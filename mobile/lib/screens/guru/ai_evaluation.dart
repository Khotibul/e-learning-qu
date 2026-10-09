import "package:flutter/material.dart";
import "package:intl/intl.dart";
import "../../services/api_service.dart";

/// Evaluasi AI + Hasil SUS (privilese guru) — mirror web /guru/ai-evaluation.
class GuruAiEvaluation extends StatefulWidget {
  const GuruAiEvaluation({super.key});
  @override
  State<GuruAiEvaluation> createState() => _GuruAiEvaluationState();
}

class _GuruAiEvaluationState extends State<GuruAiEvaluation> {
  bool loading = true;
  Map<String, dynamic>? sus;
  Map<String, dynamic>? ai;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/ai-evaluation", useCache: false);
      if (mounted && v is Map) {
        setState(() {
          sus = v["sus"] is Map ? Map<String, dynamic>.from(v["sus"] as Map) : null;
          ai = v["ai"] is Map ? Map<String, dynamic>.from(v["ai"] as Map) : null;
          loading = false;
        });
      } else if (mounted) {
        setState(() => loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  String _interpretation(int skor) {
    if (skor >= 80) return "Excellent";
    if (skor >= 68) return "Good";
    if (skor >= 50) return "OK";
    if (skor >= 25) return "Poor";
    return "Terrible";
  }

  Color _interpColor(int skor) {
    if (skor >= 80) return const Color(0xFF10B981);
    if (skor >= 68) return const Color(0xFF0EA5E9);
    if (skor >= 50) return const Color(0xFFF59E0B);
    if (skor >= 25) return const Color(0xFFF97316);
    return const Color(0xFFEF4444);
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 2,
    child: Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text("Evaluasi AI"),
        backgroundColor: Colors.white,
        elevation: 0,
        bottom: const TabBar(labelColor: Color(0xFF0F172A), unselectedLabelColor: Colors.black45, tabs: [Tab(text: "Hasil SUS"), Tab(text: "Evaluasi AI")]),
      ),
      body: loading ? const Center(child: CircularProgressIndicator()) : TabBarView(children: [_buildSus(), _buildAi()]),
    ),
  );

  Widget _buildSus() {
    if (sus == null) return const Center(child: Text("Gagal memuat hasil SUS", style: TextStyle(color: Colors.black54)));
    final total = (sus!["total"] as num?) ?? 0;
    final average = ((sus!["average"] as num?) ?? 0).toInt();
    final dist = (sus!["distribusi"] as Map<String, dynamic>?) ?? {};
    final results = (sus!["results"] as List? ?? []);
    final entries = [
      ("Excellent", (dist["excellent"] ?? 0) as num, const Color(0xFF10B981)),
      ("Good", (dist["good"] ?? 0) as num, const Color(0xFF0EA5E9)),
      ("OK", (dist["ok"] ?? 0) as num, const Color(0xFFF59E0B)),
      ("Poor", (dist["poor"] ?? 0) as num, const Color(0xFFF97316)),
      ("Terrible", (dist["terrible"] ?? 0) as num, const Color(0xFFEF4444)),
    ];
    final maxV = entries.map((e) => e.$2.toInt()).fold<int>(1, (a, b) => b > a ? b : a);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (total == 0)
          const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada hasil SUS yang tersedia.", style: TextStyle(color: Colors.black54)))))
        else ...[
          Row(children: [
            Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text("Rata-rata SUS", style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              Text("$average / 100", style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: _interpColor(average).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)), child: Text(_interpretation(average), style: TextStyle(fontSize: 11, color: _interpColor(average), fontWeight: FontWeight.w700))),
            ])))),
            Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text("Total Respons", style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              Text("$total", style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const Text("lintas seluruh siswa", style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
            ])))),
          ]),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text("Distribusi", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 10),
                ...entries.map((e) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [Text(e.$1, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)), const Spacer(), Text("${e.$2.toInt()}", style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)))]),
                    const SizedBox(height: 3),
                    ClipRRect(borderRadius: BorderRadius.circular(6), child: LinearProgressIndicator(value: total > 0 ? e.$2 / maxV : 0, minHeight: 6, backgroundColor: const Color(0xFFE2E8F0), color: e.$3)),
                  ]),
                )),
              ]),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text("Rincian Jawaban", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 6),
                ...results.map((r) { final m = r as Map; final skor = ((m["skor"] as num?) ?? 0).toInt(); return ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(radius: 16, backgroundColor: _interpColor(skor).withValues(alpha: 0.12), child: Text("$skor", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _interpColor(skor)))),
                  title: Text("${m["siswa"] ?? "-"} (${m["kelas"] ?? "-"})", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  subtitle: Text("${_interpretation(skor)} • ${DateFormat("dd MMM yyyy").format(DateTime.tryParse("${m["tanggal"]}") ?? DateTime.now())}${m["komentar"] != null ? "\n\"${m["komentar"]}\"" : ""}", maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10)),
                  isThreeLine: m["komentar"] != null,
                ); }),
              ]),
            ),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildAi() {
    if (ai == null) return const Center(child: Text("Gagal memuat evaluasi AI", style: TextStyle(color: Colors.black54)));
    final total = (ai!["total"] as num?) ?? 0;
    final summary = (ai!["summary"] as List? ?? []);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              const Icon(Icons.smart_toy_outlined, color: Color(0xFF8B5CF6)),
              const SizedBox(width: 12),
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text("$total", style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                const Text("total evaluasi AI tercatat", style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              ]),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        if (summary.isEmpty)
          const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada metrik evaluasi AI.", style: TextStyle(color: Colors.black54)))))
        else
          ...summary.map((s) { final m = s as Map; return Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text("${m["metrik"] ?? "-"}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13))),
                  Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: const Color(0xFF8B5CF6).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)), child: Text("avg ${m["rataRata"] ?? 0}", style: const TextStyle(fontSize: 11, color: Color(0xFF8B5CF6), fontWeight: FontWeight.w700))),
                ]),
                const SizedBox(height: 8),
                Row(children: [
                  _stat("Total", "${m["total"] ?? 0}"),
                  _stat("Min", "${m["min"] ?? 0}"),
                  _stat("Max", "${m["max"] ?? 0}"),
                ]),
              ]),
            ),
          ); }),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _stat(String label, String value) => Expanded(
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
      Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
    ]),
  );
}
