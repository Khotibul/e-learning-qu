import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class SiswaStrukturKelas extends StatefulWidget {
  const SiswaStrukturKelas({super.key});
  @override
  State<SiswaStrukturKelas> createState() => _SiswaStrukturKelasState();
}

class _SiswaStrukturKelasState extends State<SiswaStrukturKelas> {
  Map<String, dynamic>? data;
  bool loading = true;
  @override
  void initState() {
    super.initState();
    ApiService.getStrukturKelas().then((v) {
      if (mounted) setState(() { data = v is Map ? v.first : null; loading = false; });
    }).catchError((_) { if (mounted) setState(() => loading = false); });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Struktur Kelas"), backgroundColor: Colors.white, elevation: 0),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : data == null
            ? const Center(child: Text("Belum ada data kelas", style: TextStyle(color: Colors.black54)))
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: const Color(0xFF4F46E5).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.groups_outlined, color: Color(0xFF4F46E5), size: 18)),
                          const SizedBox(width: 10),
                          Expanded(child: Text(data!["nama"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w700))),
                          if (data!["guru"] != null) Text("Wali: ${data!["guru"]["nama"]}", style: const TextStyle(fontSize: 11, color: Colors.black54)),
                        ]),
                        const SizedBox(height: 12),
                        ...((data!["siswas"] as List? ?? []).map((s) => Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(border: Border.all(color: const Color(0xFFE2E8F0)), borderRadius: BorderRadius.circular(12)),
                              child: Row(children: [
                                CircleAvatar(radius: 16, backgroundColor: const Color(0xFFEEF2FF), child: Text((s["nama"] ?? "?")[0], style: const TextStyle(color: Color(0xFF4F46E5), fontWeight: FontWeight.bold, fontSize: 12))),
                                const SizedBox(width: 10),
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(s["nama"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)), if (s["jabatan"] != null) Text(s["jabatan"], style: const TextStyle(fontSize: 10, color: Color(0xFF4F46E5)))])),
                              ]),
                            ))),
                      ]),
                    ),
                  ),
                ],
              ),
  );
}
