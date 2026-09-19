import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class SiswaAbsensiHarian extends StatefulWidget {
  const SiswaAbsensiHarian({super.key});
  @override
  State<SiswaAbsensiHarian> createState() => _SiswaAbsensiHarianState();
}

class _SiswaAbsensiHarianState extends State<SiswaAbsensiHarian> {
  List<dynamic> _raw = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final end = DateTime.now().toIso8601String().split("T")[0];
    final start = DateTime.now().subtract(const Duration(days: 30)).toIso8601String().split("T")[0];
    try {
      final data = await ApiService.getAbsensi(start: start, end: end);
      setState(() { _raw = data; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    // Group by tanggal
    final map = <String, List<dynamic>>{};
    for (final r in _raw) {
      final key = DateTime.parse(r["tanggal"]).toIso8601String().split("T")[0];
      map.putIfAbsent(key, () => []).add(r);
    }
    final entries = map.entries.toList()..sort((a,b) => b.key.compareTo(a.key));
    final totalHari = entries.length;
    final hadirPenuh = entries.where((e) => e.value.every((x) => x["status"] == "HADIR")).length;

    return Scaffold(
      appBar: AppBar(title: const Text("Absensi Harian")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(children: [
            _StatCard(label: "Total Hari", value: "$totalHari", sub: "hari berjadwal"),
            const SizedBox(width: 8),
            _StatCard(label: "Hadir Penuh", value: "$hadirPenuh", sub: "dari $totalHari", color: Colors.green),
            const SizedBox(width: 8),
            _StatCard(label: "Persentase", value: totalHari>0 ? "${((hadirPenuh/totalHari)*100).round()}%" : "0%", sub: "rata harian"),
          ]),
          const SizedBox(height: 12),
          const Text("Rekap Harian — Persentase = HADIR ÷ total pelajaran hari itu × 100%", style: TextStyle(fontSize: 11, color: Colors.black54)),
          const SizedBox(height: 12),
          ...entries.map((e) {
            final total = e.value.length;
            final hadir = e.value.where((x) => x["status"] == "HADIR").length;
            final pct = total>0 ? ((hadir/total)*100).round() : 0;
            return Card(
              child: ExpansionTile(
                title: Text(e.key, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text("$hadir/$total hadir — $pct%"),
                trailing: Badge(label: Text(pct==100 ? "Hadir Penuh" : pct==0 ? "Tidak Hadir" : "Sebagian"), backgroundColor: pct==100?Colors.green: pct>=75?Colors.orange:Colors.red),
                children: e.value.map<Widget>((x) => ListTile(
                  dense: true,
                  leading: Icon(x["status"]=="HADIR" ? Icons.check_circle : Icons.cancel, color: x["status"]=="HADIR"?Colors.green:Colors.red, size: 18),
                  title: Text(x["mataPelajaran"] ?? "-", style: const TextStyle(fontSize: 13)),
                  trailing: Chip(label: Text(x["status"], style: const TextStyle(fontSize: 11))),
                )).toList(),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label; final String value; final String sub; final Color? color;
  const _StatCard({required this.label, required this.value, required this.sub, this.color});
  @override
  Widget build(BuildContext context) => Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [Text(label, style: const TextStyle(fontSize: 11, color: Colors.black54)), Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)), Text(sub, style: const TextStyle(fontSize: 10, color: Colors.black45))]))));
}
