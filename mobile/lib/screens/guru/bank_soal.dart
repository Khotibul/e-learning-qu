import "package:flutter/material.dart";
import "../../services/api_service.dart";

class GuruBankSoal extends StatefulWidget {
  const GuruBankSoal({super.key});
  @override
  State<GuruBankSoal> createState() => _GuruBankSoalState();
}

class _GuruBankSoalState extends State<GuruBankSoal> {
  List<dynamic> data = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/bank-soal");
      if (mounted) setState(() { data = v is List ? v : []; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Bank Soal"), backgroundColor: Colors.white, elevation: 0),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: data.length,
            itemBuilder: (_, i) {
              final s = data[i] as Map;
              return Card(child: ListTile(title: Text(s["pertanyaan"] ?? "-", maxLines: 2, overflow: TextOverflow.ellipsis), subtitle: Text("${s["jenisSoal"] ?? ""} • ${s["tingkatKesulitan"] ?? ""}")));
            },
          ),
  );
}
