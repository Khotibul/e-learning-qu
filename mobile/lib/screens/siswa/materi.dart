import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class SiswaMateri extends StatefulWidget {
  const SiswaMateri({super.key});
  @override
  State<SiswaMateri> createState() => _SiswaMateriState();
}

class _SiswaMateriState extends State<SiswaMateri> {
  List<dynamic> data = [];
  bool loading = true;
  @override
  void initState() {
    super.initState();
    ApiService.getMateri().then((v) => setState(() { data = v; loading = false; })).catchError((_) => setState(() => loading = false));
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text("Materi"), backgroundColor: Colors.white),
    body: loading ? const Center(child: CircularProgressIndicator()) : data.isEmpty ? const Center(child: Text("Belum ada materi")) : ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: data.length,
      itemBuilder: (_, i) {
        final m = data[i] as Map;
        return Card(child: ListTile(leading: const Icon(Icons.book, color: Color(0xFF4F46E5)), title: Text(m["judul"] ?? m["nama"] ?? "-"), subtitle: Text(m["mataPelajaran"]?["nama"] ?? m["mapel"] ?? "")));
      },
    ),
  );
}
