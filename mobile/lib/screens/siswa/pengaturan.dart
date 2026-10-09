import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "../../providers/auth_provider.dart";
import "../../services/api_service.dart";

/// Pengaturan siswa — edit profil (nama/nis/nisn/alamat/noTelp) + ganti password
/// + keluar. Mirror web /siswa/pengaturan (updateSiswaProfile/updateSiswaPassword).
class SiswaPengaturanNew extends StatefulWidget {
  const SiswaPengaturanNew({super.key});
  @override
  State<SiswaPengaturanNew> createState() => _SiswaPengaturanNewState();
}

class _SiswaPengaturanNewState extends State<SiswaPengaturanNew> {
  bool loading = true;
  bool savingProfile = false;
  bool savingPassword = false;

  final namaCtrl = TextEditingController();
  final nisCtrl = TextEditingController();
  final nisnCtrl = TextEditingController();
  final alamatCtrl = TextEditingController();
  final noTelpCtrl = TextEditingController();
  String email = "";
  String kelas = "";

  final lamaCtrl = TextEditingController();
  final baruCtrl = TextEditingController();
  final konfirmCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/siswa/pengaturan", useCache: false);
      if (mounted && v is Map) {
        setState(() {
          namaCtrl.text = "${v["nama"] ?? ""}";
          nisCtrl.text = "${v["nis"] ?? ""}";
          nisnCtrl.text = "${v["nisn"] ?? ""}";
          alamatCtrl.text = "${v["alamat"] ?? ""}";
          noTelpCtrl.text = "${v["noTelp"] ?? ""}";
          email = "${v["user"]?["email"] ?? ""}";
          kelas = "${v["kelas"]?["nama"] ?? ""}";
          loading = false;
        });
      } else if (mounted) {
        setState(() => loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  Future<void> _simpanProfil() async {
    if (namaCtrl.text.trim().isEmpty) { _snack("Nama wajib diisi", color: const Color(0xFFEF4444)); return; }
    setState(() => savingProfile = true);
    try {
      await ApiService.post("/api/mobile/siswa/pengaturan", {
        "op": "updateProfile",
        "nama": namaCtrl.text.trim(),
        "nis": nisCtrl.text.trim(),
        "nisn": nisnCtrl.text.trim(),
        "alamat": alamatCtrl.text.trim(),
        "noTelp": noTelpCtrl.text.trim(),
      });
      if (!mounted) return;
      context.read<AuthProvider>().refreshName(namaCtrl.text.trim());
      _snack("Profil diperbarui");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => savingProfile = false);
    }
  }

  Future<void> _gantiPassword() async {
    if (lamaCtrl.text.isEmpty || baruCtrl.text.isEmpty || konfirmCtrl.text.isEmpty) {
      _snack("Semua field password harus diisi", color: const Color(0xFFEF4444));
      return;
    }
    if (baruCtrl.text != konfirmCtrl.text) {
      _snack("Password baru tidak cocok", color: const Color(0xFFEF4444));
      return;
    }
    if (baruCtrl.text.length < 6) {
      _snack("Password minimal 6 karakter", color: const Color(0xFFEF4444));
      return;
    }
    setState(() => savingPassword = true);
    try {
      await ApiService.post("/api/mobile/siswa/pengaturan", {"op": "updatePassword", "passwordLama": lamaCtrl.text, "passwordBaru": baruCtrl.text});
      lamaCtrl.clear();
      baruCtrl.clear();
      konfirmCtrl.clear();
      _snack("Password berhasil diganti");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => savingPassword = false);
    }
  }

  @override
  void dispose() {
    namaCtrl.dispose(); nisCtrl.dispose(); nisnCtrl.dispose(); alamatCtrl.dispose(); noTelpCtrl.dispose();
    lamaCtrl.dispose(); baruCtrl.dispose(); konfirmCtrl.dispose();
    super.dispose();
  }

  InputDecoration _dec(String label) => InputDecoration(labelText: label, border: const OutlineInputBorder(), isDense: true);

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(title: const Text("Pengaturan"), backgroundColor: Colors.white, elevation: 0),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.person_outline),
                    title: Text(auth.user?.name ?? "-"),
                    subtitle: Text(email.isEmpty ? (auth.user?.email ?? "") : email),
                    trailing: kelas.isEmpty ? null : Chip(label: Text(kelas, style: const TextStyle(fontSize: 11)), visualDensity: VisualDensity.compact),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text("Profil", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      const SizedBox(height: 12),
                      TextField(controller: namaCtrl, decoration: _dec("Nama"), textCapitalization: TextCapitalization.words),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(child: TextField(controller: nisCtrl, decoration: _dec("NIS"), keyboardType: TextInputType.number)),
                        const SizedBox(width: 8),
                        Expanded(child: TextField(controller: nisnCtrl, decoration: _dec("NISN"), keyboardType: TextInputType.number)),
                      ]),
                      const SizedBox(height: 10),
                      TextField(controller: alamatCtrl, decoration: _dec("Alamat"), maxLines: 2),
                      const SizedBox(height: 10),
                      TextField(controller: noTelpCtrl, decoration: _dec("No. Telepon"), keyboardType: TextInputType.phone),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: savingProfile ? null : _simpanProfil,
                          icon: savingProfile ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.save_outlined, size: 16),
                          label: const Text("Simpan Profil"),
                        ),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text("Ganti Password", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      const SizedBox(height: 12),
                      TextField(controller: lamaCtrl, obscureText: true, decoration: _dec("Password lama")),
                      const SizedBox(height: 10),
                      TextField(controller: baruCtrl, obscureText: true, decoration: _dec("Password baru (min. 6)")),
                      const SizedBox(height: 10),
                      TextField(controller: konfirmCtrl, obscureText: true, decoration: _dec("Konfirmasi password baru")),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: savingPassword ? null : _gantiPassword,
                          icon: savingPassword ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.key_outlined, size: 16),
                          label: const Text("Ganti Password"),
                        ),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.logout, color: Colors.red),
                    title: const Text("Keluar"),
                    onTap: () => context.read<AuthProvider>().signOut(),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
    );
  }
}
