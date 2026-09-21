import "package:flutter/material.dart";
import "../../services/api_service.dart";
class GuruAntiCheat extends StatefulWidget { const GuruAntiCheat({super.key}); @override State<GuruAntiCheat> createState() => _GuruAntiCheatState(); }
class _GuruAntiCheatState extends State<GuruAntiCheat> {
  List<dynamic> data=[]; bool loading=true;
  @override void initState(){ super.initState(); _load(); }
  Future<void> _load() async {
    try { final v=await ApiService.get("/api/mobile/guru/anti-cheat"); if(mounted) setState(() {data=v is List?v:[]; loading=false;}); } catch(_){ if(mounted) setState(()=> loading=false); }
  }
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: const Color(0xFFF8FAFC), appBar: AppBar(title: const Text("Anti-Cheat"), backgroundColor: Colors.white, elevation:0), body: loading? const Center(child: CircularProgressIndicator()): data.isEmpty? const Center(child: Text("Tidak ada kecurangan terdeteksi", style: TextStyle(color: Colors.black54))): ListView.builder(padding: const EdgeInsets.all(16), itemCount: data.length, itemBuilder: (_,i){ final s=data[i] as Map; return Card(child: ListTile(leading: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.red.withValues(alpha:0.1), borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.shield_outlined, color: Colors.red, size:16)), title: Text(s["siswa"]?["nama"]??"-"), subtitle: Text("${s["ujian"]?["nama"]??""} • Score ${s["cheatingScore"]??0}"), trailing: s["isFlagged"]==true? const Icon(Icons.flag, color: Colors.red, size:16): null)); }));
}


