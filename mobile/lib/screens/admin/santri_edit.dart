import "package:flutter/material.dart";

import "../../services/api_service.dart";
import "../../widgets/biodata_fields.dart";

/// Edit data santri oleh Admin (termasuk biodata diri & keluarga).
/// Memakai API mobile admin: PATCH /api/mobile/admin/santri/[id] dan
/// PATCH /api/mobile/admin/biodata/[userId].
class SantriEditScreen extends StatefulWidget {
  final String id;
  final String? nama;
  const SantriEditScreen({super.key, required this.id, this.nama});
  @override
  State<SantriEditScreen> createState() => _SantriEditScreenState();
}

class _SantriEditScreenState extends State<SantriEditScreen> {
  static const statusList = {
    "CALON": "Calon",
    "AKTIF": "Aktif",
    "CUTI": "Cuti",
    "NONAKTIF": "Nonaktif",
    "MUTASI": "Mutasi",
    "LULUS": "Lulus",
    "ALUMNI": "Alumni",
    "KELUAR": "Keluar",
  };

  bool loading = true;
  bool saving = false;

  final nisNoCtrl = TextEditingController();
  final tanggalMasukCtrl = TextEditingController();
  final catatanCtrl = TextEditingController();
  final biodata = BiodataControllers();

  String? userId;
  String status = "AKTIF";
  String nama = "";
  String email = "";
  String infoSiswa = "";

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final santri = await ApiService.get(
        "/api/mobile/admin/santri/${widget.id}",
        useCache: false,
      );
      if (santri is Map) userId = santri["userId"] as String?;
      Map? bio;
      if (userId != null) {
        final b = await ApiService.get(
          "/api/mobile/admin/biodata/$userId",
          useCache: false,
        );
        if (b is Map && b["data"] is Map) bio = b["data"] as Map;
      }
      if (!mounted) return;
      setState(() {
        final s = santri is Map ? santri : const {};
        nama = "${s["nama"] ?? widget.nama ?? ""}";
        email = "${s["user"]?["email"] ?? ""}";
        nisNoCtrl.text = "${s["nisNo"] ?? ""}";
        status = "${s["status"] ?? "AKTIF"}";
        final tgl = s["tanggalMasuk"];
        tanggalMasukCtrl.text = tgl == null
            ? ""
            : ("$tgl".length >= 10 ? "$tgl".substring(0, 10) : "$tgl");
        catatanCtrl.text = "${s["catatan"] ?? ""}";
        final sw = s["siswa"];
        infoSiswa = sw is Map
            ? "${sw["nama"] ?? ""}${sw["kelas"] is Map ? " · ${sw["kelas"]["nama"]}" : ""}"
            : "Nonformal";
        biodata.isiDari(bio);
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _pilihTanggal() async {
    final awal = DateTime.tryParse(tanggalMasukCtrl.text) ?? DateTime.now();
    final hasil = await showDatePicker(
      context: context,
      initialDate: awal,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
      helpText: "Tanggal masuk",
    );
    if (hasil != null) {
      setState(
        () => tanggalMasukCtrl.text = hasil.toIso8601String().substring(0, 10),
      );
    }
  }

  Future<void> _simpan() async {
    setState(() => saving = true);
    try {
      await ApiService.patch("/api/mobile/admin/santri/${widget.id}", {
        "op": "update",
        "nisNo": nisNoCtrl.text.trim(),
        "tanggalMasuk": tanggalMasukCtrl.text.trim(),
        "catatan": catatanCtrl.text.trim(),
        "status": status,
      });
      if (userId != null) {
        await ApiService.patch("/api/mobile/admin/biodata/$userId", {
          "userId": userId,
          ...biodata.toJson(sertakanAlamat: true),
        });
      }
      if (!mounted) return;
      _snack("Data santri berhasil disimpan");
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
    nisNoCtrl.dispose();
    tanggalMasukCtrl.dispose();
    catatanCtrl.dispose();
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
        title: Text(nama.isEmpty ? (widget.nama ?? "Edit Santri") : nama),
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
                          "Data Santri",
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: nisNoCtrl,
                          decoration: _dec("Nomor Induk Santri"),
                          keyboardType: TextInputType.number,
                        ),
                        const SizedBox(height: 10),
                        DropdownButtonFormField<String>(
                          initialValue: status,
                          isExpanded: true,
                          decoration: _dec("Status"),
                          items: statusList.entries
                              .map(
                                (e) => DropdownMenuItem(
                                  value: e.key,
                                  child: Text(
                                    e.value,
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (v) =>
                              setState(() => status = v ?? "AKTIF"),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: tanggalMasukCtrl,
                          readOnly: true,
                          onTap: _pilihTanggal,
                          decoration: _dec("Tanggal Masuk").copyWith(
                            hintText: "YYYY-MM-DD",
                            suffixIcon: const Icon(
                              Icons.calendar_today_outlined,
                              size: 16,
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: catatanCtrl,
                          decoration: _dec("Catatan"),
                          maxLines: 2,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          "Siswa: ${infoSiswa.isEmpty ? "-" : infoSiswa}${email.isEmpty ? "" : " • $email"}",
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF64748B),
                          ),
                        ),
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
                        // Santri memakai alamat di biodata (sama seperti web admin).
                        BiodataFields(data: biodata, tampilkanAlamat: true),
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
