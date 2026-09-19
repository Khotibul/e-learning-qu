import "package:flutter/material.dart";
class SiswaDashboard extends StatelessWidget {
  const SiswaDashboard({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text("Dashboard Siswa")), body: ListView(padding: const EdgeInsets.all(16), children: const [Card(child: ListTile(title: Text("Rata-rata Nilai"), subtitle: Text("Memuat dari /api/siswa/...")))]));
}
