import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../providers/auth_provider.dart';
import '../../models/user.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../verifikasi_surat_page.dart';

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
  void dispose() {
    _email.dispose();
    _pass.dispose();
    super.dispose();
  }

  Future<void> _masuk() async {
    setState(() => _loading = true);
    try {
      if (!mounted) return;
      await context.read<AuthProvider>().signIn(_email.text.trim(), _pass.text, _role);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Login gagal: $e"), backgroundColor: AppColors.danger),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _masukGoogle() async {
    setState(() => _loading = true);
    try {
      // Android native Google Sign-In — 1 DB dengan website
      final googleSignIn = GoogleSignIn(
        scopes: ['email', 'profile'],
        serverClientId: '190762274336-msoeb1vaq8niqf0e5hfb1ur0hqpmln8f.apps.googleusercontent.com',
      );
      final account = await googleSignIn.signIn();
      if (account == null) throw Exception("Dibatalkan");
      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) throw Exception("Gagal ambil idToken — cek google-services.json & SHA-1 di Console");
      final res = await ApiService.signInWithGoogle(idToken, roleToString(_role));
      if (!mounted) return;
      final user = res["user"] as Map<String, dynamic>;
      final extra = res["extra"] is Map ? Map<String, dynamic>.from(res["extra"] as Map) : null;
      await context.read<AuthProvider>().signInWithGoogleUser(user, extra: extra);
      if (res["extra"]?["needRoleSelection"] == true && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Akun Google baru — lengkapi profil di website jika perlu")),
        );
      }
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().contains("CANCELED") || e.toString().contains("ApiException: 10")
          ? "Konfigurasi Google belum benar (cek SHA-1 & google-services.json)"
          : e.toString();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Google login gagal: $msg"), backgroundColor: AppColors.danger),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppGradients.brand),
        child: Column(
          children: [
            // Bagian atas: identitas aplikasi
            SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 26, 24, 24),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
                      ),
                      child: const Icon(Icons.school_rounded, size: 30, color: Colors.white),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      "E-Learning QU",
                      style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.5),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Belajar cerdas, masa depan cerah",
                      style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.80)),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.20)),
                      ),
                      child: Text(
                        "Khusus Siswa & Guru  •  Satu data dengan website",
                        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.92)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // Bagian bawah: kartu form
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                ),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  padding: EdgeInsets.fromLTRB(20, 18, 20, 24 + MediaQuery.of(context).viewInsets.bottom),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          margin: const EdgeInsets.only(bottom: 18),
                          decoration: BoxDecoration(color: AppColors.borderStrong, borderRadius: BorderRadius.circular(4)),
                        ),
                      ),
                      const Text("Masuk ke akun", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.ink, letterSpacing: -0.2)),
                      const SizedBox(height: 3),
                      const Text("Pilih peran Anda, lalu masuk dengan email sekolah atau Google.", style: TextStyle(fontSize: 12, color: AppColors.inkMuted, height: 1.4)),
                      const SizedBox(height: 16),
                      // Pemilih peran
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: AppColors.border),
                          boxShadow: AppShadows.soft,
                        ),
                        child: Row(
                          children: [
                            _RoleTab(
                              label: "Siswa",
                              icon: Icons.person_outline,
                              selected: _role == Role.siswa,
                              onTap: () => setState(() => _role = Role.siswa),
                            ),
                            _RoleTab(
                              label: "Guru",
                              icon: Icons.school_outlined,
                              selected: _role == Role.guru,
                              onTap: () => setState(() => _role = Role.guru),
                            ),
                            _RoleTab(
                              label: "Admin",
                              icon: Icons.admin_panel_settings_outlined,
                              selected: _role == Role.admin,
                              onTap: () => setState(() => _role = Role.admin),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autocorrect: false,
                        decoration: InputDecoration(
                          labelText: "Email",
                          hintText: _role == Role.siswa ? "siswa@sekolah.id" : (_role == Role.guru ? "guru@sekolah.id" : "admin@sekolah.id"),
                          prefixIcon: const Icon(Icons.mail_outline, size: 20),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _pass,
                        obscureText: _obscure,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _loading ? null : _masuk(),
                        decoration: InputDecoration(
                          labelText: "Kata sandi",
                          prefixIcon: const Icon(Icons.lock_outline, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
                            tooltip: _obscure ? "Tampilkan kata sandi" : "Sembunyikan kata sandi",
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      _GradientButton(
                        loading: _loading,
                        label: "Masuk sebagai ${_role == Role.siswa ? "Siswa" : (_role == Role.guru ? "Guru" : "Admin")}",
                        onTap: _loading ? null : _masuk,
                      ),
                      if (_role != Role.admin) ...[
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          const Expanded(child: Divider(color: AppColors.border)),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Text("atau", style: TextStyle(fontSize: 11, color: AppColors.inkMuted.withValues(alpha: 0.9))),
                          ),
                          const Expanded(child: Divider(color: AppColors.border)),
                        ],
                      ),
                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        onPressed: _loading ? null : _masukGoogle,
                        icon: Image.network(
                          "https://www.gstatic.com/images/branding/product/1x/gsa_64dp.png",
                          height: 18,
                          width: 18,
                          errorBuilder: (_, _, _) => const Icon(Icons.g_mobiledata, size: 20),
                        ),
                        label: Text(
                          "Masuk dengan Google (${_role == Role.siswa ? "Siswa" : "Guru"})",
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                        ),
                      ),
                      ],
                      const SizedBox(height: 10),
                      TextButton.icon(
                        onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const VerifikasiSuratPage())),
                        icon: const Icon(Icons.qr_code_2_outlined, size: 18),
                        label: const Text("Cek keaslian surat izin (QR)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 8,
                        runSpacing: 6,
                        children: const [
                          _TrustBadge(icon: Icons.verified_user_outlined, label: "Satu database"),
                          _TrustBadge(icon: Icons.bolt_outlined, label: "Stabil"),
                          _TrustBadge(icon: Icons.school_outlined, label: "Edukasi"),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoleTab extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _RoleTab({required this.label, required this.icon, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(vertical: 11),
          decoration: BoxDecoration(
            color: selected ? AppColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
            boxShadow: selected
                ? [BoxShadow(color: AppColors.primary.withValues(alpha: 0.28), blurRadius: 14, offset: const Offset(0, 6))]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 17, color: selected ? Colors.white : AppColors.inkMuted),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: selected ? Colors.white : AppColors.inkSoft,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GradientButton extends StatelessWidget {
  final bool loading;
  final String label;
  final VoidCallback? onTap;

  const _GradientButton({required this.loading, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: AppGradients.indigo,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.32), blurRadius: 20, offset: const Offset(0, 10))],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: SizedBox(
            height: 52,
            child: Center(
              child: loading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Flexible(
                          child: Text(
                            label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Colors.white),
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(Icons.arrow_forward_rounded, size: 18, color: Colors.white),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TrustBadge extends StatelessWidget {
  final IconData icon;
  final String label;
  const _TrustBadge({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Icon(icon, size: 13, color: AppColors.primary),
            const SizedBox(width: 4),
            Text(label, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: AppColors.inkSoft)),
          ],
        ),
      );
}
