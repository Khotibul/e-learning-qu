import "package:flutter/material.dart";
import "../../services/api_service.dart";

class GuruAiKnowledge extends StatefulWidget {
  const GuruAiKnowledge({super.key});
  @override
  State<GuruAiKnowledge> createState() => _GuruAiKnowledgeState();
}

class _GuruAiKnowledgeState extends State<GuruAiKnowledge> {
  Map<String, dynamic>? data;
  bool loading = true;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/ai-knowledge", useCache: false);
      if (mounted) setState(() { data = v is Map<String, dynamic> ? v : null; loading = false; _filter(); });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  Future<void> _op(String op, Map materi) async {
    final label = op == "indexMateri" ? "mengindeks" : "menghapus index";
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(op == "indexMateri" ? "Index Ulang Materi?" : "Hapus Index Materi?"),
        content: Text("${materi["judul"] ?? "-"}\nIni akan $label materi ini untuk knowledge base RAG."),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Lanjut"))],
      ),
    );
    if (ok != true) return;
    setState(() => busy = true);
    try {
      final res = await ApiService.post("/api/mobile/guru/ai-knowledge", {"op": op, "materiId": materi["id"]});
      if (op == "indexMateri") {
        _snack("Terindeks ${res is Map ? res["jumlahChunk"] ?? 0 : 0} chunk (${res is Map ? res["modeEmbed"] ?? "-" : "-"})");
      } else {
        _snack("Index dihapus");
      }
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  final searchCtrl = TextEditingController();
  List<dynamic> filtered = [];
  @override
  void dispose() { searchCtrl.dispose(); super.dispose(); }
  void _filter() {
    final q = searchCtrl.text.toLowerCase();
    final all = (data?["materis"] as List? ?? []);
    setState(() { filtered = q.isEmpty ? all : all.where((m) => (m["judul"] ?? "").toLowerCase().contains(q)).toList(); });
  }
  @override
  Widget build(BuildContext context) {
    final materis = (data?["materis"] as List? ?? []);
    if (filtered.isEmpty && searchCtrl.text.isEmpty) filtered = materis;
    return Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("AI Knowledge"), backgroundColor: Colors.white, elevation: 0),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Card(child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [const Icon(Icons.memory, color: Color(0xFF4F46E5)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text("${data?["totalChunks"] ?? 0} chunks", style: const TextStyle(fontWeight: FontWeight.bold)), Text("Knowledge base RAG — ${data?["geminiEnabled"] == true ? "semantic (Gemini)" : "keyword"}", style: const TextStyle(fontSize: 11, color: Colors.black54))]))]))),
                const SizedBox(height: 12),
                TextField(controller: searchCtrl, onChanged: (_) => _filter(), decoration: InputDecoration(hintText: "Cari materi...", prefixIcon: const Icon(Icons.search, size: 18), filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))), contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10))),
                const SizedBox(height: 12),
                Expanded(
                  child: ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (_, i) {
                      final m = filtered[i] as Map;
                      return Card(child: ListTile(
                        title: Text(m["judul"] ?? "-", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        subtitle: Text("${m["_count"]?["chunks"] ?? 0} chunks", style: const TextStyle(fontSize: 11)),
                        leading: (m["_count"]?["chunks"] ?? 0) > 0 ? const Icon(Icons.check_circle, color: Colors.green, size: 18) : const Icon(Icons.warning, color: Colors.orange, size: 18),
                        trailing: PopupMenuButton<String>(
                          icon: const Icon(Icons.more_vert, size: 18),
                          enabled: !busy,
                          onSelected: (v) => _op(v, m),
                          itemBuilder: (_) => const [
                            PopupMenuItem(value: "indexMateri", child: Text("Index Ulang", style: TextStyle(fontSize: 13))),
                            PopupMenuItem(value: "deleteMateriIndex", child: Text("Hapus Index", style: TextStyle(fontSize: 13, color: Colors.red))),
                          ],
                        ),
                      ));
                    },
                  ),
                ),
              ],
            ),
          ),
  );
  }
}
