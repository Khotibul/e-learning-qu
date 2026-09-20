import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class SiswaLatihan extends StatefulWidget {
  const SiswaLatihan({super.key});
  @override
  State<SiswaLatihan> createState() => _SiswaLatihanState();
}

class _SiswaLatihanState extends State<SiswaLatihan> {
  List<dynamic> data = [];
  bool loading = true;
  @override
  void initState() {
    super.initState();
    ApiService.getLatihanList().then((v) {
      if (mounted) setState(() { data = v; loading = false; });
    }).catchError((_) {
      if (mounted) setState(() => loading = false);
    });
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text("Latihan")),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: data.length,
            itemBuilder: (_, i) {
              final l = data[i] as Map;
              return Card(child: ListTile(title: Text(l["nama"] ?? "-"), subtitle: Text("${l["mapel"] ?? ""} • ${l["durasi"] ?? 0} menit")));
            },
          ),
  );
}
