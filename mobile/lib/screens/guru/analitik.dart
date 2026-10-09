import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Analitik pembelajaran guru — mirror web /guru/analitik via
/// GET /api/mobile/guru/analitik (1 DB): rata-rata, tertinggi/terendah,
/// lulus/tidak lulus, grafik per kelas & per mapel, jumlah essay/PG.
class GuruAnalitik extends StatefulWidget {
  const GuruAnalitik({super.key});
  @override
  State<GuruAnalitik> createState() => _GuruAnalitikState();
}

class _GuruAnalitikState extends State<GuruAnalitik> {
  Map<String, dynamic> data = {};
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/analitik", useCache: false);
      if (mounted) setState(() { if (v is Map) data = Map<String, dynamic>.from(v); loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  num _n(String k) => (data[k] as num?) ?? 0;

  Widget _card(String label, String value, IconData icon, Color c) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: c.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)), child: Icon(icon, size: 16, color: c)),
            const SizedBox(width: 8),
            Expanded(child: Text(label, style: const TextStyle(fontSize: 11, color: Colors.black54), overflow: TextOverflow.ellipsis)),
          ]),
          const Spacer(),
          Text(value, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: c)),
        ]),
      );

  Widget _bars(String title, List<dynamic> items, Color c) {
    final list = items.map((e) => e as Map).toList();
    final maxV = list.fold<num>(0, (m, e) => ((e["nilai"] as num?) ?? 0) > m ? (e["nilai"] as num) : m);
    final scale = maxV > 0 ? maxV : 100;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 10),
          if (list.isEmpty) const Text("Belum ada data nilai", style: TextStyle(color: Colors.black45, fontSize: 12)),
          ...list.map((e) {
            final v = ((e["nilai"] as num?) ?? 0).toDouble();
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                SizedBox(width: 90, child: Text(e["label"] ?? "-", style: const TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis)),
                const SizedBox(width: 8),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(value: (v / scale).clamp(0.0, 1.0), minHeight: 10, backgroundColor: const Color(0xFFF1F5F9), valueColor: AlwaysStoppedAnimation(c)),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(width: 44, child: Text(v.toStringAsFixed(1), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c))),
              ]),
            );
          }),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(title: const Text("Analitik"), backgroundColor: Colors.white, elevation: 0),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(padding: const EdgeInsets.all(16), children: [
                  const Text("Analitik Pembelajaran", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const Text("Ringkasan hasil belajar siswa", style: TextStyle(fontSize: 12, color: Colors.black54)),
                  const SizedBox(height: 12),
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.5,
                    children: [
                      _card("Rata-rata", _n("rataRata").toStringAsFixed(1), Icons.grade_outlined, const Color(0xFF4F46E5)),
                      _card("Tertinggi", "${_n("tertinggi")}", Icons.trending_up, const Color(0xFF10B981)),
                      _card("Terendah", "${_n("terendah")}", Icons.trending_down, const Color(0xFFEF4444)),
                      _card("Dinilai", "${_n("totalSiswaDinilai")}", Icons.people_outline, const Color(0xFF06B6D4)),
                      _card("Lulus", "${_n("lulus")}", Icons.check_circle_outline, const Color(0xFF10B981)),
                      _card("Tidak Lulus", "${_n("tidakLulus")}", Icons.cancel_outlined, const Color(0xFFF59E0B)),
                      _card("Essay Dinilai", "${_n("essayCount")}", Icons.edit_note, const Color(0xFF8B5CF6)),
                      _card("PG Benar", "${_n("pgCount")}", Icons.radio_button_checked, const Color(0xFFEC4899)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _bars("Rata-rata per Kelas", (data["grafikKelas"] as List?) ?? [], const Color(0xFF4F46E5)),
                  _bars("Rata-rata per Mapel", (data["grafikMapel"] as List?) ?? [], const Color(0xFF06B6D4)),
                ]),
              ),
      );
}
