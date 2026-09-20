import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class SiswaDashboard extends StatefulWidget {
  const SiswaDashboard({super.key});
  @override
  State<SiswaDashboard> createState() => _SiswaDashboardState();
}

class _SiswaDashboardState extends State<SiswaDashboard> {
  Map<String, dynamic>? stats;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    ApiService.get("/api/siswa/dashboard").then((v) {
      if (mounted) setState(() { stats = v is Map<String, dynamic> ? v : null; loading = false; });
    }).catchError((_) { if (mounted) setState(() => loading = false); });
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return Scaffold(appBar: AppBar(title: const Text("Beranda")), body: const Center(child: CircularProgressIndicator()));
    return Scaffold(
      appBar: AppBar(title: const Text("Beranda Siswa"), backgroundColor: Colors.white),
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFEEF2FF), Color(0xFFF8FAFC)])),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF4F46E5), Color(0xFF06B6D4)]), borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.person, color: Colors.white)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text("Halo, ${stats?["nama"] ?? "Siswa"}", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)), Text("${stats?["kelas"] ?? "-"}", style: const TextStyle(color: Colors.black54, fontSize: 12))]))]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: _MiniStat(label: "Rata Nilai", value: "${stats?["rataNilai"] ?? stats?["nilaiRataRata"] ?? "-"}", icon: Icons.grade, color: const Color(0xFF10B981))),
                    const SizedBox(width: 8),
                    Expanded(child: _MiniStat(label: "Ujian Aktif", value: "${stats?["ujianAktif"] ?? 0}", icon: Icons.quiz, color: const Color(0xFFF59E0B))),
                  ]),
                ]),
              ),
            ),
            const SizedBox(height: 12),
            const Text("Menu Belajar", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            const SizedBox(height: 8),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 3,
              childAspectRatio: 0.95,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              children: [
                _MenuCard(icon: Icons.quiz, label: "Ujian", color: const Color(0xFF4F46E5), onTap: () {}),
                _MenuCard(icon: Icons.menu_book, label: "Materi", color: const Color(0xFF06B6D4), onTap: () {}),
                _MenuCard(icon: Icons.fact_check, label: "Absensi", color: const Color(0xFF10B981), onTap: () {}),
                _MenuCard(icon: Icons.grade, label: "Nilai", color: const Color(0xFFF59E0B), onTap: () {}),
                _MenuCard(icon: Icons.leaderboard, label: "Ranking", color: const Color(0xFFEF4444), onTap: () {}),
                _MenuCard(icon: Icons.smart_toy, label: "AI Tutor", color: const Color(0xFF8B5CF6), onTap: () {}),
                _MenuCard(icon: Icons.calendar_today, label: "Jadwal", color: const Color(0xFFEC4899), onTap: () {}),
                _MenuCard(icon: Icons.groups, label: "Kelas", color: const Color(0xFF14B8A6), onTap: () {}),
                _MenuCard(icon: Icons.account_balance_wallet, label: "Iuran", color: const Color(0xFFF97316), onTap: () {}),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE0E7FF))),
              child: const Row(children: [Icon(Icons.info_outline, size: 16, color: Color(0xFF4F46E5)), SizedBox(width: 8), Expanded(child: Text("1 Database dengan Web — nilai, absensi, materi sinkron real-time", style: TextStyle(fontSize: 11, color: Color(0xFF4F46E5))))]),
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label; final String value; final IconData icon; final Color color;
  const _MiniStat({required this.label, required this.value, required this.icon, required this.color});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(12), border: Border.all(color: color.withOpacity(0.2))),
    child: Row(children: [Icon(icon, size: 18, color: color), const SizedBox(width: 8), Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(fontSize: 10, color: Colors.black54)), Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color))])]),
  );
}

class _MenuCard extends StatelessWidget {
  final IconData icon; final String label; final Color color; final VoidCallback onTap;
  const _MenuCard({required this.icon, required this.label, required this.color, required this.onTap});
  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: color, size: 22)),
          const SizedBox(height: 8),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12), textAlign: TextAlign.center),
        ]),
      ),
    ),
  );
}
