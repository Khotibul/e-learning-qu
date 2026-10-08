import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:local_auth/local_auth.dart';

import '../services/api_service.dart';

/// Status verifikasi satu sesi (state disimpan di parent, widget ini controlled).
class VerifState {
  String? fotoUrl;
  double? lat;
  double? lng;
  double? akurasiMeter;
  int? jarakMeter;
  bool? gpsValid;
  bool? mock;
  bool sidikOk = false;
  String? sidikProvider;

  bool get kosong => fotoUrl == null && jarakMeter == null && !sidikOk;

  Map<String, dynamic> toJson() => {
        if (fotoUrl != null) "fotoUrl": fotoUrl,
        if (lat != null && lng != null)
          "gps": {
            "lat": lat,
            "lng": lng,
            if (akurasiMeter != null) "akurasiMeter": akurasiMeter,
            if (jarakMeter != null) "jarakMeter": jarakMeter,
            if (gpsValid != null) "gpsValid": gpsValid,
            if (mock != null) "mock": mock,
          },
        if (sidikOk) "sidikJari": {"verified": true, "provider": sidikProvider ?? "device-biometric"},
      };
}

double haversineMeter(double lat1, double lon1, double lat2, double lon2) {
  const r = 6371000.0;
  final p = pi / 180;
  final a = 0.5 - cos((lat2 - lat1) * p) / 2 + cos(lat1 * p) * cos(lat2 * p) * (1 - cos((lon2 - lon1) * p)) / 2;
  return 2 * r * asin(sqrt(a));
}

/// Apakah butuh foto pada fase ini (foto hanya wajib saat MASUK).
bool butuhFoto(String metode, String fase) => fase == "MASUK" && metode.contains("FOTO");
bool butuhGps(String metode) => metode.contains("GPS");
bool butuhSidik(String metode) => metode.contains("SIDIK");

class VerifikasiWidget extends StatefulWidget {
  final String metode;
  final Map<String, dynamic> kebijakan; // {lokasi: {lat,lng,radiusMeter,akurasiMaksMeter,lokasiNama,gpsWajib}}
  final String fase; // MASUK | SELESAI
  final VerifState state;
  final ValueChanged<VerifState> onChange;
  final bool busy;
  final VoidCallback? onAjukanPengecualian;
  final bool disabled;

  const VerifikasiWidget({
    super.key,
    required this.metode,
    required this.kebijakan,
    required this.fase,
    required this.state,
    required this.onChange,
    this.busy = false,
    this.onAjukanPengecualian,
    this.disabled = false,
  });

  @override
  State<VerifikasiWidget> createState() => _VerifikasiWidgetState();
}

class _VerifikasiWidgetState extends State<VerifikasiWidget> {
  bool proses = false;

  Map<String, dynamic> get _lokasi {
    final l = widget.kebijakan["lokasi"];
    return (l is Map ? l : {}) as Map<String, dynamic>;
  }

  void _set(void Function(VerifState s) fn) {
    fn(widget.state);
    if (mounted) widget.onChange(widget.state);
  }

  Future<void> _ambilFoto() async {
    setState(() => proses = true);
    try {
      final picker = ImagePicker();
      final XFile? file = await picker.pickImage(source: ImageSource.camera, imageQuality: 55, maxWidth: 900);
      if (file == null) return;
      final url = await ApiService.uploadFile("/api/mobile/upload", file.path);
      _set((s) => s.fotoUrl = url);
      _toast("Foto bukti tersimpan");
    } catch (e) {
      _toast(e.toString().replaceFirst("Exception: ", ""));
    } finally {
      if (mounted) setState(() => proses = false);
    }
  }

  Future<void> _ambilLokasi() async {
    setState(() => proses = true);
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        _toast("Izin lokasi ditolak. Ajukan pengecualian ke Admin.");
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)),
      );
      final cfgLat = double.tryParse("${_lokasi["lat"] ?? ""}");
      final cfgLng = double.tryParse("${_lokasi["lng"] ?? ""}");
      final radius = double.tryParse("${_lokasi["radiusMeter"] ?? 100}") ?? 100;
      final akurasiMaks = double.tryParse("${_lokasi["akurasiMaksMeter"] ?? 50}") ?? 50;

      int? jarak;
      bool? valid;
      if (cfgLat != null && cfgLng != null) {
        final d = haversineMeter(pos.latitude, pos.longitude, cfgLat, cfgLng);
        jarak = d.round();
        final akurasiOk = pos.accuracy <= akurasiMaks;
        valid = d <= radius && akurasiOk;
      }
      _set((s) {
        s.lat = pos.latitude;
        s.lng = pos.longitude;
        s.akurasiMeter = pos.accuracy;
        s.jarakMeter = jarak;
        s.gpsValid = valid;
        s.mock = pos.isMocked;
      });
      if (jarak == null) {
        _toast("Lokasi tercatat (titik absen belum diatur Admin)");
      } else if (valid == true) {
        _toast("Di dalam radius ($jarak m)");
      } else {
        _toast("Di luar radius ($jarak m) — minta pengecualian Admin");
      }
    } catch (e) {
      _toast("Gagal mengambil lokasi: $e");
    } finally {
      if (mounted) setState(() => proses = false);
    }
  }

  Future<void> _sidikJari() async {
    setState(() => proses = true);
    try {
      final auth = LocalAuthentication();
      final can = await auth.canCheckBiometrics || await auth.isDeviceSupported();
      if (!can) {
        _toast("Perangkat tidak mendukung biometrik");
        return;
      }
      final ok = await auth.authenticate(
        localizedReason: "Verifikasi kehadiran — sidik jari/wajah perangkat",
        options: const AuthenticationOptions(biometricOnly: true, stickyAuth: true),
      );
      if (ok) {
        final daftar = await auth.getAvailableBiometrics();
        _set((s) {
          s.sidikOk = true;
          s.sidikProvider = daftar.isEmpty ? "device-biometric" : daftar.map((b) => b.name).join(",");
        });
        _toast("Biometrik terverifikasi");
      } else {
        _toast("Verifikasi biometrik dibatalkan");
      }
    } catch (e) {
      _toast("Biometrik gagal: $e");
    } finally {
      if (mounted) setState(() => proses = false);
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), duration: const Duration(seconds: 3)));
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.metode;
    if (m == "TANPA" || m.isEmpty) return const SizedBox.shrink();
    final fase = widget.fase;
    final fFoto = butuhFoto(m, fase);
    final fGps = butuhGps(m);
    final fSidik = butuhSidik(m);
    final s = widget.state;
    final busy = proses || widget.busy;

    // Sudah lengkap?
    final fotoOk = !fFoto || (s.fotoUrl != null || fase == "SELESAI");
    final gpsOk = !fGps || s.jarakMeter != null;
    final sidikOk = !fSidik || s.sidikOk;
    final lengkap = fotoOk && gpsOk && sidikOk;

    final lok = _lokasi;
    final radius = (num.tryParse("${lok["radiusMeter"] ?? 100}") ?? 100).toDouble();
    final namaLok = (lok["lokasiNama"] ?? "").toString();

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.verified_user_outlined, size: 14, color: Color(0xFF4F46E5)),
          const SizedBox(width: 6),
          Text("Verifikasi $m${fase == "MASUK" ? " (absen masuk)" : " (absen selesai)"}",
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
          const Spacer(),
          if (lengkap)
            const Icon(Icons.check_circle, size: 15, color: Color(0xFF10B981))
          else
            const Icon(Icons.pending_actions, size: 15, color: Color(0xFFF59E0B)),
        ]),
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, children: [
          if (fFoto)
            _chip(
              s.fotoUrl != null ? "Foto ✓" : "Foto belum",
              s.fotoUrl != null ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
              icon: Icons.photo_camera_outlined,
            ),
          if (fGps)
            _chip(
              s.jarakMeter != null
                  ? "GPS ${s.jarakMeter}m${s.gpsValid == false ? " (luar!)" : s.mock == true ? " (mock?)" : " ✓"}"
                  : "GPS belum",
              s.jarakMeter == null
                  ? const Color(0xFFF59E0B)
                  : s.gpsValid == true
                      ? const Color(0xFF10B981)
                      : const Color(0xFFEF4444),
              icon: Icons.location_on_outlined,
            ),
          if (fSidik)
            _chip(
              s.sidikOk ? "Sidik jari ✓" : "Sidik jari belum",
              s.sidikOk ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
              icon: Icons.fingerprint,
            ),
          if (fGps && namaLok.isNotEmpty)
            _chip("Radius $radius m • $namaLok", const Color(0xFF64748B), icon: Icons.radio_button_checked),
        ]),
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, children: [
          if (fFoto && s.fotoUrl == null)
            _btn(Icons.photo_camera_outlined, "Ambil Foto", _ambilFoto, busy || widget.disabled),
          if (fGps && s.jarakMeter == null)
            _btn(Icons.my_location, "Ambil Lokasi", _ambilLokasi, busy || widget.disabled),
          if (fSidik && !s.sidikOk)
            _btn(Icons.fingerprint, "Sidik Jari", _sidikJari, busy || widget.disabled),
          if (widget.onAjukanPengecualian != null)
            TextButton.icon(
              onPressed: busy || widget.disabled ? null : widget.onAjukanPengecualian,
              icon: const Icon(Icons.rule_outlined, size: 14),
              label: const Text("Pengajuan Pengecualian", style: TextStyle(fontSize: 11)),
            ),
        ]),
        if (!lengkap)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              [
                if (fFoto && fase == "MASUK" && s.fotoUrl == null) "foto wajib saat absen masuk",
                if (fGps && s.jarakMeter == null) "lokasi wajib di dalam radius sekolah",
                if (fSidik && !s.sidikOk) "sidik jari/wajah perangkat wajib",
              ].join(" • "),
              style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
            ),
          ),
      ]),
    );
  }

  Widget _chip(String text, Color color, {IconData? icon}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 11, color: color), const SizedBox(width: 3)],
          Text(text, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w700)),
        ]),
      );

  Widget _btn(IconData icon, String label, VoidCallback onTap, bool disabled) => FilledButton.tonalIcon(
        onPressed: disabled ? null : onTap,
        icon: proses
            ? const SizedBox(height: 13, width: 13, child: CircularProgressIndicator(strokeWidth: 2))
            : Icon(icon, size: 14),
        label: Text(label, style: const TextStyle(fontSize: 11)),
        style: FilledButton.styleFrom(visualDensity: VisualDensity.compact, padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
      );
}
