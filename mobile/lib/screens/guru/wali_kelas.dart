import "package:flutter/material.dart";
import "../../services/api_service.dart";
class GuruWaliKelas extends StatefulWidget { const GuruWaliKelas({super.key}); @override State<GuruWaliKelas> createState() => _GuruWaliKelasState(); }
class _GuruWaliKelasState extends State<GuruWaliKelas> {
  List<dynamic> data=[]; List<dynamic> filtered=[]; bool loading=true; final searchCtrl=TextEditingController();
  @override void initState(){ super.initState(); _load(); searchCtrl.addListener(_filter); }
  Future<void> _load() async {
    try { final v=await ApiService.get("/api/mobile/guru/wali-kelas"); if(mounted) setState(() {data=v is List?v:[]; filtered=v is List?v:[]; loading=false;}); } catch(_){ if(mounted) setState(()=> loading=false); }
  }
  void _filter(){ final q=searchCtrl.text.toLowerCase(); setState((){ filtered=q.isEmpty? data: data.where((k)=> (k["nama"]??"").toLowerCase().contains(q) || ((k["siswas"] as List? ?? []).any((s)=> (s["nama"]??"").toLowerCase().contains(q)))).toList();}); }
  @override void dispose(){ searchCtrl.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: const Color(0xFFF8FAFC), appBar: AppBar(title: const Text("Wali Kelas"), backgroundColor: Colors.white, elevation:0), body: loading? const Center(child: CircularProgressIndicator()): Column(children: [Padding(padding: const EdgeInsets.all(12), child: TextField(controller: searchCtrl, decoration: InputDecoration(hintText: "Cari kelas atau siswa...", prefixIcon: const Icon(Icons.search, size:18), filled:true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))), contentPadding: const EdgeInsets.symmetric(horizontal:12, vertical:10)))), Expanded(child: filtered.isEmpty? const Center(child: Text("Bukan wali kelas atau tidak ada data", style: TextStyle(color: Colors.black54))): ListView.builder(padding: const EdgeInsets.fromLTRB(16,0,16,16), itemCount: filtered.length, itemBuilder: (_,i){ final k=filtered[i] as Map; return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(k["nama"]??"-", style: const TextStyle(fontWeight: FontWeight.bold, fontSize:14)), Text("${k["_count"]?["siswas"]??0} siswa", style: const TextStyle(fontSize:12, color: Color(0xFF64748B))), const SizedBox(height:8), Wrap(spacing:6, children: ((k["siswas"] as List? ?? []).take(6).map((s)=> Chip(label: Text(s["nama"], style: const TextStyle(fontSize:11)), visualDensity: VisualDensity.compact)).toList()))]))); }))]));
}

