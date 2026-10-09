import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Jadwal piket kelas (view siswa) — mirror web /siswa/jadwal-piket.
class SiswaJadwalPiket extends StatefulWidget {
  const SiswaJadwalPiket({super.key});
  @override
  State<SiswaJadwalPiket> createState() => _SiswaJadwalPiketState();
}

class _SiswaJadwalPiketState extends State<SiswaJadwalPiket> {
  bool loading = true;
  List<dynamic> data = [];

  static const _hariList = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/siswa/jadwal-piket", useCache: false);
      if (mounted) setState(() { data = v is List ? v : []; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Jadwal Piket"), backgroundColor: Colors.white, elevation: 0),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : data.isEmpty
            ? const Center(child: Text("Belum ada jadwal piket", style: TextStyle(color: Colors.black54)))
            : RefreshIndicator(
            onRefresh: _load,
            child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Text("Jadwal Piket Kelas", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            const SizedBox(height: 4),
                            Text("${data.length} jadwal aktif — siapa yang bertugas per hari", style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                          ]),
                        ),
                      ),
                      const SizedBox(height: 8),
                      ..._hariList.map((hari) {
                        final items = data.where((p) => (p as Map)["hari"] == hari).toList();
                        if (items.isEmpty) return const SizedBox.shrink();
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                const Icon(Icons.cleaning_services_outlined, size: 16, color: Color(0xFF0EA5E9)),
                                const SizedBox(width: 6),
                                Text(hari, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0EA5E9))),
                              ]),
                              const SizedBox(height: 6),
                              Wrap(spacing: 6, runSpacing: 6, children: items.map((p) => Chip(
                                avatar: const Icon(Icons.person_outline, size: 14),
                                label: Text("${(p as Map)["siswa"]?["nama"] ?? "-"}", style: const TextStyle(fontSize: 11)),
                                visualDensity: VisualDensity.compact,
                                backgroundColor: const Color(0xFF0EA5E9).withValues(alpha: 0.08),
                              )).toList()),
                            ]),
                          ),
                        );
                      }),
                      const SizedBox(height: 24),
                    ],
                  ),
          ),
  );
}
