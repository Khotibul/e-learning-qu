import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "../../providers/auth_provider.dart";
import "../../services/api_service.dart";
import "murid_detail.dart";
import "ujian.dart";
import "soal.dart";
import "bank_soal.dart";
import "materi.dart";
import "nilai.dart";
import "intervensi.dart";
import "anti_cheat.dart";
import "ai_knowledge.dart";
import "ai_evaluation.dart";
import "teacher_analytics.dart";
import "analitik.dart";
import "wali_kelas.dart";
import "pelanggaran.dart";
import "pengaturan.dart";
import "absensi.dart";
import "izin_musyrif.dart";
import "gerbang.dart";
import "ustadz_pondok.dart";
import "pengurus_pondok.dart";
import "../notifikasi.dart";

class GuruDashboard extends StatefulWidget {
  const GuruDashboard({super.key});
  @override
  State<GuruDashboard> createState() => _GuruDashboardState();
}

class _GuruDashboardState extends State<GuruDashboard> {
  Map<String, dynamic> stats = {};
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.getGuruDashboard();
      if (mounted) setState(() { stats = v; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _buka(Widget page) => Navigator.push(context, MaterialPageRoute(builder: (_) => page));

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final nama = (stats["nama"] ?? auth.user?.name ?? "Guru").toString();
    final jabatan = stats["jabatan"]?.toString() ?? auth.user?.jabatan;
    final bisaMusyrif = stats["bisaMusyrif"] == true;
    final bisaPelanggaran = stats["bisaPelanggaran"] == true;
    final bisaGerbang = stats["bisaGerbang"] == true;
    final bisaUstadz = stats["bisaUstadz"] == true;
    final bisaPengurus = stats["bisaPengurus"] == true;

    return Scaffold(
      appBar: AppBar(title: const Text("Beranda Guru"), backgroundColor: Colors.white, actions: const [NotifBell(), SizedBox(width: 8)]),
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFEEF2FF), Color(0xFFF8FAFC)])),
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF4F46E5), Color(0xFF06B6D4)]), borderRadius: BorderRadius.circular(10)),
                      child: const Icon(Icons.school_outlined, color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Flexible(child: Text("Halo, $nama", maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                          if (jabatan != null && jabatan.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: const Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(20)),
                              child: Text(jabatan, style: const TextStyle(fontSize: 10, color: Color(0xFF4F46E5), fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ]),
                        const Text("Kelola kelas, ujian, absensi & siswa", style: TextStyle(color: Colors.black54, fontSize: 11)),
                      ]),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: 10),
              if (loading)
                const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())))
              else
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  childAspectRatio: 2.2,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  children: [
                    _StatCard(label: "Kelas Saya", value: "${stats["kelasCount"] ?? 0}", icon: Icons.door_front_door_outlined, color: const Color(0xFF4F46E5)),
                    _StatCard(label: "Mata Pelajaran", value: "${stats["mapelCount"] ?? 0}", icon: Icons.book_outlined, color: const Color(0xFF0EA5E9)),
                    _StatCard(label: "Siswa", value: "${stats["siswaCount"] ?? 0}", icon: Icons.people_outline, color: const Color(0xFF10B981)),
                    _StatCard(label: "Ujian Aktif", value: "${stats["ujianAktif"] ?? 0}", icon: Icons.quiz_outlined, color: const Color(0xFF8B5CF6)),
                    _StatCard(label: "Latihan Aktif", value: "${stats["latihanAktif"] ?? 0}", icon: Icons.menu_book_outlined, color: const Color(0xFFEC4899)),
                    _StatCard(label: "Bank Soal", value: "${stats["totalSoal"] ?? 0}", icon: Icons.inventory_2_outlined, color: const Color(0xFFF59E0B)),
                    _StatCard(label: "Rata-rata Nilai", value: "${stats["rataNilai"] ?? 0}", icon: Icons.grade_outlined, color: const Color(0xFF10B981)),
                    _StatCard(label: "Mastery", value: "${stats["rataMastery"] ?? 0}%", icon: Icons.track_changes_outlined, color: const Color(0xFF06B6D4)),
                  ],
                ),
              const SizedBox(height: 12),
              const Text("Menu Guru", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 8),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 3,
                childAspectRatio: 0.95,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                children: [
                  _GuruCard(icon: Icons.people_outline, label: "Murid", color: const Color(0xFF4F46E5), onTap: () => _buka(const GuruMurid())),
                  _GuruCard(icon: Icons.inventory_2_outlined, label: "Bank Soal", color: const Color(0xFF0EA5E9), onTap: () => _buka(const GuruBankSoal())),
                  _GuruCard(icon: Icons.quiz_outlined, label: "Soal", color: const Color(0xFF8B5CF6), onTap: () => _buka(const GuruSoal())),
                  _GuruCard(icon: Icons.assignment_outlined, label: "Ujian", color: const Color(0xFF06B6D4), onTap: () => _buka(const GuruUjian())),
                  _GuruCard(icon: Icons.fact_check_outlined, label: "Absensi", color: const Color(0xFF10B981), onTap: () => _buka(const GuruAbsensi())),
                  _GuruCard(icon: Icons.shield_outlined, label: "Wali Kelas", color: const Color(0xFF0EA5E9), onTap: () => _buka(const GuruWaliKelas())),
                  if (bisaPelanggaran) _GuruCard(icon: Icons.gavel_outlined, label: "Pelanggaran", color: const Color(0xFFEF4444), onTap: () => _buka(const GuruPelanggaran())),
                  if (bisaMusyrif) _GuruCard(icon: Icons.badge_outlined, label: "Izin Musyrif", color: const Color(0xFF14B8A6), onTap: () => _buka(const GuruIzinMusyrif())),
                  if (bisaGerbang) _GuruCard(icon: Icons.fingerprint, label: "Gerbang", color: const Color(0xFF0EA5E9), onTap: () => _buka(const GuruGerbang())),
                  if (bisaUstadz) _GuruCard(icon: Icons.school_outlined, label: "Ustadz", color: const Color(0xFF10B981), onTap: () => _buka(const GuruUstadzPondok())),
                  if (bisaPengurus) _GuruCard(icon: Icons.groups_outlined, label: "Pengurus", color: const Color(0xFF8B5CF6), onTap: () => _buka(const GuruPengurusPondok())),
                  _GuruCard(icon: Icons.menu_book_outlined, label: "Materi", color: const Color(0xFFF59E0B), onTap: () => _buka(const GuruMateri())),
                  _GuruCard(icon: Icons.analytics_outlined, label: "Analitik", color: const Color(0xFF8B5CF6), onTap: () => _buka(const GuruAnalitik())),
                  _GuruCard(icon: Icons.grade_outlined, label: "Nilai", color: const Color(0xFFEF4444), onTap: () => _buka(const GuruNilai())),
                  _GuruCard(icon: Icons.support_agent_outlined, label: "Intervensi", color: const Color(0xFFF97316), onTap: () => _buka(const GuruIntervensi())),
                  _GuruCard(icon: Icons.security_outlined, label: "Anti-Cheat", color: const Color(0xFFEF4444), onTap: () => _buka(const GuruAntiCheat())),
                  _GuruCard(icon: Icons.memory_outlined, label: "AI Know", color: const Color(0xFF14B8A6), onTap: () => _buka(const GuruAiKnowledge())),
                  _GuruCard(icon: Icons.psychology_outlined, label: "Evaluasi AI", color: const Color(0xFF8B5CF6), onTap: () => _buka(const GuruAiEvaluation())),
                  _GuruCard(icon: Icons.monitor_heart_outlined, label: "Teacher Ana", color: const Color(0xFF0EA5E9), onTap: () => _buka(const GuruTeacherAnalytics())),
                  _GuruCard(icon: Icons.settings_outlined, label: "Pengaturan", color: const Color(0xFF64748B), onTap: () => _buka(const GuruPengaturan())),
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
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.icon, required this.color});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
    child: Row(children: [
      Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: color.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(9)), child: Icon(icon, size: 15, color: color)),
      const SizedBox(width: 8),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
        Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 9, color: Colors.black54)),
        Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: color)),
      ])),
    ]),
  );
}

class _GuruCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _GuruCard({required this.icon, required this.label, required this.color, required this.onTap});
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
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11), textAlign: TextAlign.center),
        ]),
      ),
    ),
  );
}
