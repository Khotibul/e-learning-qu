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
    ApiService.getMateri().then((v) {
      if (mounted) setState(() { data = v; loading = false; });
    }).catchError((_) {
      if (mounted) setState(() => loading = false);
    });
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Materi"), backgroundColor: Colors.white, elevation: 0),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : data.isEmpty
            ? const Center(child: Text("Belum ada materi", style: TextStyle(color: Colors.black54)))
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: data.length,
                itemBuilder: (_, i) {
                  final m = data[i] as Map;
                  // API mobile return flat: {id, judul, deskripsi, fileUrl, mataPelajaran: {nama}}
                  // Website also same, so Android 100% sesuai
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(16),
                      leading: Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFF4F46E5).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.menu_book, color: Color(0xFF4F46E5))),
                      title: Text(m["judul"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                      subtitle: Padding(padding: const EdgeInsets.only(top: 4), child: Text(m["mataPelajaran"]?["nama"] ?? m["mapel"] ?? "", style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)))),
                      trailing: const Icon(Icons.chevron_right, color: Color(0xFF94A3B8)),
                    ),
                  );
                },
              ),
  );
}
