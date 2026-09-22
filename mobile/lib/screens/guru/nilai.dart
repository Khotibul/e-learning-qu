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
  @override void dispose(){ searchCtrl.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: const Color(0xFFF8FAFC), appBar: AppBar(title: const Text("Nilai"), backgroundColor: Colors.white, elevation:0), body: loading? const Center(child: CircularProgressIndicator()): Column(children: [Padding(padding: const EdgeInsets.all(12), child: TextField(controller: searchCtrl, decoration: InputDecoration(hintText: "Cari siswa atau ujian...", prefixIcon: const Icon(Icons.search, size:18), filled:true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))), contentPadding: const EdgeInsets.symmetric(horizontal:12, vertical:10)))), Padding(padding: const EdgeInsets.symmetric(horizontal:16), child: Row(children: [Text("Ujian: ${ujians.length}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize:12, color: Color(0xFF64748B))), const Spacer(), Text("${filtered.length} nilai", style: const TextStyle(fontSize:12, color: Color(0xFF64748B)))])), const SizedBox(height:8), Expanded(child: filtered.isEmpty? const Center(child: Text("Tidak ada nilai", style: TextStyle(color: Colors.black54))): ListView.builder(padding: const EdgeInsets.fromLTRB(16,0,16,16), itemCount: filtered.length, itemBuilder: (_,i){ final n=filtered[i]; return Card(child: ListTile(title: Text(n["siswa"]?["nama"]??"-", style: const TextStyle(fontSize:13, fontWeight: FontWeight.w600)), subtitle: Text("${n["ujian"]?["nama"]??""}", style: const TextStyle(fontSize:11)), trailing: Container(padding: const EdgeInsets.symmetric(horizontal:12, vertical:6), decoration: BoxDecoration(color: (n["nilai"]??0)>=75? Colors.green: Colors.orange, borderRadius: BorderRadius.circular(20)), child: Text("${n["nilai"]}", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize:12))))); }))]));
}


