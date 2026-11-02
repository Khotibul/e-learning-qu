import "package:flutter/material.dart";
import "package:intl/intl.dart";
import "../../services/api_service.dart";
import "surat_izin_page.dart";
import "daftar_surat_izin_page.dart";
import "../verifikasi_surat_page.dart";

/// Perizinan santri — mirror web /santri/izin.
/// Ajukan izin, simpan draft, batalkan, konfirmasi tiba di tujuan.
/// Data dari /api/mobile/siswa/izin (tabel yang sama dengan website).
class SiswaIzin extends StatefulWidget {
  const SiswaIzin({super.key});
  @override
  State<SiswaIzin> createState() => _SiswaIzinState();
}

class _SiswaIzinState extends State<SiswaIzin> {
  bool loading = true;
  String? error;
  Map<String, dynamic>? santri;
  List<dynamic> rows = [];
  List<dynamic> jenisOpts = [];
  Map<String, String> statusLabel = {};
  Map<String, String> jenisLabel = {};
  Map<String, String> keberadaanLabel = {};
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/siswa/izin", useCache: false);
      if (!mounted) return;
      if (v is Map) {
        setState(() {
          santri = v["santri"] is Map ? Map<String, dynamic>.from(v["santri"] as Map) : null;
          rows = (v["rows"] as List?) ?? [];
          jenisOpts = (v["jenisOpts"] as List?) ?? [];
          statusLabel = _strMap(v["statusLabel"]);
          jenisLabel = _strMap(v["jenisLabel"]);
          keberadaanLabel = _strMap(v["keberadaanLabel"]);
          error = null;
          loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { error = e.toString(); loading = false; });
    }
  }

  static Map<String, String> _strMap(dynamic v) => v is Map ? v.map((k, val) => MapEntry("$k", "$val")) : {};

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  int get _jumlahSurat => rows.where((r) => r is Map && ("${r["suratNomor"] ?? ""}".trim().isNotEmpty || "${r["suratToken"] ?? ""}".trim().isNotEmpty)).length;

  bool get _adaIzinAktif => rows.any((r) => const [
    "DIAJUKU", "MENUNGGU_WALI", "MENUNGGU_PENGURUS", "MENUNGGU_MUSYRIF", "MENUNGGU_KEPALA", "MENUNGGU_ADMIN", "DISETUJUI",
  ].contains("${(r as Map)["status"]}"));

  Future<void> _batalkan(String id) async {
    final ctrl = TextEditingController();
    final alasan = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Batalkan Izin"),
        content: TextField(controller: ctrl, maxLines: 3, decoration: const InputDecoration(labelText: "Alasan pembatalan (min. 5 karakter)", border: OutlineInputBorder())),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Kembali")),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            child: const Text("Batalkan Izin"),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (alasan == null) return;
    if (alasan.length < 5) { _snack("Alasan pembatalan minimal 5 karakter", color: const Color(0xFFEF4444)); return; }
    setState(() => busy = true);
    try {
      await ApiService.post("/api/mobile/siswa/izin", {"op": "batal", "izinId": id, "alasan": alasan});
      _snack("Izin dibatalkan");
      await _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _konfirmasi(String id) async {
    setState(() => busy = true);
    try {
      await ApiService.post("/api/mobile/siswa/izin", {"op": "konfirmasi", "izinId": id});
      _snack("Konfirmasi tiba di tujuan tercatat");
      await _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _ajukan(Map<String, dynamic> form) async {
    setState(() => busy = true);
    try {
      final res = await ApiService.post("/api/mobile/siswa/izin", form);
      _snack(form["op"] == "draft" ? "Draft izin tersimpan" : "Izin berhasil diajukan — menunggu persetujuan (${res["status"] ?? ""})");
      await _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 2,
    child: Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text("Perizinan Santri"),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: "Cek keaslian surat (QR)",
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const VerifikasiSuratPage())),
            icon: const Icon(Icons.verified_user_outlined, size: 20),
          ),
          IconButton(onPressed: loading ? null : _load, icon: const Icon(Icons.refresh, size: 20)),
        ],
        bottom: const TabBar(
          labelColor: Color(0xFF4F46E5),
          unselectedLabelColor: Color(0xFF64748B),
          tabs: [Tab(text: "Riwayat Izin"), Tab(text: "Ajukan Izin Baru")],
        ),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.info_outline, size: 40, color: Color(0xFF94A3B8)),
                  const SizedBox(height: 8),
                  Text(error!, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF64748B))),
                ])))
              : TabBarView(children: [_tabRiwayat(), _tabAjukan()]),
    ),
  );

  Widget _tabRiwayat() {
    final aktif = rows.cast<Map>().where((r) => const ["DISETUJUI", "MENUNGGU_WALI", "MENUNGGU_PENGURUS", "MENUNGGU_MUSYRIF", "MENUNGGU_KEPALA", "MENUNGGU_ADMIN", "DIAJUKU"].contains("${r["status"]}")).toList();
    final izinAktif = aktif.isEmpty ? null : aktif.first;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text("Status Saat Ini", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 6, children: [
                _badge("Keberadaan: ${keberadaanLabel["${santri?["keberadaan"]}"] ?? santri?["keberadaan"] ?? "-"}", const Color(0xFF0EA5E9)),
                _badge("Izin aktif: ${izinAktif == null ? "Tidak ada" : (statusLabel["${izinAktif["status"]}"] ?? "${izinAktif["status"]}")}", izinAktif == null ? const Color(0xFF94A3B8) : const Color(0xFF4F46E5)),
                _badge("${santri?["asrama"]?["nama"] ?? "-"} / ${santri?["kamar"]?["nama"] ?? "-"}", const Color(0xFF10B981)),
              ]),
              if (izinAktif != null && izinAktif["status"] == "DISETUJUI" && izinAktif["checkoutAt"] == null)
                const Padding(padding: EdgeInsets.only(top: 6), child: Text("Izin disetujui — masih di pondok sampai check-out petugas.", style: TextStyle(fontSize: 11, color: Color(0xFF059669)))),
              if (izinAktif != null && izinAktif["checkoutAt"] != null && izinAktif["checkinAt"] == null)
                Padding(padding: const EdgeInsets.only(top: 6), child: Text("Sedang keluar pondok — batas kembali ${_fmt(izinAktif["rencanaKembali"])}.", style: const TextStyle(fontSize: 11, color: Color(0xFFB45309)))),
            ]),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          child: ListTile(
            dense: true,
            leading: const Icon(Icons.description_outlined, size: 20, color: Color(0xFF4F46E5)),
            title: const Text("Surat Izin Terbit", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
            subtitle: Text(
              _jumlahSurat == 0 ? "Belum ada surat yang terbit" : "$_jumlahSurat surat — lihat daftar & status QR",
              style: const TextStyle(fontSize: 10.5),
            ),
            trailing: const Icon(Icons.chevron_right, size: 18),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => DaftarSuratIzinPage(
                  rows: rows,
                  santri: santri,
                  jenisLabel: jenisLabel,
                  statusLabel: statusLabel,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        if (rows.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada riwayat izin.", style: TextStyle(color: Colors.black54)))),
        ...rows.cast<Map>().map((r) {
          final status = "${r["status"]}";
          final color = status == "DISETUJUI" ? const Color(0xFF10B981) : status == "DITOLAK" || status == "DIBATALKAN" || status == "KEDALUWARSA" ? const Color(0xFFEF4444) : const Color(0xFFF59E0B);
          final bisaBatal = const ["DRAFT", "DIAJUKU", "MENUNGGU_WALI", "MENUNGGU_PENGURUS", "MENUNGGU_MUSYRIF", "MENUNGGU_KEPALA", "MENUNGGU_ADMIN", "DISETUJUI"].contains(status) && r["checkoutAt"] == null;
          final bisaKonfirmasi = status == "DISETUJUI" && r["checkoutAt"] != null && r["checkinAt"] == null && r["perjalananConfirmedAt"] == null;
          final bisaSurat = const ["DISETUJUI", "SELESAI"].contains(status) && r["suratToken"] != null;
          void bukaSurat() => Navigator.push(context, MaterialPageRoute(
            builder: (_) => SuratIzinPage(
              row: r,
              santri: santri,
              jenisLabel: jenisLabel,
              statusLabel: statusLabel,
            ),
          ));
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(jenisLabel["${r["jenis"]}"] ?? "${r["jenis"]}", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                  _badge(statusLabel[status] ?? status, color),
                ]),
                const SizedBox(height: 6),
                Text("${r["alasan"] ?? ""}", style: const TextStyle(fontSize: 12, color: Color(0xFF475569))),
                const SizedBox(height: 8),
                _meta(Icons.schedule, "Keluar: ${_fmt(r["rencanaKeluar"])}"),
                _meta(Icons.schedule, "Kembali: ${_fmt(r["rencanaKembali"])}"),
                _meta(Icons.place_outlined, "Tujuan: ${r["alamatTujuan"] ?? "-"}"),
                _meta(Icons.person_outline, "Penjemput: ${r["namaPenjemput"] ?? "-"} (${r["hubunganPenjemput"] ?? "-"}) • ${r["noTelpPenjemput"] ?? "-"}"),
                if (r["alasanKeputusan"] != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text("Alasan keputusan: ${r["alasanKeputusan"]}", style: const TextStyle(fontSize: 11, color: Color(0xFFEF4444)))),
                if (r["suratNomor"] != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text("Surat: ${r["suratNomor"]}", style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)))),
                if (r["checkoutAt"] != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text("Check-out: ${_fmt(r["checkoutAt"])}${r["checkinAt"] != null ? " • Check-in: ${_fmt(r["checkinAt"])}" : ""}", style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)))),
                if (bisaBatal || bisaKonfirmasi || bisaSurat) Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Wrap(spacing: 8, children: [
                    if (bisaSurat) FilledButton.icon(
                      onPressed: () => bukaSurat(),
                      icon: const Icon(Icons.qr_code_2, size: 15),
                      label: const Text("Lihat Surat & QR", style: TextStyle(fontSize: 11)),
                    ),
                    if (bisaKonfirmasi) OutlinedButton(onPressed: busy ? null : () => _konfirmasi("${r["id"]}"), child: const Text("Konfirmasi Tiba di Tujuan", style: TextStyle(fontSize: 11))),
                    if (bisaBatal) TextButton.icon(
                      onPressed: busy ? null : () => _batalkan("${r["id"]}"),
                      icon: const Icon(Icons.cancel_outlined, size: 14, color: Color(0xFFEF4444)),
                      label: const Text("Batalkan", style: TextStyle(fontSize: 11, color: Color(0xFFEF4444))),
                    ),
                  ]),
                ),
              ]),
            ),
          );
        }),
      ],
    );
  }

  Widget _tabAjukan() {
    if (_adaIzinAktif) {
      return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text("Masih ada izin aktif. Selesaikan atau batalkan izin tersebut sebelum mengajukan izin baru.", textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF64748B)))));
    }
    return _FormIzin(
      jenisOpts: jenisOpts.cast<Map>().map((e) => MapEntry("${e["value"]}", "${e["label"]}")).toList(),
      nama: "${santri?["nama"] ?? ""} (${santri?["nisNo"] ?? "-"})",
      busy: busy,
      onSubmit: _ajukan,
    );
  }

  static String _fmt(dynamic v) {
    final d = DateTime.tryParse("$v");
    if (d == null) return "-";
    return DateFormat("dd MMM yyyy HH:mm", "id_ID").format(d.toLocal());
  }

  Widget _badge(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
    child: Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
  );

  Widget _meta(IconData icon, String text) => Padding(
    padding: const EdgeInsets.only(top: 2),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 12, color: const Color(0xFF94A3B8)),
      const SizedBox(width: 4),
      Expanded(child: Text(text, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)))),
    ]),
  );
}

class _FormIzin extends StatefulWidget {
  final List<MapEntry<String, String>> jenisOpts;
  final String nama;
  final bool busy;
  final Future<void> Function(Map<String, dynamic>) onSubmit;
  const _FormIzin({required this.jenisOpts, required this.nama, required this.busy, required this.onSubmit});

  @override
  State<_FormIzin> createState() => _FormIzinState();
}

class _FormIzinState extends State<_FormIzin> {
  String? jenis;
  final alasan = TextEditingController();
  final alamat = TextEditingController();
  final penjemput = TextEditingController();
  final noTelp = TextEditingController();
  String hubungan = "AYAH";
  DateTime? keluar;
  DateTime? kembali;
  late final TextEditingController namaCtrl;

  @override
  void initState() {
    super.initState();
    namaCtrl = TextEditingController(text: widget.nama);
    if (widget.jenisOpts.isNotEmpty) jenis = widget.jenisOpts.first.key;
  }

  @override
  void dispose() { namaCtrl.dispose(); alasan.dispose(); alamat.dispose(); penjemput.dispose(); noTelp.dispose(); super.dispose(); }

  String? _validasi() {
    if (jenis == null) return "Pilih jenis izin";
    if (alasan.text.trim().length < 10) return "Alasan minimal 10 karakter";
    if (keluar == null || kembali == null) return "Isi waktu keluar & kembali";
    if (!kembali!.isAfter(keluar!)) return "Waktu kembali harus setelah keluar";
    if (alamat.text.trim().length < 5) return "Alamat tujuan minimal 5 karakter";
    if (penjemput.text.trim().length < 3) return "Nama penjemput minimal 3 karakter";
    if (!RegExp(r"^\d{9,15}$").hasMatch(noTelp.text.replaceAll(RegExp(r"[\s-]"), ""))) return "No. HP penjemput tidak valid";
    return null;
  }

  void _snack(String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: const Color(0xFFEF4444)));

  Future<void> _pilihWaktu(bool isKeluar) async {
    final now = DateTime.now();
    final base = (isKeluar ? keluar : kembali) ?? now;
    final d = await showDatePicker(context: context, initialDate: base, firstDate: DateTime(now.year - 1), lastDate: DateTime(now.year + 2));
    if (d == null || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(base));
    if (t == null) return;
    setState(() {
      final v = DateTime(d.year, d.month, d.day, t.hour, t.minute);
      if (isKeluar) {
        keluar = v;
      } else {
        kembali = v;
      }
    });
  }

  Future<void> _kirim(bool draft) async {
    final err = _validasi();
    if (err != null) { _snack(err); return; }
    await widget.onSubmit({
      "op": draft ? "draft" : "ajukan",
      "jenis": jenis,
      "alasan": alasan.text.trim(),
      "rencanaKeluar": _iso(keluar!),
      "rencanaKembali": _iso(kembali!),
      "alamatTujuan": alamat.text.trim(),
      "namaPenjemput": penjemput.text.trim(),
      "hubunganPenjemput": hubungan,
      "noTelpPenjemput": noTelp.text.trim(),
    });
    if (mounted && !draft) {
      setState(() {
        alasan.clear(); alamat.clear(); penjemput.clear(); noTelp.clear();
        keluar = null; kembali = null;
        if (widget.jenisOpts.isNotEmpty) jenis = widget.jenisOpts.first.key;
      });
    }
  }

  static String _iso(DateTime d) => "${d.year}-${d.month.toString().padLeft(2, "0")}-${d.day.toString().padLeft(2, "0")}T${d.hour.toString().padLeft(2, "0")}:${d.minute.toString().padLeft(2, "0")}";
  static String _label(DateTime? d) => d == null ? "Pilih tanggal & jam" : DateFormat("dd MMM yyyy HH:mm", "id_ID").format(d);

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text("Formulir Pengajuan Izin", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            const SizedBox(height: 12),
            TextField(controller: namaCtrl, enabled: false, decoration: const InputDecoration(labelText: "Nama / NIS", border: OutlineInputBorder(), isDense: true)),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: jenis,
              decoration: const InputDecoration(labelText: "Jenis Izin", border: OutlineInputBorder(), isDense: true),
              items: widget.jenisOpts.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value, style: const TextStyle(fontSize: 12)))).toList(),
              onChanged: (v) => setState(() => jenis = v),
            ),
            const SizedBox(height: 10),
            TextField(controller: alasan, maxLines: 2, maxLength: 300, decoration: const InputDecoration(labelText: "Alasan Izin (min. 10 karakter)", border: OutlineInputBorder(), isDense: true, counterText: "")),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: OutlinedButton.icon(onPressed: () => _pilihWaktu(true), icon: const Icon(Icons.schedule, size: 15), label: Text("Keluar\n${_label(keluar)}", style: const TextStyle(fontSize: 10)))),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton.icon(onPressed: () => _pilihWaktu(false), icon: const Icon(Icons.schedule, size: 15), label: Text("Kembali\n${_label(kembali)}", style: const TextStyle(fontSize: 10)))),
            ]),
            const SizedBox(height: 10),
            TextField(controller: alamat, decoration: const InputDecoration(labelText: "Alamat Tujuan", border: OutlineInputBorder(), isDense: true)),
            const SizedBox(height: 10),
            TextField(controller: penjemput, decoration: const InputDecoration(labelText: "Nama Penjemput", border: OutlineInputBorder(), isDense: true)),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: hubungan,
              decoration: const InputDecoration(labelText: "Hubungan", border: OutlineInputBorder(), isDense: true),
              items: const [
                DropdownMenuItem(value: "AYAH", child: Text("Ayah")), DropdownMenuItem(value: "IBU", child: Text("Ibu")),
                DropdownMenuItem(value: "WALI", child: Text("Wali")), DropdownMenuItem(value: "LAINNYA", child: Text("Lainnya")),
              ],
              onChanged: (v) => setState(() => hubungan = v ?? "AYAH"),
            ),
            const SizedBox(height: 10),
            TextField(controller: noTelp, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: "No. HP Penjemput", border: OutlineInputBorder(), isDense: true)),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: FilledButton(onPressed: widget.busy ? null : () => _kirim(false), child: const Text("Ajukan Izin"))),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton(onPressed: widget.busy ? null : () => _kirim(true), child: const Text("Simpan Draft"))),
            ]),
            const SizedBox(height: 8),
            const Text("Setelah diajukan, izin memerlukan persetujuan wali, musyrif, pengurus, dan admin pondok sesuai pengaturan. Surat izin digital terbit otomatis bila seluruh tahap disetujui.", style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
          ]),
        ),
      ),
    ],
  );
}
