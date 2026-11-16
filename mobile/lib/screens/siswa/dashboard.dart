import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';
import 'ujian.dart';
import 'materi.dart';
import 'absensi_harian.dart';
import 'kehadiran.dart';
import 'izin.dart';
import 'dompet.dart';
import 'nilai.dart';
import 'ranking.dart';
import 'jadwal.dart';
import 'jadwal_piket.dart';
import 'ai_tutor.dart';
import 'latihan.dart';
import 'struktur_kelas.dart';
import 'profil_belajar.dart';
import 'bendahara.dart';
import 'iuran_saya.dart';
import 'pengaturan.dart';
import 'sekretaris.dart';
import 'sus.dart';
import 'ai_analitik.dart';
import '../notifikasi.dart';

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
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.getDashboard();
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

  void _butuhJabatan(String jabatan, VoidCallback lanjut) {
    final punya = stats?["jabatan"]?.toString();
    if (punya != jabatan) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Hanya $jabatan yang dapat membuka fitur ini — sama seperti website")),
      );
      return;
    }
    lanjut();
  }

  @override
  Widget build(BuildContext context) {
    final s = stats ?? {};
    final nama = (s["nama"] ?? "Siswa").toString();
    final jabatan = s["jabatan"]?.toString();
    final sudahAdaData = !loading && stats != null;

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
                  subtitle: "${s["kelas"] ?? "-"} • ${s["jurusan"] ?? "-"} • ${s["semester"] ?? ""}",
                  badge: jabatan,
                  subtitleIcon: Icons.school_outlined,
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
                    if (loading)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else ...[
                      if (jabatan != null && jabatan.isNotEmpty) ...[
                        InfoBanner(
                          icon: Icons.verified_outlined,
                          text: "Anda menjabat sebagai $jabatan — fitur khusus jabatan tersedia di bagian Kelas & Organisasi.",
                          color: AppColors.accent,
                        ),
                        const SizedBox(height: 14),
                      ],
                      const SectionHeader(title: "Ringkasan Belajar"),
                      const SizedBox(height: 10),
                      GridView(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          mainAxisExtent: 78,
                        ),
                        children: [
                          StatTile(icon: Icons.psychology_outlined, label: "Nilai Rata-rata", value: (s["nilaiRataRata"] ?? 0).toStringAsFixed(1), color: AppColors.success),
                          StatTile(icon: Icons.track_changes_outlined, label: "Mastery", value: "${s["rataMastery"] ?? 0}%", color: AppColors.primary),
                          StatTile(icon: Icons.local_fire_department_outlined, label: "Streak", value: "${s["streak"] ?? 0} hari", color: AppColors.gold),
                          StatTile(icon: Icons.schedule_outlined, label: "Jam Belajar", value: "${s["jamBelajar"] ?? 0}j", color: AppColors.accent),
                          StatTile(icon: Icons.quiz_outlined, label: "Ujian Aktif", value: "${s["ujianAktif"] ?? 0}", color: const Color(0xFF7C3AED)),
                          StatTile(icon: Icons.menu_book_outlined, label: "Latihan Aktif", value: "${s["tugasAktif"] ?? 0}", color: AppColors.rose),
                          StatTile(icon: Icons.trending_up_outlined, label: "Progres", value: "${s["progresBelajar"] ?? 0}%", color: AppColors.warning),
                          StatTile(icon: Icons.library_books_outlined, label: "Materi", value: "${s["totalMateri"] ?? 0}", color: const Color(0xFF0284C7)),
                        ],
                      ),
                      const SizedBox(height: 14),
                      InfoBanner(
                        icon: Icons.auto_awesome_outlined,
                        text: (s["aiInsight"] ?? "Mulai belajar untuk melihat insight AI.").toString(),
                        italic: true,
                      ),
                      const SizedBox(height: 20),
                      const SectionHeader(title: "Grafik Persentase"),
                      const SizedBox(height: 10),
                      GridView(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          mainAxisExtent: 98,
                        ),
                        children: [
                          PercentTile(
                            label: "Absensi",
                            value: ((s["persentaseAbsensi"] ?? 0) as num).round(),
                            detail: "${s["hadirAbsensi"] ?? 0}/${s["totalAbsensi"] ?? 0} hari",
                            icon: Icons.fact_check_outlined,
                            color: AppColors.success,
                          ),
                          PercentTile(
                            label: "Materi",
                            value: ((s["keaktifanMateri"] ?? 0) as num).round(),
                            detail: "${s["materiDiakses"] ?? 0}/${s["totalMateri"] ?? 0} dibuka",
                            icon: Icons.menu_book_outlined,
                            color: AppColors.accent,
                          ),
                          PercentTile(
                            label: "AI Tutor",
                            value: ((s["keaktifanAI"] ?? 0) as num).round(),
                            detail: "${s["aiChatCount"] ?? 0} chat",
                            icon: Icons.smart_toy_outlined,
                            color: const Color(0xFF7C3AED),
                          ),
                          PercentTile(
                            label: "Aplikasi",
                            value: ((s["keaktifanAplikasi"] ?? 0) as num).round(),
                            detail: "${s["totalAktivitas"] ?? 0} aktivitas",
                            icon: Icons.phone_android_outlined,
                            color: AppColors.primary,
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      PercentTile(
                        label: "Nilai",
                        value: ((s["nilaiRataRata"] ?? 0) as num).round().clamp(0, 100),
                        detail: "rata-rata ${((s["nilaiRataRata"] ?? 0) as num).toStringAsFixed(1)}",
                        icon: Icons.grade_outlined,
                        color: AppColors.gold,
                      ),
                      const SizedBox(height: 22),
                      const SectionHeader(title: "Akademik"),
                      const SizedBox(height: 10),
                      GridView(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          mainAxisExtent: 106,
                        ),
                        children: [
                          FeatureTile(icon: Icons.quiz_outlined, label: "Ujian", gradient: AppGradients.indigo, onTap: () => _buka(const SiswaUjian())),
                          FeatureTile(icon: Icons.menu_book_outlined, label: "Materi", gradient: AppGradients.sky, onTap: () => _buka(const SiswaMateri())),
                          FeatureTile(icon: Icons.assignment_outlined, label: "Latihan", gradient: AppGradients.violet, onTap: () => _buka(const SiswaLatihan())),
                          FeatureTile(icon: Icons.grade_outlined, label: "Nilai", gradient: AppGradients.amber, onTap: () => _buka(const SiswaNilai())),
                          FeatureTile(icon: Icons.leaderboard_outlined, label: "Ranking", gradient: AppGradients.rose, onTap: () => _buka(const SiswaRanking())),
                          FeatureTile(icon: Icons.smart_toy_outlined, label: "AI Tutor", gradient: AppGradients.violet, onTap: () => _buka(const SiswaAiTutor())),
                          FeatureTile(icon: Icons.insights_outlined, label: "AI Analitik", gradient: AppGradients.teal, onTap: () => _buka(const SiswaAiAnalitik())),
                        ],
                      ),
                      const SizedBox(height: 22),
                      const SectionHeader(title: "Kehadiran"),
                      const SizedBox(height: 10),
                      GridView(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          mainAxisExtent: 106,
                        ),
                        children: [
                          FeatureTile(icon: Icons.fact_check_outlined, label: "Absensi", gradient: AppGradients.emerald, onTap: () => _buka(const SiswaAbsensiHarian())),
                          FeatureTile(icon: Icons.fingerprint, label: "Kehadiran", gradient: AppGradients.sky, onTap: () => _buka(const SiswaKehadiran())),
                          FeatureTile(icon: Icons.assignment_turned_in_outlined, label: "Izin", gradient: AppGradients.violet, onTap: () => _buka(const SiswaIzin())),
                          FeatureTile(icon: Icons.calendar_today_outlined, label: "Jadwal", gradient: AppGradients.rose, onTap: () => _buka(const SiswaJadwal())),
                          FeatureTile(icon: Icons.cleaning_services_outlined, label: "Piket", gradient: AppGradients.teal, onTap: () => _buka(const SiswaJadwalPiket())),
                        ],
                      ),
                      const SizedBox(height: 22),
                      const SectionHeader(title: "Kelas & Organisasi"),
                      const SizedBox(height: 10),
                      GridView(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          mainAxisExtent: 106,
                        ),
                        children: [
                          FeatureTile(icon: Icons.groups_outlined, label: "Kelas", gradient: AppGradients.teal, onTap: () => _buka(const SiswaStrukturKelas())),
                          FeatureTile(
                            icon: Icons.assignment_outlined,
                            label: "Sekretaris",
                            gradient: AppGradients.sky,
                            locked: jabatan != "SEKRETARIS",
                            onTap: () => _butuhJabatan("SEKRETARIS", () => _buka(const SiswaSekretaris())),
                          ),
                          FeatureTile(
                            icon: Icons.account_balance_wallet_outlined,
                            label: "Bendahara",
                            gradient: AppGradients.amber,
                            locked: jabatan != "BENDAHARA",
                            onTap: () => _butuhJabatan("BENDAHARA", () => _buka(const SiswaBendahara())),
                          ),
                          FeatureTile(icon: Icons.savings_outlined, label: "Iuran", gradient: AppGradients.emerald, onTap: () => _buka(const SiswaIuranSaya())),
                          FeatureTile(icon: Icons.wallet_outlined, label: "Dompet", gradient: AppGradients.emerald, onTap: () => _buka(const SiswaDompet())),
                        ],
                      ),
                      const SizedBox(height: 22),
                      const SectionHeader(title: "Lainnya"),
                      const SizedBox(height: 10),
                      GridView(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          mainAxisExtent: 106,
                        ),
                        children: [
                          FeatureTile(icon: Icons.psychology_outlined, label: "Profil Belajar", gradient: AppGradients.violet, onTap: () => _buka(const SiswaProfilBelajar())),
                          FeatureTile(icon: Icons.assignment_turned_in_outlined, label: "Evaluasi SUS", gradient: AppGradients.sky, onTap: () => _buka(const SiswaSus())),
                          FeatureTile(icon: Icons.settings_outlined, label: "Pengaturan", gradient: AppGradients.slate, onTap: () => _buka(const SiswaPengaturanNew())),
                        ],
                      ),
                      if (sudahAdaData)
                        Padding(
                          padding: const EdgeInsets.only(top: 18),
                          child: Text(
                            "Data diperbarui otomatis saat Anda menarik halaman ke bawah.",
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 10.5, color: AppColors.inkMuted.withValues(alpha: 0.9)),
                          ),
                        ),
                    ],
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
