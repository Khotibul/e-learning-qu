import "package:flutter/material.dart";
import "../../services/api_service.dart";

class GuruBankSoal extends StatefulWidget {
  const GuruBankSoal({super.key});
  @override
  State<GuruBankSoal> createState() => _GuruBankSoalState();
}

class _GuruBankSoalState extends State<GuruBankSoal> {
  List<dynamic> data = [];
  List<dynamic> filtered = [];
  bool loading = true;
  final searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    searchCtrl.addListener(_filter);
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/bank-soal");
      if (mounted) setState(() { data = v is List ? v : []; filtered = v is List ? v : []; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _filter() {
    final q = searchCtrl.text.toLowerCase();
    setState(() { filtered = q.isEmpty ? data : data.where((s) => (s["pertanyaan"] ?? "").toLowerCase().contains(q) || (s["jenisSoal"] ?? "").toLowerCase().contains(q)).toList(); });
  }

  @override
  void dispose() { searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Bank Soal"), backgroundColor: Colors.white, elevation: 0),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : Column(children: [
            Padding(padding: const EdgeInsets.all(12), child: TextField(controller: searchCtrl, decoration: InputDecoration(hintText: "Cari soal...", prefixIcon: const Icon(Icons.search, size: 18), filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))), contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10)))),
            Expanded(child: filtered.isEmpty ? const Center(child: Text("Tidak ada soal", style: TextStyle(color: Colors.black54))) : RefreshIndicator(onRefresh: _load, child: ListView.builder(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), itemCount: filtered.length, itemBuilder: (_, i) { final s = filtered[i] as Map; return Card(child: ListTile(title: Text(s["pertanyaan"] ?? "-", maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)), subtitle: Text("${s["jenisSoal"] ?? ""} • ${s["tingkatKesulitan"] ?? ""}", style: const TextStyle(fontSize: 11)))); }))),
          ]),
  );
}
