import "dart:async";

import "package:flutter/material.dart";

import "../../services/api_service.dart";
import "santri_edit.dart";

/// Daftar santri untuk Admin; ketuk kartu untuk membuka layar edit.
class AdminSantriPage extends StatefulWidget {
  const AdminSantriPage({super.key});
  @override
  State<AdminSantriPage> createState() => _AdminSantriPageState();
}

class _AdminSantriPageState extends State<AdminSantriPage> {
  List<dynamic> data = [];
  bool loading = true;
  final searchCtrl = TextEditingController();
  Timer? _debounce;

  static const statusLabel = {
    "CALON": "Calon",
    "AKTIF": "Aktif",
    "CUTI": "Cuti",
    "NONAKTIF": "Nonaktif",
    "MUTASI": "Mutasi",
    "LULUS": "Lulus",
    "ALUMNI": "Alumni",
    "KELUAR": "Keluar",
  };

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
        "/api/mobile/admin/santri?limit=50&q=$q",
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
      title: const Text("Data Santri"),
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
              hintText: "Cari nama atau nomor induk santri...",
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
                                child: Text("Tidak ada data santri"),
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                          itemCount: data.length,
                          itemBuilder: (_, i) {
                            final s = data[i];
                            final sub = [
                              if ("${s["nisNo"] ?? ""}".isNotEmpty)
                                "NIS ${s["nisNo"]}",
                              if (s["kelas"] != null) "${s["kelas"]}",
                              if (s["email"] != null) "${s["email"]}",
                            ].join(" • ");
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                title: Text(
                                  "${s["nama"] ?? "-"}",
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                                subtitle: Text(
                                  sub,
                                  style: const TextStyle(fontSize: 12),
                                ),
                                trailing: Chip(
                                  label: Text(
                                    statusLabel[s["status"]] ??
                                        "${s["status"] ?? "-"}",
                                    style: const TextStyle(fontSize: 10),
                                  ),
                                  visualDensity: VisualDensity.compact,
                                ),
                                onTap: () async {
                                  final berubah = await Navigator.push<bool>(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => SantriEditScreen(
                                        id: "${s["id"]}",
                                        nama: "${s["nama"] ?? ""}",
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
