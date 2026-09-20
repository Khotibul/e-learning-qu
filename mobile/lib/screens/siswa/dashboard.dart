import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import 'ujian.dart';
import 'materi.dart';
import 'absensi_harian.dart';
import 'nilai.dart';
import 'ranking.dart';
import 'jadwal.dart';
import 'ai_tutor.dart';
import 'latihan.dart';

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
    ApiService.getDashboard().then((v) {
      if (mounted) setState(() { stats = v; loading = false; });
    }).catchError((_) { if (mounted) setState(() => loading = false); });
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return Scaffold(appBar: AppBar(title: const Text("Beranda")), body: const Center(child: CircularProgressIndicator()));
    final s = stats ?? {};
    return Scaffold(
      appBar: AppBar(title: const Text("Beranda Siswa"), backgroundColor: Colors.white),
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFEEF2FF), Color(0xFFF8FAFC)])),
        child: RefreshIndicator(
          onRefresh: () async {
            final v = await ApiService.getDashboard();
            if (mounted) setState(() => stats = v);
          },
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Header
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF4F46E5), Color(0xFF06B6D4)]), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.person_outline, color: Colors.white, size: 20)), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text("Halo, ${s["nama"] ?? "Siswa"}", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)), Text("${s["kelas"] ?? "-"} • ${s["jurusan"] ?? "-"} • ${s["semester"] ?? ""}", style: const TextStyle(color: Colors.black54, fontSize: 11))]))]),
                    const SizedBox(height: 12),
                    Text(s["aiInsight"] ?? "Mulai belajar untuk melihat insight AI.", style: const TextStyle(fontSize: 12, color: Color(0xFF475569), fontStyle: FontStyle.italic)),
                  ]),
                ),
              ),
              const SizedBox(height: 12),
              // 8 StatCards seperti website
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                childAspectRatio: 2.2,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                children: [
                  _StatCard(title: "Nilai Rata-rata", value: (s["nilaiRataRata"] ?? 0).toStringAsFixed(1), icon: Icons.psychology_outlined, color: const Color(0xFF10B981)),
                  _StatCard(title: "Mastery", value: "${s["rataMastery"] ?? 0}%", icon: Icons.track_changes_outlined, color: const Color(0xFF4F46E5)),
                  _StatCard(title: "Streak", value: "${s["streak"] ?? 0} hari", icon: Icons.local_fire_department_outlined, color: const Color(0xFFF59E0B)),
                  _StatCard(title: "Jam Belajar", value: "${s["jamBelajar"] ?? 0}j", icon: Icons.schedule_outlined, color: const Color(0xFF06B6D4)),
                  _StatCard(title: "Ujian Aktif", value: "${s["ujianAktif"] ?? 0}", icon: Icons.quiz_outlined, color: const Color(0xFF8B5CF6)),
                  _StatCard(title: "Latihan Aktif", value: "${s["tugasAktif"] ?? 0}", icon: Icons.menu_book_outlined, color: const Color(0xFFEC4899)),
                  _StatCard(title: "Progres", value: "${s["progresBelajar"] ?? 0}%", icon: Icons.trending_up_outlined, color: const Color(0xFF14B8A6)),
                  _StatCard(title: "Materi", value: "${s["totalMateri"] ?? 0}", icon: Icons.library_books_outlined, color: const Color(0xFFF97316)),
                ],
              ),
              const SizedBox(height: 12),
              // Grafik Persentase — sesuai website: absensi, materi, AI, aplikasi, nilai
              const Text("Grafik Persentase", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 8),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                childAspectRatio: 2.8,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                children: [
                  _PercentCard(label: "Absensi", value: s["persentaseAbsensi"] ?? 0, total: "${s["hadirAbsensi"] ?? 0}/${s["totalAbsensi"] ?? 0}", icon: Icons.fact_check_outlined, color: const Color(0xFF10B981)),
                  _PercentCard(label: "Materi", value: s["keaktifanMateri"] ?? 0, total: "${s["materiDiakses"] ?? 0}/${s["totalMateri"] ?? 0}", icon: Icons.menu_book_outlined, color: const Color(0xFF06B6D4)),
                  _PercentCard(label: "AI Tutor", value: s["keaktifanAI"] ?? 0, total: "${s["aiChatCount"] ?? 0} chat", icon: Icons.smart_toy_outlined, color: const Color(0xFF8B5CF6)),
                  _PercentCard(label: "Aplikasi", value: s["keaktifanAplikasi"] ?? 0, total: "${s["totalAktivitas"] ?? 0} aktivitas", icon: Icons.phone_android_outlined, color: const Color(0xFF4F46E5)),
                ],
              ),
              const SizedBox(height: 8),
              _PercentCard(label: "Nilai", value: ((s["nilaiRataRata"] ?? 0) as num).round(), total: "rata ${((s["nilaiRataRata"] ?? 0) as num).toStringAsFixed(1)}", icon: Icons.grade_outlined, color: const Color(0xFFF59E0B), fullWidth: true),
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
                  _MenuCard(icon: Icons.quiz_outlined, label: "Ujian", color: const Color(0xFF4F46E5), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SiswaUjian()))),
                  _MenuCard(icon: Icons.menu_book_outlined, label: "Materi", color: const Color(0xFF06B6D4), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SiswaMateri()))),
                  _MenuCard(icon: Icons.fact_check_outlined, label: "Absensi", color: const Color(0xFF10B981), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SiswaAbsensiHarian()))),
                  _MenuCard(icon: Icons.grade_outlined, label: "Nilai", color: const Color(0xFFF59E0B), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SiswaNilai()))),
                  _MenuCard(icon: Icons.leaderboard_outlined, label: "Ranking", color: const Color(0xFFEF4444), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SiswaRanking()))),
                  _MenuCard(icon: Icons.smart_toy_outlined, label: "AI Tutor", color: const Color(0xFF8B5CF6), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SiswaAiTutor()))),
                  _MenuCard(icon: Icons.menu_book_outlined, label: "Latihan", color: const Color(0xFF6366F1), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SiswaLatihan()))),
                  _MenuCard(icon: Icons.calendar_today_outlined, label: "Jadwal", color: const Color(0xFFEC4899), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SiswaJadwal()))),
                  _MenuCard(icon: Icons.groups_outlined, label: "Kelas", color: const Color(0xFF14B8A6), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SiswaAbsensiHarian()))),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title; final String value; final IconData icon; final Color color;
  const _StatCard({required this.title, required this.value, required this.icon, required this.color});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
    child: Row(children: [
      Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: color.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)), child: Icon(icon, size: 16, color: color)),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 10, color: Colors.black54)), Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: color))])),
    ]),
  );
}

class _PercentCard extends StatelessWidget {
  final String label; final int value; final String total; final IconData icon; final Color color; final bool fullWidth;
  const _PercentCard({required this.label, required this.value, required this.total, required this.icon, required this.color, this.fullWidth = false});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Icon(icon, size: 14, color: color), const SizedBox(width: 6), Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)), const Spacer(), Text("$value%", style: TextStyle(fontWeight: FontWeight.bold, color: color))]),
      const SizedBox(height: 6),
      ClipRRect(borderRadius: BorderRadius.circular(6), child: LinearProgressIndicator(value: value / 100, minHeight: 6, backgroundColor: const Color(0xFFF1F5F9), color: color)),
      const SizedBox(height: 4),
      Text(total, style: const TextStyle(fontSize: 10, color: Colors.black54)),
    ]),
  );
}

class _MenuCard extends StatelessWidget {
  final IconData icon; final String label; final Color color; final VoidCallback onTap;
  const _MenuCard({required this.icon, required this.label, required this.color, required this.onTap});
  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFF1F5F9))),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: color.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: color, size: 18)),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      ),
    ),
  );
}
