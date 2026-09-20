import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../providers/auth_provider.dart';
import '../../models/user.dart';
import '../../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _pass = TextEditingController();
  Role _role = Role.siswa;
  bool _loading = false;
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFEEF2FF), Color(0xFFF8FAFC)],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [BoxShadow(color: Color(0x1A4F46E5), blurRadius: 20, offset: Offset(0, 8))],
                  ),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [Color(0xFF4F46E5), Color(0xFF06B6D4)]),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.school_outlined, size: 28, color: Colors.white),
                      ),
                      const SizedBox(height: 12),
                      const Text("E-Learning QU", style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                      const Text("Belajar Cerdas, Masa Depan Cerah", style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(20)),
                        child: const Text("Khusus Siswa & Guru  •  1 Database dengan Web", style: TextStyle(fontSize: 11, color: Color(0xFF4F46E5), fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                // Role switch — hanya Siswa & Guru
                Container(
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Color(0xFFE2E8F0))),
                  child: SegmentedButton<Role>(
                    style: ButtonStyle(
                      backgroundColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? const Color(0xFF4F46E5) : Colors.transparent),
                      foregroundColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? Colors.white : const Color(0xFF64748B)),
                    ),
                    showSelectedIcon: false,
                    segments: const [
                      ButtonSegment(value: Role.siswa, label: Text("SISWA"), icon: Icon(Icons.person_outline, size: 16)),
                      ButtonSegment(value: Role.guru, label: Text("GURU"), icon: Icon(Icons.school_outlined, size: 16)),
                    ],
                    selected: {_role},
                    onSelectionChanged: (s) => setState(() => _role = s.first),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: "Email",
                    hintText: _role == Role.siswa ? "siswa@sekolah.id" : "guru@sekolah.id",
                    prefixIcon: const Icon(Icons.email_outlined),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Color(0xFFE2E8F0))),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pass,
                  obscureText: _obscure,
                  decoration: InputDecoration(
                    labelText: "Password",
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility), onPressed: () => setState(() => _obscure = !_obscure)),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Color(0xFFE2E8F0))),
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  height: 50,
                  child: FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: Color(0xFF4F46E5), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                    onPressed: _loading ? null : () async {
                      setState(() => _loading = true);
                      try {
                        if (!mounted) return;
                        // ignore: use_build_context_synchronously
                        await context.read<AuthProvider>().signIn(_email.text.trim(), _pass.text, _role);
                      } catch (e) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Login gagal: $e"), backgroundColor: Color(0xFFEF4444)));
                      } finally {
                        if (mounted) setState(() => _loading = false);
                      }
                    },
                    child: _loading
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Row(mainAxisAlignment: MainAxisAlignment.center, children: [Text(_role == Role.siswa ? "Masuk sebagai Siswa" : "Masuk sebagai Guru", style: TextStyle(fontWeight: FontWeight.w700)), SizedBox(width: 8), Icon(Icons.arrow_forward, size: 18)]),
                  ),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  const Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text("atau", style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                  ),
                  const Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                ]),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _loading ? null : () async {
                    setState(() => _loading = true);
                    try {
                      final googleSignIn = GoogleSignIn(
                        scopes: ['email', 'profile'],
                        serverClientId: '190762274336-msoeb1vaq8niqf0e5hfb1ur0hqpmln8f.apps.googleusercontent.com',
                      );
                      final account = await googleSignIn.signIn();
                      if (account == null) throw Exception("Dibatalkan");
                      final auth = await account.authentication;
                      final idToken = auth.idToken;
                      if (idToken == null) throw Exception("Gagal ambil idToken Google");
                      final res = await ApiService.signInWithGoogle(idToken, roleToString(_role));
                      if (!mounted) return;
                      final user = res["user"] as Map<String, dynamic>;
                      // ignore: use_build_context_synchronously
                      await context.read<AuthProvider>().signInWithGoogleUser(user);
                      if (res["extra"]?["needRoleSelection"] == true && mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Akun Google baru — lengkapi profil di website jika perlu")));
                      }
                    } catch (e) {
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Google login gagal: $e"), backgroundColor: const Color(0xFFEF4444)));
                    } finally {
                      if (mounted) setState(() => _loading = false);
                    }
                  },
                  icon: Image.network("https://www.gstatic.com/images/branding/product/1x/gsa_64dp.png", height: 18, width: 18, errorBuilder: (_, __, ___) => const Icon(Icons.g_mobiledata, size: 18)),
                  label: Text("Masuk dengan Google (${_role == Role.siswa ? "Siswa" : "Guru"})", style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    backgroundColor: Colors.white,
                  ),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                  Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text("Aman & Terpercaya", style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)))),
                  Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                ]),
                const SizedBox(height: 12),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  _TrustBadge(icon: Icons.verified_user, label: "1 Database"),
                  SizedBox(width: 12),
                  _TrustBadge(icon: Icons.bolt, label: "Stabil"),
                  SizedBox(width: 12),
                  _TrustBadge(icon: Icons.school, label: "Edukasi"),
                ]),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TrustBadge extends StatelessWidget {
  final IconData icon; final String label;
  const _TrustBadge({required this.icon, required this.label});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: Color(0xFFE2E8F0))),
    child: Row(children: [Icon(icon, size: 14, color: Color(0xFF4F46E5)), const SizedBox(width: 4), Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF334155)))]),
  );
}
