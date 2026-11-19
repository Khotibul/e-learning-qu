import "package:flutter/material.dart";

import "../../services/api_service.dart";
import "../../widgets/biodata_fields.dart";

/// Edit data murid oleh Admin (termasuk biodata diri & keluarga).
/// Memakai API mobile admin: PATCH /api/mobile/admin/murid/[id] dan
/// PATCH /api/mobile/admin/biodata/[userId].
class MuridEditScreen extends StatefulWidget {
  final String id;
  final String? nama;
  const MuridEditScreen({super.key, required this.id, this.nama});
  @override
  State<MuridEditScreen> createState() => _MuridEditScreenState();
}

class _MuridEditScreenState extends State<MuridEditScreen> {
  bool loading = true;
  bool saving = false;

  final namaCtrl = TextEditingController();
  final nisCtrl = TextEditingController();
  final nisnCtrl = TextEditingController();
  final noTelpCtrl = TextEditingController();
  final alamatCtrl = TextEditingController();
  final jabatanCtrl = TextEditingController();
  final biodata = BiodataControllers();

  String? userId;
  String email = "";
  String? kelasId;
  List<dynamic> kelasList = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final siswa = await ApiService.get(
        "/api/mobile/admin/murid/${widget.id}",
        useCache: false,
      );
      final refs = await ApiService.get(
        "/api/mobile/admin/refs",
        useCache: false,
      );
      Map? bio;
      if (siswa is Map && siswa["user"] is Map) {
        userId = siswa["user"]["id"] as String?;
      }
      if (userId != null) {
        final b = await ApiService.get(
          "/api/mobile/admin/biodata/$userId",
          useCache: false,
        );
        if (b is Map && b["data"] is Map) bio = b["data"] as Map;
      }
      if (!mounted) return;
      setState(() {
        final s = siswa is Map ? siswa : const {};
        namaCtrl.text = "${s["nama"] ?? ""}";
        nisCtrl.text = "${s["nis"] ?? ""}";
        nisnCtrl.text = "${s["nisn"] ?? ""}";
        noTelpCtrl.text = "${s["noTelp"] ?? ""}";
        alamatCtrl.text = "${s["alamat"] ?? ""}";
        jabatanCtrl.text = "${s["jabatan"] ?? ""}";
        email = "${s["user"]?["email"] ?? ""}";
        kelasId = s["kelasId"] as String?;
        if (refs is Map && refs["kelas"] is List) {
          kelasList = refs["kelas"] as List<dynamic>;
        }
        biodata.isiDari(bio);
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _simpan() async {
    if (namaCtrl.text.trim().isEmpty) {
      _snack("Nama wajib diisi", error: true);
      return;
    }
    setState(() => saving = true);
    try {
      await ApiService.patch("/api/mobile/admin/murid/${widget.id}", {
        "nama": namaCtrl.text.trim(),
        "nis": nisCtrl.text.trim(),
        "nisn": nisnCtrl.text.trim(),
        "noTelp": noTelpCtrl.text.trim(),
        "alamat": alamatCtrl.text.trim(),
        "kelasId": kelasId,
        "jabatan": jabatanCtrl.text.trim(),
      });
      if (userId != null) {
        await ApiService.patch("/api/mobile/admin/biodata/$userId", {
          "userId": userId,
          ...biodata.toJson(),
        });
      }
      if (!mounted) return;
      _snack("Data murid berhasil disimpan");
      Navigator.pop(context, true);
    } catch (e) {
      _snack("Gagal: $e", error: true);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: error
            ? const Color(0xFFEF4444)
            : const Color(0xFF10B981),
      ),
    );
  }

  @override
  void dispose() {
    namaCtrl.dispose();
    nisCtrl.dispose();
    nisnCtrl.dispose();
    noTelpCtrl.dispose();
    alamatCtrl.dispose();
    jabatanCtrl.dispose();
    biodata.dispose();
    super.dispose();
  }

  InputDecoration _dec(String label) => InputDecoration(
    labelText: label,
    border: const OutlineInputBorder(),
    isDense: true,
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(widget.nama ?? "Edit Murid"),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "Data Murid",
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: namaCtrl,
                          decoration: _dec("Nama Lengkap"),
                          textCapitalization: TextCapitalization.words,
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: nisCtrl,
                                decoration: _dec("NIS"),
                                keyboardType: TextInputType.number,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                controller: nisnCtrl,
                                decoration: _dec("NISN"),
                                keyboardType: TextInputType.number,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        DropdownButtonFormField<String>(
                          initialValue: kelasId ?? "",
                          isExpanded: true,
                          decoration: _dec("Kelas"),
                          items: [
                            const DropdownMenuItem<String>(
                              value: "",
                              child: Text(
                                "— Tanpa kelas —",
                                style: TextStyle(fontSize: 13),
                              ),
                            ),
                            ...kelasList.map(
                              (k) => DropdownMenuItem<String>(
                                value: "${k["id"]}",
                                child: Text(
                                  "${k["nama"]}",
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                            ),
                          ],
                          onChanged: (v) => setState(
                            () => kelasId = (v == null || v.isEmpty) ? null : v,
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: noTelpCtrl,
                          decoration: _dec("No. Telepon"),
                          keyboardType: TextInputType.phone,
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: alamatCtrl,
                          decoration: _dec("Alamat"),
                          maxLines: 2,
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: jabatanCtrl,
                          decoration: _dec("Jabatan (opsional)"),
                          textCapitalization: TextCapitalization.words,
                        ),
                        if (email.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            "Email: $email",
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "Data Diri & Keluarga",
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 12),
                        // Alamat murid ada di Siswa.alamat (form Data Murid).
                        BiodataFields(data: biodata),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: saving ? null : _simpan,
                  icon: saving
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.save_outlined, size: 18),
                  label: const Text("Simpan Perubahan"),
                ),
                const SizedBox(height: 24),
              ],
            ),
    );
  }
}
