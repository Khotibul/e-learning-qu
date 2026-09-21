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

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/ai-knowledge");
      if (mounted) setState(() { data = v is Map<String, dynamic> ? v : null; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("AI Knowledge"), backgroundColor: Colors.white, elevation: 0),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Card(child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [const Icon(Icons.memory, color: Color(0xFF4F46E5)), const SizedBox(width: 12), Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text("${data?["totalChunks"] ?? 0} chunks", style: const TextStyle(fontWeight: FontWeight.bold)), const Text("Knowledge base untuk RAG", style: TextStyle(fontSize: 11, color: Colors.black54))])]))),
                const SizedBox(height: 12),
                Expanded(
                  child: ListView.builder(
                    itemCount: (data?["materis"] as List? ?? []).length,
                    itemBuilder: (_, i) {
                      final m = (data?["materis"] as List)[i] as Map;
                      return Card(child: ListTile(title: Text(m["judul"] ?? "-"), subtitle: Text("${m["_count"]?["chunks"] ?? 0} chunks"), trailing: (m["_count"]?["chunks"] ?? 0) > 0 ? const Icon(Icons.check_circle, color: Colors.green, size: 18) : const Icon(Icons.warning, color: Colors.orange, size: 18)));
                    },
                  ),
                ),
              ],
            ),
          ),
  );
}
