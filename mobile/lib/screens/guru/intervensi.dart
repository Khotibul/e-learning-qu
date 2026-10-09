import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Intervensi siswa — daftar + tambah + ubah status + hapus via
/// POST/DELETE /api/mobile/guru/intervensi (mirror web intervensi actions).
class GuruIntervensi extends StatefulWidget {
  const GuruIntervensi({super.key});
  @override
  State<GuruIntervensi> createState() => _GuruIntervensiState();
}

class _GuruIntervensiState extends State<GuruIntervensi> {
  List<dynamic> data = [];
  List<dynamic> filtered = [];
  bool loading = true;
  final searchCtrl = TextEditingController();

  static const _tipe = ["REMEDIAL", "TUGAS_TAMBAHAN", "MENTORING", "REKOMENDASI_MATERI", "KONSULTASI", "FOLLOW_UP"];
  static const _status = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

  @override
  void initState() {
    super.initState();
    _load();
    searchCtrl.addListener(_filter);
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/intervensi", useCache: false);
      if (mounted) setState(() { data = v is List ? v : []; filtered = v is List ? v : []; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _filter() {
    final q = searchCtrl.text.toLowerCase();
    setState(() { filtered = q.isEmpty ? data : data.where((it) => (it["siswa"]?["nama"] ?? "").toLowerCase().contains(q) || (it["tipe"] ?? "").toLowerCase().contains(q) || (it["status"] ?? "").toLowerCase().contains(q)).toList(); });
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  Future<void> _op(Map<String, dynamic> body) async {
    await ApiService.post("/api/mobile/guru/intervensi", body);
    await _load();
  }

  Future<void> _form() async {
    List<dynamic> siswas = [];
    try {
      final v = await ApiService.get("/api/mobile/guru/intervensi?tab=siswa", useCache: false);
      if (v is List) siswas = v;
    } catch (_) {}
    if (!mounted) return;
    if (siswas.isEmpty) { _snack("Tidak ada siswa di kelas Anda", color: const Color(0xFFEF4444)); return; }

    String? siswaId;
    String tipe = _tipe.first;
    final reason = TextEditingController();
    final action = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
        title: const Text("Tambah Intervensi"),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: "Siswa", border: OutlineInputBorder()),
              items: siswas.map((s) => DropdownMenuItem<String>(value: (s as Map)["id"] as String, child: Text("${s["nama"]} (${s["kelas"]?["nama"] ?? "-"})", style: const TextStyle(fontSize: 13)))).toList(),
              onChanged: (v) => setDlg(() => siswaId = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: tipe,
              decoration: const InputDecoration(labelText: "Tipe", border: OutlineInputBorder()),
              items: _tipe.map((t) => DropdownMenuItem(value: t, child: Text(t.replaceAll("_", " "), style: const TextStyle(fontSize: 13)))).toList(),
              onChanged: (v) => setDlg(() => tipe = v ?? tipe),
            ),
            const SizedBox(height: 12),
            TextField(controller: reason, maxLines: 2, decoration: const InputDecoration(labelText: "Alasan (reason)", border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: action, maxLines: 2, decoration: const InputDecoration(labelText: "Tindakan (action)", border: OutlineInputBorder())),
          ])),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan")),
        ],
      )),
    );
    if (ok != true) return;
    if (siswaId == null || reason.text.trim().isEmpty || action.text.trim().isEmpty) {
      _snack("Siswa, alasan & tindakan wajib", color: const Color(0xFFEF4444));
      return;
    }
    try {
      await _op({"op": "createIntervention", "siswaId": siswaId, "tipe": tipe, "reason": reason.text.trim(), "action": action.text.trim()});
      _snack("Intervensi dibuat");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _ubahStatus(Map it) async {
    String status = _status.contains(it["status"]) ? it["status"] : _status.first;
    final notes = TextEditingController(text: it["notes"]?.toString() ?? "");
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
        title: Text("Status: ${it["siswa"]?["nama"] ?? "-"}"),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          DropdownButtonFormField<String>(
            initialValue: status,
            decoration: const InputDecoration(labelText: "Status", border: OutlineInputBorder()),
            items: _status.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 13)))).toList(),
            onChanged: (v) => setDlg(() => status = v ?? status),
          ),
          const SizedBox(height: 12),
          TextField(controller: notes, maxLines: 3, decoration: const InputDecoration(labelText: "Catatan (notes)", border: OutlineInputBorder())),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan")),
        ],
      )),
    );
    if (ok != true) return;
    try {
      await _op({"op": "updateStatus", "id": it["id"], "status": status, "notes": notes.text.trim()});
      _snack("Status diperbarui");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _hapus(Map it) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Hapus Intervensi?"),
        content: Text("${it["siswa"]?["nama"] ?? "-"} • ${it["tipe"] ?? "-"}"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Colors.red), onPressed: () => Navigator.pop(ctx, true), child: const Text("Hapus")),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiService.delete("/api/mobile/guru/intervensi?id=${it["id"]}");
      _snack("Dihapus");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Color _stColor(String s) => s == "OPEN" ? const Color(0xFFF59E0B) : s == "IN_PROGRESS" ? const Color(0xFF0EA5E9) : s == "COMPLETED" ? const Color(0xFF10B981) : const Color(0xFF64748B);

  @override
  void dispose() { searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Intervensi"), backgroundColor: Colors.white, elevation: 0),
    floatingActionButton: FloatingActionButton.extended(onPressed: _form, icon: const Icon(Icons.add), label: const Text("Tambah")),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : Column(children: [
            Padding(padding: const EdgeInsets.all(12), child: TextField(controller: searchCtrl, decoration: InputDecoration(hintText: "Cari siswa/tipe/status...", prefixIcon: const Icon(Icons.search, size: 18), filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))), contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10)))),
            Expanded(child: filtered.isEmpty ? const Center(child: Text("Tidak ada intervensi", style: TextStyle(color: Colors.black54))) : RefreshIndicator(onRefresh: _load, child: ListView.builder(padding: const EdgeInsets.fromLTRB(16, 0, 16, 80), itemCount: filtered.length, itemBuilder: (_, i) { final it = filtered[i] as Map; final st = (it["status"] ?? "OPEN").toString(); return Card(child: ListTile(
              onTap: () => _ubahStatus(it),
              title: Text(it["siswa"]?["nama"] ?? "-", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              subtitle: Text("${(it["tipe"] ?? "").toString().replaceAll("_", " ")}\n${it["reason"] ?? ""}", maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11)),
              isThreeLine: true,
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: _stColor(st).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)), child: Text(st, style: TextStyle(color: _stColor(st), fontSize: 9, fontWeight: FontWeight.w700))),
                IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => _hapus(it)),
              ]),
            )); }))),
          ]),
  );
}
