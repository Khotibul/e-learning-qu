import "package:flutter/material.dart";
import "../../services/api_service.dart";
class GuruNilai extends StatefulWidget { const GuruNilai({super.key}); @override State<GuruNilai> createState() => _GuruNilaiState(); }
class _GuruNilaiState extends State<GuruNilai> {
  List<dynamic> nilais=[]; List<dynamic> filtered=[]; List<dynamic> ujians=[]; bool loading=true; final searchCtrl=TextEditingController();
  @override void initState(){ super.initState(); _load(); searchCtrl.addListener(_filter); }
  Future<void> _load() async {
    try { final v=await ApiService.get("/api/mobile/guru/nilai"); if(mounted) setState(() { ujians=v["ujians"]??[]; nilais=v["nilais"]??[]; filtered=v["nilais"]??[]; loading=false;}); } catch(_){ if(mounted) setState(()=> loading=false);}
  }
  void _filter(){ final q=searchCtrl.text.toLowerCase(); setState((){ filtered=q.isEmpty? nilais: nilais.where((n)=> (n["siswa"]?["nama"]??"").toLowerCase().contains(q) || (n["ujian"]?["nama"]??"").toLowerCase().contains(q)).toList();}); }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  /// Alur penilaian essay: pilih ujian → daftar jawaban essay → input nilai+komentar.
  Future<void> _gradeEssayFlow() async {
    if (ujians.isEmpty) { _snack("Belum ada ujian", color: const Color(0xFFEF4444)); return; }
    final picked = await showModalBottomSheet<Map>(
      context: context,
      builder: (ctx) => ListView(
        shrinkWrap: true,
        children: ujians.map((u) => ListTile(
          leading: const Icon(Icons.assignment_outlined, size: 18, color: Color(0xFF4F46E5)),
          title: Text(u["nama"] ?? "-", style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          subtitle: Text(u["kelas"]?["nama"] ?? "-", style: const TextStyle(fontSize: 11)),
          onTap: () => Navigator.pop(ctx, u as Map),
        )).toList(),
      ),
    );
    if (picked == null || !mounted) return;

    List<dynamic> essays = [];
    try {
      final v = await ApiService.get("/api/mobile/guru/nilai?tab=essays&ujianId=${picked["id"]}", useCache: false);
      if (v is List) essays = v;
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
      return;
    }
    if (!mounted) return;
    if (essays.isEmpty) { _snack("Tidak ada jawaban essay di ujian ini"); return; }

    if (!mounted) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        builder: (ctx, scrollCtrl) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text("Penilaian Essay — ${picked["nama"]}", style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
            Expanded(
              child: ListView.builder(
                controller: scrollCtrl,
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                itemCount: essays.length,
                itemBuilder: (_, i) {
                  final e = essays[i] as Map;
                  final penilaian = e["penilaianEssay"] as Map?;
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text(e["siswa"]?["nama"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                          if (penilaian != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(color: const Color(0xFF10B981).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                              child: Text("Dinilai: ${penilaian["nilai"]}", style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF10B981))),
                            ),
                        ]),
                        const SizedBox(height: 6),
                        Text(e["soal"]?["pertanyaan"] ?? "-", style: const TextStyle(fontSize: 11, color: Colors.black54)),
                        const SizedBox(height: 6),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFE2E8F0))),
                          child: Text(e["esaiJawaban"]?.toString().isNotEmpty == true ? "${e["esaiJawaban"]}" : (e["jawaban"] ?? "-").toString(), style: const TextStyle(fontSize: 12)),
                        ),
                        const SizedBox(height: 8),
                        _GradeForm(jawabanId: e["id"].toString(), nilaiAwal: penilaian?["nilai"]?.toString() ?? "", komentarAwal: penilaian?["komentar"]?.toString() ?? "", onDone: (msg, ok) { _snack(msg, color: ok ? const Color(0xFF10B981) : const Color(0xFFEF4444)); }),
                      ]),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
  @override void dispose(){ searchCtrl.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: const Color(0xFFF8FAFC), appBar: AppBar(title: const Text("Nilai"), backgroundColor: Colors.white, elevation:0, actions: [IconButton(icon: const Icon(Icons.grading_outlined, size: 20), tooltip: "Nilai Essay", onPressed: _gradeEssayFlow), const SizedBox(width: 8)]), body: loading? const Center(child: CircularProgressIndicator()): Column(children: [Padding(padding: const EdgeInsets.all(12), child: TextField(controller: searchCtrl, decoration: InputDecoration(hintText: "Cari siswa atau ujian...", prefixIcon: const Icon(Icons.search, size:18), filled:true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))), contentPadding: const EdgeInsets.symmetric(horizontal:12, vertical:10)))), Padding(padding: const EdgeInsets.symmetric(horizontal:16), child: Row(children: [Text("Ujian: ${ujians.length}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize:12, color: Color(0xFF64748B))), const Spacer(), Text("${filtered.length} nilai", style: const TextStyle(fontSize:12, color: Color(0xFF64748B)))])), const SizedBox(height:8), Expanded(child: filtered.isEmpty? const Center(child: Text("Tidak ada nilai", style: TextStyle(color: Colors.black54))): ListView.builder(padding: const EdgeInsets.fromLTRB(16,0,16,16), itemCount: filtered.length, itemBuilder: (_,i){ final n=filtered[i]; return Card(child: ListTile(title: Text(n["siswa"]?["nama"]??"-", style: const TextStyle(fontSize:13, fontWeight: FontWeight.w600)), subtitle: Text("${n["ujian"]?["nama"]??""}", style: const TextStyle(fontSize:11)), trailing: Container(padding: const EdgeInsets.symmetric(horizontal:12, vertical:6), decoration: BoxDecoration(color: (n["nilai"]??0)>=75? Colors.green: Colors.orange, borderRadius: BorderRadius.circular(20)), child: Text("${n["nilai"]}", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize:12))))); }))]));
}




class _GradeForm extends StatefulWidget {
  final String jawabanId; final String nilaiAwal; final String komentarAwal;
  final void Function(String msg, bool ok) onDone;
  const _GradeForm({required this.jawabanId, required this.nilaiAwal, required this.komentarAwal, required this.onDone});
  @override State<_GradeForm> createState() => _GradeFormState();
}

class _GradeFormState extends State<_GradeForm> {
  late final TextEditingController nilai;
  late final TextEditingController komentar;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    nilai = TextEditingController(text: widget.nilaiAwal);
    komentar = TextEditingController(text: widget.komentarAwal);
  }

  @override
  void dispose() { nilai.dispose(); komentar.dispose(); super.dispose(); }

  Future<void> _simpan() async {
    final v = int.tryParse(nilai.text.trim());
    if (v == null || v < 0) { widget.onDone("Nilai tidak valid", false); return; }
    setState(() => saving = true);
    try {
      await ApiService.post("/api/mobile/guru/nilai", {"op": "gradeEssay", "jawabanUjianId": widget.jawabanId, "nilai": v, "komentar": komentar.text.trim()});
      widget.onDone("Essay dinilai", true);
    } catch (e) {
      widget.onDone("Gagal: $e", false);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Row(children: [
    SizedBox(
      width: 70,
      child: TextField(
        controller: nilai,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(labelText: "Nilai", border: OutlineInputBorder(), isDense: true),
      ),
    ),
    const SizedBox(width: 8),
    Expanded(
      child: TextField(
        controller: komentar,
        decoration: const InputDecoration(labelText: "Komentar", border: OutlineInputBorder(), isDense: true),
      ),
    ),
    const SizedBox(width: 8),
    FilledButton(
      onPressed: saving ? null : _simpan,
      child: saving ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Text("Simpan"),
    ),
  ]);
}
