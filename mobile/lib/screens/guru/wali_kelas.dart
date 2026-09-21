import "package:flutter/material.dart";
import "../../services/api_service.dart";
class GuruWaliKelas extends StatefulWidget { const GuruWaliKelas({super.key}); @override State<GuruWaliKelas> createState() => _GuruWaliKelasState(); }
class _GuruWaliKelasState extends State<GuruWaliKelas> {
  List<dynamic> data=[]; bool loading=true;
  @override void initState(){ super.initState(); ApiService.get("/api/mobile/guru/wali-kelas").then((v){ if(mounted) setState(()=>{data=v is List?v:[]; loading=false;}); }).catchError((_){ if(mounted) setState(()=> loading=false);}); }
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: const Color(0xFFF8FAFC), appBar: AppBar(title: const Text("Wali Kelas"), backgroundColor: Colors.white, elevation:0), body: loading? const Center(child: CircularProgressIndicator()): ListView.builder(padding: const EdgeInsets.all(16), itemCount: data.length, itemBuilder: (_,i){ final k=data[i] as Map; return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(k["nama"]??"-", style: const TextStyle(fontWeight: FontWeight.bold)), Text("${k["_count"]?["siswas"]??0} siswa"), Wrap(spacing:6, children: ((k["siswas"] as List? ?? []).map((s)=> Chip(label: Text(s["nama"], style: const TextStyle(fontSize:11)), visualDensity: VisualDensity.compact)).toList()))]))); }));
}
