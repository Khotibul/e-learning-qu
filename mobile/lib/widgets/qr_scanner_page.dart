import "package:flutter/material.dart";
import "package:mobile_scanner/mobile_scanner.dart";

import "../utils/qr_token.dart";

/// Pemindai QR surat izin pondok.
/// Mengembalikan token izin lewat `Navigator.pop`, atau null bila dibatalkan.
class QrScannerPage extends StatefulWidget {
  const QrScannerPage({super.key, this.judul = "Pindai QR Izin"});

  final String judul;

  @override
  State<QrScannerPage> createState() => _QrScannerPageState();
}

class _QrScannerPageState extends State<QrScannerPage> {
  final MobileScannerController _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );

  bool _selesai = false;
  bool _senter = false;
  String? _pesan;
  // 0.0 = tanpa zoom, 1.0 = zoom maksimum kamera (skala dinormalisasi oleh plugin).
  double _zoom = 0;
  CameraFacing _facing = CameraFacing.back;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _info(String msg) {
    if (mounted && _pesan != msg) setState(() => _pesan = msg);
  }

  Future<void> _deteksi(BarcodeCapture capture) async {
    if (_selesai) return;
    for (final barcode in capture.barcodes) {
      final token = tokenDariQr(barcode.rawValue);
      if (token == null) continue;
      _selesai = true;
      if (mounted) setState(() => _pesan = "QR terbaca — mencari izin…");
      try {
        await _controller.stop();
      } catch (_) {
        // Kamera mungkin sudah berhenti; abaikan.
      }
      if (mounted) Navigator.pop(context, token);
      return;
    }
    // QR lain (bukan surat izin) — beri tahu tanpa menghentikan kamera.
    _info("QR tidak dikenali. Arahkan ke QR surat izin pondok.");
  }

  Future<void> _senterToggle() async {
    try {
      await _controller.toggleTorch();
      if (mounted) setState(() => _senter = !_senter);
    } catch (_) {
      _info("Senter tidak tersedia di perangkat ini.");
    }
  }

  Future<void> _gantiKamera() async {
    try {
      await _controller.switchCamera();
      if (!mounted) return;
      setState(() {
        _facing = _facing == CameraFacing.back ? CameraFacing.front : CameraFacing.back;
        // Zoom lama tidak berlaku untuk kamera baru.
        _zoom = 0;
        _senter = false;
        _pesan = null;
      });
    } catch (_) {
      _info("Perangkat ini tidak memiliki kamera lain.");
    }
  }

  Future<void> _aturZoom(double v) async {
    if (v != _zoom) setState(() => _zoom = v);
    try {
      await _controller.setZoomScale(v);
    } catch (_) {
      // Kamera belum siap / tidak mendukung zoom — slider tetap responsif.
    }
  }

  Future<void> _inputManual() async {
    final ctrl = TextEditingController();
    final hasil = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Input Token Manual"),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: "Token / isi QR",
            hintText: "Tempel token izin",
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text("Cari")),
        ],
      ),
    );
    ctrl.dispose();
    final token = tokenDariQr(hasil);
    if (token == null) {
      if ((hasil ?? "").trim().isNotEmpty) _info("Token tidak dikenali (minimal 16 karakter).");
      return;
    }
    _selesai = true;
    await _controller.stop();
    if (mounted) Navigator.pop(context, token);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Colors.black,
    appBar: AppBar(
      title: Text(widget.judul),
      backgroundColor: Colors.black,
      foregroundColor: Colors.white,
      actions: [
        IconButton(
          tooltip: _facing == CameraFacing.back ? "Ganti ke kamera depan" : "Ganti ke kamera belakang",
          onPressed: _gantiKamera,
          icon: Icon(_facing == CameraFacing.back ? Icons.camera_front : Icons.camera_rear),
        ),
        IconButton(
          tooltip: _senter ? "Matikan senter" : "Nyalakan senter",
          onPressed: _senterToggle,
          icon: Icon(_senter ? Icons.flash_on : Icons.flash_off),
        ),
        IconButton(
          tooltip: "Input manual",
          onPressed: _inputManual,
          icon: const Icon(Icons.keyboard),
        ),
      ],
    ),
    body: Stack(
      fit: StackFit.expand,
      children: [
        MobileScanner(
          controller: _controller,
          onDetect: _deteksi,
          errorBuilder: (context, error) => _galat(error),
        ),
        // Bingkai bidik
        IgnorePointer(
          child: Center(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white70, width: 3),
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 24,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_pesan != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(10)),
                  child: Text(
                    _pesan!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ),
              const SizedBox(height: 8),
              const Text(
                "Arahkan kamera ke QR pada surat izin santri.",
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    IconButton(
                      tooltip: "Perkecil zoom",
                      visualDensity: VisualDensity.compact,
                      onPressed: _zoom <= 0 ? null : () => _aturZoom((_zoom - 0.2).clamp(0.0, 1.0).toDouble()),
                      icon: const Icon(Icons.zoom_out, color: Colors.white, size: 20),
                    ),
                    Expanded(
                      child: Slider(
                        value: _zoom,
                        min: 0,
                        max: 1,
                        activeColor: Colors.white,
                        inactiveColor: Colors.white30,
                        onChanged: _aturZoom,
                      ),
                    ),
                    IconButton(
                      tooltip: "Perbesar zoom",
                      visualDensity: VisualDensity.compact,
                      onPressed: _zoom >= 1 ? null : () => _aturZoom((_zoom + 0.2).clamp(0.0, 1.0).toDouble()),
                      icon: const Icon(Icons.zoom_in, color: Colors.white, size: 20),
                    ),
                    SizedBox(
                      width: 40,
                      child: Text(
                        "${(_zoom * 100).round()}%",
                        textAlign: TextAlign.right,
                        style: const TextStyle(color: Colors.white70, fontSize: 11),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _inputManual,
                style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white54)),
                icon: const Icon(Icons.keyboard, size: 16),
                label: const Text("Input token manual", style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _galat(MobileScannerException error) {
    final izinDitolak = error.errorCode == MobileScannerErrorCode.permissionDenied;
    return Container(
      color: Colors.black,
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(izinDitolak ? Icons.no_photography_outlined : Icons.camera_alt_outlined, color: Colors.white54, size: 42),
          const SizedBox(height: 12),
          Text(
            izinDitolak
                ? "Akses kamera ditolak. Izinkan kamera di pengaturan aplikasi, lalu coba lagi."
                : "Kamera tidak dapat dibuka: ${error.errorCode.name}",
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _inputManual,
            icon: const Icon(Icons.keyboard, size: 16),
            label: const Text("Input token manual"),
          ),
        ],
      ),
    );
  }
}
