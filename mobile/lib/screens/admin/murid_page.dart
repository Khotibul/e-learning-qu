import "dart:async";

import "package:flutter/material.dart";

import "../../services/api_service.dart";
import "murid_edit.dart";

/// Daftar murid untuk Admin; ketuk kartu untuk membuka layar edit.
class AdminMuridPage extends StatefulWidget {
  const AdminMuridPage({super.key});
  @override
  State<AdminMuridPage> createState() => _AdminMuridPageState();
}

class _AdminMuridPageState extends State<AdminMuridPage> {
  List<dynamic> data = [];
  bool loading = true;
  final searchCtrl = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _load();
    searchCtrl.addListener(_onSearch);
  }

  void _onSearch() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => _load());
  }

  Future<void> _load() async {
    if (mounted) setState(() => loading = true);
    try {
      final q = Uri.encodeComponent(searchCtrl.text.trim());
      final v = await ApiService.get(
        "/api/mobile/admin/murid?limit=50&search=$q",
        useCache: false,
      );
      if (mounted) {
        setState(() {
          data = v is Map && v["data"] is List
              ? v["data"] as List<dynamic>
              : [];
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(
      title: const Text("Data Murid"),
      backgroundColor: Colors.white,
      elevation: 0,
    ),
    body: Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: searchCtrl,
            decoration: const InputDecoration(
              hintText: "Cari nama, NIS, atau NISN...",
              hintStyle: TextStyle(fontSize: 13, color: Colors.black38),
              prefixIcon: Icon(Icons.search, size: 18),
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
        ),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: data.isEmpty
                      ? ListView(
                          children: const [
                            Padding(
                              padding: EdgeInsets.all(32),
                              child: Center(
                                child: Text("Tidak ada data murid"),
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                          itemCount: data.length,
                          itemBuilder: (_, i) {
                            final m = data[i];
                            final sub = [
                              if ("${m["nis"] ?? ""}".isNotEmpty)
                                "NIS ${m["nis"]}",
                              if ("${m["nisn"] ?? ""}".isNotEmpty)
                                "NISN ${m["nisn"]}",
                              if (m["kelas"] is Map &&
                                  m["kelas"]["nama"] != null)
                                "${m["kelas"]["nama"]}",
                            ].join(" • ");
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                title: Text(
                                  "${m["nama"] ?? "-"}",
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                                subtitle: Text(
                                  sub.isEmpty
                                      ? "${m["user"]?["email"] ?? ""}"
                                      : sub,
                                  style: const TextStyle(fontSize: 12),
                                ),
                                trailing: const Icon(
                                  Icons.chevron_right,
                                  size: 20,
                                ),
                                onTap: () async {
                                  final berubah = await Navigator.push<bool>(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => MuridEditScreen(
                                        id: "${m["id"]}",
                                        nama: "${m["nama"] ?? ""}",
                                      ),
                                    ),
                                  );
                                  if (berubah == true) _load();
                                },
                              ),
                            );
                          },
                        ),
                ),
        ),
      ],
    ),
  );
}
