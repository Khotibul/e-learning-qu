import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Pelanggaran siswa (wali kelas) — daftar + tambah + hapus via
/// POST/DELETE /api/mobile/guru/pelanggaran (guard kelas.guruId di backend).
class GuruPelanggaran extends StatefulWidget {
  const GuruPelanggaran({super.key});
  @override
  State<GuruPelanggaran> createState() => _GuruPelanggaranState();
}

class _GuruPelanggaranState extends State<GuruPelanggaran> {
  List<dynamic> data = [];
  List<dynamic> filtered = [];
  bool loading = true;
  final searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    searchCtrl.addListener(_filter);
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/pelanggaran", useCache: false);
      if (mounted) setState(() { data = v is List ? v : []; filtered = v is List ? v : []; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _filter() {
    final q = searchCtrl.text.toLowerCase();
    setState(() { filtered = q.isEmpty ? data : data.where((p) => (p["siswa"]?["nama"] ?? "").toLowerCase().contains(q) || (p["jenis"] ?? "").toLowerCase().contains(q) || (p["deskripsi"] ?? "").toLowerCase().contains(q)).toList(); });
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  Future<void> _form() async {
    List<dynamic> siswas = [];
    try {
      final v = await ApiService.get("/api/mobile/guru/pelanggaran?tab=siswa", useCache: false);
      if (v is List) siswas = v;
    } catch (_) {}
    if (!mounted) return;
    if (siswas.isEmpty) { _snack("Tidak ada siswa di kelas wali Anda", color: const Color(0xFFEF4444)); return; }

    String? siswaId;
    final jenis = TextEditingController();
    final deskripsi = TextEditingController();
    final poin = TextEditingController(text: "10");
    final tindakan = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
        title: const Text("Tambah Pelanggaran"),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: "Siswa", border: OutlineInputBorder()),
              items: siswas.map((s) => DropdownMenuItem<String>(value: (s as Map)["id"] as String, child: Text("${s["nama"]} (${s["kelas"]?["nama"] ?? "-"})", style: const TextStyle(fontSize: 13)))).toList(),
              onChanged: (v) => setDlg(() => siswaId = v),
            ),
            const SizedBox(height: 12),
            TextField(controller: jenis, decoration: const InputDecoration(labelText: "Jenis (mis. Terlambat)", border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: deskripsi, maxLines: 2, decoration: const InputDecoration(labelText: "Deskripsi", border: OutlineInputBorder())),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: poin, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Poin", border: OutlineInputBorder(), isDense: true))),
              const SizedBox(width: 8),
              Expanded(child: TextField(controller: tindakan, decoration: const InputDecoration(labelText: "Tindakan", border: OutlineInputBorder(), isDense: true))),
            ]),
          ])),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan")),
        ],
      )),
    );
    if (ok != true) return;
    if (siswaId == null || jenis.text.trim().isEmpty) { _snack("Siswa & jenis wajib", color: const Color(0xFFEF4444)); return; }
    try {
      await ApiService.post("/api/mobile/guru/pelanggaran", {
        "op": "createPelanggaran",
        "siswaId": siswaId,
        "jenis": jenis.text.trim(),
        "deskripsi": deskripsi.text.trim(),
        "poin": int.tryParse(poin.text),
        "tindakan": tindakan.text.trim(),
      });
      _snack("Pelanggaran dicatat");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _hapus(Map p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Hapus Pelanggaran?"),
        content: Text("${p["siswa"]?["nama"] ?? "-"} • ${p["jenis"] ?? "-"}"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Colors.red), onPressed: () => Navigator.pop(ctx, true), child: const Text("Hapus")),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiService.delete("/api/mobile/guru/pelanggaran?id=${p["id"]}");
      _snack("Dihapus");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  @override
  void dispose() { searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Pelanggaran"), backgroundColor: Colors.white, elevation: 0),
    floatingActionButton: FloatingActionButton.extended(onPressed: _form, icon: const Icon(Icons.add), label: const Text("Tambah")),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : Column(children: [
            Padding(padding: const EdgeInsets.all(12), child: TextField(controller: searchCtrl, decoration: InputDecoration(hintText: "Cari siswa/jenis/deskripsi...", prefixIcon: const Icon(Icons.search, size: 18), filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))), contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10)))),
            Expanded(child: filtered.isEmpty ? const Center(child: Text("Tidak ada pelanggaran", style: TextStyle(color: Colors.black54))) : RefreshIndicator(onRefresh: _load, child: ListView.builder(padding: const EdgeInsets.fromLTRB(16, 0, 16, 80), itemCount: filtered.length, itemBuilder: (_, i) { final p = filtered[i] as Map; return Card(child: ListTile(
              title: Text(p["siswa"]?["nama"] ?? "-", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              subtitle: Text("${p["jenis"] ?? ""} • ${p["poin"] ?? 0} poin\n${p["deskripsi"] ?? ""}", maxLines: 2, style: const TextStyle(fontSize: 11)),
              isThreeLine: true,
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(p["tanggal"]?.toString().split("T").first ?? "", style: const TextStyle(fontSize: 11, color: Colors.black54)),
                IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => _hapus(p)),
              ]),
            )); }))),
          ]),
  );
}
