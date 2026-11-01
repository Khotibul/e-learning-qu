import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Monitoring kehadiran siswa — mirror web /siswa/kehadiran.
/// Absensi harian fingerprint (masuk/pulang) + absensi per mata pelajaran
/// + pengajuan verifikasi manual. Data dari /api/mobile/siswa/kehadiran.
class SiswaKehadiran extends StatefulWidget {
  const SiswaKehadiran({super.key});
  @override
  State<SiswaKehadiran> createState() => _SiswaKehadiranState();
}

class _SiswaKehadiranState extends State<SiswaKehadiran> {
  bool loading = true;
  String? error;
  Map<String, dynamic>? data;
  DateTime bulan = DateTime(DateTime.now().year, DateTime.now().month);
  bool mengajukan = false;

  static String _ym(DateTime d) => "${d.year}-${d.month.toString().padLeft(2, "0")}";

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/siswa/kehadiran?bulan=${_ym(bulan)}", useCache: false);
      if (mounted) setState(() { data = v is Map ? Map<String, dynamic>.from(v) : null; loading = false; error = null; });
    } catch (e) {
      if (mounted) setState(() { loading = false; error = e.toString(); });
    }
  }

  Future<void> _gantiBulan(int delta) async {
    setState(() { loading = true; bulan = DateTime(bulan.year, bulan.month + delta); });
    await _load();
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  Future<void> _ajukanManual() async {
    final form = await showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _FormManual(),
    );
    if (form == null) return;
    setState(() => mengajukan = true);
    try {
      await ApiService.post("/api/mobile/siswa/kehadiran", form);
      _snack("Permintaan diajukan — menunggu persetujuan Admin");
      await _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => mengajukan = false);
    }
  }

  Color _statusColor(String? s) {
    if (s == "TERLAMBAT") return const Color(0xFFF59E0B);
    if (s == "AWAL") return const Color(0xFFEF4444);
    if (s == "HADIR" || s == "NORMAL") return const Color(0xFF10B981);
    return const Color(0xFF94A3B8);
  }

  Color _pelajaranColor(String? s) {
    switch (s) {
      case "HADIR": return const Color(0xFF10B981);
      case "TERLAMBAT": return const Color(0xFFF59E0B);
      case "IZIN": return const Color(0xFF0EA5E9);
      case "SAKIT": return const Color(0xFF8B5CF6);
      default: return const Color(0xFFEF4444);
    }
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 3,
    child: Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text("Monitoring Kehadiran"),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: "Muat ulang",
            icon: const Icon(Icons.refresh, size: 20),
            onPressed: loading ? null : () { setState(() => loading = true); _load(); },
          ),
        ],
        bottom: const TabBar(
          isScrollable: true,
          labelColor: Color(0xFF4F46E5),
          unselectedLabelColor: Color(0xFF64748B),
          tabs: [Tab(text: "Riwayat Fingerprint"), Tab(text: "Per Pelajaran"), Tab(text: "Permintaan Manual")],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: mengajukan ? null : _ajukanManual,
        backgroundColor: const Color(0xFF4F46E5),
        icon: mengajukan
            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.schedule, size: 18),
        label: const Text("Verifikasi Manual", style: TextStyle(fontSize: 12)),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text("Gagal memuat: $error", textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFFEF4444)))))
              : _buildBody(),
    ),
  );

  Widget _buildBody() {
    final d = data ?? {};
    final hariIni = (d["hariIni"] as Map?) ?? {};
    final kebijakan = (d["kebijakan"] as Map?) ?? {};
    final rekap = (d["rekap"] as Map?) ?? {};
    final rows = (d["rows"] as List?) ?? [];
    final pelajaran = (d["pelajaran"] as List?) ?? [];
    final permintaan = (d["permintaan"] as List?) ?? [];
    final adaMenunggu = permintaan.any((p) => (p as Map)["status"] == "MENUNGGU");
    final jamMasuk = hariIni["jamMasuk"];
    final jamPulang = hariIni["jamPulang"];

    return RefreshIndicator(
      onRefresh: _load,
      child: TabBarView(
        children: [
          ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
            children: [
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                childAspectRatio: 1.5,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                children: [
                  _box("Absen Masuk", jamMasuk ?? "--:--", jamMasuk == null ? "BELUM SCAN" : (hariIni["statusMasuk"] == "TERLAMBAT" ? "TERLAMBAT ${hariIni["terlambatMenit"]} MENIT" : "HADIR"), _statusColor(hariIni["statusMasuk"] as String?), icon: Icons.login),
                  _box("Absen Pulang", jamPulang ?? "--:--", jamPulang == null ? "BELUM SCAN" : (hariIni["statusPulang"] == "AWAL" ? "PULANG AWAL" : "PULANG NORMAL"), _statusColor(hariIni["statusPulang"] as String?), icon: Icons.logout),
                  _box("Kehadiran Bulan Ini", "${rekap["persenKehadiran"] ?? 0}%", "${rekap["hadir"] ?? 0} hadir • ${rekap["terlambat"] ?? 0} terlambat dari ${d["hariSekolah"] ?? 0} hari", const Color(0xFF4F46E5), icon: Icons.insights),
                  _box("Kebijakan Sekolah", "Masuk ≤ ${kebijakan["jamMasuk"] ?? "07:00"}", "Pulang ≥ ${kebijakan["jamPulang"] ?? "15:00"} • toleransi ${kebijakan["toleransiMasukMenit"] ?? 15} mnt", const Color(0xFF0EA5E9), icon: Icons.policy_outlined),
                ],
              ),
              if (adaMenunggu) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFFDE68A))),
                  child: const Row(children: [
                    Icon(Icons.warning_amber, size: 16, color: Color(0xFFB45309)),
                    SizedBox(width: 6),
                    Expanded(child: Text("Ada permintaan verifikasi manual yang masih menunggu persetujuan Admin.", style: TextStyle(fontSize: 12, color: Color(0xFF92400E)))),
                  ]),
                ),
              ],
              const SizedBox(height: 14),
              Row(children: [
                IconButton(onPressed: () => _gantiBulan(-1), icon: const Icon(Icons.chevron_left)),
                Expanded(child: Text(_namaBulan(bulan), textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                IconButton(onPressed: () => _gantiBulan(1), icon: const Icon(Icons.chevron_right)),
              ]),
              Card(
                child: rows.isEmpty
                    ? const Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada absensi fingerprint", style: TextStyle(color: Colors.black54))))
                    : Column(children: rows.map((r) {
                        final m = r as Map;
                        return ListTile(
                          dense: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                          leading: Text("${m["tanggal"]}".substring(5), style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                          title: Row(children: [
                            Text("Masuk ${m["jamMasuk"] ?? "-"}", style: const TextStyle(fontSize: 12)),
                            const SizedBox(width: 8),
                            _chip(m["jamMasuk"] == null ? "BELUM" : (m["statusMasuk"] == "TERLAMBAT" ? "TERLAMBAT ${m["terlambatMenit"]}M" : "HADIR"), _statusColor(m["statusMasuk"] as String?)),
                          ]),
                          subtitle: Row(children: [
                            Text("Pulang ${m["jamPulang"] ?? "-"}  ", style: const TextStyle(fontSize: 11)),
                            _chip(m["jamPulang"] == null ? "BELUM" : (m["statusPulang"] == "AWAL" ? "AWAL" : "NORMAL"), _statusColor(m["statusPulang"] as String?)),
                            const SizedBox(width: 6),
                            Expanded(child: Text("${m["sumber"] ?? "-"}", maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10))),
                          ]),
                        );
                      }).toList()),
              ),
            ],
          ),
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: pelajaran.isEmpty
                    ? const Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada absensi per pelajaran", style: TextStyle(color: Colors.black54))))
                    : Column(children: pelajaran.map((p) {
                        final m = p as Map;
                        return ListTile(
                          dense: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                          title: Text("${m["mataPelajaran"] ?? "-"}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          subtitle: Text("${m["tanggal"]} • ${m["keterangan"] ?? "-"}", style: const TextStyle(fontSize: 11)),
                          trailing: _chip("${m["status"] ?? "-"}", _pelajaranColor(m["status"] as String?)),
                        );
                      }).toList()),
              ),
              const SizedBox(height: 8),
              const Text(
                "Catatan: absensi masuk sekolah tidak otomatis membuat Anda hadir pada setiap mata pelajaran — guru tetap mengabsensi per sesi.",
                style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
            ],
          ),
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: permintaan.isEmpty
                    ? const Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada permintaan", style: TextStyle(color: Colors.black54))))
                    : Column(children: permintaan.map((p) {
                        final m = p as Map;
                        final status = "${m["status"]}";
                        final color = status == "DISETUJUI" ? const Color(0xFF10B981) : status == "DITOLAK" ? const Color(0xFFEF4444) : const Color(0xFFF59E0B);
                        return ListTile(
                          dense: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                          title: Text("${m["tanggal"]} • ${m["tipe"]}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          subtitle: Text("${m["alasan"]}\nCatatan admin: ${m["catatanAdmin"] ?? "-"}", style: const TextStyle(fontSize: 11)),
                          isThreeLine: true,
                          trailing: _chip(status, color),
                        );
                      }).toList()),
              ),
              const SizedBox(height: 8),
              const Text("Gunakan tombol Verifikasi Manual bila fingerprint gagal/tidak dikenal. Perlu persetujuan Admin sebelum dicatat.", style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
            ],
          ),
        ],
      ),
    );
  }

  static String _namaBulan(DateTime d) {
    const n = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return "${n[d.month - 1]} ${d.year}";
  }

  Widget _box(String label, String value, String sub, Color color, {required IconData icon}) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Icon(icon, size: 14, color: color), const SizedBox(width: 6), Expanded(child: Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))))]),
      const SizedBox(height: 4),
      FittedBox(child: Text(value, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: color))),
      Text(sub, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
    ]),
  );

  Widget _chip(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
    child: Text(text, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color)),
  );
}

class _FormManual extends StatefulWidget {
  const _FormManual();
  @override
  State<_FormManual> createState() => _FormManualState();
}

class _FormManualState extends State<_FormManual> {
  DateTime tanggal = DateTime.now();
  String tipe = "MASUK";
  final alasan = TextEditingController();

  @override
  void dispose() { alasan.dispose(); super.dispose(); }

  Future<void> _pilihTanggal() async {
    final d = await showDatePicker(
      context: context,
      initialDate: tanggal,
      firstDate: DateTime(DateTime.now().year - 1),
      lastDate: DateTime.now(),
    );
    if (d != null) setState(() => tanggal = d);
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 16, right: 16, top: 16),
    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text("Ajukan Verifikasi Manual", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
      const SizedBox(height: 4),
      const Text("Gunakan bila fingerprint gagal/tidak dikenal. Perlu persetujuan Admin sebelum dicatat.", style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
      const SizedBox(height: 12),
      Row(children: [
        Expanded(child: OutlinedButton.icon(onPressed: _pilihTanggal, icon: const Icon(Icons.calendar_today, size: 15), label: Text(_fmt(tanggal), style: const TextStyle(fontSize: 12)))),
        const SizedBox(width: 8),
        Expanded(child: DropdownButtonFormField<String>(
          initialValue: tipe,
          decoration: const InputDecoration(labelText: "Tipe", isDense: true, border: OutlineInputBorder()),
          items: const [DropdownMenuItem(value: "MASUK", child: Text("Absen Masuk")), DropdownMenuItem(value: "PULANG", child: Text("Absen Pulang"))],
          onChanged: (v) => setState(() => tipe = v ?? "MASUK"),
        )),
      ]),
      const SizedBox(height: 10),
      TextField(controller: alasan, maxLines: 3, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: "Alasan (min. 5 karakter)", hintText: "misal: sensor fingerprint tidak membaca sidik jari saya", border: OutlineInputBorder(), isDense: true)),
      const SizedBox(height: 12),
      FilledButton(
        onPressed: alasan.text.trim().length < 5
            ? null
            : () => Navigator.pop(context, {"tanggal": _ymd(tanggal), "tipe": tipe, "alasan": alasan.text.trim()}),
        child: const Text("Ajukan Permintaan"),
      ),
      const SizedBox(height: 8),
    ]),
  );

  static String _ymd(DateTime d) => "${d.year}-${d.month.toString().padLeft(2, "0")}-${d.day.toString().padLeft(2, "0")}";
  static String _fmt(DateTime d) => "${d.day.toString().padLeft(2, "0")}/${d.month.toString().padLeft(2, "0")}/${d.year}";
}
