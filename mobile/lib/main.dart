import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'theme/app_theme.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'providers/auth_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/siswa/dashboard.dart';
import 'screens/siswa/ujian.dart';
import 'screens/siswa/absensi_harian.dart';
import 'screens/siswa/materi.dart';
import 'screens/siswa/ai_tutor.dart';
import 'screens/guru/dashboard.dart';
import 'screens/guru/murid_detail.dart';
import 'screens/guru/absensi.dart';
import 'screens/guru/analitik.dart';
import 'screens/guru/ujian.dart';
import 'screens/admin/murid_page.dart';
import 'screens/admin/santri_page.dart';
import 'models/user.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('id_ID', null);
  await initializeDateFormatting('en_US', null);
  runApp(const ELearningQuApp());
}

class ELearningQuApp extends StatelessWidget {
  const ELearningQuApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [ChangeNotifierProvider(create: (_) => AuthProvider())],
      child: MaterialApp(
        title: 'E-Learning QU',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        home: const AuthGate(),
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        if (auth.loading) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        if (!auth.isLoggedIn) return const LoginScreen();
        return RoleScaffold(role: auth.role!);
      },
    );
  }
}

class RoleScaffold extends StatefulWidget {
  final Role role;
  const RoleScaffold({super.key, required this.role});
  @override
  State<RoleScaffold> createState() => _RoleScaffoldState();
}

class _RoleScaffoldState extends State<RoleScaffold> {
  int _idx = 0;

  @override
  Widget build(BuildContext context) {
    final isSiswa = widget.role == Role.siswa;
    final isGuru = widget.role == Role.guru;
    final isAdmin = widget.role == Role.admin;

    // Fitur disesuaikan dengan website — Siswa, Guru, dan Admin (data murid/santri)
    final siswaPages = [
      const SiswaDashboard(),
      const SiswaUjian(),
      const SiswaAbsensiHarian(),
      const SiswaMateri(),
      const SiswaAiTutor(),
    ];
    final guruPages = [
      const GuruDashboard(),
      const GuruMurid(),
      const GuruUjian(), // kelola ujian: buat/mulai/hentikan/reset
      const GuruAbsensi(), // absensi sesi mengajar + absensi siswa per mapel
      const GuruAnalitik(), // analitik guru
    ];
    final adminPages = [
      const AdminMuridPage(),
      const AdminSantriPage(),
    ];

    final pages = isSiswa ? siswaPages : (isGuru ? guruPages : adminPages);
    final items = isAdmin
        ? const [
            NavigationDestination(icon: Icon(Icons.people_outline, size: 20), selectedIcon: Icon(Icons.people, size: 20), label: "Murid"),
            NavigationDestination(icon: Icon(Icons.school_outlined, size: 20), selectedIcon: Icon(Icons.school, size: 20), label: "Santri"),
          ]
        : isSiswa
        ? const [
            NavigationDestination(icon: Icon(Icons.dashboard_outlined, size: 20), selectedIcon: Icon(Icons.dashboard, size: 20), label: "Beranda"),
            NavigationDestination(icon: Icon(Icons.quiz_outlined, size: 20), selectedIcon: Icon(Icons.quiz, size: 20), label: "Ujian"),
            NavigationDestination(icon: Icon(Icons.calendar_today_outlined, size: 20), selectedIcon: Icon(Icons.calendar_today, size: 20), label: "Absensi"),
            NavigationDestination(icon: Icon(Icons.menu_book_outlined, size: 20), selectedIcon: Icon(Icons.menu_book, size: 20), label: "Materi"),
            NavigationDestination(icon: Icon(Icons.smart_toy_outlined, size: 20), selectedIcon: Icon(Icons.smart_toy, size: 20), label: "AI Tutor"),
          ]
        : const [
            NavigationDestination(icon: Icon(Icons.dashboard_outlined, size: 20), selectedIcon: Icon(Icons.dashboard, size: 20), label: "Beranda"),
            NavigationDestination(icon: Icon(Icons.people_outline, size: 20), selectedIcon: Icon(Icons.people, size: 20), label: "Murid"),
            NavigationDestination(icon: Icon(Icons.assignment_outlined, size: 20), selectedIcon: Icon(Icons.assignment, size: 20), label: "Ujian"),
            NavigationDestination(icon: Icon(Icons.fact_check_outlined, size: 20), selectedIcon: Icon(Icons.fact_check, size: 20), label: "Absensi"),
            NavigationDestination(icon: Icon(Icons.analytics_outlined, size: 20), selectedIcon: Icon(Icons.analytics, size: 20), label: "Analitik"),
          ];

    return Scaffold(
      body: pages[_idx],
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.border)),
          boxShadow: [BoxShadow(color: Color(0x141E1B4B), blurRadius: 24, offset: Offset(0, -8))],
        ),
        child: SafeArea(
          top: false,
          child: NavigationBar(
            selectedIndex: _idx,
            onDestinationSelected: (i) => setState(() => _idx = i),
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: items,
          ),
        ),
      ),
      // Menu akun sengaja dipisah dari bilah navigasi utama agar tidak salah tekan.
      floatingActionButton: FloatingActionButton.small(
        heroTag: "keluar",
        tooltip: "Keluar",
        onPressed: () => _konfirmasiKeluar(context),
        child: const Icon(Icons.logout, size: 18),
      ),
    );
  }

  Future<void> _konfirmasiKeluar(BuildContext context) async {
    final keluar = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text("Keluar dari aplikasi?", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        content: const Text("Anda perlu masuk kembali untuk membuka absensi, ujian, dan materi.", style: TextStyle(fontSize: 13, height: 1.45)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal", style: TextStyle(color: AppColors.inkSoft))),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(96, 42), backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Keluar"),
          ),
        ],
      ),
    );
    if (keluar == true && context.mounted) {
      await context.read<AuthProvider>().signOut();
    }
  }
}
