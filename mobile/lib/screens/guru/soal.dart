import "package:flutter/material.dart";
import "../../services/api_service.dart";
class GuruSoal extends StatefulWidget { const GuruSoal({super.key}); @override State<GuruSoal> createState() => _GuruSoalState(); }
class _GuruSoalState extends State<GuruSoal> {
  List<dynamic> data=[]; bool loading=true;
  @override void initState(){ super.initState(); ApiService.get("/api/mobile/guru/soal").then((v){ if(mounted) setState(()=>{data=v is List?v:[]; loading=false;}); }).catchError((_)=> setState(()=> loading=false)); }
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: const Color(0xFFF8FAFC), appBar: AppBar(title: const Text("Soal"), backgroundColor: Colors.white, elevation:0), body: loading? const Center(child: CircularProgressIndicator()): ListView.builder(padding: const EdgeInsets.all(16), itemCount: data.length, itemBuilder: (_,i){ final s=data[i] as Map; return Card(child: ListTile(title: Text(s["pertanyaan"]??"-", maxLines:2, overflow: TextOverflow.ellipsis), subtitle: Text("${s["jenisSoal"]??""} • ${s["tingkatKesulitan"]??""} • ${s["poin"]??0} poin"), trailing: Container(padding: const EdgeInsets.symmetric(horizontal:8, vertical:4), decoration: BoxDecoration(color: const Color(0xFF4F46E5).withValues(alpha:0.1), borderRadius: BorderRadius.circular(20)), child: Text(s["mataPelajaran"]?["nama"]??"", style: const TextStyle(fontSize:10, color: Color(0xFF4F46E5)))))); }));
}
