import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Bank soal guru — daftar + cari + tambah/edit/hapus soal
/// via POST/DELETE /api/mobile/guru/soal (mirror web createSoal/updateSoal/deleteSoal).
class GuruBankSoal extends StatefulWidget {
  const GuruBankSoal({super.key});
  @override
  State<GuruBankSoal> createState() => _GuruBankSoalState();
}

class _GuruBankSoalState extends State<GuruBankSoal> {
  List<dynamic> data = [];
  List<dynamic> filtered = [];
  bool loading = true;
  final searchCtrl = TextEditingController();

  static const _jenis = ["PILIHAN_GANDA", "ESSAY", "TRUE_FALSE"];
  static const _tingkat = ["MUDAH", "SEDANG", "SULIT"];

  @override
  void initState() {
    super.initState();
    _load();
    searchCtrl.addListener(_filter);
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/soal", useCache: false);
      if (mounted) setState(() { data = v is List ? v : []; filtered = v is List ? v : []; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _filter() {
    final q = searchCtrl.text.toLowerCase();
    setState(() { filtered = q.isEmpty ? data : data.where((s) => (s["pertanyaan"] ?? "").toLowerCase().contains(q) || (s["jenisSoal"] ?? "").toLowerCase().contains(q)).toList(); });
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  Future<void> _form([Map? existing]) async {
    List<dynamic> mapels = [];
    try {
      final mv = await ApiService.get("/api/mobile/guru/mapel");
      if (mv is List) mapels = mv;
    } catch (_) {}
    if (!mounted) return;

    final pertanyaan = TextEditingController(text: existing?["pertanyaan"]?.toString() ?? "");
    final jawaban = TextEditingController(text: existing?["jawaban"]?.toString() ?? "");
    final poin = TextEditingController(text: "${existing?["poin"] ?? 1}");
    String jenis = existing?["jenisSoal"]?.toString() ?? "PILIHAN_GANDA";
    if (!_jenis.contains(jenis)) jenis = "PILIHAN_GANDA";
    String tingkat = existing?["tingkatKesulitan"]?.toString() ?? "SEDANG";
    if (!_tingkat.contains(tingkat)) tingkat = "SEDANG";
    String? mapelId = existing?["mataPelajaranId"] as String?;
    bool tf = existing?["trueFalse"] == true;
    final optsCtrl = List.generate(4, (i) {
      final pg = existing?["pilihanGanda"];
      if (pg is List && i < pg.length) return TextEditingController(text: pg[i]?.toString() ?? "");
      return TextEditingController();
    });

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
        title: Text(existing == null ? "Tambah Soal" : "Edit Soal"),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: pertanyaan, maxLines: 3, decoration: const InputDecoration(labelText: "Pertanyaan", border: OutlineInputBorder())),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: jenis,
              decoration: const InputDecoration(labelText: "Jenis", border: OutlineInputBorder()),
              items: _jenis.map((j) => DropdownMenuItem(value: j, child: Text(j.replaceAll("_", " "), style: const TextStyle(fontSize: 13)))).toList(),
              onChanged: (v) => setDlg(() => jenis = v ?? jenis),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: tingkat,
              decoration: const InputDecoration(labelText: "Tingkat Kesulitan", border: OutlineInputBorder()),
              items: _tingkat.map((t) => DropdownMenuItem(value: t, child: Text(t, style: const TextStyle(fontSize: 13)))).toList(),
              onChanged: (v) => setDlg(() => tingkat = v ?? tingkat),
            ),
            const SizedBox(height: 12),
            if (mapels.isNotEmpty)
              DropdownButtonFormField<String>(
                initialValue: mapelId,
                decoration: const InputDecoration(labelText: "Mata Pelajaran", border: OutlineInputBorder()),
                items: mapels.map((m) => DropdownMenuItem<String>(value: (m as Map)["id"] as String, child: Text("${m["nama"]}", style: const TextStyle(fontSize: 13)))).toList(),
                onChanged: (v) => setDlg(() => mapelId = v),
              ),
            if (mapels.isEmpty) const Padding(padding: EdgeInsets.only(bottom: 8), child: Text("Mapel tidak ditemukan — periksa pengampuan", style: TextStyle(fontSize: 11, color: Colors.red))),
            const SizedBox(height: 12),
            if (jenis == "PILIHAN_GANDA") ...[
              const Text("Pilihan Ganda", style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
              const SizedBox(height: 6),
              for (int i = 0; i < 4; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: TextField(
                    controller: optsCtrl[i],
                    decoration: InputDecoration(labelText: "Opsi ${String.fromCharCode(65 + i)}", border: const OutlineInputBorder(), isDense: true),
                  ),
                ),
              TextField(controller: jawaban, decoration: const InputDecoration(labelText: "Kunci jawaban (teks persis salah satu opsi)", border: OutlineInputBorder(), isDense: true)),
            ] else if (jenis == "TRUE_FALSE") ...[
              SegmentedButton<bool>(
                segments: const [ButtonSegment(value: true, label: Text("Benar")), ButtonSegment(value: false, label: Text("Salah"))],
                selected: {tf},
                onSelectionChanged: (v) => setDlg(() { tf = v.first; jawaban.text = v.first ? "true" : "false"; }),
              ),
            ] else ...[
              TextField(controller: jawaban, maxLines: 2, decoration: const InputDecoration(labelText: "Kunci/jawaban model (opsional)", border: OutlineInputBorder())),
            ],
            const SizedBox(height: 12),
            TextField(controller: poin, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Poin", border: OutlineInputBorder(), isDense: true)),
          ])),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan")),
        ],
      )),
    );
    if (ok != true) {
      for (final c in optsCtrl) { c.dispose(); }
      return;
    }
    if (pertanyaan.text.trim().isEmpty || mapelId == null) {
      for (final c in optsCtrl) { c.dispose(); }
      _snack(pertanyaan.text.trim().isEmpty ? "Pertanyaan wajib" : "Pilih mata pelajaran", color: const Color(0xFFEF4444));
      return;
    }
    try {
      await ApiService.post("/api/mobile/guru/soal", {
        "op": existing == null ? "createSoal" : "updateSoal",
        if (existing != null) "id": existing["id"],
        "pertanyaan": pertanyaan.text.trim(),
        "jenisSoal": jenis,
        "tingkatKesulitan": tingkat,
        "mataPelajaranId": mapelId,
        "poin": int.tryParse(poin.text) ?? 1,
        "jawaban": jenis == "TRUE_FALSE" ? (tf ? "true" : "false") : jawaban.text.trim(),
        if (jenis == "PILIHAN_GANDA") "pilihanGanda": optsCtrl.map((c) => c.text.trim()).where((o) => o.isNotEmpty).toList(),
        if (jenis == "TRUE_FALSE") "trueFalse": tf,
      });
      for (final c in optsCtrl) { c.dispose(); }
      _snack("Soal tersimpan");
      _load();
    } catch (e) {
      for (final c in optsCtrl) { c.dispose(); }
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _hapus(Map s) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Hapus Soal?"),
        content: Text("\"${s["pertanyaan"] ?? "-"}\" akan dihapus."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Colors.red), onPressed: () => Navigator.pop(ctx, true), child: const Text("Hapus")),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiService.delete("/api/mobile/guru/soal?id=${s["id"]}");
      _snack("Soal dihapus");
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
    appBar: AppBar(title: const Text("Bank Soal"), backgroundColor: Colors.white, elevation: 0),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () => _form(),
      icon: const Icon(Icons.add),
      label: const Text("Tambah"),
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : Column(children: [
            Padding(padding: const EdgeInsets.all(12), child: TextField(controller: searchCtrl, decoration: InputDecoration(hintText: "Cari soal...", prefixIcon: const Icon(Icons.search, size: 18), filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))), contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10)))),
            Expanded(child: filtered.isEmpty ? const Center(child: Text("Tidak ada soal", style: TextStyle(color: Colors.black54))) : RefreshIndicator(onRefresh: _load, child: ListView.builder(padding: const EdgeInsets.fromLTRB(16, 0, 16, 80), itemCount: filtered.length, itemBuilder: (_, i) { final s = filtered[i] as Map; return Card(child: ListTile(
              title: Text(s["pertanyaan"] ?? "-", maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              subtitle: Text("${(s["mataPelajaran"] is Map ? (s["mataPelajaran"]["nama"] ?? "") : s["mataPelajaran"] ?? "")} • ${s["jenisSoal"] ?? ""} • ${s["tingkatKesulitan"] ?? ""} • ${s["poin"] ?? 0} poin", style: const TextStyle(fontSize: 11)),
              trailing: PopupMenuButton<String>(
                onSelected: (v) => v == "edit" ? _form(s) : _hapus(s),
                itemBuilder: (_) => const [PopupMenuItem(value: "edit", child: Text("Edit")), PopupMenuItem(value: "hapus", child: Text("Hapus", style: TextStyle(color: Colors.red)))],
              ),
            )); }))),
          ]),
  );
}
