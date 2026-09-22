import "package:flutter/material.dart";
import "../../services/api_service.dart";
class GuruIntervensi extends StatefulWidget { const GuruIntervensi({super.key}); @override State<GuruIntervensi> createState() => _GuruIntervensiState(); }
class _GuruIntervensiState extends State<GuruIntervensi> {
  List<dynamic> data=[]; List<dynamic> filtered=[]; bool loading=true; final searchCtrl=TextEditingController();
  @override void initState(){ super.initState(); _load(); searchCtrl.addListener(_filter); }
  Future<void> _load() async {
    try { final v=await ApiService.get("/api/mobile/guru/intervensi"); if(mounted) setState(() {data=v is List?v:[]; filtered=v is List?v:[]; loading=false;}); } catch(_){ if(mounted) setState(()=> loading=false); }
  }
  void _filter(){ final q=searchCtrl.text.toLowerCase(); setState((){ filtered=q.isEmpty? data: data.where((it)=> (it["siswa"]?["nama"]??"").toLowerCase().contains(q) || (it["tipe"]??"").toLowerCase().contains(q) || (it["status"]??"").toLowerCase().contains(q)).toList();}); }
  @override void dispose(){ searchCtrl.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: const Color(0xFFF8FAFC), appBar: AppBar(title: const Text("Intervensi"), backgroundColor: Colors.white, elevation:0), body: loading? const Center(child: CircularProgressIndicator()): Column(children: [Padding(padding: const EdgeInsets.all(12), child: TextField(controller: searchCtrl, decoration: InputDecoration(hintText: "Cari siswa/tipe/status...", prefixIcon: const Icon(Icons.search, size:18), filled:true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))), contentPadding: const EdgeInsets.symmetric(horizontal:12, vertical:10)))), Expanded(child: filtered.isEmpty? const Center(child: Text("Tidak ada intervensi", style: TextStyle(color: Colors.black54))): ListView.builder(padding: const EdgeInsets.fromLTRB(16,0,16,16), itemCount: filtered.length, itemBuilder: (_,i){ final it=filtered[i] as Map; return Card(child: ListTile(title: Text(it["siswa"]?["nama"]??"-", style: const TextStyle(fontSize:13, fontWeight: FontWeight.w600)), subtitle: Text("${it["tipe"]??""} • ${it["status"]??""}\n${it["reason"]??""}", maxLines:2, style: const TextStyle(fontSize:11)), isThreeLine: true, trailing: Container(padding: const EdgeInsets.symmetric(horizontal:8, vertical:4), decoration: BoxDecoration(color: it["status"]=="OPEN"? Colors.orange: Colors.green, borderRadius: BorderRadius.circular(12)), child: Text(it["status"]??"", style: const TextStyle(color: Colors.white, fontSize:10))))); }))]));
}


