import "package:flutter/material.dart";
import "package:intl/intl.dart";

import "surat_izin_page.dart";
import "../verifikasi_surat_page.dart";

/// Daftar surat izin yang pernah terbit untuk santri, beserta status QR-nya.
/// Sumber data sama dengan riwayat izin: /api/mobile/siswa/izin.
class DaftarSuratIzinPage extends StatelessWidget {
  final List rows;
  final Map? santri;
  final Map<String, String> jenisLabel;
  final Map<String, String> statusLabel;
  const DaftarSuratIzinPage({
    super.key,
    required this.rows,
    this.santri,
    this.jenisLabel = const {},
    this.statusLabel = const {},
  });

  /// Hanya izin yang sudah punya nomor/token surat.
  List<Map> get _surat => rows
      .whereType<Map>()
      .where((r) => "${r["suratNomor"] ?? ""}".trim().isNotEmpty || "${r["suratToken"] ?? ""}".trim().isNotEmpty)
      .toList();

  static String _fmt(dynamic v, {String kosong = "-"}) {
    if (v == null || "$v" == "null") return kosong;
    final d = DateTime.tryParse("$v");
    if (d == null) return kosong;
    return DateFormat("dd MMM yyyy HH:mm", "id_ID").format(d.toLocal());
  }

  static String _statusQr(Map r) {
    final expires = DateTime.tryParse("${r["suratExpiresAt"]}");
    if (expires != null && expires.isBefore(DateTime.now())) return "KEDALUWARSA";
    final status = "${r["status"]}";
    if (status == "DISETUJUI") return "AKTIF";
    if (status == "SELESAI") return "SELESAI";
    return "TIDAK BERLAKU";
  }

  static Color _warna(String status) {
    switch (status) {
      case "AKTIF":
        return const Color(0xFF059669);
      case "SELESAI":
        return const Color(0xFF4F46E5);
      case "KEDALUWARSA":
        return const Color(0xFFD97706);
      default:
        return const Color(0xFFDC2626);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surat = _surat;
    final aktif = surat.where((r) => _statusQr(r) == "AKTIF").length;
    final kedaluwarsa = surat.where((r) => _statusQr(r) == "KEDALUWARSA").length;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text("Surat Izin Terbit"),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: "Cek keaslian surat (QR)",
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const VerifikasiSuratPage())),
            icon: const Icon(Icons.verified_user_outlined, size: 20),
          ),
        ],
      ),
      body: surat.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.description_outlined, size: 44, color: Color(0xFF94A3B8)),
                    SizedBox(height: 10),
                    Text(
                      "Belum ada surat izin yang terbit untuk Anda.",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                    ),
                    SizedBox(height: 6),
                    Text(
                      "Surat terbit otomatis setelah izin disetujui seluruh tahap.",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10.5),
                    ),
                  ],
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        Expanded(child: _ringkasan("${surat.length}", "Total surat", const Color(0xFF0F172A))),
                        Expanded(child: _ringkasan("$aktif", "QR aktif", const Color(0xFF059669))),
                        Expanded(child: _ringkasan("$kedaluwarsa", "Kedaluwarsa", const Color(0xFFD97706))),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                ...surat.map((r) {
                  final status = _statusQr(r);
                  final warna = _warna(status);
                  return Card(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => SuratIzinPage(
                            row: r,
                            santri: santri,
                            jenisLabel: jenisLabel,
                            statusLabel: statusLabel,
                          ),
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: warna.withValues(alpha: 0.10),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(Icons.qr_code_2, size: 22, color: warna),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          "${r["suratNomor"] ?? "Tanpa nomor"}",
                                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: warna.withValues(alpha: 0.12),
                                          borderRadius: BorderRadius.circular(999),
                                        ),
                                        child: Text(
                                          "QR $status",
                                          style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: warna),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    jenisLabel["${r["jenis"]}"] ?? "${r["jenis"] ?? "-"}",
                                    style: const TextStyle(fontSize: 11, color: Color(0xFF475569)),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    "Terbit: ${_fmt(r["createdAt"])}",
                                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                                  ),
                                  Text(
                                    "Berlaku sampai: ${_fmt(r["suratExpiresAt"])}",
                                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                                  ),
                                  if ("${r["status"]}" == "DISETUJUI" || "${r["status"]}" == "SELESAI")
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Text(
                                        "Status izin: ${statusLabel["${r["status"]}"] ?? r["status"]}",
                                        style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right, size: 18, color: Color(0xFFCBD5E1)),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
    );
  }

  Widget _ringkasan(String nilai, String label, Color color) => Column(
    children: [
      Text(nilai, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
      const SizedBox(height: 2),
      Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
    ],
  );
}
