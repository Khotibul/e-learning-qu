import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Layar Bendahara (Siswa berjabatan BENDAHARA) — mirror website:
/// Kas (summary), Iuran (CRUD + konfirmasi pembayaran), Denda (CRUD + catat),
/// Pengeluaran (CRUD). 1 DB dengan web via /api/mobile/siswa/bendahara.
class SiswaBendahara extends StatefulWidget {
  const SiswaBendahara({super.key});
  @override
  State<SiswaBendahara> createState() => _SiswaBendaharaState();
}

class _SiswaBendaharaState extends State<SiswaBendahara> {
  Map<String, dynamic> summary = {};
  List<dynamic> iuran = [];
  List<dynamic> denda = [];
  List<dynamic> pengeluaran = [];
  bool loading = true;

  String _rp(dynamic n) {
    final v = ((n as num?) ?? 0).round().toString();
    final b = StringBuffer();
    for (int i = 0; i < v.length; i++) {
      if (i > 0 && (v.length - i) % 3 == 0) b.write(".");
      b.write(v[i]);
    }
    return "Rp $b";
  }

  String _dt(dynamic iso) => iso == null ? "-" : iso.toString().substring(0, 10);

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Future.wait([
        ApiService.get("/api/mobile/siswa/bendahara?tab=summary", useCache: false),
        ApiService.get("/api/mobile/siswa/bendahara?tab=iuran", useCache: false),
        ApiService.get("/api/mobile/siswa/bendahara?tab=denda", useCache: false),
        ApiService.get("/api/mobile/siswa/bendahara?tab=pengeluaran", useCache: false),
      ]);
      if (mounted) {
        setState(() {
          if (r[0] is Map) summary = r[0] as Map<String, dynamic>;
          iuran = r[1] is List ? r[1] as List : [];
          denda = r[2] is List ? r[2] as List : [];
          pengeluaran = r[3] is List ? r[3] as List : [];
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _op(Map<String, dynamic> body) async {
    await ApiService.post("/api/mobile/siswa/bendahara", body);
    await _load();
  }

  Future<void> _hapus(String jenis, String id, String label) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Hapus?"),
        content: Text("\"$label\" akan dihapus."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Colors.red), onPressed: () => Navigator.pop(ctx, true), child: const Text("Hapus")),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiService.delete("/api/mobile/siswa/bendahara?jenis=$jenis&id=$id");
      _snack("$label dihapus");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _form(String jenis) async {
    final nama = TextEditingController();
    final nominal = TextEditingController();
    final ket = TextEditingController();
    DateTime? tenggat;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
        title: Text(jenis == "iuran" ? "Tambah Iuran" : jenis == "denda" ? "Tambah Denda" : "Tambah Pengeluaran"),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (jenis != "pengeluaran") ...[
            TextField(controller: nama, decoration: InputDecoration(labelText: jenis == "iuran" ? "Nama iuran" : "Nama denda", border: const OutlineInputBorder())),
            const SizedBox(height: 12),
          ],
          TextField(controller: nominal, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: "Nominal (Rp)", border: const OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: ket, decoration: InputDecoration(labelText: jenis == "pengeluaran" ? "Keterangan" : "Deskripsi (opsional)", border: const OutlineInputBorder())),
          if (jenis == "iuran") ...[
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: Text(tenggat == null ? "Tenggat: -" : "Tenggat: ${tenggat.toString().substring(0, 10)}")),
              TextButton(onPressed: () async {
                final d = await showDatePicker(context: ctx, firstDate: DateTime(2024), lastDate: DateTime(2030), initialDate: DateTime.now());
                if (d != null) setDlg(() => tenggat = d);
              }, child: const Text("Pilih")),
            ]),
          ],
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan")),
        ],
      )),
    );
    if (ok != true) return;
    try {
      final body = <String, dynamic>{"op": jenis == "iuran" ? "createIuran" : jenis == "denda" ? "createDenda" : "createPengeluaran"};
      if (jenis == "pengeluaran") {
        body["keterangan"] = ket.text;
        body["jumlah"] = int.tryParse(nominal.text.replaceAll(".", "")) ?? 0;
      } else {
        body["nama"] = nama.text;
        body["nominal"] = int.tryParse(nominal.text.replaceAll(".", "")) ?? 0;
        if (jenis == "iuran") {
          if (ket.text.isNotEmpty) body["deskripsi"] = ket.text;
          if (tenggat != null) body["tenggat"] = tenggat.toString().substring(0, 10);
        } else {
          if (ket.text.isNotEmpty) body["deskripsi"] = ket.text;
        }
      }
      await _op(body);
      _snack("Berhasil disimpan");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Color _stColor(String s) => s == "LUNAS" ? const Color(0xFF10B981) : s == "MENUNGGU" ? const Color(0xFFF59E0B) : const Color(0xFFEF4444);
  String _stLabel(String s) => s == "LUNAS" ? "LUNAS" : s == "MENUNGGU" ? "MENUNGGU" : s;

  Widget _chip(String label, Color c) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
        child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: c)),
      );

  Widget _summaryCard(String label, dynamic v, IconData icon, Color c) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: c.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)), child: Icon(icon, size: 16, color: c)),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          ]),
          const SizedBox(height: 8),
          Text(_rp(v), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: c)),
        ]),
      );

  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: 4,
        child: Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          appBar: AppBar(
            title: const Text("Bendahara"),
            backgroundColor: Colors.white,
            elevation: 0,
            bottom: const TabBar(
              labelColor: Color(0xFF4F46E5),
              unselectedLabelColor: Colors.black54,
              indicatorColor: Color(0xFF4F46E5),
              tabs: [Tab(text: "Kas"), Tab(text: "Iuran"), Tab(text: "Denda"), Tab(text: "Pengeluaran")],
            ),
          ),
          body: loading
              ? const Center(child: CircularProgressIndicator())
              : TabBarView(children: [
                  // ─── KAS ───
                  RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.all(16), children: [
                      GridView.count(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisCount: 2,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childAspectRatio: 1.6,
                        children: [
                          _summaryCard("Sisa Kas", summary["sisaKas"], Icons.account_balance_wallet_outlined, const Color(0xFF10B981)),
                          _summaryCard("Total Masuk", summary["totalPemasukan"], Icons.trending_up, const Color(0xFF4F46E5)),
                          _summaryCard("Iuran Lunas", summary["pemasukanIuran"], Icons.payments_outlined, const Color(0xFF06B6D4)),
                          _summaryCard("Total Keluar", summary["totalPengeluaran"], Icons.trending_down, const Color(0xFFEF4444)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _summaryCard("Denda Masuk", summary["pemasukanDenda"], Icons.gavel_outlined, const Color(0xFFF59E0B)),
                    ]),
                  ),
                  // ─── IURAN ───
                  RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.all(16), children: [
                      Row(children: [
                        Expanded(child: Text("Iuran Kelas (${iuran.length})", style: const TextStyle(fontWeight: FontWeight.w700))),
                        FilledButton.tonal(onPressed: () => _form("iuran"), child: const Text("+ Tambah")),
                      ]),
                      const SizedBox(height: 8),
                      ...iuran.map((raw) {
                        final it = raw as Map;
                        final pays = (it["pembayaran"] as List?) ?? [];
                        final count = (it["_count"]?["pembayaran"] as num?) ?? pays.length;
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: ExpansionTile(
                            shape: const Border(),
                            title: Text(it["nama"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text("${_rp(it["nominal"])}  •  tenggat ${_dt(it["tenggat"])}  •  $count bayar"),
                            leading: const Icon(Icons.payments_outlined, color: Color(0xFFF97316)),
                            trailing: IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => _hapus("iuran", it["id"], it["nama"] ?? "Iuran")),
                            children: [
                              if (pays.isEmpty) const Padding(padding: EdgeInsets.all(12), child: Text("Belum ada pembayaran", style: TextStyle(color: Colors.black45, fontSize: 12))),
                              ...pays.map((p0) {
                                final p = p0 as Map;
                                final st = (p["status"] ?? "").toString();
                                return ListTile(
                                  dense: true,
                                  title: Text(p["siswa"]?["nama"] ?? "-"),
                                  subtitle: Text("${_rp(p["jumlah"])} • ${_dt(p["tanggalBayar"])}"),
                                  trailing: st == "MENUNGGU"
                                      ? Row(mainAxisSize: MainAxisSize.min, children: [
                                          TextButton(onPressed: () async { try { await _op({"op": "rejectIuran", "iuranId": it["id"], "siswaId": p["siswaId"]}); _snack("Ditolak"); } catch (e) { _snack("Gagal: $e", color: const Color(0xFFEF4444)); } }, child: const Text("Tolak", style: TextStyle(color: Colors.red, fontSize: 12))),
                                          FilledButton(onPressed: () async { try { await _op({"op": "confirmIuran", "iuranId": it["id"], "siswaId": p["siswaId"]}); _snack("Dikonfirmasi LUNAS"); } catch (e) { _snack("Gagal: $e", color: const Color(0xFFEF4444)); } }, child: const Text("Terima", style: TextStyle(fontSize: 12))),
                                        ])
                                      : _chip(_stLabel(st), _stColor(st)),
                                );
                              }),
                              if (pays.isEmpty)
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                                  child: Align(
                                    alignment: Alignment.centerRight,
                                    child: TextButton.icon(
                                      onPressed: () async {
                                        try {
                                          final siswas = await ApiService.get("/api/mobile/siswa/bendahara?tab=siswa", useCache: false);
                                          if (siswas is! List || siswas.isEmpty) return;
                                          if (!context.mounted) return;
                                          final target = await showModalBottomSheet<Map>(
                                            context: context,
                                            builder: (ctx) => ListView(children: siswas.map((s) => ListTile(title: Text(s["nama"] ?? "-"), onTap: () => Navigator.pop(ctx, s as Map))).toList()),
                                          );
                                          if (target != null) { await _op({"op": "recordIuran", "iuranId": it["id"], "siswaId": target["id"]}); _snack("Dicatat LUNAS"); }
                                        } catch (e) { _snack("Gagal: $e", color: const Color(0xFFEF4444)); }
                                      },
                                      icon: const Icon(Icons.how_to_reg_outlined, size: 16),
                                      label: const Text("Catat lunas manual"),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        );
                      }),
                      if (iuran.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text("Belum ada iuran", textAlign: TextAlign.center, style: TextStyle(color: Colors.black45))),
                    ]),
                  ),
                  // ─── DENDA ───
                  RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.all(16), children: [
                      Row(children: [
                        Expanded(child: Text("Denda Kelas (${denda.length})", style: const TextStyle(fontWeight: FontWeight.w700))),
                        FilledButton.tonal(onPressed: () => _form("denda"), child: const Text("+ Tambah")),
                      ]),
                      const SizedBox(height: 8),
                      ...denda.map((raw) {
                        final it = raw as Map;
                        final pays = (it["pembayaran"] as List?) ?? [];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: ExpansionTile(
                            shape: const Border(),
                            title: Text(it["nama"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text("${_rp(it["nominal"])} • ${pays.length} bayar"),
                            leading: const Icon(Icons.gavel_outlined, color: Color(0xFFEF4444)),
                            trailing: IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => _hapus("denda", it["id"], it["nama"] ?? "Denda")),
                            children: [
                              ...pays.map((p0) {
                                final p = p0 as Map;
                                return ListTile(dense: true, title: Text(p["siswa"]?["nama"] ?? "-"), subtitle: Text(_rp(p["jumlah"])), trailing: _chip((p["status"] ?? "").toString(), _stColor((p["status"] ?? "").toString())));
                              }),
                              Padding(
                                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                                child: Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton.icon(
                                    onPressed: () async {
                                      try {
                                        final siswas = await ApiService.get("/api/mobile/siswa/bendahara?tab=siswa", useCache: false);
                                        if (siswas is! List || siswas.isEmpty) return;
                                        if (!context.mounted) return;
                                        final target = await showModalBottomSheet<Map>(
                                          context: context,
                                          builder: (ctx) => ListView(children: siswas.map((s) => ListTile(title: Text(s["nama"] ?? "-"), onTap: () => Navigator.pop(ctx, s as Map))).toList()),
                                        );
                                        if (target != null) { await _op({"op": "recordDenda", "dendaId": it["id"], "siswaId": target["id"], "jumlah": it["nominal"]}); _snack("Denda dicatat"); }
                                      } catch (e) { _snack("Gagal: $e", color: const Color(0xFFEF4444)); }
                                    },
                                    icon: const Icon(Icons.how_to_reg_outlined, size: 16),
                                    label: const Text("Catat pembayaran"),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                      if (denda.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text("Belum ada denda", textAlign: TextAlign.center, style: TextStyle(color: Colors.black45))),
                    ]),
                  ),
                  // ─── PENGELUARAN ───
                  RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.all(16), children: [
                      Row(children: [
                        Expanded(child: Text("Pengeluaran (${pengeluaran.length})", style: const TextStyle(fontWeight: FontWeight.w700))),
                        FilledButton.tonal(onPressed: () => _form("pengeluaran"), child: const Text("+ Tambah")),
                      ]),
                      const SizedBox(height: 8),
                      ...pengeluaran.map((raw) {
                        final it = raw as Map;
                        return Card(
                          child: ListTile(
                            leading: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: const Color(0xFFEF4444).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.receipt_long_outlined, size: 16, color: Color(0xFFEF4444))),
                            title: Text(it["keterangan"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text(_dt(it["tanggal"])),
                            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                              Text(_rp(it["jumlah"]), style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFEF4444))),
                              IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => _hapus("pengeluaran", it["id"], it["keterangan"] ?? "Pengeluaran")),
                            ]),
                          ),
                        );
                      }),
                      if (pengeluaran.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text("Belum ada pengeluaran", textAlign: TextAlign.center, style: TextStyle(color: Colors.black45))),
                    ]),
                  ),
                ]),
        ),
      );
}
