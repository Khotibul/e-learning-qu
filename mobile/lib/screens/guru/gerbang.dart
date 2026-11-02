import "dart:io";

import "package:flutter/material.dart";
import "package:intl/intl.dart";
import "package:path_provider/path_provider.dart";
import "package:share_plus/share_plus.dart";
import "../../services/api_service.dart";
import "../../services/verifikasi_log.dart";
import "../../widgets/qr_scanner_page.dart";
import "../verifikasi_surat_page.dart";

/// Gerbang Pondok — mirror web /gerbang.
/// Cari izin aktif (NIS/nama/token QR/no. surat), check-out & check-in santri.
class GuruGerbang extends StatefulWidget {
  const GuruGerbang({super.key});
  @override
  State<GuruGerbang> createState() => _GuruGerbangState();
}

class _GuruGerbangState extends State<GuruGerbang> with SingleTickerProviderStateMixin {
  final _cari = TextEditingController();
  final GlobalKey<_RiwayatVerifikasiState> _riwayatQrKey = GlobalKey<_RiwayatVerifikasiState>();
  late final TabController _tab;
  int _tabAktif = 0;
  List<dynamic> rows = [];
  List<dynamic> riwayat = [];
  Map<String, dynamic>? pesan;
  Map<String, String> jenisLabel = {};
  Map<String, String> statusLabel = {};
  bool loading = false;
  bool verifikasiPenjemput = false;
  // Hasil cek keaslian QR per izin (key = id izin), dari /api/izin/verifikasi.
  final Map<String, Map<String, dynamic>> _verifikasi = {};
  final Set<String> _verifLoading = {};

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this)..addListener(_saatTabBerubah);
    WidgetsBinding.instance.addPostFrameCallback((_) => _muatDaftar());
  }

  /// Muat ulang riwayat QR tiap kali tab "Riwayat QR" dibuka.
  void _saatTabBerubah() {
    if (_tab.index == _tabAktif) return;
    _tabAktif = _tab.index;
    if (_tabAktif == 2) _riwayatQrKey.currentState?.muatUlang();
  }

  @override
  void dispose() {
    _tab.removeListener(_saatTabBerubah);
    _tab.dispose();
    _cari.dispose();
    super.dispose();
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  static String _fmt(dynamic v) {
    final d = DateTime.tryParse("$v");
    return d == null ? "-" : DateFormat("dd MMM yyyy HH:mm", "id_ID").format(d.toLocal());
  }

  static Map<String, String> _strMap(dynamic v) => v is Map ? v.map((k, val) => MapEntry("$k", "$val")) : {};

  static String _nama(dynamic v) => v is Map ? "${v["nama"] ?? "-"}" : (v?.toString() ?? "-");

  Future<void> _muatDaftar() async {
    setState(() => loading = true);
    try {
      final d = await ApiService.get("/api/mobile/pondok/gerbang?limit=50", useCache: false);
      if (mounted && d is Map) {
        setState(() {
          rows = (d["rows"] as List?) ?? [];
          jenisLabel = _strMap(d["jenisLabel"]);
          statusLabel = _strMap(d["statusLabel"]);
          pesan = null;
          _verifikasi.clear();
        });
      }
    } catch (e) {
      if (mounted) setState(() => pesan = {"error": "$e"});
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _cariIzin([String? q]) async {
    final nilai = (q ?? _cari.text).trim();
    if (nilai.length < 2) { _snack("Minimal 2 karakter (NIS / nama / token / no. surat)", color: const Color(0xFFEF4444)); return; }
    setState(() => loading = true);
    try {
      final d = await ApiService.get("/api/mobile/pondok/gerbang?q=${Uri.encodeQueryComponent(nilai)}", useCache: false);
      if (mounted) {
        setState(() {
          rows = d is Map ? ((d["rows"] as List?) ?? []) : [];
          jenisLabel = d is Map ? _strMap(d["jenisLabel"]) : {};
          statusLabel = d is Map ? _strMap(d["statusLabel"]) : {};
          pesan = null;
          _verifikasi.clear();
        });
        if (rows.isEmpty) _snack("Izin tidak ditemukan", color: const Color(0xFFF59E0B));
        // Pencarian dari hasil scan QR: langsung cek keaslian tokennya.
        final token = nilai;
        for (final r in rows.cast<Map>()) {
          if ("${r["suratToken"] ?? ""}" == token) {
            _verifikasiQr(r);
            break;
          }
        }
      }
    } catch (e) {
      if (mounted) setState(() => pesan = {"error": "$e"});
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _scanToken() async {
    final mode = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.qr_code_scanner),
            title: const Text("Pindai QR dengan kamera"),
            subtitle: const Text("Arahkan kamera ke QR pada surat izin", style: TextStyle(fontSize: 11)),
            onTap: () => Navigator.pop(ctx, "kamera"),
          ),
          ListTile(
            leading: const Icon(Icons.keyboard),
            title: const Text("Input token manual"),
            subtitle: const Text("Tempel token bila QR tidak terbaca", style: TextStyle(fontSize: 11)),
            onTap: () => Navigator.pop(ctx, "manual"),
          ),
        ]),
      ),
    );
    if (!mounted) return;
    if (mode == "kamera") {
      final token = await Navigator.push<String>(context, MaterialPageRoute(builder: (_) => const QrScannerPage()));
      if (token != null && token.isNotEmpty) {
        _cari.text = token;
        await _cariIzin(token);
      }
      return;
    }
    if (mode != "manual" || !mounted) return;

    final ctrl = TextEditingController();
    final token = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Scan QR / Token Izin"),
        content: TextField(controller: ctrl, autofocus: true, decoration: const InputDecoration(labelText: "Tempel hasil scan QR atau token", border: OutlineInputBorder())),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text("Cari")),
        ],
      ),
    );
    ctrl.dispose();
    if (token != null && token.isNotEmpty) {
      _cari.text = token;
      await _cariIzin(token);
    }
  }

  /// Cek keaslian QR (**publik**, data minimal) untuk satu izin.
  Future<Map<String, dynamic>?> _verifikasiQr(Map r) async {
    final id = "${r["id"] ?? ""}";
    final token = "${r["suratToken"] ?? ""}".trim();
    if (token.isEmpty) {
      _snack("Izin ini belum memiliki token QR.", color: const Color(0xFFF59E0B));
      return null;
    }
    setState(() => _verifLoading.add(id));
    try {
      final d = await ApiService.get("/api/izin/verifikasi?token=${Uri.encodeQueryComponent(token)}", useCache: false);
      final hasil = d is Map ? Map<String, dynamic>.from(d) : <String, dynamic>{};
      if (mounted) setState(() => _verifikasi[id] = hasil);
      VerifikasiLog.tambah(token: token, hasil: hasil, sumber: "GERBANG");
      return hasil;
    } catch (e) {
      final pesanError = e.toString().replaceFirst("Exception: ", "").trim();
      final gagal = <String, dynamic>{"valid": false, "error": pesanError};
      if (mounted) setState(() => _verifikasi[id] = gagal);
      VerifikasiLog.tambah(token: token, error: pesanError, sumber: "GERBANG");
      return gagal;
    } finally {
      if (mounted) setState(() => _verifLoading.remove(id));
    }
  }

  static String _normNama(String s) => s
      .toLowerCase()
      .replaceAll(RegExp(r"[^a-z0-9\s]"), " ")
      .replaceAll(RegExp(r"\s+"), " ")
      .trim();

  /// Nama pada surat harus sama dengan santri pemilik izin.
  static bool _namaCocok(Map r, Map hasil) {
    final namaIzin = "${(r["santri"] as Map?)?["nama"] ?? ""}".trim();
    final namaSurat = "${hasil["namaSantri"] ?? ""}".trim();
    if (namaIzin.isEmpty || namaSurat.isEmpty) return true; // data tidak lengkap — jangan tuduh
    return _normNama(namaIzin) == _normNama(namaSurat);
  }

  /// Gerbang hanya boleh check-out bila QR tidak terbukti tidak sah.
  Future<bool> _pastikanQrSah(Map r) async {
    final id = "${r["id"] ?? ""}";
    final token = "${r["suratToken"] ?? ""}".trim();
    if (token.isEmpty) return true; // izin lama tanpa token — aturan server tetap berlaku
    final hasil = _verifikasi[id] ?? await _verifikasiQr(r);
    if (hasil == null) return true; // gagal cek (jaringan) — jangan blokir petugas
    if (hasil["valid"] == true) {
      if (_namaCocok(r, hasil)) return true;
      final namaIzin = "${(r["santri"] as Map?)?["nama"] ?? "-"}";
      _snack(
        "Check-out ditolak — nama di surat (${hasil["namaSantri"]}) berbeda dengan santri pada izin ($namaIzin).",
        color: const Color(0xFFEF4444),
      );
      return false;
    }
    final galat = "${hasil["error"] ?? ""}".trim();
    // Hanya blokir bila token benar-benar ditolak server. Gagal jaringan/
    // server tidak terjangkau tidak boleh menahan santri di gerbang.
    if (galat.isNotEmpty && !galat.toLowerCase().contains("token")) return true;
    final alasan = galat.isNotEmpty ? galat : (hasil["kedaluwarsa"] == true ? "QR kedaluwarsa" : "status surat: ${hasil["status"] ?? "tidak berlaku"}");
    _snack("Check-out ditolak — QR tidak sah: $alasan", color: const Color(0xFFEF4444));
    return false;
  }

  Future<void> _checkout(Map r) async {
    setState(() => loading = true);
    try {
      if (!await _pastikanQrSah(r)) return;
      await ApiService.post("/api/mobile/pondok/gerbang", {
        "op": "checkout",
        "izinId": "${r["id"]}",
        "verifikasiPenjemput": verifikasiPenjemput,
      });
      _snack("Check-out tercatat — status keberadaan diperbarui");
      await _muatUlangSetelahAksi();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _checkin(String izinId) async {
    setState(() => loading = true);
    try {
      await ApiService.post("/api/mobile/pondok/gerbang", {"op": "checkin", "izinId": izinId});
      _snack("Check-in tercatat — santri kembali DI PONDOK");
      await _muatUlangSetelahAksi();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _muatUlangSetelahAksi() async {
    if (_cari.text.trim().length >= 2) {
      await _cariIzin();
    } else {
      await _muatDaftar();
    }
  }

  Future<void> _muatRiwayat() async {
    setState(() => loading = true);
    try {
      final d = await ApiService.get("/api/mobile/pondok/gerbang?riwayat=1", useCache: false);
      if (mounted && d is Map) setState(() => riwayat = (d["riwayatRows"] as List?) ?? []);
    } catch (e) {
      if (mounted) _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(
      title: const Text("Gerbang Pondok"),
      backgroundColor: Colors.white,
      elevation: 0,
      actions: [
        IconButton(
          tooltip: "Cek keaslian QR surat",
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const VerifikasiSuratPage())),
          icon: const Icon(Icons.verified_user_outlined, size: 20),
        ),
        IconButton(onPressed: loading ? null : _muatDaftar, icon: const Icon(Icons.refresh, size: 20)),
      ],
      bottom: TabBar(
        controller: _tab,
        labelColor: const Color(0xFF4F46E5),
        unselectedLabelColor: const Color(0xFF64748B),
        tabs: const [Tab(text: "Gerbang"), Tab(text: "Riwayat Keluar/Masuk"), Tab(text: "Riwayat QR")],
      ),
    ),
    body: TabBarView(controller: _tab, children: [_tabGerbang(), _tabRiwayat(), _tabVerifikasi()]),
  );

  Widget _tabGerbang() {
    final err = pesan?["error"];
    return RefreshIndicator(
      onRefresh: _muatDaftar,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Text("Cari Izin Aktif", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 8),
                TextField(
                  controller: _cari,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (v) => _cariIzin(v),
                  decoration: InputDecoration(
                    hintText: "NIS / nama santri / token QR / no. surat",
                    isDense: true,
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.search, size: 18),
                    suffixIcon: IconButton(icon: const Icon(Icons.qr_code_scanner, size: 18), onPressed: _scanToken),
                  ),
                ),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: FilledButton.icon(onPressed: loading ? null : () => _cariIzin(), icon: const Icon(Icons.search, size: 15), label: const Text("Cari", style: TextStyle(fontSize: 12)))),
                  const SizedBox(width: 8),
                  Expanded(child: OutlinedButton.icon(onPressed: loading ? null : _scanToken, icon: const Icon(Icons.qr_code_scanner, size: 15), label: const Text("Scan QR", style: TextStyle(fontSize: 12)))),
                ]),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  value: verifikasiPenjemput,
                  onChanged: (v) => setState(() => verifikasiPenjemput = v),
                  title: const Text("Identitas penjemput sudah diverifikasi", style: TextStyle(fontSize: 12)),
                  secondary: const Icon(Icons.verified_user_outlined, size: 18),
                ),
              ]),
            ),
          ),
          if (err != null) ...[
            const SizedBox(height: 10),
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Text("$err", style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12)))),
          ],
          if (loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
          if (!loading && rows.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Tidak ada izin aktif / hasil pencarian.", style: TextStyle(color: Color(0xFF64748B))))),
          ...rows.cast<Map>().map(_kartuIzin),
        ],
      ),
    );
  }

  Widget _kartuIzin(Map r) {
    final santri = (r["santri"] as Map?) ?? {};
    final status = "${r["status"]}";
    final checkout = r["checkoutAt"];
    final checkin = r["checkinAt"];
    final kedaluwarsa = r["suratExpiresAt"] != null && DateTime.tryParse("${r["suratExpiresAt"]}")?.isBefore(DateTime.now()) == true;
    final bolehCheckout = status == "DISETUJUI" && checkout == null && !kedaluwarsa;
    final bolehCheckin = status == "DISETUJUI" && checkout != null && checkin == null;
    final statusColor = status == "DISETUJUI" ? const Color(0xFF10B981) : status == "SELESAI" ? const Color(0xFF4F46E5) : const Color(0xFFF59E0B);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text("${santri["nama"] ?? "-"}", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              Text("${santri["nisNo"] ?? "-"} • ${_nama(santri["asrama"])} / ${_nama(santri["kamar"])}", style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
            ])),
            _badge(statusLabel[status] ?? status, statusColor),
          ]),
          const SizedBox(height: 4),
          Text("${jenisLabel["${r["jenis"]}"] ?? r["jenisLabel"] ?? r["jenis"] ?? "-"}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4F46E5))),
          if (santri["keberadaan"] != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text("Keberadaan: ${santri["keberadaan"]}", style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)))),
          const SizedBox(height: 6),
          _meta("Surat: ${r["suratNomor"] ?? "-"}"),
          _meta("Berlaku s/d: ${_fmt(r["suratExpiresAt"])}"),
          _meta("Rencana keluar: ${_fmt(r["rencanaKeluar"])}"),
          _meta("Rencana kembali: ${_fmt(r["rencanaKembali"])}"),
          _meta("Tujuan: ${r["alamatTujuan"] ?? "-"}"),
          _meta("Penjemput: ${r["namaPenjemput"] ?? "-"} (${r["hubunganPenjemput"] ?? "-"}) — ${r["noTelpPenjemput"] ?? "-"}"),
          if (checkout != null) _meta("Check-out: ${_fmt(checkout)}"),
          if (checkin != null) _meta("Check-in: ${_fmt(checkin)}"),
          if (kedaluwarsa) const Padding(padding: EdgeInsets.only(top: 4), child: Text("QR/surat kedaluwarsa — hubungi admin pondok.", style: TextStyle(fontSize: 11, color: Color(0xFFEF4444), fontWeight: FontWeight.w600))),
          if ("${r["suratToken"] ?? ""}".isNotEmpty) _panelVerifikasi(r),
          if (bolehCheckout || bolehCheckin) Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Wrap(spacing: 8, children: [
              if (bolehCheckout) FilledButton.icon(
                onPressed: loading ? null : () => _checkout(r),
                icon: const Icon(Icons.logout, size: 15),
                label: const Text("Konfirmasi Keluar", style: TextStyle(fontSize: 11)),
              ),
              if (bolehCheckin) OutlinedButton.icon(
                onPressed: loading ? null : () => _checkin("${r["id"]}"),
                icon: const Icon(Icons.login, size: 15),
                label: const Text("Konfirmasi Kembali", style: TextStyle(fontSize: 11)),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  /// Hasil cek keaslian QR — tampil di kartu izin, sebelum tombol check-out.
  Widget _panelVerifikasi(Map r) {
    final id = "${r["id"] ?? ""}";
    if (_verifLoading.contains(id)) {
      return const Padding(
        padding: EdgeInsets.only(top: 8),
        child: Row(children: [
          SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
          SizedBox(width: 8),
          Text("Memeriksa keaslian QR…", style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
        ]),
      );
    }

    final hasil = _verifikasi[id];
    if (hasil == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: OutlinedButton.icon(
          onPressed: loading ? null : () => _verifikasiQr(r),
          icon: const Icon(Icons.verified_user_outlined, size: 15),
          label: const Text("Verifikasi QR surat", style: TextStyle(fontSize: 11)),
        ),
      );
    }

    final galat = hasil["error"];
    final valid = hasil["valid"] == true;
    final kedaluwarsa = hasil["kedaluwarsa"] == true;
    final color = valid ? const Color(0xFF059669) : (kedaluwarsa ? const Color(0xFFD97706) : const Color(0xFFDC2626));
    final judul = valid
        ? "QR TERVERIFIKASI — SURAT ASLI & BERLAKU"
        : galat != null
            ? "VERIFIKASI QR GAGAL"
            : kedaluwarsa
                ? "QR KEDALUWARSA"
                : "QR TIDAK BERLAKU";
    final keterangan = galat != null
        ? "$galat"
        : "Surat ${hasil["suratNomor"] ?? "-"} • ${hasil["jenis"] ?? "-"}\n"
            "Status: ${hasil["status"] ?? "-"} • Berlaku s/d ${_fmt(hasil["berlakuSampai"])}";

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(valid ? Icons.verified : (kedaluwarsa ? Icons.schedule : Icons.gpp_bad_outlined), size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(judul, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: color)),
                const SizedBox(height: 2),
                Text(keterangan, style: TextStyle(fontSize: 10, color: color.withValues(alpha: 0.95), height: 1.35)),
                if (galat == null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      "Nama di surat: ${hasil["namaSantri"] ?? "-"} (${hasil["nisNo"] ?? "-"})"
                      "${hasil["sudahCheckout"] == true ? " • sudah check-out" : ""}"
                      "${hasil["sudahCheckin"] == true ? " • sudah check-in" : ""}",
                      style: TextStyle(fontSize: 9.5, color: color.withValues(alpha: 0.85)),
                    ),
                  ),
                if (galat == null && !_namaCocok(r, hasil))
                  Container(
                    margin: const EdgeInsets.only(top: 5),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFFF59E0B)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.warning_amber_rounded, size: 14, color: Color(0xFFB45309)),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            "Nama di surat (${hasil["namaSantri"]}) BUKAN santri pada izin ini "
                            "(${(r["santri"] as Map?)?["nama"] ?? "-"}). Jangan check-out sebelum dicocokkan.",
                            style: const TextStyle(fontSize: 9.5, color: Color(0xFF92400E), height: 1.35),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          IconButton(
            tooltip: "Cek ulang QR",
            visualDensity: VisualDensity.compact,
            onPressed: loading || _verifLoading.contains(id) ? null : () => _verifikasiQr(r),
            icon: Icon(Icons.refresh, size: 16, color: color),
          ),
        ],
      ),
    );
  }

  Widget _tabVerifikasi() => _RiwayatVerifikasi(key: _riwayatQrKey);

  Widget _tabRiwayat() => _RiwayatGerbang(
    riwayat: riwayat,
    loading: loading,
    onMuat: _muatRiwayat,
    fmt: _fmt,
  );

  static Widget _badge(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
    child: Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
  );

  static Widget _meta(String text) => Padding(
    padding: const EdgeInsets.only(top: 2),
    child: Text(text, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
  );
}

class _RiwayatGerbang extends StatefulWidget {
  final List<dynamic> riwayat;
  final bool loading;
  final Future<void> Function() onMuat;
  final String Function(dynamic) fmt;
  const _RiwayatGerbang({required this.riwayat, required this.loading, required this.onMuat, required this.fmt});

  @override
  State<_RiwayatGerbang> createState() => _RiwayatGerbangState();
}

class _RiwayatGerbangState extends State<_RiwayatGerbang> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => widget.onMuat());
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: widget.onMuat,
    child: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (widget.loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
        if (!widget.loading && widget.riwayat.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada riwayat keluar/masuk.", style: TextStyle(color: Color(0xFF64748B))))),
        ...widget.riwayat.cast<Map>().map((r) {
          final checkout = r["checkoutAt"];
          final checkin = r["checkinAt"];
          return Card(
            child: ListTile(
              leading: Icon(checkin != null ? Icons.check_circle : Icons.directions_walk, size: 20, color: checkin != null ? const Color(0xFF10B981) : const Color(0xFFF59E0B)),
              title: Text("${r["santri"]?["nama"] ?? "-"} (${r["santri"]?["nisNo"] ?? "-"})", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              subtitle: Text("${r["jenisLabel"] ?? r["jenis"] ?? "-"}\nKeluar: ${widget.fmt(checkout)}${checkin != null ? " • Kembali: ${widget.fmt(checkin)}" : " • Belum kembali"}", style: const TextStyle(fontSize: 11)),
              isThreeLine: true,
              trailing: Text(
                checkin != null ? "SELESAI" : checkout != null ? "DI LUAR" : "-",
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: checkin != null ? const Color(0xFF10B981) : const Color(0xFFF59E0B)),
              ),
            ),
          );
        }),
      ],
    ),
  );
}

/// Riwayat verifikasi QR terakhir yang dilakukan petugas di perangkat ini.
class _RiwayatVerifikasi extends StatefulWidget {
  const _RiwayatVerifikasi({super.key});

  @override
  State<_RiwayatVerifikasi> createState() => _RiwayatVerifikasiState();
}

class _RiwayatVerifikasiState extends State<_RiwayatVerifikasi> {
  bool loading = true;
  bool _ekspor = false;
  List<Map<String, dynamic>> items = [];
  final TextEditingController _cariRiwayat = TextEditingController();
  // SEMUA | SAH | KEDALUWARSA | TIDAK SAH | GAGAL
  String filter = "SEMUA";

  List<Map<String, dynamic>> get tampil {
    final q = _cariRiwayat.text.trim().toLowerCase();
    return items.where((r) {
      if (filter != "SEMUA" && _status(r).$1 != filter) return false;
      if (q.isEmpty) return true;
      final gabungan = "${r["namaSantri"] ?? ""} ${r["nisNo"] ?? ""} ${r["suratNomor"] ?? ""} ${r["token"] ?? ""}".toLowerCase();
      return gabungan.contains(q);
    }).toList();
  }

  @override
  void initState() {
    super.initState();
    _inisialisasi();
  }

  @override
  void dispose() {
    _cariRiwayat.dispose();
    super.dispose();
  }

  Future<void> _inisialisasi() async {
    filter = await VerifikasiLog.filterTersimpan();
    await _muat();
  }

  /// Dipanggil Gerbang saat tab "Riwayat QR" dibuka.
  Future<void> muatUlang() => _muat();

  String _aktifFilter = "SEMUA";

  Future<void> _muat() async {
    setState(() => loading = true);
    final data = await VerifikasiLog.semua();
    if (!mounted) return;
    setState(() {
      items = data;
      _aktifFilter = "SEMUA";
      loading = false;
    });
  }

  Future<void> _hapus() async {
    final ya = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Hapus riwayat verifikasi?"),
        content: const Text("Riwayat QR yang tersimpan di perangkat ini akan dihapus."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Hapus"),
          ),
        ],
      ),
    );
    if (ya != true) return;
    await VerifikasiLog.bersihkan();
    await _muat();
  }

  Future<void> _hapusSatu(Map<String, dynamic> r) async {
    final nomor = "${r["suratNomor"] ?? ""}".trim();
    final nama = "${r["namaSantri"] ?? ""}".trim();
    final label = [if (nomor.isNotEmpty) nomor, if (nama.isNotEmpty) nama].join(" — ");
    final ya = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Hapus entri ini?"),
        content: Text(
          label.isEmpty
              ? "Entri verifikasi ini akan dihapus dari riwayat perangkat."
              : "Entri “$label” akan dihapus dari riwayat perangkat.",
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Hapus"),
          ),
        ],
      ),
    );
    if (ya != true) return;
    final ok = await VerifikasiLog.hapusEntri(r);
    if (!mounted) return;
    await _muat();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ok ? "Entri verifikasi dihapus." : "Entri tidak ditemukan, riwayat dimuat ulang.")),
    );
  }

  static String _selCsv(dynamic v) {
    final s = "${v ?? ""}".replaceAll("\r", " ").replaceAll("\n", " ").trim();
    return "\"${s.replaceAll('"', '""')}\"";
  }

  /// Ekspor entri yang sedang tampil (mengikuti filter & pencarian) ke CSV.
  bool _eksporSemua = false;

  Future<void> _eksporCsv() async {
    setState(() => _ekspor = true);
    try {
      // Gunakan data sesuai filter/pencarian aktif (default) atau seluruh riwayat
      final data = _eksporSemua ? items : tampil;
      if (data.isEmpty) {
        String label = _eksporSemua ? "semua" : "menyaring";
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Tidak ada entri $label untuk diekspor."))
        );
        setState(() => _ekspor = false);
        return;
      }
      final b = StringBuffer();
      b.writeln(["Waktu", "Status", "Sumber", "No Surat", "Nama Santri", "NIS", "Jenis Izin", "Token", "Error"].map(_selCsv).join(","));
      for (final r in data) {
        b.writeln([
          _waktu(r["waktu"]),
          _status(r).$1,
          _labelSumber(r).isEmpty ? "-" : _labelSumber(r),
          "${r["suratNomor"] ?? "-"}",
          "${r["namaSantri"] ?? "-"}",
          "${r["nisNo"] ?? "-"}",
          "${r["jenis"] ?? "-"}",
          "${r["token"] ?? "-"}",
          "${r["error"] ?? ""}",
        ].map(_selCsv).join(","));
      }
      final dir = await getApplicationDocumentsDirectory();
      final stamp = DateFormat("yyyyMMdd-HHmm").format(DateTime.now());
      final file = File("${dir.path}/riwayat-verifikasi-qr-$stamp.csv");
      // BOM agar Excel membaca UTF-8 dengan benar.
      await file.writeAsString("\uFEFF${b.toString()}", flush: true);
      final String _statusText = _eksporSemua
          ? 'semua status (semua filter)'
          : filter == "SEMUA"
              ? 'semua status'
              : 'status $filter';
      final String _teksEkspor = 'Riwayat verifikasi QR suratizin (${data.length} entri, $_statusText)';
      await SharePlus.instance.share(ShareParams(
        files: [XFile(file.path, mimeType: "text/csv")],
        subject: "Riwayat verifikasi QR — ${data.length} entri",
        text: _teksEkspor,
      ));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Gagal mengekspor CSV: ${e.toString().replaceFirst("Exception: ", "")}")),
        );
      }
    } finally {
      if (mounted) setState(() => _ekspor = false);
    }
  }

  Future<void> _tampilkanPilihSumber() async {
    // Memilih sumber untuk filter tampilan; menyimpan pilihan di SharedPreferences
    final pilih = await showDialog<Map<String, bool>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Filter sumber"),
        content: const Text("Pilih sumber yang akan ditampilkan:"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, {}), child: const Text("Batal")),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: () => Navigator.pop(ctx, {"GERBANG": true, "CEK": false}),
                  child: const Text("Hanya Gerbang"),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton(
                  onPressed: () => Navigator.pop(ctx, {"GERBANG": false, "CEK": true}),
                  child: const Text("Hanya Cek"),
                ),
              ),
            ],
          ),
          TextButton(onPressed: () => Navigator.pop(ctx, {"GERBANG": true, "CEK": true}), child: const Text("Semua")),
        ],
      ),
    );
    if (pilih != null && pilih.isNotEmpty) {
      setState(() {
        // Filter diterapkan saat membangun tampilan (lihat _status dan _chipFilter)
        // dan _ringkasanSumber menghitung dari items yang sudah difilter
      });
    }
  }

  int _jumlahSumber(String kode) => items.where((r) => "${r["sumber"] ?? ""}" == kode).length;



  Widget _ringkasanSumber() {
    final gerbang = _jumlahSumber("GERBANG");
    final cek = _jumlahSumber("CEK");
    final lain = items.length - gerbang - cek;
    Widget item(IconData ikon, String label, int jumlah, Color warna) => Expanded(
      child: Row(
        children: [
          Icon(ikon, size: 14, color: warna),
          const SizedBox(width: 4),
          Expanded(
            child: Text(label, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
          ),
          Text("$jumlah", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: warna)),
        ],
      ),
    );
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          item(Icons.door_front_door_outlined, "Gerbang", gerbang, const Color(0xFF4F46E5)),
          const SizedBox(width: 10),
          item(Icons.verified_user_outlined, "Cek Keaslian", cek, const Color(0xFF0891B2)),
          if (lain > 0) ...[
            const SizedBox(width: 10),
            item(Icons.help_outline, "Tanpa label", lain, const Color(0xFF94A3B8)),
          ],
        ],
      ),
    );
  }

  static String _waktu(dynamic v) {
    final d = DateTime.tryParse("$v");
    return d == null ? "-" : DateFormat("dd MMM yyyy HH:mm", "id_ID").format(d.toLocal());
  }

  static String _tokenRingkas(String token) {
    if (token.length <= 14) return token;
    return "${token.substring(0, 8)}…${token.substring(token.length - 4)}";
  }

  (String, Color, IconData) _status(Map<String, dynamic> r) {
    if (r["error"] != null) return ("GAGAL", const Color(0xFFDC2626), Icons.error_outline);
    if (r["valid"] == true) return ("SAH", const Color(0xFF059669), Icons.verified);
    if (r["kedaluwarsa"] == true) return ("KEDALUWARSA", const Color(0xFFD97706), Icons.schedule);
    return ("TIDAK SAH", const Color(0xFFDC2626), Icons.gpp_bad_outlined);
  }

  Widget _chipFilter(String nilai, String label, {bool isAktif = false}) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(
      label: Text(label, style: const TextStyle(fontSize: 11)),
      selected: filter == nilai || isAktif,
      visualDensity: VisualDensity.compact,
      onSelected: (_) {
        setState(() => filter = nilai);
        VerifikasiLog.simpanFilter(nilai);
      },
    ),
  );

  /// Asal pemeriksaan: "Gerbang" (petugas) atau "Cek Keaslian" (halaman publik).
  static String _labelSumber(Map<String, dynamic> r) {
    switch ("${r["sumber"] ?? ""}") {
      case "GERBANG":
        return "Gerbang";
      case "CEK":
        return "Cek Keaslian";
      default:
        return "";
    }
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: _muat,
    child: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                "Riwayat verifikasi QR (${tampil.length}${filter == "SEMUA" ? "" : " / ${items.length}"})",
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ),
            IconButton(
              tooltip: "Ekspor riwayat ke CSV",
              visualDensity: VisualDensity.compact,
              onPressed: loading || _ekspor || tampil.isEmpty ? null : _eksporCsv,
              icon: _ekspor
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.file_download_outlined, size: 18),
            ),
            IconButton(
              tooltip: "Muat ulang riwayat",
              visualDensity: VisualDensity.compact,
              onPressed: loading ? null : _muat,
              icon: const Icon(Icons.refresh, size: 18),
            ),
            if (items.isNotEmpty)
              TextButton.icon(
                onPressed: _hapus,
                icon: const Icon(Icons.delete_outline, size: 15, color: Color(0xFFEF4444)),
                label: const Text("Hapus", style: TextStyle(fontSize: 11, color: Color(0xFFEF4444))),
              ),
          ],
        ),
        const Text(
          "Tersimpan di perangkat ini, maksimal 30 pemeriksaan terakhir.",
          style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
        ),
        if (!loading && items.isNotEmpty) ...[
          _ringkasanSumber(),
          const SizedBox(height: 4),
          InkWell(
            onTap: () => _tampilkanPilihSumber(),
            child: const Row(
              children: [
                Icon(Icons.tune, size: 16, color: Color(0xFF4F46E5)),
                SizedBox(width: 4),
                Text("Filter sumber", style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF4F46E5))),
              ],
            ),
          ),
        ],
        const SizedBox(height: 8),
        TextField(
          controller: _cariRiwayat,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: "Cari nama, NIS, no. surat, atau token",
            isDense: true,
            border: const OutlineInputBorder(),
            prefixIcon: const Icon(Icons.search, size: 18),
            suffixIcon: _cariRiwayat.text.isEmpty
                ? null
                : IconButton(
                    tooltip: "Bersihkan pencarian",
                    icon: const Icon(Icons.close, size: 16),
                    onPressed: () {
                      _cariRiwayat.clear();
                      setState(() {});
                    },
                  ),
          ),
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _chipFilter("SEMUA", "Semua (${tampil.length})", isAktif: _aktifFilter == "SEMUA"),
              _chipFilter("SAH", "Sah (${items.where((r) => _status(r).$1 == "SAH").length})", isAktif: _aktifFilter == "SAH"),
              _chipFilter("KEDALUWARSA", "Kedaluwarsa (${items.where((r) => _status(r).$1 == "KEDALUWARSA").length})", isAktif: _aktifFilter == "KEDALUWARSA"),
              _chipFilter("TIDAK SAH", "Tidak sah (${items.where((r) => _status(r).$1 == "TIDAK SAH").length})", isAktif: _aktifFilter == "TIDAK SAH"),
              _chipFilter("GAGAL", "Gagal (${items.where((r) => _status(r).$1 == "GAGAL").length})", isAktif: _aktifFilter == "GAGAL"),
              _chipFilter("SAH", "Sah (${items.where((r) => _status(r).$1 == "SAH").length})"),
              _chipFilter("KEDALUWARSA", "Kedaluwarsa (${items.where((r) => _status(r).$1 == "KEDALUWARSA").length})"),
              _chipFilter("TIDAK SAH", "Tidak sah (${items.where((r) => _status(r).$1 == "TIDAK SAH").length})"),
              _chipFilter("GAGAL", "Gagal (${items.where((r) => _status(r).$1 == "GAGAL").length})"),
            ],
          ),
        ),
        const SizedBox(height: 10),
        if (loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
        if (!loading && items.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(
              child: Text(
                "Belum ada verifikasi QR. Hasil cek keaslian di layar Gerbang akan muncul di sini.",
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
              ),
            ),
          ),
        if (!loading && items.isNotEmpty && tampil.isEmpty)
          Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: Text(
                _cariRiwayat.text.trim().isEmpty
                    ? "Tidak ada verifikasi berstatus $filter."
                    : "Tidak ada hasil untuk “${_cariRiwayat.text.trim()}”.",
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
              ),
            ),
          ),
        ...tampil.map((r) {
          final (label, color, ikon) = _status(r);
          final token = "${r["token"] ?? ""}";
          final nomor = "${r["suratNomor"] ?? ""}".trim();
          final nama = "${r["namaSantri"] ?? ""}".trim();
          final nis = "${r["nisNo"] ?? ""}".trim();
          return Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: token.isEmpty
                  ? null
                  : () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => VerifikasiSuratPage(tokenAwal: token)),
                      ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(ikon, size: 20, color: color),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  nomor.isEmpty ? "Surat tanpa nomor" : nomor,
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
                                child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color)),
                              ),
                            ],
                          ),
                          if (nama.isNotEmpty)
                            Text(
                              "$nama${nis.isEmpty ? "" : " ($nis)"}",
                              style: const TextStyle(fontSize: 11, color: Color(0xFF475569)),
                            ),
                          if (r["jenis"] != null)
                            Text("${r["jenis"]}", style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                          if (r["error"] != null)
                            Text("${r["error"]}", style: const TextStyle(fontSize: 10, color: Color(0xFFDC2626))),
                          const SizedBox(height: 2),
                          Text(
                            "${_waktu(r["waktu"])}"
                            "${_labelSumber(r).isEmpty ? "" : " • ${_labelSumber(r)}"}"
                            " • token ${_tokenRingkas(token)}",
                            style: const TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8)),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: "Hapus entri ini",
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.all(4),
                          constraints: const BoxConstraints(),
                          onPressed: () => _hapusSatu(r),
                          icon: const Icon(Icons.delete_outline, size: 16, color: Color(0xFFCBD5E1)),
                        ),
                        const SizedBox(height: 4),
                        InkWell(
                          onTap: () => _tampilkanPilihSumber(),
                          child: const Icon(Icons.filter_list, size: 16, color: Color(0xFF4F46E5)),
                        ),
                        const Icon(Icons.chevron_right, size: 16, color: Color(0xFFCBD5E1)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    ),
  );
}
