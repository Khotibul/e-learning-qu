import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/siswa/dashboard.dart';
import 'screens/siswa/ujian.dart';
import 'screens/siswa/absensi_harian.dart';
import 'screens/siswa/materi.dart';
import 'screens/siswa/ai_tutor.dart';
import 'screens/guru/dashboard.dart';
import 'screens/guru/murid_detail.dart';
import 'models/user.dart';

void main() {
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
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF4F46E5),
            secondary: const Color(0xFF06B6D4),
            brightness: Brightness.light,
          ),
          useMaterial3: true,
          scaffoldBackgroundColor: const Color(0xFFF8FAFC),
          cardTheme: CardThemeData(
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFE2E8F0))),
            color: Colors.white,
          ),
          appBarTheme: const AppBarTheme(
            backgroundColor: Colors.white,
            foregroundColor: Color(0xFF0F172A),
            elevation: 0,
            centerTitle: true,
            titleTextStyle: TextStyle(color: Color(0xFF0F172A), fontSize: 18, fontWeight: FontWeight.w700),
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          ),
        ),
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

    // Fitur disesuaikan dengan website — semua yang relevan untuk mobile, hanya Siswa & Guru
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
      const SiswaUjian(), // reuse ujian list, backend sama
      const SiswaAbsensiHarian(),
      const GuruDashboard(), // analitik ringkas
    ];

    // Admin tidak ada di Android — khusus web
    if (!isSiswa && !isGuru) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.admin_panel_settings, size: 64, color: Color(0xFF94A3B8)),
              const SizedBox(height: 12),
              const Text("Akses Admin hanya via Website", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const Text("Silakan login sebagai Siswa atau Guru di aplikasi Android", textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
              const SizedBox(height: 16),
              FilledButton(onPressed: () => context.read<AuthProvider>().signOut(), child: const Text("Kembali ke Login")),
            ]),
          ),
        ),
      );
    }

    final pages = isSiswa ? siswaPages : guruPages;
    final items = isSiswa
        ? const [
            BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: "Beranda"),
            BottomNavigationBarItem(icon: Icon(Icons.quiz), label: "Ujian"),
            BottomNavigationBarItem(icon: Icon(Icons.calendar_today), label: "Absensi"),
            BottomNavigationBarItem(icon: Icon(Icons.book), label: "Materi"),
            BottomNavigationBarItem(icon: Icon(Icons.smart_toy), label: "AI Tutor"),
          ]
        : const [
            BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: "Beranda"),
            BottomNavigationBarItem(icon: Icon(Icons.people), label: "Murid"),
            BottomNavigationBarItem(icon: Icon(Icons.assignment), label: "Ujian"),
            BottomNavigationBarItem(icon: Icon(Icons.fact_check), label: "Absensi"),
            BottomNavigationBarItem(icon: Icon(Icons.analytics), label: "Analitik"),
          ];

    return Scaffold(
      body: pages[_idx],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _idx,
        onTap: (i) => setState(() => _idx = i),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFF4F46E5),
        items: items,
      ),
      floatingActionButton: FloatingActionButton.small(
        onPressed: () => context.read<AuthProvider>().signOut(),
        child: const Icon(Icons.logout),
      ),
    );
  }
}
