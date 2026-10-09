import "dart:async";
import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Notification Center versi mobile — GET /api/mobile/notifikasi (polling 30s),
/// tap untuk tandai dibaca, tombol "tandai semua" via POST {ids}.
class NotifikasiScreen extends StatefulWidget {
  const NotifikasiScreen({super.key});
  @override
  State<NotifikasiScreen> createState() => _NotifikasiScreenState();
}

class _NotifikasiScreenState extends State<NotifikasiScreen> {
  List<dynamic> rows = [];
  int unread = 0;
  bool loading = true;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final v = await ApiService.get("/api/mobile/notifikasi", useCache: false);
      if (mounted) {
        setState(() {
          if (v is Map) {
            rows = (v["rows"] as List?) ?? [];
            unread = (v["unread"] as num?)?.toInt() ?? 0;
          }
          loading = false;
        });
      }
    } catch (_) {
      if (mounted && !silent) setState(() => loading = false);
    }
  }

  Future<void> _mark(List<String> ids) async {
    try {
      await ApiService.post("/api/mobile/notifikasi", {"ids": ids});
      _load(silent: true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Gagal: $e"), backgroundColor: const Color(0xFFEF4444)));
    }
  }

  IconData _icon(String? tipe) {
    final t = (tipe ?? "").toUpperCase();
    if (t.contains("UJIAN") || t.contains("NILAI")) return Icons.quiz_outlined;
    if (t.contains("ABSEN")) return Icons.fact_check_outlined;
    if (t.contains("MATERI")) return Icons.menu_book_outlined;
    if (t.contains("IURAN") || t.contains("BENDAHARA")) return Icons.payments_outlined;
    if (t.contains("PELANGGARAN")) return Icons.gavel_outlined;
    return Icons.notifications_outlined;
  }

  String _time(dynamic iso) {
    final s = iso?.toString() ?? "";
    if (s.length < 16) return "-";
    return "${s.substring(0, 10)} • ${s.substring(11, 16)}";
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: Text(unread > 0 ? "Notifikasi ($unread)" : "Notifikasi"),
          backgroundColor: Colors.white,
          elevation: 0,
          actions: [
            TextButton(onPressed: unread > 0 ? () => _mark([]) : null, child: const Text("Tandai semua")),
          ],
        ),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: rows.isEmpty
                    ? ListView(children: const [Padding(padding: EdgeInsets.all(48), child: Center(child: Text("Belum ada notifikasi", style: TextStyle(color: Colors.black54))))])
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: rows.length,
                        itemBuilder: (_, i) {
                          final n = rows[i] as Map;
                          final isRead = n["isRead"] == true;
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            color: isRead ? Colors.white : const Color(0xFFEEF2FF),
                            child: ListTile(
                              leading: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(color: const Color(0xFF4F46E5).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                                child: Icon(_icon(n["tipe"]?.toString()), size: 18, color: const Color(0xFF4F46E5)),
                              ),
                              title: Text(n["judul"] ?? "-", style: TextStyle(fontWeight: isRead ? FontWeight.w600 : FontWeight.w800, fontSize: 13)),
                              subtitle: Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text("${n["pesan"] ?? ""}\n${_time(n["createdAt"])}", style: const TextStyle(fontSize: 11, color: Colors.black54)),
                              ),
                              isThreeLine: true,
                              trailing: isRead ? null : Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFFEF4444), shape: BoxShape.circle)),
                              onTap: isRead ? null : () => _mark([n["id"].toString()]),
                            ),
                          );
                        },
                      ),
              ),
      );
}

/// Lonceng unread-badge untuk AppBar dashboard (siswa & guru).
class NotifBell extends StatefulWidget {
  const NotifBell({super.key});
  @override
  State<NotifBell> createState() => _NotifBellState();
}

class _NotifBellState extends State<NotifBell> {
  int unread = 0;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    try {
      final v = await ApiService.get("/api/mobile/notifikasi", useCache: false);
      if (mounted && v is Map) setState(() => unread = (v["unread"] as num?)?.toInt() ?? 0);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => IconButton(
        icon: Badge(
          isLabelVisible: unread > 0,
          label: Text(unread > 99 ? "99+" : "$unread", style: const TextStyle(fontSize: 9)),
          child: const Icon(Icons.notifications_outlined),
        ),
        tooltip: "Notifikasi",
        onPressed: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => const NotifikasiScreen()));
          _refresh();
        },
      );
}
