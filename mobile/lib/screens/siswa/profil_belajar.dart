import "package:flutter/material.dart";
import "../../services/api_service.dart";

class SiswaProfilBelajar extends StatefulWidget {
  const SiswaProfilBelajar({super.key});
  @override
  State<SiswaProfilBelajar> createState() => _SiswaProfilBelajarState();
}

class _SiswaProfilBelajarState extends State<SiswaProfilBelajar> {
  Map<String, dynamic>? data;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/siswa/profil-belajar");
      if (mounted) setState(() { data = v is Map<String, dynamic> ? v : null; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Profil Belajar"), backgroundColor: Colors.white, elevation: 0),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text("Gaya Belajar: ${data?["gayaBelajar"] ?? "-"}", style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(value: (data?["rataMastery"] ?? 0) / 100, minHeight: 8),
                    const SizedBox(height: 8),
                    Text("Mastery: ${data?["rataMastery"] ?? 0}%"),
                  ]),
                ),
              ),
            ],
          ),
  );
}
