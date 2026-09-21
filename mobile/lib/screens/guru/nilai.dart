import "package:flutter/material.dart";
import "../../services/api_service.dart";
class GuruNilai extends StatefulWidget { const GuruNilai({super.key}); @override State<GuruNilai> createState() => _GuruNilaiState(); }
class _GuruNilaiState extends State<GuruNilai> {
  List<dynamic> nilais=[]; List<dynamic> ujians=[]; bool loading=true;
  @override void initState(){ super.initState(); _load(); }
  Future<void> _load() async {
    try { final v=await ApiService.get("/api/mobile/guru/nilai"); if(mounted) setState(() { ujians=v["ujians"]??[]; nilais=v["nilais"]??[]; loading=false;}); } catch(_){ if(mounted) setState(()=> loading=false);}
  }
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: const Color(0xFFF8FAFC), appBar: AppBar(title: const Text("Nilai"), backgroundColor: Colors.white, elevation:0), body: loading? const Center(child: CircularProgressIndicator()): ListView(padding: const EdgeInsets.all(16), children: [Text("Ujian: ${ujians.length}", style: const TextStyle(fontWeight: FontWeight.bold)), const SizedBox(height:8), ...nilais.map((n)=> Card(child: ListTile(title: Text(n["siswa"]?["nama"]??"-"), subtitle: Text("${n["ujian"]?["nama"]??""}"), trailing: Container(padding: const EdgeInsets.symmetric(horizontal:12, vertical:6), decoration: BoxDecoration(color: (n["nilai"]??0)>=75? Colors.green: Colors.orange, borderRadius: BorderRadius.circular(20)), child: Text("${n["nilai"]}", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))))))]));
}


