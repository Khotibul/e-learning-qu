import "dart:io";

import "package:flutter/material.dart";
import "package:file_picker/file_picker.dart";
import "package:flutter/services.dart";
import "package:intl/intl.dart";
import "package:path_provider/path_provider.dart";
import "package:qr_flutter/qr_flutter.dart";
import "package:share_plus/share_plus.dart";

import "../../services/api_service.dart";

/// Surat izin digital santri + QR verifikasi.
/// Isi & tata letak mengikuti PDF surat website (/api/izin/surat/[id]):
/// kop, identitas, detail izin, penjemput, persetujuan, dan QR keaslian.
class SuratIzinPage extends StatefulWidget {
  final Map row;
  final Map? santri;
  final Map<String, String> jenisLabel;
  final Map<String, String> statusLabel;
  const SuratIzinPage({
    super.key,
    required this.row,
    this.santri,
    this.jenisLabel = const {},
    this.statusLabel = const {},
  });

  @override
  State<SuratIzinPage> createState() => _SuratIzinPageState();
}

class _SuratIzinPageState extends State<SuratIzinPage> {
  Map get row => widget.row;
  Map? get santri => widget.santri;
  Map<String, String> get jenisLabel => widget.jenisLabel;
  Map<String, String> get statusLabel => widget.statusLabel;

  bool _busy = false;

  String get _namaFile {
    final nomor = "${row["suratNomor"] ?? ""}".trim();
    final id = "${row["id"] ?? ""}".trim();
    return "surat-izin-${nomor.isEmpty ? id : nomor.replaceAll("/", "-")}.pdf";
  }

  void _pesan(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  /// Unduh PDF dari endpoint mobile (builder sama dengan surat web).
  Future<File> _ambilPdf() async {
    final id = "${row["id"] ?? ""}".trim();
    if (id.isEmpty) throw Exception("ID izin tidak tersedia");
    final bytes = await ApiService.getBytes("/api/mobile/siswa/izin/surat?id=${Uri.encodeQueryComponent(id)}");
    final dir = await getTemporaryDirectory();
    final file = File("${dir.path}/$_namaFile");
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  Future<void> _unduh() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final bytes = await ApiService.getBytes("/api/mobile/siswa/izin/surat?id=${Uri.encodeQueryComponent("${row["id"]}")}");
      // Dialog "simpan sebagai" bawaan sistem (Android: pemilih folder/Downloads).
      String? path;
      var adaDialog = true;
      try {
        path = await FilePicker.platform.saveFile(
          dialogTitle: "Simpan surat izin",
          fileName: _namaFile,
          type: FileType.custom,
          allowedExtensions: const ["pdf"],
          bytes: bytes,
        );
      } on UnimplementedError {
        adaDialog = false;
      }
      if (!adaDialog) {
        final dir = await getApplicationDocumentsDirectory();
        final file = File("${dir.path}/$_namaFile");
        await file.writeAsBytes(bytes, flush: true);
        _pesan("Surat tersimpan: ${file.path}");
      } else if (path != null) {
        _pesan("Surat disimpan: $_namaFile");
      }
      // path == null dengan dialog tersedia berarti pengguna membatalkan.
    } catch (e) {
      _pesan("Gagal mengunduh surat: ${e.toString().replaceFirst("Exception: ", "")}", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _bagikan() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final file = await _ambilPdf();
      await SharePlus.instance.share(ShareParams(
        files: [XFile(file.path, mimeType: "application/pdf")],
        subject: "Surat Izin ${row["suratNomor"] ?? ""}".trim(),
        text: "Surat izin ${santri?["nama"] ?? row["santri"]?["nama"] ?? "santri"} — ${row["suratNomor"] ?? ""}",
      ));
    } catch (e) {
      _pesan("Gagal membagikan surat: ${e.toString().replaceFirst("Exception: ", "")}", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  static String _fmt(dynamic v) {
    if (v == null || "$v" == "null") return "-";
    final d = DateTime.tryParse("$v");
    if (d == null) return "-";
    return "${DateFormat("dd MMMM yyyy HH:mm", "id_ID").format(d.toLocal())} WIB";
  }

  bool get _kedaluwarsa {
    final e = DateTime.tryParse("${row["suratExpiresAt"]}");
    return e != null && e.isBefore(DateTime.now());
  }

  String get _statusSurat {
    if (_kedaluwarsa) return "KEDALUWARSA";
    final s = "${row["status"]}";
    return s == "SELESAI" ? "SELESAI" : (s == "DISETUJUI" ? "AKTIF" : s);
  }

  @override
  Widget build(BuildContext context) {
    final verifyUrl = row["verifyUrl"]?.toString();
    final token = row["suratToken"]?.toString();
    final aktif = _statusSurat == "AKTIF";
    final statusColor = aktif
        ? const Color(0xFF059669)
        : _kedaluwarsa
            ? const Color(0xFFDC2626)
            : const Color(0xFF64748B);

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        title: const Text("Surat Izin"),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          if (token != null && token.isNotEmpty)
            IconButton(
              tooltip: "Salin token QR",
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: token));
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Token surat disalin")),
                  );
                }
              },
              icon: const Icon(Icons.copy_all_outlined, size: 20),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
        children: [
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: const [BoxShadow(color: Color(0x0F0F172A), blurRadius: 10, offset: Offset(0, 2))],
            ),
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Center(
                  child: Text(
                    "PONDOK PESANTREN E-LEARNING QU",
                    textAlign: TextAlign.center,
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, letterSpacing: 0.3),
                  ),
                ),
                const SizedBox(height: 2),
                const Center(
                  child: Text(
                    "Sistem Informasi Santri — Surat Izin Pulang Digital",
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                ),
                const SizedBox(height: 8),
                Center(
                  child: Text(
                    "Nomor: ${row["suratNomor"] ?? "-"}",
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                  ),
                ),
                const SizedBox(height: 12),
                const Divider(height: 1),
                const SizedBox(height: 14),

                _section("Identitas Santri"),
                _line("Nama", "${santri?["nama"] ?? row["santri"]?["nama"] ?? "-"}"),
                _line("Nomor Induk Santri", "${santri?["nisNo"] ?? row["santri"]?["nisNo"] ?? "-"}"),
                _line(
                  "Asrama / Kamar",
                  "${santri?["asrama"]?["nama"] ?? row["santri"]?["asrama"]?["nama"] ?? "-"} / "
                      "${santri?["kamar"]?["nama"] ?? row["santri"]?["kamar"]?["nama"] ?? "-"}",
                ),
                const SizedBox(height: 12),

                _section("Detail Izin"),
                _line("Jenis Izin", jenisLabel["${row["jenis"]}"] ?? "${row["jenis"] ?? "-"}"),
                _line("Alasan", "${row["alasan"] ?? "-"}"),
                _line("Rencana Keluar", _fmt(row["rencanaKeluar"])),
                _line("Batas Kembali", _fmt(row["rencanaKembali"])),
                _line("Alamat Tujuan", "${row["alamatTujuan"] ?? "-"}"),
                const SizedBox(height: 12),

                _section("Penjemput"),
                _line("Nama", "${row["namaPenjemput"] ?? "-"}"),
                _line("Hubungan", "${row["hubunganPenjemput"] ?? "-"}"),
                _line("No. HP", "${row["noTelpPenjemput"] ?? "-"}"),
                const SizedBox(height: 12),

                _section("Persetujuan & Verifikasi"),
                _line(
                  "Wali",
                  row["waliApprovedAt"] == null ? "—" : "Disetujui ${_fmt(row["waliApprovedAt"])}",
                ),
                _line(
                  "Musyrif",
                  row["musyrifApprovedAt"] == null ? "—" : "Disetujui ${_fmt(row["musyrifApprovedAt"])}",
                ),
                _line(
                  "Admin Pondok",
                  row["adminApprovedAt"] == null ? "—" : "Disetujui ${_fmt(row["adminApprovedAt"])}",
                ),
                _line("Status", statusLabel["${row["status"]}"] ?? "${row["status"] ?? "-"}"),
                _line("Check-out", _fmt(row["checkoutAt"])),
                _line("Check-in", _fmt(row["checkinAt"])),
                const SizedBox(height: 16),

                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    children: [
                      if (verifyUrl != null && verifyUrl.isNotEmpty && token != null)
                        Center(
                          child: Opacity(
                            opacity: _kedaluwarsa ? 0.35 : 1,
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
                              child: QrImageView(
                                data: verifyUrl,
                                version: QrVersions.auto,
                                size: 176,
                                backgroundColor: Colors.white,
                                eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Color(0xFF0F172A)),
                                dataModuleStyle: const QrDataModuleStyle(
                                  dataModuleShape: QrDataModuleShape.square,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                            ),
                          ),
                        )
                      else
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text(
                            "QR verifikasi belum tersedia untuk izin ini.",
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                          ),
                        ),
                      const SizedBox(height: 10),
                      Text(
                        "Scan untuk verifikasi keaslian surat.",
                        style: const TextStyle(fontSize: 11, color: Color(0xFF475569)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "Berlaku sampai: ${_fmt(row["suratExpiresAt"])}",
                        style: const TextStyle(fontSize: 11, color: Color(0xFF475569)),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          "Status QR: $_statusSurat",
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: statusColor),
                        ),
                      ),
                      if (token != null && token.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        SelectableText(
                          token,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 10, fontFamily: "monospace", color: Color(0xFF64748B)),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          "Token dapat diinput manual di Gerbang bila QR tidak terbaca.",
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 9, color: Color(0xFF94A3B8)),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _busy ? null : _unduh,
                        icon: _busy
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.download_outlined, size: 18),
                        label: const Text("Unduh PDF", style: TextStyle(fontSize: 12)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _busy ? null : _bagikan,
                        icon: const Icon(Icons.share_outlined, size: 18),
                        label: const Text("Bagikan", style: TextStyle(fontSize: 12)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Text(
                  "Surat ini diterbitkan otomatis oleh Sistem E-Learning Qu. Dilarang memalsukan. "
                  "Setiap pemindaian diverifikasi terhadap database resmi.",
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 9, color: Color(0xFF94A3B8), height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _section(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(text, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
  );

  Widget _line(String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 124,
          child: Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
        ),
        Expanded(
          child: Text(value, style: const TextStyle(fontSize: 11, color: Color(0xFF0F172A), height: 1.35)),
        ),
      ],
    ),
  );
}
