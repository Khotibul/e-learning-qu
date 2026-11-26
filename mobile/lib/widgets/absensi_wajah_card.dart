import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'app_ui.dart';

class AbsensiWajahCard extends StatefulWidget {
  final String? keterangan;
  final Map<String, dynamic>? kebijakan;
  const AbsensiWajahCard({super.key, this.keterangan, this.kebijakan});

  @override
  State<AbsensiWajahCard> createState() => _AbsensiWajahCardState();
}

class _AbsensiWajahCardState extends State<AbsensiWajahCard> {
  bool _memuat = false;
  bool? _terdaftar;

  Map<String, dynamic> get _lokasi {
    final l = widget.kebijakan?["lokasi"];
    return (l is Map ? l : <String, dynamic>{}) as Map<String, dynamic>;
  }

  double _haversine(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371000.0;
    final p = math.pi / 180;
    final a = 0.5 - math.cos((lat2 - lat1) * p) / 2 +
        math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2;
    return 2 * r * math.asin(math.sqrt(a.clamp(0.0, 1.0)));
  }

  Future<bool> _cekLokasi() async {
    // Lokasi hanya wajib bila kebijakan Admin mengaktifkannya.
    if (_lokasi["gpsWajib"] != true) return true;
    final cfgLat = double.tryParse("${_lokasi["lat"] ?? ""}");
    final cfgLng = double.tryParse("${_lokasi["lng"] ?? ""}");
    if (cfgLat == null || cfgLng == null) {
      _snack("Titik lokasi belum ditentukan Admin", AppColors.warning);
      return false;
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      _snack("Izin lokasi ditolak", AppColors.danger);
      return false;
    }
    Position pos;
    try {
      pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)),
      );
    } catch (e) {
      _snack("Gagal mengambil lokasi: $e", AppColors.danger);
      return false;
    }
    final radius = double.tryParse("${_lokasi["radiusMeter"] ?? 100}") ?? 100;
    final akurasiMaks = double.tryParse("${_lokasi["akurasiMaksMeter"] ?? 50}") ?? 50;
    final d = _haversine(pos.latitude, pos.longitude, cfgLat, cfgLng);
    final akurasiOk = pos.accuracy <= akurasiMaks;
    if (d > radius || !akurasiOk) {
      _snack("Lokasi tidak sesuai / anda tidak di area lokasi", AppColors.danger);
      return false;
    }
    return true;
  }

  Future<void> _buka({bool daftar = false}) async {
    setState(() => _memuat = true);
    try {
      final lokasiOk = await _cekLokasi();
      if (!lokasiOk) return;

      final cam = await Permission.camera.request();
      if (!cam.isGranted) {
        _snack(
          cam.isPermanentlyDenied
              ? "Izin kamera diblokir. Buka Pengaturan aplikasi, lalu izinkan Kamera."
              : "Izin kamera ditolak",
          AppColors.danger,
        );
        return;
      }

      final res = await ApiService.post(
          "/api/mobile/wajah/token", {"tujuan": daftar ? "daftar" : "absensi"});
      final data = res is Map ? Map<String, dynamic>.from(res) : <String, dynamic>{};
      final url = data["url"];
      if (url is! String || url.isEmpty) {
        throw Exception(data["error"] ?? "URL absensi wajah tidak tersedia");
      }
      setState(() => _terdaftar = data["terdaftar"] == true);
      if (!daftar && data["terdaftar"] != true && mounted) {
        _snack("Wajah Anda belum terdaftar — gunakan tombol Daftarkan Wajah untuk mendaftar sendiri.", AppColors.warning);
      }
      if (!mounted) return;
      await showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => _WajahWebViewDialog(url: url),
      );
    } catch (e) {
      if (mounted) _snack(e.toString().replaceFirst("Exception: ", ""), AppColors.danger);
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
                  boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.30), blurRadius: 12, offset: const Offset(0, 5))],
                ),
                child: const Icon(Icons.face_retouching_natural, size: 20, color: Colors.white),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text("Absensi Wajah (Kamera)", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.ink)),
              ),
              if (_terdaftar == true)
                _StatusChip(icon: Icons.verified_outlined, label: "Terdaftar", color: AppColors.success)
              else if (_terdaftar == false)
                _StatusChip(icon: Icons.info_outline, label: "Belum", color: AppColors.warning),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            widget.keterangan ?? "Verifikasi wajah lewat kamera depan perangkat. Bisa dipakai di Android maupun browser desktop.",
            style: const TextStyle(fontSize: 11.5, height: 1.45, color: AppColors.inkMuted),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _memuat ? null : () => _buka(),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)),
              icon: _memuat
                  ? const SizedBox(height: 15, width: 15, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.camera_front, size: 17),
              label: Text(_memuat ? "Membuka kamera…" : "Buka Absensi Wajah", style: const TextStyle(fontSize: 13)),
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

class _WajahWebViewDialog extends StatefulWidget {
  final String url;
  const _WajahWebViewDialog({required this.url});
  @override
  State<_WajahWebViewDialog> createState() => _WajahWebViewDialogState();
}

class _WajahWebViewDialogState extends State<_WajahWebViewDialog> {
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController(
      onPermissionRequest: (request) async {
        if (request.types.contains(WebViewPermissionResourceType.camera)) {
          final izin = await Permission.camera.request();
          if (izin.isGranted) {
            await request.grant();
            return;
          }
        }
        await request.deny();
      },
    )
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (_) => setState(() => _loading = true),
        onPageFinished: (_) => setState(() => _loading = false),
      ))
      ..loadRequest(Uri.parse(widget.url));

    // Android WebView menolak GPS secara default. Izinkan origin halaman ini
    // selama izin lokasi aplikasi sudah diberikan.
    final platform = _controller.platform;
    if (platform is AndroidWebViewController) {
      platform.setGeolocationPermissionsPromptCallbacks(
        onShowPrompt: (_) async {
          final izin = await Permission.locationWhenInUse.request();
          return GeolocationPermissionsResponse(
            allow: izin.isGranted,
            retain: true,
          );
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog.fullscreen(
      child: Scaffold(
        appBar: AppBar(
          title: const Text("Absensi Wajah"),
          leading: IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
        ),
        body: Stack(children: [
          WebViewWidget(controller: _controller),
          if (_loading) const Center(child: CircularProgressIndicator()),
        ]),
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
