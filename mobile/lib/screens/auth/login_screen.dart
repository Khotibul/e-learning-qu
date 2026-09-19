import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../models/user.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.school, size: 64, color: Color(0xFF4F46E5)),
              const SizedBox(height: 12),
              const Text("E-Learning QU", style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
              const Text("Masuk — 1 database dengan sistem web", style: TextStyle(color: Colors.black54), textAlign: TextAlign.center),
              const SizedBox(height: 24),
              SegmentedButton<Role>(
                segments: const [
                  ButtonSegment(value: Role.siswa, label: Text("SISWA"), icon: Icon(Icons.person)),
                  ButtonSegment(value: Role.guru, label: Text("GURU"), icon: Icon(Icons.school)),
                  ButtonSegment(value: Role.admin, label: Text("ADMIN"), icon: Icon(Icons.admin_panel_settings)),
                ],
                selected: {_role},
                onSelectionChanged: (s) => setState(() => _role = s.first),
              ),
              const SizedBox(height: 16),
              TextField(controller: _email, decoration: const InputDecoration(labelText: "Email", border: OutlineInputBorder(), prefixIcon: Icon(Icons.email))),
              const SizedBox(height: 12),
              TextField(controller: _pass, decoration: const InputDecoration(labelText: "Password", border: OutlineInputBorder(), prefixIcon: Icon(Icons.lock)), obscureText: true),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loading ? null : () async {
                  setState(() => _loading = true);
                  try {
                    if (!mounted) return;
                    // ignore: use_build_context_synchronously
                    await context.read<AuthProvider>().signIn(_email.text.trim(), _pass.text, _role);
                  } catch (e) {
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Login gagal: $e")));
                  } finally {
                    if (mounted) setState(() => _loading = false);
                  }
                },
                child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text("Masuk"),
              ),
              const SizedBox(height: 8),
              const Text("API: /api/auth/callback/credentials → PostgreSQL yang sama", style: TextStyle(fontSize: 11, color: Colors.black45), textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}
