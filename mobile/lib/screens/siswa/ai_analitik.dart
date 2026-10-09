import "package:flutter/material.dart";
import "package:intl/intl.dart";
import "../../services/api_service.dart";

/// Analitik AI siswa — mirror web /siswa/ai-analitik (statistik agent log,
/// per-agent, profil model belajar, penguasaan kompetensi).
class SiswaAiAnalitik extends StatefulWidget {
  const SiswaAiAnalitik({super.key});
  @override
  State<SiswaAiAnalitik> createState() => _SiswaAiAnalitikState();
}

class _SiswaAiAnalitikState extends State<SiswaAiAnalitik> {
  bool loading = true;
  Map<String, dynamic>? data;

  static const _colors = <String, Color>{
    "orchestrator": Color(0xFF64748B),
    "tutor": Color(0xFF0EA5E9),
    "assessor": Color(0xFFF59E0B),
    "recommender": Color(0xFF8B5CF6),
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/siswa/ai-analitik", useCache: false);
      if (mounted) setState(() { data = v is Map ? Map<String, dynamic>.from(v) : null; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Color _agentColor(String a) => _colors[a] ?? const Color(0xFF64748B);

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(
      title: const Text("AI Analitik"),
      backgroundColor: Colors.white,
      elevation: 0,
      actions: [IconButton(icon: const Icon(Icons.refresh, size: 20), onPressed: () { setState(() => loading = true); _load(); })],
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : data == null
            ? const Center(child: Text("Gagal memuat analitik", style: TextStyle(color: Colors.black54)))
            : RefreshIndicator(onRefresh: _load, child: _buildBody()),
  );

  Widget _buildBody() {
    final d = data!;
    final stat = (d["statistik"] as Map<String, dynamic>?) ?? {};
    final profile = (d["profile"] as Map<String, dynamic>?) ?? {};
    final perAgent = (d["perAgent"] as List? ?? []);
    final logs = (d["logs"] as List? ?? []);
    final penguasaan = (d["penguasaan"] as Map<String, dynamic>?) ?? {};
    final total = ((stat["totalRuns"] as num?) ?? 1).toInt();
    final maxAgent = perAgent.fold<int>(1, (m, a) { final t = ((a as Map)["total"] as num? ?? 0).toInt(); return t > m ? t : m; });

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(children: [
          Expanded(child: _statCard("Total Run", "$total", const Color(0xFF0F172A))),
          const SizedBox(width: 8),
          Expanded(child: _statCard("Berhasil", "${stat["sukses"] ?? 0}", const Color(0xFF10B981), sub: total > 0 ? "${(((stat["sukses"] as num? ?? 0) / total) * 100).toStringAsFixed(1)}%" : "")),
          const SizedBox(width: 8),
          Expanded(child: _statCard("Gagal", "${stat["gagal"] ?? 0}", const Color(0xFFEF4444))),
        ]),
        const SizedBox(height: 8),
        _statCard("Rata-rata Durasi", "${(((stat["rataDurasi"] as num?) ?? 0).toDouble()).toStringAsFixed(1)}s", const Color(0xFF0EA5E9)),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text("Per Agent", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 12),
              if (perAgent.isEmpty)
                const Text("Belum ada log agent.", style: TextStyle(fontSize: 12, color: Colors.black54))
              else
                ...perAgent.map((a) {
                  final m = Map<String, dynamic>.from(a as Map);
                  final totalA = ((m["total"] as num?) ?? 0).toInt();
                  final label = switch (m["agent"]) { "tutor" => "Tutor Agent", "assessor" => "Assessor Agent", "recommender" => "Recommender Agent", "orchestrator" => "Orchestrator", _ => "${m["agent"]}" };
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Container(width: 8, height: 8, decoration: BoxDecoration(color: _agentColor("${m["agent"]}"), shape: BoxShape.circle)),
                        const SizedBox(width: 6),
                        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        const Spacer(),
                        Text("$totalA run • ${(((m["rataDurasi"] as num?) ?? 0) / 1000).toStringAsFixed(1)}s", style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                      ]),
                      const SizedBox(height: 4),
                      ClipRRect(borderRadius: BorderRadius.circular(6), child: LinearProgressIndicator(value: totalA / maxAgent, minHeight: 7, backgroundColor: const Color(0xFFE2E8F0), color: _agentColor("${m["agent"]}"))),
                    ]),
                  );
                }),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        if (profile.isNotEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text("Profil Belajar", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 10),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  _pill("Gaya belajar", "${profile["gayaBelajar"] ?? "-"}"),
                  _pill("Motivasi", "${profile["motivasi"] ?? 0}%"),
                  _pill("Engagement", "${profile["engagement"] ?? 0}%"),
                  _pill("Konsistensi", "${profile["konsistensi"] ?? 0}%"),
                  _pill("Streak", "${profile["streak"] ?? 0} hari"),
                  _pill("Trend nilai", "${profile["trendNilai"] ?? 0}"),
                ]),
              ]),
            ),
          ),
        if (penguasaan.isNotEmpty) ...[
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text("Penguasaan Kompetensi — rata-rata ${penguasaan["rataSkor"] ?? 0}% • ${penguasaan["total"] ?? 0} kompetensi", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 10),
                ...((penguasaan["penguasaan"] as List? ?? []).take(8).map((p) {
                  final m = Map<String, dynamic>.from(p as Map);
                  final skor = ((m["skor"] as num?) ?? 0).toInt();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text("${m["kompetensi"] ?? m["kode"] ?? "-"}", maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
                        Text("$skor% • ${m["kategori"] ?? "-"}", style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                      ]),
                      const SizedBox(height: 3),
                      ClipRRect(borderRadius: BorderRadius.circular(6), child: LinearProgressIndicator(value: skor / 100, minHeight: 6, backgroundColor: const Color(0xFFE2E8F0), color: skor >= 70 ? const Color(0xFF10B981) : skor >= 50 ? const Color(0xFFF59E0B) : const Color(0xFFEF4444))),
                    ]),
                  );
                })),
              ]),
            ),
          ),
        ],
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text("Log Terbaru", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 8),
              if (logs.isEmpty)
                const Text("Belum ada log.", style: TextStyle(fontSize: 12, color: Colors.black54))
              else
                ...logs.take(20).map((l) {
                  final m = Map<String, dynamic>.from(l as Map);
                  final ok = m["sukses"] == true;
                  return ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(radius: 14, backgroundColor: _agentColor("${m["agent"]}").withValues(alpha: 0.15), child: Icon(ok ? Icons.check : Icons.close, size: 14, color: _agentColor("${m["agent"]}"))),
                    title: Text(_agentLabel("${m["agent"]}"), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    subtitle: Text("${m["query"] ?? ""}\n${DateFormat("dd MMM yyyy HH:mm").format(DateTime.tryParse("${m["createdAt"]}") ?? DateTime.now())} • ${m["durasiMs"] ?? 0}ms${m["model"] != null ? " • ${m["model"]}" : ""}", maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10)),
                    isThreeLine: true,
                    trailing: Icon(ok ? Icons.check_circle : Icons.cancel, size: 16, color: ok ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
                  );
                }),
            ]),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  static String _agentLabel(String a) => switch (a) {
    "tutor" => "Tutor Agent",
    "assessor" => "Assessor Agent",
    "recommender" => "Recommender Agent",
    "orchestrator" => "Orchestrator",
    _ => a,
  };

  Widget _statCard(String label, String value, Color color, {String sub = ""}) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
        const SizedBox(height: 2),
        FittedBox(child: Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color))),
        if (sub.isNotEmpty) Text(sub, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
      ]),
    ),
  );

  Widget _pill(String label, String value) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(10)),
    child: Text("$label: $value", style: const TextStyle(fontSize: 11, color: Color(0xFF334155))),
  );
}
