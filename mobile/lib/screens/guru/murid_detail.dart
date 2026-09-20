import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class GuruMurid extends StatefulWidget {
  const GuruMurid({super.key});
  @override
  State<GuruMurid> createState() => _GuruMuridState();
}

class _GuruMuridState extends State<GuruMurid> {
  List<dynamic> data = [];
  bool loading = true;
  @override
  void initState() {
    super.initState();
    ApiService.getGuruMurid().then((v) {
      if (mounted) setState(() { data = v; loading = false; });
    }).catchError((_) {
      if (mounted) setState(() => loading = false);
    });
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text("Murid")),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: data.length,
            itemBuilder: (_, i) {
              final s = data[i] as Map;
              return Card(child: ListTile(title: Text(s["nama"] ?? "-"), subtitle: Text("${s["nis"] ?? ""} • ${s["kelas"]?["nama"] ?? ""}")));
            },
          ),
  );
}
