import "package:flutter/material.dart";
import "../../services/api_service.dart";
class GuruIntervensi extends StatefulWidget { const GuruIntervensi({super.key}); @override State<GuruIntervensi> createState() => _GuruIntervensiState(); }
class _GuruIntervensiState extends State<GuruIntervensi> {
  List<dynamic> data=[]; bool loading=true;
  @override void initState(){ super.initState(); _load(); }
  Future<void> _load() async {
    try { final v=await ApiService.get("/api/mobile/guru/intervensi"); if(mounted) setState(() {data=v is List?v:[]; loading=false;}); } catch(_){ if(mounted) setState(()=> loading=false); }
  }
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: const Color(0xFFF8FAFC), appBar: AppBar(title: const Text("Intervensi"), backgroundColor: Colors.white, elevation:0), body: loading? const Center(child: CircularProgressIndicator()): ListView.builder(padding: const EdgeInsets.all(16), itemCount: data.length, itemBuilder: (_,i){ final it=data[i] as Map; return Card(child: ListTile(title: Text(it["siswa"]?["nama"]??"-"), subtitle: Text("${it["tipe"]??""} • ${it["status"]??""}\n${it["reason"]??""}", maxLines:2), isThreeLine: true, trailing: Container(padding: const EdgeInsets.symmetric(horizontal:8, vertical:4), decoration: BoxDecoration(color: it["status"]=="OPEN"? Colors.orange: Colors.green, borderRadius: BorderRadius.circular(12)), child: Text(it["status"]??"", style: const TextStyle(color: Colors.white, fontSize:10))))); }));
}


