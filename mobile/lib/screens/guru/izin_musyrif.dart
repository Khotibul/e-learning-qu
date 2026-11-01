import "package:flutter/material.dart";
import "package:intl/intl.dart";
import "../../services/api_service.dart";

/// Izin Musyrif — mirror web /guru/izin-musyrif.
/// Persetujuan tahap musyrif + monitoring keberadaan santri binaan.
class GuruIzinMusyrif extends StatefulWidget {
  const GuruIzinMusyrif({super.key});
  @override
  State<GuruIzinMusyrif> createState() => _GuruIzinMusyrifState();
}

class _GuruIzinMusyrifState extends State<GuruIzinMusyrif> {
  bool loading = true;
  String? error;
  List<dynamic> antrean = [];
  Map<String, dynamic> monitoring = {};
  Map<String, String> statusLabel = {};
  Map<String, String> jenisLabel = {};
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final hasil = await Future.wait([
        ApiService.get("/api/mobile/guru/izin-musyrif", useCache: false),
        ApiService.get("/api/mobile/guru/izin-musyrif?view=monitoring", useCache: false),
      ]);
      if (!mounted) return;
      final a = hasil[0] is Map ? Map<String, dynamic>.from(hasil[0] as Map) : {};
      setState(() {
        antrean = (a["rows"] as List?) ?? [];
        statusLabel = _strMap(a["statusLabel"]);
        jenisLabel = _strMap(a["jenisLabel"]);
        monitoring = hasil[1] is Map ? Map<String, dynamic>.from(hasil[1] as Map) : {};
        loading = false;
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() { error = e.toString(); loading = false; });
    }
  }

  static Map<String, String> _strMap(dynamic v) => v is Map ? v.map((k, val) => MapEntry("$k", "$val")) : {};

  static String _fmt(dynamic v) {
    final d = DateTime.tryParse("$v");
    return d == null ? "-" : DateFormat("dd MMM yyyy HH:mm", "id_ID").format(d.toLocal());
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  Future<void> _aksi(String mode, String izinId) async {
    final ctrl = TextEditingController();
    final teks = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(mode == "setuju" ? "Setujui sebagai Musyrif" : "Tolak Izin"),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          decoration: InputDecoration(
            labelText: mode == "tolak" ? "Alasan penolakan (wajib)" : "Catatan (opsional)",
            border: const OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Batal")),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: mode == "tolak" ? const Color(0xFFEF4444) : const Color(0xFF4F46E5)),
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            child: const Text("Konfirmasi"),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (teks == null) return;
    if (mode == "tolak" && teks.length < 5) { _snack("Alasan minimal 5 karakter", color: const Color(0xFFEF4444)); return; }
    setState(() => busy = true);
    try {
      await ApiService.post("/api/mobile/guru/izin-musyrif", {
        "op": mode,
        "izinId": izinId,
        if (mode == "setuju") "catatan": teks.isEmpty ? null : teks,
        if (mode == "tolak") "alasan": teks,
      });
      _snack(mode == "setuju" ? "Disetujui musyrif" : "Izin ditolak");
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
        title: const Text("Perizinan Santri — Musyrif"),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [IconButton(onPressed: loading ? null : _load, icon: const Icon(Icons.refresh, size: 20))],
        bottom: TabBar(
          labelColor: const Color(0xFF4F46E5),
          unselectedLabelColor: const Color(0xFF64748B),
          tabs: [Tab(text: "Antrean (${antrean.length})"), const Tab(text: "Monitoring Pondok")],
        ),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.admin_panel_settings_outlined, size: 40, color: Color(0xFF94A3B8)),
                  const SizedBox(height: 8),
                  Text("Halaman ini khusus Musyrif / Pembina Asrama.\n$error", textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF64748B))),
                ])))
              : TabBarView(children: [_tabAntrean(), _tabMonitoring()]),
    ),
  );

  Widget _tabAntrean() {
    if (antrean.isEmpty) {
      return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text("Tidak ada izin yang menunggu persetujuan musyrif.", style: TextStyle(color: Color(0xFF64748B)))));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: antrean.length,
        itemBuilder: (_, i) {
          final r = antrean[i] as Map;
          final santri = (r["santri"] as Map?) ?? {};
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text("${santri["nama"] ?? "-"}", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    Text("${santri["nisNo"] ?? "-"} • ${santri["asrama"]?["nama"] ?? "-"} / ${santri["kamar"]?["nama"] ?? "-"}", style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                  ])),
                  _badge(statusLabel["${r["status"]}"] ?? "${r["status"]}", const Color(0xFFF59E0B)),
                ]),
                const SizedBox(height: 4),
                Text(jenisLabel["${r["jenis"]}"] ?? "${r["jenis"]}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4F46E5))),
                const SizedBox(height: 4),
                Text("${r["alasan"] ?? ""}", style: const TextStyle(fontSize: 12, color: Color(0xFF475569))),
                const SizedBox(height: 6),
                _meta("Keluar: ${_fmt(r["rencanaKeluar"])}"),
                _meta("Kembali: ${_fmt(r["rencanaKembali"])}"),
                _meta("Tujuan: ${r["alamatTujuan"] ?? "-"}"),
                _meta("Penjemput: ${r["namaPenjemput"] ?? "-"} — ${r["noTelpPenjemput"] ?? "-"}"),
                const SizedBox(height: 8),
                Wrap(spacing: 8, children: [
                  FilledButton.icon(
                    onPressed: busy ? null : () => _aksi("setuju", "${r["id"]}"),
                    icon: const Icon(Icons.check_circle_outline, size: 15),
                    label: const Text("Setujui", style: TextStyle(fontSize: 11)),
                  ),
                  OutlinedButton.icon(
                    onPressed: busy ? null : () => _aksi("tolak", "${r["id"]}"),
                    icon: const Icon(Icons.cancel_outlined, size: 15, color: Color(0xFFEF4444)),
                    label: const Text("Tolak", style: TextStyle(fontSize: 11, color: Color(0xFFEF4444))),
                  ),
                ]),
              ]),
            ),
          );
        },
      ),
    );
  }

  Widget _tabMonitoring() {
    final stat = (monitoring["statistik"] as Map?) ?? {};
    final sedangIzin = (monitoring["sedangIzin"] as List?) ?? [];
    final terlambat = (monitoring["terlambat"] as List?) ?? [];
    final statistik = <List<Object>>[
      ["Total Santri", "${stat["totalSantri"] ?? 0}", const Color(0xFF0F172A)],
      ["Di Pondok", "${stat["diPondok"] ?? 0}", const Color(0xFF10B981)],
      ["Izin Disetujui", "${stat["izinAktif"] ?? 0}", const Color(0xFF4F46E5)],
      ["Menunggu", "${stat["menunggu"] ?? 0}", const Color(0xFFF59E0B)],
      ["Sedang Pulang", "${stat["sedangPulang"] ?? 0}", const Color(0xFF0EA5E9)],
      ["Terlambat", "${stat["terlambat"] ?? 0}", const Color(0xFFEF4444)],
    ];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 3,
            childAspectRatio: 1.55,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            children: statistik.map((s) => Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text("${s[1]}", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: s[2] as Color)),
                Text("${s[0]}", textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, color: Color(0xFF64748B))),
              ]),
            )).toList(),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text("Santri Sedang Izin (${sedangIzin.length})", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 8),
                if (sedangIzin.isEmpty) const Text("Tidak ada santri sedang izin.", style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ...sedangIzin.cast<Map>().map((s) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text("${s["nama"]} (${s["nisNo"] ?? "-"})", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                      Text("${s["asrama"]?["nama"] ?? "-"}", style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                    ])),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text("${s["keberadaan"] ?? "-"}", style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF0EA5E9))),
                      if ((s["izins"] as List?)?.isNotEmpty == true) Text("Batas: ${_fmt((s["izins"] as List).first["rencanaKembali"])}", style: const TextStyle(fontSize: 9, color: Color(0xFF64748B))),
                    ]),
                  ]),
                )),
              ]),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text("Terlambat Kembali (${terlambat.length})", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFFEF4444))),
                const SizedBox(height: 8),
                if (terlambat.isEmpty) const Text("Tidak ada keterlambatan.", style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ...terlambat.cast<Map>().map((s) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(children: [
                    Expanded(child: Text("${s["nama"]} (${s["nisNo"] ?? "-"})", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFB91C1C)))),
                    if ((s["izins"] as List?)?.isNotEmpty == true) Text("Batas: ${_fmt((s["izins"] as List).first["rencanaKembali"])}", style: const TextStyle(fontSize: 9, color: Color(0xFFEF4444))),
                  ]),
                )),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _meta(String text) => Padding(
    padding: const EdgeInsets.only(top: 2),
    child: Text(text, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
  );

  Widget _badge(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
    child: Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
  );
}
