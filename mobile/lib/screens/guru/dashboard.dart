import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "../../providers/auth_provider.dart";
import "../../services/api_service.dart";
import "../../theme/app_theme.dart";
import "../../widgets/app_ui.dart";
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
      if (mounted) {
        setState(() {
          stats = v;
          loading = false;
        });
      }
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
      body: AppBackdrop(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: EdgeInsets.zero,
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SafeArea(
                bottom: false,
                child: DashboardHeader(
                  greeting: "Selamat datang,",
                  name: nama,
                  subtitle: "Kelola kelas, ujian, absensi & perkembangan siswa",
                  badge: jabatan,
                  subtitleIcon: Icons.workspace_premium_outlined,
                  actions: Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: Material(
                      color: Colors.white.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(14),
                      child: const IconTheme(
                        data: IconThemeData(color: Colors.white),
                        child: NotifBell(),
                      ),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 96),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(title: "Ringkasan Mengajar"),
                    const SizedBox(height: 10),
                    if (loading)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else
                      GridView.count(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisCount: 2,
                        childAspectRatio: 1.95,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        children: [
                          StatTile(icon: Icons.door_front_door_outlined, label: "Kelas Saya", value: "${stats["kelasCount"] ?? 0}", color: AppColors.primary),
                          StatTile(icon: Icons.book_outlined, label: "Mata Pelajaran", value: "${stats["mapelCount"] ?? 0}", color: const Color(0xFF0284C7)),
                          StatTile(icon: Icons.people_outline, label: "Siswa", value: "${stats["siswaCount"] ?? 0}", color: AppColors.success),
                          StatTile(icon: Icons.quiz_outlined, label: "Ujian Aktif", value: "${stats["ujianAktif"] ?? 0}", color: const Color(0xFF7C3AED)),
                          StatTile(icon: Icons.menu_book_outlined, label: "Latihan Aktif", value: "${stats["latihanAktif"] ?? 0}", color: AppColors.rose),
                          StatTile(icon: Icons.inventory_2_outlined, label: "Bank Soal", value: "${stats["totalSoal"] ?? 0}", color: AppColors.gold),
                          StatTile(icon: Icons.grade_outlined, label: "Rata-rata Nilai", value: "${stats["rataNilai"] ?? 0}", color: AppColors.success),
                          StatTile(icon: Icons.track_changes_outlined, label: "Mastery", value: "${stats["rataMastery"] ?? 0}%", color: AppColors.accent),
                        ],
                      ),
                    const SizedBox(height: 22),
                    const SectionHeader(title: "Pembelajaran"),
                    const SizedBox(height: 10),
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 3,
                      childAspectRatio: 0.92,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      children: [
                        FeatureTile(icon: Icons.people_outline, label: "Murid", gradient: AppGradients.indigo, onTap: () => _buka(const GuruMurid())),
                        FeatureTile(icon: Icons.menu_book_outlined, label: "Materi", gradient: AppGradients.amber, onTap: () => _buka(const GuruMateri())),
                        FeatureTile(icon: Icons.inventory_2_outlined, label: "Bank Soal", gradient: AppGradients.sky, onTap: () => _buka(const GuruBankSoal())),
                        FeatureTile(icon: Icons.edit_note_outlined, label: "Soal", gradient: AppGradients.violet, onTap: () => _buka(const GuruSoal())),
                        FeatureTile(icon: Icons.assignment_outlined, label: "Ujian", gradient: AppGradients.teal, onTap: () => _buka(const GuruUjian())),
                        FeatureTile(icon: Icons.grade_outlined, label: "Nilai", gradient: AppGradients.rose, onTap: () => _buka(const GuruNilai())),
                      ],
                    ),
                    const SizedBox(height: 22),
                    const SectionHeader(title: "Kehadiran & Kelas"),
                    const SizedBox(height: 10),
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 3,
                      childAspectRatio: 0.92,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      children: [
                        FeatureTile(icon: Icons.fact_check_outlined, label: "Absensi", gradient: AppGradients.emerald, onTap: () => _buka(const GuruAbsensi())),
                        FeatureTile(icon: Icons.shield_outlined, label: "Wali Kelas", gradient: AppGradients.sky, onTap: () => _buka(const GuruWaliKelas())),
                        if (bisaMusyrif) FeatureTile(icon: Icons.badge_outlined, label: "Izin Musyrif", gradient: AppGradients.teal, onTap: () => _buka(const GuruIzinMusyrif())),
                        if (bisaGerbang) FeatureTile(icon: Icons.fingerprint, label: "Gerbang", gradient: AppGradients.sky, onTap: () => _buka(const GuruGerbang())),
                        if (bisaPelanggaran) FeatureTile(icon: Icons.gavel_outlined, label: "Pelanggaran", gradient: AppGradients.rose, onTap: () => _buka(const GuruPelanggaran())),
                      ],
                    ),
                    const SizedBox(height: 22),
                    const SectionHeader(title: "Analitik & AI"),
                    const SizedBox(height: 10),
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 3,
                      childAspectRatio: 0.92,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      children: [
                        FeatureTile(icon: Icons.analytics_outlined, label: "Analitik", gradient: AppGradients.violet, onTap: () => _buka(const GuruAnalitik())),
                        FeatureTile(icon: Icons.monitor_heart_outlined, label: "Teacher Analytics", gradient: AppGradients.sky, onTap: () => _buka(const GuruTeacherAnalytics())),
                        FeatureTile(icon: Icons.support_agent_outlined, label: "Intervensi", gradient: AppGradients.amber, onTap: () => _buka(const GuruIntervensi())),
                        FeatureTile(icon: Icons.memory_outlined, label: "AI Knowledge", gradient: AppGradients.teal, onTap: () => _buka(const GuruAiKnowledge())),
                        FeatureTile(icon: Icons.psychology_outlined, label: "Evaluasi AI", gradient: AppGradients.violet, onTap: () => _buka(const GuruAiEvaluation())),
                        FeatureTile(icon: Icons.security_outlined, label: "Anti-Cheat", gradient: AppGradients.rose, onTap: () => _buka(const GuruAntiCheat())),
                      ],
                    ),
                    const SizedBox(height: 22),
                    const SectionHeader(title: "Pondok & Lainnya"),
                    const SizedBox(height: 10),
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 3,
                      childAspectRatio: 0.92,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      children: [
                        if (bisaUstadz) FeatureTile(icon: Icons.school_outlined, label: "Ustadz", gradient: AppGradients.emerald, onTap: () => _buka(const GuruUstadzPondok())),
                        if (bisaPengurus) FeatureTile(icon: Icons.groups_outlined, label: "Pengurus", gradient: AppGradients.violet, onTap: () => _buka(const GuruPengurusPondok())),
                        FeatureTile(icon: Icons.settings_outlined, label: "Pengaturan", gradient: AppGradients.slate, onTap: () => _buka(const GuruPengaturan())),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
