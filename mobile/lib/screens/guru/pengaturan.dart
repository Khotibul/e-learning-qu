import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "../../providers/auth_provider.dart";
import "../../services/api_service.dart";

/// Pengaturan guru — edit profil (nama/nip/nuptk/alamat/noTelp), data diri &
/// keluarga, ganti password, dan keluar. Mirror web /guru/pengaturan.
class GuruPengaturan extends StatefulWidget {
  const GuruPengaturan({super.key});
  @override
  State<GuruPengaturan> createState() => _GuruPengaturanState();
}

class _GuruPengaturanState extends State<GuruPengaturan> {
  bool loading = true;
  bool savingProfile = false;
  bool savingPassword = false;

  final namaCtrl = TextEditingController();
  final nipCtrl = TextEditingController();
  final nuptkCtrl = TextEditingController();
  final alamatCtrl = TextEditingController();
  final noTelpCtrl = TextEditingController();
  // data diri & keluarga
  final tempatLahirCtrl = TextEditingController();
  final tanggalLahirCtrl = TextEditingController();
  final anakKeCtrl = TextEditingController();
  final statusKeluargaCtrl = TextEditingController();
  final namaAyahCtrl = TextEditingController();
  final namaIbuCtrl = TextEditingController();
  final pekerjaanAyahCtrl = TextEditingController();
  final pekerjaanIbuCtrl = TextEditingController();
  final asalSekolahCtrl = TextEditingController();
  final noTelpWaliCtrl = TextEditingController();
  String jenisKelamin = "";
  String agama = "";
  String email = "";

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
      final v = await ApiService.get("/api/mobile/guru/pengaturan", useCache: false);
      if (mounted && v is Map) {
        setState(() {
          namaCtrl.text = "${v["nama"] ?? ""}";
          nipCtrl.text = "${v["nip"] ?? ""}";
          nuptkCtrl.text = "${v["nuptk"] ?? ""}";
          alamatCtrl.text = "${v["alamat"] ?? ""}";
          noTelpCtrl.text = "${v["noTelp"] ?? ""}";
          final bio = v["biodata"];
          if (bio is Map) {
            jenisKelamin = "${bio["jenisKelamin"] ?? ""}";
            agama = "${bio["agama"] ?? ""}";
            tempatLahirCtrl.text = "${bio["tempatLahir"] ?? ""}";
            final tgl = bio["tanggalLahir"];
            tanggalLahirCtrl.text = tgl == null ? "" : ("$tgl".length >= 10 ? "$tgl".substring(0, 10) : "$tgl");
            anakKeCtrl.text = bio["anakKe"] == null ? "" : "${bio["anakKe"]}";
            statusKeluargaCtrl.text = "${bio["statusKeluarga"] ?? ""}";
            namaAyahCtrl.text = "${bio["namaAyah"] ?? ""}";
            namaIbuCtrl.text = "${bio["namaIbu"] ?? ""}";
            pekerjaanAyahCtrl.text = "${bio["pekerjaanAyah"] ?? ""}";
            pekerjaanIbuCtrl.text = "${bio["pekerjaanIbu"] ?? ""}";
            asalSekolahCtrl.text = "${bio["asalSekolah"] ?? ""}";
            noTelpWaliCtrl.text = "${bio["noTelpWali"] ?? ""}";
          }
          email = "${v["user"]?["email"] ?? ""}";
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
      await ApiService.post("/api/mobile/guru/pengaturan", {
        "op": "updateProfile",
        "nama": namaCtrl.text.trim(),
        "nip": nipCtrl.text.trim(),
        "nuptk": nuptkCtrl.text.trim(),
        "alamat": alamatCtrl.text.trim(),
        "noTelp": noTelpCtrl.text.trim(),
        "biodata": {
          "jenisKelamin": jenisKelamin,
          "agama": agama,
          "tempatLahir": tempatLahirCtrl.text.trim(),
          "tanggalLahir": tanggalLahirCtrl.text.trim(),
          "anakKe": anakKeCtrl.text.trim(),
          "statusKeluarga": statusKeluargaCtrl.text.trim(),
          "namaAyah": namaAyahCtrl.text.trim(),
          "namaIbu": namaIbuCtrl.text.trim(),
          "pekerjaanAyah": pekerjaanAyahCtrl.text.trim(),
          "pekerjaanIbu": pekerjaanIbuCtrl.text.trim(),
          "asalSekolah": asalSekolahCtrl.text.trim(),
          "noTelpWali": noTelpWaliCtrl.text.trim(),
        },
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
      await ApiService.post("/api/mobile/guru/pengaturan", {"op": "updatePassword", "passwordLama": lamaCtrl.text, "passwordBaru": baruCtrl.text});
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
    namaCtrl.dispose(); nipCtrl.dispose(); nuptkCtrl.dispose(); alamatCtrl.dispose(); noTelpCtrl.dispose();
    tempatLahirCtrl.dispose(); tanggalLahirCtrl.dispose(); anakKeCtrl.dispose(); statusKeluargaCtrl.dispose();
    namaAyahCtrl.dispose(); namaIbuCtrl.dispose(); pekerjaanAyahCtrl.dispose(); pekerjaanIbuCtrl.dispose();
    asalSekolahCtrl.dispose(); noTelpWaliCtrl.dispose();
    lamaCtrl.dispose(); baruCtrl.dispose(); konfirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _pilihTanggal() async {
    final awal = DateTime.tryParse(tanggalLahirCtrl.text) ?? DateTime(1990);
    final hasil = await showDatePicker(
      context: context,
      initialDate: awal,
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
      helpText: "Tanggal lahir",
    );
    if (hasil != null) {
      setState(() => tanggalLahirCtrl.text = hasil.toIso8601String().substring(0, 10));
    }
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
                    subtitle: Text(email),
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
                      TextField(controller: nipCtrl, decoration: _dec("NIP"), keyboardType: TextInputType.number),
                      const SizedBox(height: 10),
                      TextField(controller: nuptkCtrl, decoration: _dec("NUPTK"), keyboardType: TextInputType.number),
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
                      const Text("Data Diri & Keluarga", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      const SizedBox(height: 4),
                      const Text("Lengkapi agar tercatat di administrasi. Simpan melalui tombol Simpan Profil di atas.", style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: DropdownButtonFormField<String>(
                          initialValue: jenisKelamin.isEmpty ? null : jenisKelamin,
                          isExpanded: true,
                          isDense: true,
                          decoration: _dec("Jenis Kelamin"),
                          items: const [
                            DropdownMenuItem(value: "LAKI_LAKI", child: Text("Laki-laki", style: TextStyle(fontSize: 13))),
                            DropdownMenuItem(value: "PEREMPUAN", child: Text("Perempuan", style: TextStyle(fontSize: 13))),
                          ],
                          onChanged: (v) => setState(() => jenisKelamin = v ?? ""),
                        )),
                        const SizedBox(width: 8),
                        Expanded(child: DropdownButtonFormField<String>(
                          initialValue: agama.isEmpty ? null : agama,
                          isExpanded: true,
                          isDense: true,
                          decoration: _dec("Agama"),
                          items: const ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"]
                              .map((a) => DropdownMenuItem(value: a, child: Text(a, style: TextStyle(fontSize: 13))))
                              .toList(),
                          onChanged: (v) => setState(() => agama = v ?? ""),
                        )),
                      ]),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(child: TextField(controller: tempatLahirCtrl, decoration: _dec("Tempat Lahir"), textCapitalization: TextCapitalization.words)),
                        const SizedBox(width: 8),
                        Expanded(child: TextField(
                          controller: tanggalLahirCtrl,
                          readOnly: true,
                          onTap: _pilihTanggal,
                          decoration: _dec("Tanggal Lahir").copyWith(hintText: "YYYY-MM-DD", suffixIcon: const Icon(Icons.calendar_today_outlined, size: 16)),
                        )),
                      ]),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(child: TextField(controller: anakKeCtrl, decoration: _dec("Anak Ke"), keyboardType: TextInputType.number)),
                        const SizedBox(width: 8),
                        Expanded(child: TextField(controller: statusKeluargaCtrl, decoration: _dec("Status dalam Keluarga"), textCapitalization: TextCapitalization.words)),
                      ]),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(child: TextField(controller: namaAyahCtrl, decoration: _dec("Nama Ayah"), textCapitalization: TextCapitalization.words)),
                        const SizedBox(width: 8),
                        Expanded(child: TextField(controller: namaIbuCtrl, decoration: _dec("Nama Ibu"), textCapitalization: TextCapitalization.words)),
                      ]),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(child: TextField(controller: pekerjaanAyahCtrl, decoration: _dec("Pekerjaan Ayah"), textCapitalization: TextCapitalization.words)),
                        const SizedBox(width: 8),
                        Expanded(child: TextField(controller: pekerjaanIbuCtrl, decoration: _dec("Pekerjaan Ibu"), textCapitalization: TextCapitalization.words)),
                      ]),
                      const SizedBox(height: 10),
                      TextField(controller: asalSekolahCtrl, decoration: _dec("Asal Sekolah"), textCapitalization: TextCapitalization.words),
                      const SizedBox(height: 10),
                      TextField(controller: noTelpWaliCtrl, decoration: _dec("No. Telepon Wali"), keyboardType: TextInputType.phone),
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
