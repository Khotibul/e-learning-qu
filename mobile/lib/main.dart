import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/siswa/dashboard.dart';
import 'screens/siswa/ujian.dart';
import 'screens/siswa/absensi_harian.dart';
import 'screens/guru/dashboard.dart';
import 'screens/admin/dashboard.dart';
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
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF4F46E5)),
          useMaterial3: true,
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

    final siswaPages = [
      const SiswaDashboard(),
      const SiswaUjian(),
      const SiswaAbsensiHarian(),
      const Center(child: Text("Materi — /api/siswa/materi (1 DB)")),
      const Center(child: Text("Nilai — /api/siswa/nilai")),
    ];
    final guruPages = [
      const GuruDashboard(),
      const Center(child: Text("Murid — /api/guru/murid")),
      const Center(child: Text("Ujian — /api/guru/ujian")),
      const SiswaAbsensiHarian(), // reuse harian logic, guru lihat rekap kelas
    ];
    final adminPages = [
      const AdminDashboard(),
      const Center(child: Text("Manajemen — /api/admin/*")),
    ];

    final pages = isSiswa ? siswaPages : isGuru ? guruPages : adminPages;
    final items = isSiswa
        ? const [
            BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: "Dashboard"),
            BottomNavigationBarItem(icon: Icon(Icons.quiz), label: "Ujian"),
            BottomNavigationBarItem(icon: Icon(Icons.calendar_today), label: "Absensi"),
            BottomNavigationBarItem(icon: Icon(Icons.book), label: "Materi"),
            BottomNavigationBarItem(icon: Icon(Icons.grade), label: "Nilai"),
          ]
        : isGuru
            ? const [
                BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: "Dashboard"),
                BottomNavigationBarItem(icon: Icon(Icons.people), label: "Murid"),
                BottomNavigationBarItem(icon: Icon(Icons.assignment), label: "Ujian"),
                BottomNavigationBarItem(icon: Icon(Icons.fact_check), label: "Absensi"),
              ]
            : const [
                BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: "Dashboard"),
                BottomNavigationBarItem(icon: Icon(Icons.settings), label: "Kelola"),
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
