import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class SiswaNilai extends StatefulWidget {
  const SiswaNilai({super.key});
  @override
  State<SiswaNilai> createState() => _SiswaNilaiState();
}

class _SiswaNilaiState extends State<SiswaNilai> {
  List<dynamic> data = [];
  bool loading = true;
  @override
  void initState() {
    super.initState();
    ApiService.getNilai().then((v) {
      if (mounted) setState(() { data = v; loading = false; });
    }).catchError((_) {
      if (mounted) setState(() => loading = false);
    });
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text("Nilai")),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: data.length,
            itemBuilder: (_, i) {
              final n = data[i] as Map;
              return Card(child: ListTile(title: Text("${n["mapel"] ?? n["mataPelajaran"] ?? "-"}"), subtitle: Text("Nilai: ${n["nilai"] ?? "-"}"), trailing: Chip(label: Text("${n["nilai"] ?? 0}"))));
            },
          ),
  );
}
