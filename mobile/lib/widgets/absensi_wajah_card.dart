import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'app_ui.dart';

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
            AppColors.warning);
      }
    } catch (e) {
      if (mounted) {
        _snack(e.toString().replaceFirst("Exception: ", ""), AppColors.danger);
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
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  gradient: AppGradients.indigo,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(color: AppColors.primary.withValues(alpha: 0.30), blurRadius: 12, offset: const Offset(0, 5)),
                  ],
                ),
                child: const Icon(Icons.face_retouching_natural, size: 20, color: Colors.white),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  "Absensi Wajah (Kamera)",
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.ink),
                ),
              ),
              if (_terdaftar == true)
                _StatusChip(icon: Icons.verified_outlined, label: "Terdaftar", color: AppColors.success)
              else if (_terdaftar == false)
                _StatusChip(icon: Icons.info_outline, label: "Belum", color: AppColors.warning),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            widget.keterangan ??
                "Verifikasi wajah lewat kamera depan perangkat. Bisa dipakai di Android maupun browser desktop.",
            style: const TextStyle(fontSize: 11.5, height: 1.45, color: AppColors.inkMuted),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _memuat ? null : () => _buka(),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)),
              icon: _memuat
                  ? const SizedBox(
                      height: 15, width: 15, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.camera_front, size: 17),
              label: Text(_memuat ? "Membuka kamera…" : "Buka Absensi Wajah",
                  style: const TextStyle(fontSize: 13)),
            ),
          ),
          if (_terdaftar != true)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _memuat ? null : () => _buka(daftar: true),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(42),
                        foregroundColor: AppColors.primary,
                        side: const BorderSide(color: AppColors.borderStrong),
                      ),
                      icon: const Icon(Icons.badge_outlined, size: 16),
                      label: const Text("Daftarkan Wajah Sendiri", style: TextStyle(fontSize: 12)),
                    ),
                  ),
                  if (_terdaftar == false)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: InfoBanner(
                        icon: Icons.info_outline,
                        text: "Wajah belum terdaftar — daftar sendiri lewat kamera, lalu tunggu persetujuan Admin.",
                        color: AppColors.warning,
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _StatusChip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.22)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
      );
}
