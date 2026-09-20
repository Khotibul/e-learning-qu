import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class SiswaRanking extends StatefulWidget {
  const SiswaRanking({super.key});
  @override
  State<SiswaRanking> createState() => _SiswaRankingState();
}

class _SiswaRankingState extends State<SiswaRanking> {
  List<dynamic> data = [];
  bool loading = true;
  @override
  void initState() {
    super.initState();
    ApiService.getRanking().then((v) {
      if (mounted) setState(() { data = v; loading = false; });
    }).catchError((_) {
      if (mounted) setState(() => loading = false);
    });
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text("Ranking Kelas")),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: data.length,
            itemBuilder: (_, i) {
              final r = data[i] as Map;
              return Card(child: ListTile(leading: CircleAvatar(child: Text("${i + 1}")), title: Text(r["nama"] ?? "-"), subtitle: Text("Rata: ${r["rataRata"] ?? 0}"), trailing: r["isCurrentUser"] == true ? const Icon(Icons.star, color: Colors.amber) : null));
            },
          ),
  );
}
