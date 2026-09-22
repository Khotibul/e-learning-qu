import "package:flutter/material.dart";
import "../../services/api_service.dart";
class GuruAntiCheat extends StatefulWidget { const GuruAntiCheat({super.key}); @override State<GuruAntiCheat> createState() => _GuruAntiCheatState(); }
class _GuruAntiCheatState extends State<GuruAntiCheat> {
  List<dynamic> data=[]; List<dynamic> filtered=[]; bool loading=true; final searchCtrl=TextEditingController();
  @override void initState(){ super.initState(); _load(); searchCtrl.addListener(_filter); }
  Future<void> _load() async {
    try { final v=await ApiService.get("/api/mobile/guru/anti-cheat"); if(mounted) setState(() {data=v is List?v:[]; filtered=v is List?v:[]; loading=false;}); } catch(_){ if(mounted) setState(()=> loading=false); }
  }
  void _filter(){ final q=searchCtrl.text.toLowerCase(); setState((){ filtered=q.isEmpty? data: data.where((s)=> (s["siswa"]?["nama"]??"").toLowerCase().contains(q) || (s["ujian"]?["nama"]??"").toLowerCase().contains(q)).toList();}); }
  @override void dispose(){ searchCtrl.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: const Color(0xFFF8FAFC), appBar: AppBar(title: const Text("Anti-Cheat"), backgroundColor: Colors.white, elevation:0), body: loading? const Center(child: CircularProgressIndicator()): Column(children: [Padding(padding: const EdgeInsets.all(12), child: TextField(controller: searchCtrl, decoration: InputDecoration(hintText: "Cari siswa atau ujian...", prefixIcon: const Icon(Icons.search, size:18), filled:true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))), contentPadding: const EdgeInsets.symmetric(horizontal:12, vertical:10)))), Expanded(child: filtered.isEmpty? const Center(child: Text("Tidak ada kecurangan terdeteksi", style: TextStyle(color: Colors.black54))): ListView.builder(padding: const EdgeInsets.fromLTRB(16,0,16,16), itemCount: filtered.length, itemBuilder: (_,i){ final s=filtered[i] as Map; return Card(child: ListTile(leading: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.red.withValues(alpha:0.1), borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.shield_outlined, color: Colors.red, size:16)), title: Text(s["siswa"]?["nama"]??"-", style: const TextStyle(fontSize:13, fontWeight: FontWeight.w600)), subtitle: Text("${s["ujian"]?["nama"]??""} • Score ${s["cheatingScore"]??0}", style: const TextStyle(fontSize:11)), trailing: s["isFlagged"]==true? const Icon(Icons.flag, color: Colors.red, size:16): null)); }))]));
}


