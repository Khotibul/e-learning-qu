import "package:flutter/material.dart";
import "../../services/api_service.dart";
class SiswaAiTutor extends StatefulWidget { const SiswaAiTutor({super.key}); @override State<SiswaAiTutor> createState() => _SiswaAiTutorState(); }
class _SiswaAiTutorState extends State<SiswaAiTutor> {
  final _ctrl = TextEditingController();
  String _answer = "";
  bool _loading = false;
  Future<void> _ask() async {
    setState(()=> _loading=true);
    try { final res = await ApiService.askAiTutor(_ctrl.text); setState(()=> _answer = res["jawaban"]?? res["answer"]?? res.toString()); } catch(e){ setState(()=> _answer="Gagal: $e"); } finally{ setState(()=> _loading=false); }
  }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text("AI Tutor — 1 DB RAG")), body: Padding(padding: const EdgeInsets.all(16), child: Column(children: [TextField(controller: _ctrl, decoration: const InputDecoration(hintText: "Tanya materi...", border: OutlineInputBorder()), minLines: 1, maxLines: 3), const SizedBox(height:12), FilledButton(onPressed: _loading?null:_ask, child: _loading? const SizedBox(height:16,width:16,child: CircularProgressIndicator(strokeWidth:2)): const Text("Tanya AI")), const SizedBox(height:16), Expanded(child: SingleChildScrollView(child: Text(_answer)))])));
}
