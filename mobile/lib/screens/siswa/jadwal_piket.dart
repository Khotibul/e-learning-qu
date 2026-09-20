import "package:flutter/material.dart";
import "../../services/api_service.dart";

class SiswaJadwalPiket extends StatefulWidget {
  const SiswaJadwalPiket({super.key});
  @override
  State<SiswaJadwalPiket> createState() => _SiswaJadwalPiketState();
}

class _SiswaJadwalPiketState extends State<SiswaJadwalPiket> {
  List<dynamic> data = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.getJadwalPiket();
      if (mounted) setState(() { data = v; loading = false; });
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
        : ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: data.length,
            itemBuilder: (_, i) {
              final j = data[i] as Map;
              return Card(child: ListTile(leading: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: const Color(0xFFF59E0B).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.cleaning_services_outlined, size: 16, color: Color(0xFFF59E0B))), title: Text(j["hari"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w600)), subtitle: Text(j["siswa"]?["nama"] ?? "-")));
            },
          ),
  );
}
