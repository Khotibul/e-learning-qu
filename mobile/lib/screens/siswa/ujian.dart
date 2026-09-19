import "package:flutter/material.dart";
import "../../services/api_service.dart";

class SiswaUjian extends StatefulWidget {
  const SiswaUjian({super.key});
  @override
  State<SiswaUjian> createState() => _SiswaUjianState();
}

class _SiswaUjianState extends State<SiswaUjian> {
  List<dynamic> data = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    ApiService.getUjianList().then((v) {
      setState(() {
        data = v;
        loading = false;
      });
    }).catchError((_) {
      setState(() => loading = false);
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text("Ujian")),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : ListView.builder(
            itemCount: data.length,
            itemBuilder: (_, i) {
              final u = data[i];
              return Card(child: ListTile(title: Text(u["nama"] ?? "-"), subtitle: Text("${u["mapel"] ?? ""} • ${u["status"] ?? ""}")));
            },
          ),
  );
}
