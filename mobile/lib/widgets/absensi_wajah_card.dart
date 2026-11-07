import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_service.dart';

/// Absensi wajah (face recognition) untuk perangkat Android.
/// Aplikasi meminta token kiosk berumur pendek ke server, lalu membuka halaman
/// kamera di browser perangkat. Deteksi wajah berjalan di browser (model lokal),
/// server hanya mencocokkan descriptor dan mencatat kehadiran.
class AbsensiWajahCard extends StatefulWidget {
  final String? keterangan;
  const AbsensiWajahCard({super.key, this.keterangan});

  @override
  State<AbsensiWajahCard> createState() => _AbsensiWajahCardState();
}

class _AbsensiWajahCardState extends State<AbsensiWajahCard> {
  bool _memuat = false;
  bool? _terdaftar;

  Future<void> _buka({bool daftar = false}) async {
    setState(() => _memuat = true);
    try {
      final res = await ApiService.post(
          "/api/mobile/wajah/token", {"tujuan": daftar ? "daftar" : "absensi"});
      final data = res is Map ? Map<String, dynamic>.from(res) : <String, dynamic>{};
      final url = data["url"];
      if (url is! String || url.isEmpty) {
        throw Exception(data["error"] ?? "URL absensi wajah tidak tersedia");
      }
      setState(() => _terdaftar = data["terdaftar"] == true);
      final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!ok) throw Exception("Browser tidak bisa dibuka pada perangkat ini");
      if (!daftar && data["terdaftar"] != true && mounted) {
        _snack("Wajah Anda belum terdaftar — gunakan tombol Daftarkan Wajah untuk mendaftar sendiri.",
            const Color(0xFFF59E0B));
      }
    } catch (e) {
      if (mounted) {
        _snack(e.toString().replaceFirst("Exception: ", ""), const Color(0xFFEF4444));
      }
    } finally {
      if (mounted) setState(() => _memuat = false);
    }
  }

  void _snack(String msg, Color color) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE0E7FF)),
      ),
      color: const Color(0xFFF5F7FF),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFF4F46E5).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.face_retouching_natural, size: 16, color: Color(0xFF4F46E5)),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text("Absensi Wajah (Kamera)",
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              ),
              if (_terdaftar == true)
                const Icon(Icons.verified, size: 15, color: Color(0xFF10B981))
              else if (_terdaftar == false)
                const Icon(Icons.info_outline, size: 15, color: Color(0xFFF59E0B)),
            ]),
            const SizedBox(height: 6),
            Text(
              widget.keterangan ??
                  "Verifikasi wajah lewat kamera depan perangkat. Bisa dipakai di Android maupun browser desktop.",
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _memuat ? null : () => _buka(),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  visualDensity: VisualDensity.compact,
                ),
                icon: _memuat
                    ? const SizedBox(
                        height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.camera_front, size: 15),
                label: Text(_memuat ? "Membuka kamera…" : "Buka Absensi Wajah",
                    style: const TextStyle(fontSize: 12)),
              ),
            ),
            if (_terdaftar != true)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _memuat ? null : () => _buka(daftar: true),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF4F46E5),
                          visualDensity: VisualDensity.compact,
                        ),
                        icon: const Icon(Icons.badge_outlined, size: 15),
                        label: const Text("Daftarkan Wajah Sendiri", style: TextStyle(fontSize: 11)),
                      ),
                    ),
                    if (_terdaftar == false)
                      const Padding(
                        padding: EdgeInsets.only(top: 4),
                        child: Text(
                            "Wajah belum terdaftar — daftar sendiri lewat kamera, lalu tunggu persetujuan Admin.",
                            style: TextStyle(fontSize: 10, color: Color(0xFFB45309))),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
