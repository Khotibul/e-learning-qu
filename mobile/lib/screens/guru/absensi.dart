import 'dart:async';

import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../widgets/verifikasi_widget.dart';

class GuruAbsensi extends StatefulWidget {
  const GuruAbsensi({super.key});
  @override
  State<GuruAbsensi> createState() => _GuruAbsensiState();
}

class _GuruAbsensiState extends State<GuruAbsensi> {
  String tanggal = DateTime.now().toIso8601String().split("T")[0];
  List<dynamic> sesi = [];
  List<dynamic> filteredSesi = [];
  Map<String, dynamic> kebijakan = {};
  bool loading = true;
  String jamSekarang = "";
  String? actingId;
  Timer? _pollTimer;
  Timer? _clockTimer;
  final searchCtrl = TextEditingController();

  // absensi harian guru sendiri (legacy 1x sehari)
  String guruStatus = "HADIR";
  bool guruSaved = false;
  bool savingGuru = false;

  // status verifikasi per sesi (foto/GPS/sidik jari) — parent sebagai pemilik state
  final Map<String, VerifState> _verif = {};

  VerifState _verifSesi(String jadwalId) =>
      _verif.putIfAbsent(jadwalId, () => VerifState());

  // riwayat
  String bulan = DateTime.now().toIso8601String().substring(0, 7);
  List<dynamic> riwayat = [];
  Map<String, dynamic> rekap = {};

  @override
  void initState() {
    super.initState();
    searchCtrl.addListener(_filter);
    _load();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) => _load(silent: true));
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        final n = DateTime.now();
        setState(() {
          jamSekarang =
              "${n.hour.toString().padLeft(2, '0')}:${n.minute.toString().padLeft(2, '0')}:${n.second.toString().padLeft(2, '0')}";
        });
      }
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _clockTimer?.cancel();
    searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent && mounted) setState(() => loading = true);
    try {
      final v = await ApiService.get("/api/mobile/guru/absensi-sesi?tanggal=$tanggal");
      final gAbs = await ApiService.get("/api/mobile/guru/absensi?tanggal=$tanggal").catchError((_) => null);
      if (mounted) {
        setState(() {
          sesi = (v is Map ? (v["sesi"] as List? ?? []) : []) as List;
          kebijakan = (v is Map ? (v["kebijakan"] as Map? ?? {}) : {}) as Map<String, dynamic>;
          filteredSesi = sesi;
          if (gAbs is Map && gAbs["status"] != null) {
            guruStatus = gAbs["status"];
            guruSaved = true;
          } else {
            guruSaved = false;
          }
          if (!silent) loading = false;
        });
        _filter();
      }
    } catch (_) {
      if (mounted && !silent) setState(() => loading = false);
    }
  }

  Future<void> _loadRiwayat() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/absensi-sesi?view=rekap&bulan=$bulan");
      if (mounted && v is Map) {
        setState(() {
          riwayat = (v["riwayat"] as List? ?? []) as List;
          rekap = (v["rekap"] as Map? ?? {}) as Map<String, dynamic>;
        });
      }
    } catch (_) {}
  }

  void _filter() {
    final q = searchCtrl.text.toLowerCase();
    setState(() {
      filteredSesi = q.isEmpty
          ? sesi
          : sesi.where((s) {
              final kelas = (s["kelasNama"] ?? "").toString().toLowerCase();
              final mapel = (s["mataPelajaranNama"] ?? "").toString().toLowerCase();
              return kelas.contains(q) || mapel.contains(q);
            }).toList();
    });
  }

  String _metodeSesi(Map s) {
    final m = (s["metode"] ?? kebijakan["metode"] ?? "TANPA").toString();
    return m.isEmpty ? "TANPA" : m;
  }

  /// Verifikasi lengkap sesuai metode & fase? (foto hanya saat masuk, GPS+sidik dua fase)
  bool _verifLengkap(Map s, String fase) {
    final m = _metodeSesi(s);
    if (m == "TANPA") return true;
    final v = _verifSesi((s["jadwalId"] ?? "").toString());
    if (butuhFoto(m, fase) && fase == "MASUK" && v.fotoUrl == null) return false;
    if (butuhGps(m) && v.jarakMeter == null) return false;
    if (butuhSidik(m) && !v.sidikOk) return false;
    return true;
  }

  Future<void> _aksi(String action, Map s, {String? keterangan}) async {
    setState(() => actingId = s["jadwalId"]);
    try {
      await ApiService.post("/api/mobile/guru/absensi-sesi", {
        "action": action,
        "jadwalPelajaranId": s["jadwalId"],
        "tanggal": tanggal,
        if (keterangan != null) "keterangan": keterangan,
        if (action == "masuk" || action == "selesai")
          "verifikasi": _verifSesi((s["jadwalId"] ?? "").toString()).toJson(),
      });
      if (mounted) {
        final pesan = action == "masuk"
            ? "Absen masuk tersimpan"
            : action == "selesai"
                ? "Sesi mengajar ditutup"
                : "Status ${action.toUpperCase()} tersimpan";
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(pesan)));
      }
      await _load(silent: true);
    } catch (e) {
      final msg = e.toString().replaceFirst("Exception: ", "");
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => actingId = null);
    }
  }

  Future<void> _ajukanPengecualian(Map s) async {
    final v = _verifSesi((s["jadwalId"] ?? "").toString());
    String jenis = v.jarakMeter == null && !v.sidikOk
        ? "LOKASI"
        : v.jarakMeter == null
            ? "LOKASI"
            : !v.sidikOk
                ? "BIOMETRIK"
                : "FOTO";
    final alasanCtrl = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) => AlertDialog(
          title: const Text("Pengajuan Pengecualian", style: TextStyle(fontSize: 15)),
          content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text("Butuh persetujuan Admin sebelum absen dapat dilanjutkan.", style: TextStyle(fontSize: 12)),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: jenis,
              decoration: InputDecoration(
                labelText: "Jenis",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              items: const [
                DropdownMenuItem(value: "LOKASI", child: Text("Lokasi (di luar radius / GPS bermasalah)", style: TextStyle(fontSize: 13))),
                DropdownMenuItem(value: "BIOMETRIK", child: Text("Biometrik (sidik jari tidak tersedia)", style: TextStyle(fontSize: 13))),
                DropdownMenuItem(value: "FOTO", child: Text("Foto (kamera tidak tersedia)", style: TextStyle(fontSize: 13))),
              ],
              onChanged: (val) => setD(() => jenis = val ?? "LOKASI"),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: alasanCtrl,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: "Alasan (min. 5 karakter)",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
            ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Ajukan")),
          ],
        ),
      ),
    );
    if (ok != true) return;

    try {
      await ApiService.post("/api/mobile/guru/pengecualian", {
        "jenis": jenis,
        "alasan": alasanCtrl.text.trim(),
        "tanggal": tanggal,
        "jadwalPelajaranId": s["jadwalId"],
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Pengecualian diajukan — menunggu persetujuan Admin")));
      }
    } catch (e) {
      final msg = e.toString().replaceFirst("Exception: ", "");
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  Future<void> _saveGuruAbsensi() async {
    setState(() => savingGuru = true);
    try {
      await ApiService.post("/api/mobile/guru/absensi", {"tanggal": tanggal, "status": guruStatus});
      if (mounted) {
        setState(() => guruSaved = true);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Absensi Anda tersimpan — 1x per hari")));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Gagal: $e")));
    } finally {
      if (mounted) setState(() => savingGuru = false);
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case "HADIR":
        return const Color(0xFF10B981);
      case "TERLAMBAT":
        return const Color(0xFFF59E0B);
      case "IZIN":
        return const Color(0xFF0EA5E9);
      case "SAKIT":
        return const Color(0xFF8B5CF6);
      case "TIDAK_HADIR":
        return const Color(0xFFEF4444);
      default:
        return const Color(0xFF64748B);
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case "HADIR":
        return "Hadir";
      case "TERLAMBAT":
        return "Terlambat";
      case "IZIN":
        return "Izin";
      case "SAKIT":
        return "Sakit";
      case "TIDAK_HADIR":
        return "Tidak Hadir";
      default:
        return "Belum Absen";
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text("Absensi"),
          backgroundColor: Colors.white,
          elevation: 0,
          bottom: const TabBar(
            labelColor: Color(0xFF4F46E5),
            unselectedLabelColor: Color(0xFF64748B),
            indicatorColor: Color(0xFF4F46E5),
            tabs: [
              Tab(text: "Sesi Mengajar"),
              Tab(text: "Absensi Siswa"),
              Tab(text: "Riwayat"),
            ],
          ),
        ),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(children: [_sesiTab(), _siswaTab(), _riwayatTab()]),
      ),
    );
  }

  Widget _tanggalCard() => Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            const Icon(Icons.calendar_today_outlined, size: 18, color: Color(0xFF4F46E5)),
            const SizedBox(width: 8),
            const Text("Tanggal:", style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const Spacer(),
            Text(tanggal, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
            IconButton(
              icon: const Icon(Icons.edit, size: 16),
              onPressed: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: DateTime.parse(tanggal),
                  firstDate: DateTime(2024),
                  lastDate: DateTime(2027),
                );
                if (picked != null) {
                  setState(() => tanggal = picked.toIso8601String().split("T")[0]);
                  _load();
                }
              },
            ),
            const SizedBox(width: 4),
            const Icon(Icons.access_time, size: 16, color: Color(0xFF64748B)),
            const SizedBox(width: 4),
            Text(jamSekarang, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, fontFeatures: [])),
          ]),
        ),
      );

  Widget _guruHadirCard() => Card(
        color: guruSaved ? const Color(0xFFF0FDF4) : Colors.white,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: guruSaved ? const Color(0xFFBBF7D0) : const Color(0xFFE2E8F0))),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: const Color(0xFF4F46E5).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.verified_user_outlined, size: 16, color: Color(0xFF4F46E5))),
              const SizedBox(width: 8),
              const Text("Kehadiran Anda (harian)", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const Spacer(),
              if (guruSaved)
                Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFF10B981), borderRadius: BorderRadius.circular(20)),
                    child: const Text("Tersimpan", style: TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold))),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: guruStatus,
                  decoration: InputDecoration(
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
                  items: ["HADIR", "IZIN", "SAKIT", "ALPA"]
                      .map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 13))))
                      .toList(),
                  onChanged: guruSaved ? null : (v) => setState(() => guruStatus = v!),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 40,
                child: FilledButton(
                  onPressed: guruSaved || savingGuru ? null : _saveGuruAbsensi,
                  style: FilledButton.styleFrom(backgroundColor: guruSaved ? const Color(0xFF10B981) : const Color(0xFF4F46E5)),
                  child: savingGuru
                      ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(guruSaved ? "Tersimpan" : "Simpan", style: const TextStyle(fontSize: 12)),
                ),
              ),
            ]),
          ]),
        ),
      );

  Widget _sesiTab() {
    final summary = <String, int>{"Hadir": 0, "Terlambat": 0, "Belum": 0, "Tidak Hadir": 0};
    for (final s in sesi) {
      final st = (s["status"] ?? "BELUM_ABSEN").toString();
      if (st == "HADIR") summary["Hadir"] = (summary["Hadir"] ?? 0) + 1;
      if (st == "TERLAMBAT") summary["Terlambat"] = (summary["Terlambat"] ?? 0) + 1;
      if (st == "BELUM_ABSEN") summary["Belum"] = (summary["Belum"] ?? 0) + 1;
      if (st == "TIDAK_HADIR") summary["Tidak Hadir"] = (summary["Tidak Hadir"] ?? 0) + 1;
    }
    return RefreshIndicator(
      onRefresh: () => _load(),
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _tanggalCard(),
          const SizedBox(height: 10),
          _guruHadirCard(),
          const SizedBox(height: 10),
          if (kebijakan.isNotEmpty)
            Text(
              "Kebijakan Admin: metode ${kebijakan["metode"] ?? "TANPA"} • toleransi terlambat ${kebijakan["toleransiTerlambatMenit"] ?? 15} menit • Tidak Hadir otomatis ${kebijakan["autoTidakHadirSetelahMenit"] ?? 60} menit setelah sesi berakhir"
              "${((kebijakan["lokasi"] ?? {}) as Map)["gpsWajib"] == true ? " • lokasi wajib radius ${((kebijakan["lokasi"] ?? {}) as Map)["radiusMeter"] ?? 100} m" : ""}",
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
          const SizedBox(height: 10),
          TextField(
            controller: searchCtrl,
            decoration: InputDecoration(
              hintText: "Cari kelas atau mapel...",
              prefixIcon: const Icon(Icons.search, size: 18),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          const SizedBox(height: 10),
          Wrap(spacing: 6, runSpacing: 6, children: [
            _chip("Sesi: ${sesi.length}", const Color(0xFF64748B)),
            _chip("Hadir ${summary["Hadir"]}", const Color(0xFF10B981)),
            _chip("Terlambat ${summary["Terlambat"]}", const Color(0xFFF59E0B)),
            _chip("Belum ${summary["Belum"]}", const Color(0xFF64748B)),
            _chip("Tidak Hadir ${summary["Tidak Hadir"]}", const Color(0xFFEF4444)),
          ]),
          const SizedBox(height: 10),
          if (filteredSesi.isEmpty)
            const Card(child: Padding(padding: EdgeInsets.all(16), child: Center(child: Text("Tidak ada jadwal mengajar", style: TextStyle(color: Colors.black54)))))
          else
            ...filteredSesi.map((s) => _sesiCard(s)),
        ],
      ),
    );
  }

  Widget _chip(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
        child: Text(text, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
      );

  Widget _sesiCard(Map s) {
    final status = (s["status"] ?? "BELUM_ABSEN").toString();
    final fase = (s["fase"] ?? "").toString();
    final sudahMasuk = s["jamMasuk"] != null;
    final sudahSelesai = s["jamKeluar"] != null;
    final busy = actingId == s["jadwalId"];
    final bisaAbsen = status == "BELUM_ABSEN" && !sudahMasuk && fase != "SEBELUM";
    final skolor = _statusColor(status);

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Text("${s["kelasNama"]} • ${s["mataPelajaranNama"]}",
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: skolor.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(20)),
              child: Text(
                status == "TERLAMBAT" && (s["terlambatMenit"] ?? 0) > 0
                    ? "${_statusLabel(status)} +${s["terlambatMenit"]}m"
                    : _statusLabel(status),
                style: TextStyle(fontSize: 10, color: skolor, fontWeight: FontWeight.bold),
              ),
            ),
          ]),
          const SizedBox(height: 6),
          Wrap(spacing: 10, runSpacing: 4, children: [
            _meta(Icons.schedule, "${s["jamMulai"]} - ${s["jamSelesai"]}"),
            if (fase == "AKTIF") _meta(Icons.play_circle, "Sedang berlangsung"),
            if (sudahMasuk) _meta(Icons.login, "Masuk ${s["jamMasuk"]}"),
            if (sudahSelesai) _meta(Icons.logout, "Selesai ${s["jamKeluar"]}${s["durasiMenit"] != null ? " (${s["durasiMenit"]} mnt)" : ""}"),
            if ((s["terlambatMenit"] ?? 0) > 0) _meta(Icons.warning_amber, "Terlambat ${s["terlambatMenit"]} menit"),
            if (s["penggantiNama"] != null) _meta(Icons.swap_horiz, "Pengganti: ${s["penggantiNama"]}"),
          ]),
          if (s["koreksiAlasan"] != null) ...[
            const SizedBox(height: 4),
            Text("Koreksi Admin: ${s["koreksiAlasan"]}", style: const TextStyle(fontSize: 11, color: Color(0xFFF59E0B))),
          ],
          if (fase != "SEBELUM" && status == "BELUM_ABSEN")
            VerifikasiWidget(
              metode: _metodeSesi(s),
              kebijakan: kebijakan,
              fase: sudahMasuk ? "SELESAI" : "MASUK",
              state: _verifSesi((s["jadwalId"] ?? "").toString()),
              onChange: (_) => setState(() {}),
              busy: busy,
              onAjukanPengecualian: () => _ajukanPengecualian(s),
            ),
          const SizedBox(height: 10),
          Wrap(spacing: 8, runSpacing: 8, children: [
            if (!sudahSelesai)
              FilledButton.icon(
                onPressed: busy || !bisaAbsen || !_verifLengkap(s, "MASUK")
                    ? null
                    : () => _aksi("masuk", s),
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFF4F46E5)),
                icon: busy
                    ? const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.login, size: 15),
                label: const Text("Absen Masuk", style: TextStyle(fontSize: 12)),
              ),
            if (!sudahSelesai && sudahMasuk)
              FilledButton.icon(
                onPressed: busy || !_verifLengkap(s, "SELESAI") ? null : () => _aksi("selesai", s),
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
                icon: busy
                    ? const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.logout, size: 15),
                label: const Text("Absen Selesai Mengajar", style: TextStyle(fontSize: 12)),
              ),
            if (sudahSelesai)
              Chip(
                avatar: const Icon(Icons.check_circle, size: 14, color: Color(0xFF10B981)),
                label: const Text("Sesi selesai", style: TextStyle(fontSize: 11)),
                backgroundColor: const Color(0xFF10B981).withValues(alpha: 0.12),
                visualDensity: VisualDensity.compact,
              ),
            if (!sudahMasuk && fase != "SEBELUM" && status == "BELUM_ABSEN") ...[
              OutlinedButton(onPressed: busy ? null : () => _aksi("izin", s), child: const Text("Izin", style: TextStyle(fontSize: 12))),
              OutlinedButton(
                  onPressed: busy ? null : () => _aksi("sakit", s),
                  child: const Text("Sakit", style: TextStyle(fontSize: 12))),
            ],
          ]),
        ]),
      ),
    );
  }

  Widget _meta(IconData icon, String text) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 13, color: const Color(0xFF64748B)),
        const SizedBox(width: 3),
        Text(text, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
      ]);

  // ─── TAB: ABSENSI SISWA PER MAPEL (sesuai website) ────────────────
  Widget _siswaTab() {
    final jadwal = sesi;
    if (jadwal.isEmpty) {
      return const Center(child: Text("Tidak ada jadwal hari ini", style: TextStyle(color: Colors.black54)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: jadwal.length,
      itemBuilder: (_, i) {
        final j = jadwal[i] as Map;
        return Card(
          child: ListTile(
            leading: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: const Color(0xFF4F46E5).withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.class_outlined, size: 16, color: Color(0xFF4F46E5)),
            ),
            title: Text(j["mataPelajaranNama"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            subtitle: Text("${j["kelasNama"]} • ${j["jamMulai"]}-${j["jamSelesai"]}", style: const TextStyle(fontSize: 11, color: Colors.black54)),
            trailing: const Icon(Icons.chevron_right, size: 16, color: Color(0xFF94A3B8)),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => _MuridAbsensiPage(
                  kelasId: j["kelasId"],
                  kelasNama: j["kelasNama"],
                  mataPelajaranId: j["mataPelajaranId"],
                  mataPelajaranNama: j["mataPelajaranNama"],
                  tanggal: tanggal,
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  // ─── TAB: RIWAYAT + REKAP BULANAN ─────────────────────────────────
  Widget _riwayatTab() {
    return RefreshIndicator(
      onRefresh: _loadRiwayat,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                const Icon(Icons.date_range, size: 18, color: Color(0xFF4F46E5)),
                const SizedBox(width: 8),
                const Text("Bulan:", style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    initialValue: bulan,
                    key: ValueKey(bulan),
                    decoration: InputDecoration(
                        hintText: "YYYY-MM",
                        isDense: true,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                    onFieldSubmitted: (v) {
                      if (RegExp(r"^\d{4}-\d{2}$").hasMatch(v)) {
                        setState(() => bulan = v);
                        _loadRiwayat();
                      }
                    },
                  ),
                ),
                IconButton(
                    icon: const Icon(Icons.refresh, size: 18),
                    onPressed: () {
                      setState(() => bulan = DateTime.now().toIso8601String().substring(0, 7));
                      _loadRiwayat();
                    }),
              ]),
            ),
          ),
          const SizedBox(height: 10),
          if (rekap.isNotEmpty)
            Wrap(spacing: 6, runSpacing: 6, children: [
              _chip("Sesi: ${rekap["totalSesi"] ?? 0}", const Color(0xFF64748B)),
              _chip("Hadir ${rekap["hadir"] ?? 0}", const Color(0xFF10B981)),
              _chip("Terlambat ${rekap["terlambat"] ?? 0}", const Color(0xFFF59E0B)),
              _chip("Izin ${rekap["izin"] ?? 0}", const Color(0xFF0EA5E9)),
              _chip("Sakit ${rekap["sakit"] ?? 0}", const Color(0xFF8B5CF6)),
              _chip("Tidak Hadir ${rekap["tidakHadir"] ?? 0}", const Color(0xFFEF4444)),
              _chip("Kehadiran ${rekap["rataKehadiranPersen"] ?? 0}%", const Color(0xFF4F46E5)),
            ]),
          const SizedBox(height: 10),
          if (riwayat.isEmpty)
            const Card(child: Padding(padding: EdgeInsets.all(16), child: Center(child: Text("Belum ada riwayat", style: TextStyle(color: Colors.black54)))))
          else
            ...riwayat.map((r) {
              final m = r as Map;
              final j = (m["jadwal"] ?? {}) as Map;
              final kelas = (j["kelas"] ?? {}) as Map;
              final mapel = (j["mataPelajaran"] ?? {}) as Map;
              final st = (m["status"] ?? "BELUM_ABSEN").toString();
              return Card(
                child: ListTile(
                  dense: true,
                  title: Text("${kelas["nama"] ?? "-"} • ${mapel["nama"] ?? "-"}",
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  subtitle: Text(
                      "${j["jamMulai"] ?? ""}-${j["jamSelesai"] ?? ""} • masuk ${m["jamMasuk"] ?? "-"} • selesai ${m["jamSelesai"] ?? "-"}",
                      style: const TextStyle(fontSize: 11)),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: _statusColor(st).withValues(alpha: 0.14), borderRadius: BorderRadius.circular(20)),
                    child: Text(_statusLabel(st), style: TextStyle(fontSize: 10, color: _statusColor(st), fontWeight: FontWeight.bold)),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

}

// ─── ABSENSI SISWA PER KELOMPOK MAPEL ─────────────────────────────
class _MuridAbsensiPage extends StatefulWidget {
  final String kelasId;
  final String kelasNama;
  final String mataPelajaranId;
  final String mataPelajaranNama;
  final String tanggal;
  const _MuridAbsensiPage({
    required this.kelasId,
    required this.kelasNama,
    required this.mataPelajaranId,
    required this.mataPelajaranNama,
    required this.tanggal,
  });
  @override
  State<_MuridAbsensiPage> createState() => _MuridAbsensiPageState();
}

class _MuridAbsensiPageState extends State<_MuridAbsensiPage> {
  List<dynamic> siswas = [];
  List<dynamic> filtered = [];
  Map<String, String> statusMap = {};
  bool loading = true;
  bool saving = false;
  bool saved = false;
  final searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    searchCtrl.addListener(_filter);
    _load();
  }

  @override
  void dispose() {
    searchCtrl.dispose();
    super.dispose();
  }

  void _filter() {
    final q = searchCtrl.text.toLowerCase();
    setState(() {
      filtered = q.isEmpty
          ? siswas
          : siswas.where((s) => (s["nama"] ?? "").toString().toLowerCase().contains(q) || (s["nis"] ?? "").toString().toLowerCase().contains(q)).toList();
    });
  }

  Future<void> _load() async {
    try {
      final data = await ApiService.get(
          "/api/mobile/guru/absensi/siswa?kelasId=${widget.kelasId}&mataPelajaranId=${widget.mataPelajaranId}&tanggal=${widget.tanggal}");
      if (mounted) {
        setState(() {
          siswas = (data["siswas"] as List? ?? []) as List;
          filtered = siswas;
          for (var s in siswas) {
            statusMap[s["siswaId"] ?? s["id"]] = s["status"] ?? "HADIR";
          }
          saved = data["absensi"] != null;
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => saving = true);
    try {
      final siswaStatus = statusMap.entries.map((e) => {"siswaId": e.key, "status": e.value}).toList();
      await ApiService.post("/api/mobile/guru/absensi/siswa", {
        "kelasId": widget.kelasId,
        "mataPelajaranId": widget.mataPelajaranId,
        "tanggal": widget.tanggal,
        "siswaStatus": siswaStatus,
      });
      if (mounted) {
        setState(() => saved = true);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Absensi siswa tersimpan — 1x per mapel per hari")));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Gagal: $e")));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text("${widget.kelasNama} • ${widget.mataPelajaranNama}", style: const TextStyle(fontSize: 15)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: TextField(
                  controller: searchCtrl,
                  decoration: InputDecoration(
                    hintText: "Cari siswa (nama/NIS)...",
                    prefixIcon: const Icon(Icons.search, size: 18),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: saved
                          ? null
                          : () => setState(() {
                                for (var s in siswas) {
                                  statusMap[s["siswaId"] ?? s["id"]] = "HADIR";
                                }
                              }),
                      child: const Text("Semua Hadir", style: TextStyle(fontSize: 12)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton(
                      onPressed: saving ? null : _save,
                      style: FilledButton.styleFrom(backgroundColor: saved ? const Color(0xFF10B981) : const Color(0xFF4F46E5)),
                      child: saving
                          ? const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(saved ? "Tersimpan (bisa ubah)" : "Simpan", style: const TextStyle(fontSize: 12)),
                    ),
                  ),
                ]),
              ),
              const SizedBox(height: 4),
              Text("${filtered.length} siswa ditampilkan", style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              Expanded(
                child: filtered.isEmpty
                    ? const Center(child: Text("Tidak ada siswa", style: TextStyle(color: Colors.black54)))
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: filtered.length,
                        itemBuilder: (_, i) {
                          final s = filtered[i];
                          final id = s["siswaId"] ?? s["id"];
                          return Card(
                            child: ListTile(
                              dense: true,
                              title: Text(s["nama"] ?? "-", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                              subtitle: Text(s["nis"] ?? "", style: const TextStyle(fontSize: 11)),
                              trailing: DropdownButton<String>(
                                value: statusMap[id] ?? "HADIR",
                                items: ["HADIR", "SAKIT", "IZIN", "ALPA"]
                                    .map((v) => DropdownMenuItem(value: v, child: Text(v, style: const TextStyle(fontSize: 12))))
                                    .toList(),
                                onChanged: (v) => setState(() {
                                  statusMap[id] = v!;
                                  saved = false;
                                }),
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ]),
    );
  }
}
