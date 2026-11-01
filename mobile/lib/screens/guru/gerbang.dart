import "package:flutter/material.dart";
import "package:intl/intl.dart";
import "../../services/api_service.dart";

/// Gerbang Pondok — mirror web /gerbang.
/// Cari izin aktif (NIS/nama/token QR/no. surat), check-out & check-in santri.
class GuruGerbang extends StatefulWidget {
  const GuruGerbang({super.key});
  @override
  State<GuruGerbang> createState() => _GuruGerbangState();
}

class _GuruGerbangState extends State<GuruGerbang> {
  final _cari = TextEditingController();
  List<dynamic> rows = [];
  List<dynamic> riwayat = [];
  Map<String, dynamic>? pesan;
  Map<String, String> jenisLabel = {};
  Map<String, String> statusLabel = {};
  bool loading = false;
  bool verifikasiPenjemput = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _muatDaftar());
  }

  @override
  void dispose() { _cari.dispose(); super.dispose(); }

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
      if (mounted && d is Map) setState(() {
        rows = (d["rows"] as List?) ?? [];
        jenisLabel = _strMap(d["jenisLabel"]);
        statusLabel = _strMap(d["statusLabel"]);
        pesan = null;
      });
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
        });
        if (rows.isEmpty) _snack("Izin tidak ditemukan", color: const Color(0xFFF59E0B));
      }
    } catch (e) {
      if (mounted) setState(() => pesan = {"error": "$e"});
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _scanToken() async {
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
    if (token != null && token.isNotEmpty) await _cariIzin(token);
  }

  Future<void> _checkout(String izinId) async {
    setState(() => loading = true);
    try {
      await ApiService.post("/api/mobile/pondok/gerbang", {
        "op": "checkout",
        "izinId": izinId,
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
  Widget build(BuildContext context) => DefaultTabController(
    length: 2,
    child: Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text("Gerbang Pondok"),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [IconButton(onPressed: loading ? null : _muatDaftar, icon: const Icon(Icons.refresh, size: 20))],
        bottom: const TabBar(
          labelColor: Color(0xFF4F46E5),
          unselectedLabelColor: Color(0xFF64748B),
          tabs: [Tab(text: "Gerbang"), Tab(text: "Riwayat Keluar/Masuk")],
        ),
      ),
      body: TabBarView(children: [_tabGerbang(), _tabRiwayat()]),
    ),
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
          if (bolehCheckout || bolehCheckin) Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Wrap(spacing: 8, children: [
              if (bolehCheckout) FilledButton.icon(
                onPressed: loading ? null : () => _checkout("${r["id"]}"),
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
