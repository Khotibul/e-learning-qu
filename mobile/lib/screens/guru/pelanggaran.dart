import "package:flutter/material.dart";
import "../../services/api_service.dart";
class GuruPelanggaran extends StatefulWidget { const GuruPelanggaran({super.key}); @override State<GuruPelanggaran> createState() => _GuruPelanggaranState(); }
class _GuruPelanggaranState extends State<GuruPelanggaran> {
  List<dynamic> data=[]; bool loading=true;
  @override void initState(){ super.initState(); ApiService.get("/api/mobile/guru/pelanggaran").then((v){ if(mounted) setState(() {data=v is List?v:[]; loading=false;}); }).catchError((_){ if(mounted) setState(()=> loading=false); }); }
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: const Color(0xFFF8FAFC), appBar: AppBar(title: const Text("Pelanggaran"), backgroundColor: Colors.white, elevation:0), body: loading? const Center(child: CircularProgressIndicator()): ListView.builder(padding: const EdgeInsets.all(16), itemCount: data.length, itemBuilder: (_,i){ final p=data[i] as Map; return Card(child: ListTile(title: Text(p["siswa"]?["nama"]??"-"), subtitle: Text("${p["jenis"]??""} • ${p["poin"]??0} poin\n${p["deskripsi"]??""}", maxLines:2), isThreeLine: true, trailing: Text(p["tanggal"]?.toString().split("T").first ?? "", style: const TextStyle(fontSize:11, color: Colors.black54)))); }));
}

