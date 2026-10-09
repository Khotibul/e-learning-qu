import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Teacher Analytics — mirror web /guru/teacher-analytics:
/// ringkasan (overview/per mapel/per kelas/n-gain/aktivitas), siswa berisiko
/// (early warning + resolve), dan insight per siswa.
class GuruTeacherAnalytics extends StatefulWidget {
  const GuruTeacherAnalytics({super.key});
  @override
  State<GuruTeacherAnalytics> createState() => _GuruTeacherAnalyticsState();
}

class _GuruTeacherAnalyticsState extends State<GuruTeacherAnalytics> {
  bool loading = true;
  Map<String, dynamic>? analytics;
  List<dynamic> atRisk = [];
  List<dynamic> insights = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/teacher-analytics", useCache: false);
      if (mounted && v is Map) {
        setState(() {
          analytics = v["analytics"] is Map ? Map<String, dynamic>.from(v["analytics"] as Map) : null;
          atRisk = v["atRisk"] is List ? v["atRisk"] as List : [];
          insights = v["insights"] is List ? v["insights"] as List : [];
          loading = false;
        });
      } else if (mounted) {
        setState(() => loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  Future<void> _resolve(Map w) async {
    try {
      await ApiService.post("/api/mobile/guru/teacher-analytics", {"op": "resolveWarning", "warningId": w["id"]});
      _snack("Warning ditandai selesai");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Color _sevColor(String s) => s == "CRITICAL" ? const Color(0xFFEF4444) : s == "HIGH" ? const Color(0xFFF97316) : s == "MEDIUM" ? const Color(0xFFF59E0B) : const Color(0xFF0EA5E9);

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 3,
    child: Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text("Teacher Analytics"),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [IconButton(icon: const Icon(Icons.refresh, size: 20), onPressed: () { setState(() => loading = true); _load(); })],
        bottom: const TabBar(isScrollable: true, labelColor: Color(0xFF0F172A), unselectedLabelColor: Colors.black45, tabs: [Tab(text: "Ringkasan"), Tab(text: "Berisiko"), Tab(text: "Insight")]),
      ),
      body: loading ? const Center(child: CircularProgressIndicator()) : TabBarView(children: [_ringkasan(), _berisiko(), _insight()]),
    ),
  );

  // ---------------- Ringkasan ----------------

  Widget _ringkasan() {
    final a = analytics;
    if (a == null) return const Center(child: Text("Gagal memuat analitik", style: TextStyle(color: Colors.black54)));
    final o = (a["overview"] as Map<String, dynamic>?) ?? {};
    final perMapel = (a["perMapel"] as List? ?? []);
    final perKelas = (a["perKelas"] as List? ?? []);
    final nGain = (a["nGainSummary"] as List? ?? []);
    final recent = (a["recentActivity"] as List? ?? []);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(children: [
          _ov("Siswa", "${o["totalSiswa"] ?? 0}", const Color(0xFF4F46E5)),
          const SizedBox(width: 8),
          _ov("Kelas", "${o["totalKelas"] ?? 0}", const Color(0xFF0EA5E9)),
          const SizedBox(width: 8),
          _ov("Mapel", "${o["totalMapel"] ?? 0}", const Color(0xFF10B981)),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          _ov("Ujian", "${o["totalUjian"] ?? 0}", const Color(0xFFF59E0B)),
          const SizedBox(width: 8),
          Expanded(child: _ov("Rata Global", "${o["rataRataGlobal"] ?? 0}", const Color(0xFF8B5CF6))),
        ]),
        const SizedBox(height: 8),
        if (perMapel.isNotEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text("Per Mata Pelajaran", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 8),
                ...perMapel.map((p) { final m = p as Map; final lemah = (m["topikLemah"] as List? ?? []); return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text("${m["nama"] ?? "-"}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
                      Text("avg ${m["rataRata"] ?? 0} • lulus ${m["lulusRate"] ?? 0}%", style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    ]),
                    if (lemah.isNotEmpty) Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Wrap(spacing: 4, runSpacing: 4, children: lemah.take(4).map((t) => Chip(label: Text("$t", style: const TextStyle(fontSize: 10)), visualDensity: VisualDensity.compact, backgroundColor: const Color(0xFFEF4444).withValues(alpha: 0.08))).toList()),
                    ),
                  ]),
                ); }),
              ]),
            ),
          ),
        if (perKelas.isNotEmpty) ...[
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text("Per Kelas", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 8),
                ...perKelas.map((k) { final m = k as Map; return ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text("${m["nama"] ?? "-"}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  subtitle: Text("${m["jumlahSiswa"] ?? 0} siswa", style: const TextStyle(fontSize: 11)),
                  trailing: Text("avg ${m["rataRata"] ?? 0}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0EA5E9))),
                ); }),
              ]),
            ),
          ),
        ],
        if (nGain.isNotEmpty) ...[
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text("N-Gain", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 8),
                ...nGain.map((g) { final m = g as Map; final ef = "${m["efektivitas"] ?? "-"}"; final c = ef == "Efektif" ? const Color(0xFF10B981) : ef == "Cukup Efektif" ? const Color(0xFFF59E0B) : const Color(0xFFEF4444); return ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text("${m["mapel"] ?? "-"}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  subtitle: Text("pre ${m["pretest"] ?? 0} → post ${m["posttest"] ?? 0}", style: const TextStyle(fontSize: 11)),
                  trailing: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)), child: Text("n-gain ${m["nGain"] ?? 0} • $ef", style: TextStyle(fontSize: 10, color: c, fontWeight: FontWeight.w700))),
                ); }),
              ]),
            ),
          ),
        ],
        if (recent.isNotEmpty) ...[
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text("Aktivitas Terbaru", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 6),
                ...recent.take(8).map((r) { final m = r as Map; return ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text("${m["aktivitas"] ?? "-"}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  subtitle: Text("${m["detail"] ?? ""}\n${m["tanggal"] ?? ""}", style: const TextStyle(fontSize: 10)),
                  isThreeLine: true,
                ); }),
              ]),
            ),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _ov(String label, String value, Color c) => Expanded(
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
          FittedBox(child: Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: c))),
        ]),
      ),
    ),
  );

  // ---------------- Berisiko ----------------

  Widget _berisiko() {
    if (atRisk.isEmpty) {
      return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text("Tidak ada warning aktif — semua siswa dalam kondisi aman", textAlign: TextAlign.center, style: TextStyle(color: Colors.black54))));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: atRisk.length,
        itemBuilder: (_, i) {
          final entry = atRisk[i] as Map;
          final siswa = entry["siswa"] is Map ? Map<String, dynamic>.from(entry["siswa"] as Map) : {};
          final warnings = (entry["warnings"] as List? ?? []);
          final sev = "${entry["highestSeverity"] ?? entry["maxSeverity"] ?? "MEDIUM"}";
          final total = (entry["totalWarnings"] ?? entry["warningCount"] ?? warnings.length) as num;
          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ExpansionTile(
              tilePadding: const EdgeInsets.symmetric(horizontal: 14),
              childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              leading: CircleAvatar(radius: 16, backgroundColor: _sevColor(sev).withValues(alpha: 0.12), child: Text("$total", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: _sevColor(sev)))),
              title: Text("${siswa["nama"] ?? "-"}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              subtitle: Text("${siswa["kelas"]?["nama"] ?? "-"} • NIS ${siswa["nis"] ?? "-"}", style: const TextStyle(fontSize: 11)),
              trailing: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: _sevColor(sev).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)), child: Text(sev, style: TextStyle(fontSize: 10, color: _sevColor(sev), fontWeight: FontWeight.w700))),
              children: warnings.map((w) { final wm = w as Map; return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFE2E8F0))),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: _sevColor("${wm["severity"]}").withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)), child: Text("${wm["severity"]}", style: TextStyle(fontSize: 9, color: _sevColor("${wm["severity"]}"), fontWeight: FontWeight.w700))),
                      const SizedBox(width: 6),
                      Text("${wm["tipe"] ?? "-"}", style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                      const Spacer(),
                      TextButton(onPressed: () => _resolve(wm), child: const Text("Resolve", style: TextStyle(fontSize: 11))),
                    ]),
                    const SizedBox(height: 2),
                    Text("${wm["message"] ?? ""}", style: const TextStyle(fontSize: 12)),
                  ]),
                ),
              ); }).toList(),
            ),
          );
        },
      ),
    );
  }

  // ---------------- Insight ----------------

  Widget _insight() {
    if (insights.isEmpty) return const Center(child: Text("Belum ada insight siswa", style: TextStyle(color: Colors.black54)));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: insights.length,
        itemBuilder: (_, i) {
          final s = insights[i] as Map;
          final risk = "${s["riskLevel"] ?? "-"}";
          final rc = risk.toLowerCase().contains("tinggi") || risk.toUpperCase() == "HIGH" || risk.toUpperCase() == "CRITICAL"
              ? const Color(0xFFEF4444)
              : risk.toUpperCase() == "MEDIUM" || risk.toLowerCase().contains("sedang")
                  ? const Color(0xFFF59E0B)
                  : const Color(0xFF10B981);
          final strengths = (s["strengths"] as List? ?? []);
          final weaknesses = (s["weaknesses"] as List? ?? []);
          final recs = (s["recommendations"] as List? ?? []);
          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ExpansionTile(
              tilePadding: const EdgeInsets.symmetric(horizontal: 14),
              childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              title: Text("${s["nama"] ?? "-"} (${s["kelas"] ?? "-"})", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              subtitle: Text("progress ${s["progress"] ?? 0}% • avg ${s["averageScore"] ?? 0} • mastery ${s["mastery"] ?? 0}% • ${s["engagement"] ?? "-"}", style: const TextStyle(fontSize: 10)),
              trailing: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: rc.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)), child: Text(risk, style: TextStyle(fontSize: 10, color: rc, fontWeight: FontWeight.w700))),
              children: [
                if (strengths.isNotEmpty) _chipsRow("Kekuatan", strengths, const Color(0xFF10B981)),
                if (weaknesses.isNotEmpty) _chipsRow("Kelemahan", weaknesses, const Color(0xFFEF4444)),
                if (recs.isNotEmpty) _chipsRow("Rekomendasi", recs, const Color(0xFF0EA5E9)),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _chipsRow(String label, List items, Color c) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c)),
      const SizedBox(height: 4),
      Wrap(spacing: 4, runSpacing: 4, children: items.take(6).map((x) => Chip(label: Text("$x", style: const TextStyle(fontSize: 10)), visualDensity: VisualDensity.compact, backgroundColor: c.withValues(alpha: 0.08))).toList()),
    ]),
  );
}
