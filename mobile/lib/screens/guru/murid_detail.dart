import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class GuruMurid extends StatefulWidget {
  const GuruMurid({super.key});
  @override
  State<GuruMurid> createState() => _GuruMuridState();
}

class _GuruMuridState extends State<GuruMurid> {
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
      final v = await ApiService.getGuruMurid();
      if (mounted) setState(() { data = v; filtered = v; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _filter() {
    final q = searchCtrl.text.toLowerCase();
    setState(() {
      filtered = q.isEmpty ? data : data.where((s) => (s["nama"] ?? "").toLowerCase().contains(q) || (s["nis"] ?? "").toLowerCase().contains(q)).toList();
    });
  }

  @override
  void dispose() {
    searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Murid"), backgroundColor: Colors.white, elevation: 0),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: TextField(
                  controller: searchCtrl,
                  decoration: InputDecoration(
                    hintText: "Cari nama atau NIS...",
                    hintStyle: const TextStyle(fontSize: 13, color: Colors.black38),
                    prefixIcon: const Icon(Icons.search, size: 18),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? const Center(child: Text("Tidak ada murid", style: TextStyle(color: Colors.black54)))
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                        itemCount: filtered.length,
                        itemBuilder: (_, i) {
                          final s = filtered[i] as Map;
                          return Card(child: ListTile(leading: CircleAvatar(backgroundColor: const Color(0xFFEEF2FF), child: Text((s["nama"] ?? "?")[0], style: const TextStyle(color: Color(0xFF4F46E5), fontWeight: FontWeight.bold, fontSize: 12))), title: Text(s["nama"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)), subtitle: Text("${s["nis"] ?? ""} • ${s["kelas"]?["nama"] ?? ""}", style: const TextStyle(fontSize: 11))));
                        },
                      ),
              ),
            ],
          ),
  );
}
