import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class SiswaJadwal extends StatefulWidget {
  const SiswaJadwal({super.key});
  @override
  State<SiswaJadwal> createState() => _SiswaJadwalState();
}

class _SiswaJadwalState extends State<SiswaJadwal> {
  List<dynamic> data = [];
  bool loading = true;
  @override
  void initState() {
    super.initState();
    ApiService.getJadwalPelajaran().then((v) {
      if (mounted) setState(() { data = v; loading = false; });
    }).catchError((_) {
      if (mounted) setState(() => loading = false);
    });
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text("Jadwal Pelajaran")),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: data.length,
            itemBuilder: (_, i) {
              final j = data[i] as Map;
              return Card(child: ListTile(title: Text(j["mataPelajaran"]?["nama"] ?? j["mapel"] ?? "-"), subtitle: Text("${j["hari"] ?? ""} ${j["jamMulai"] ?? ""}-${j["jamSelesai"] ?? ""}")));
            },
          ),
  );
}
