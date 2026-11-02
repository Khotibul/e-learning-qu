import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:intl/intl.dart";

import "package:qr_flutter/qr_flutter.dart";
import "../services/api_service.dart";
import "../services/verifikasi_log.dart";
import "../utils/qr_token.dart";
import "../widgets/qr_scanner_page.dart";

/// Verifikasi keaslian surat izin pondok lewat QR atau token.
/// Sumber data sama dengan halaman web & pemindai gerbang:
/// `/api/izin/verifikasi?token=...` (publik, data minimal).
class VerifikasiSuratPage extends StatefulWidget {
  /// Token awal (mis. dari deep link atau hasil pindai) — langsung diverifikasi.
  final String? tokenAwal;
  const VerifikasiSuratPage({super.key, this.tokenAwal});

  @override
  State<VerifikasiSuratPage> createState() => _VerifikasiSuratPageState();
}

class _VerifikasiSuratPageState extends State<VerifikasiSuratPage> {
  final _token = TextEditingController();
  bool _loading = false;
  String? _error;
  Map? _hasil;

  @override
  void initState() {
    super.initState();
    final awal = widget.tokenAwal?.trim();
    if (awal != null && awal.isNotEmpty) {
      _token.text = awal;
      WidgetsBinding.instance.addPostFrameCallback((_) => _verifikasi());
    }
  }

  @override
  void dispose() {
    _token.dispose();
    super.dispose();
  }

  static String _bersihError(Object e) => e.toString().replaceFirst("Exception: ", "").trim();

  Future<void> _pindai() async {
    final token = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const QrScannerPage(judul: "Pindai QR Surat Izin")),
    );
    if (token == null || token.isEmpty) return;
    _token.text = token;
    await _verifikasi();
  }

  Future<void> _tempelDariPapanKlip() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final token = tokenDariQr(data?.text);
    if (token == null) {
      if (mounted) _pesan("Isi papan klip bukan token surat izin");
      return;
    }
    _token.text = token;
    await _verifikasi();
  }

  void _pesan(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: const Color(0xFFF59E0B)),
      );
    }
  }

  Future<void> _verifikasi() async {
    final token = tokenDariQr(_token.text) ?? _token.text.trim();
    if (token.length < 16) {
      setState(() {
        _hasil = null;
        _error = "Token tidak valid — minimal 16 karakter. Pindai QR pada surat izin.";
      });
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
      _hasil = null;
    });
    try {
      final res = await ApiService.get(
        "/api/izin/verifikasi?token=${Uri.encodeQueryComponent(token)}",
        useCache: false,
      );
      final hasil = res is Map ? Map<String, dynamic>.from(res) : null;
      // Ikut dicatat ke riwayat verifikasi QR di perangkat (tab Gerbang).
      VerifikasiLog.tambah(
        token: token,
        hasil: hasil,
        error: hasil == null ? "Respons verifikasi tidak dikenali" : null,
        sumber: "CEK",
      );
      if (!mounted) return;
      setState(() {
        _hasil = hasil;
        _error = hasil == null ? "Respons verifikasi tidak dikenali" : null;
        _loading = false;
      });
    } catch (e) {
      final pesanError = _bersihError(e);
      VerifikasiLog.tambah(token: token, error: pesanError, sumber: "CEK");
      if (!mounted) return;
      setState(() {
        _error = pesanError;
        _loading = false;
      });
    }
  }

  static String _fmt(dynamic v) {
    if (v == null || "$v" == "null") return "-";
    final d = DateTime.tryParse("$v");
    if (d == null) return "-";
    return "${DateFormat("dd MMMM yyyy HH:mm", "id_ID").format(d.toLocal())} WIB";
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text("Cek Keaslian Surat"),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    "Verifikasi surat izin pondok",
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    "Pindai QR pada surat izin, atau tempel tokennya. Hasil dicek langsung ke database pondok.",
                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B), height: 1.4),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _token,
                    autocorrect: false,
                    enableSuggestions: false,
                    minLines: 1,
                    maxLines: 3,
                    style: const TextStyle(fontFamily: "monospace", fontSize: 12),
                    onSubmitted: (_) => _loading ? null : _verifikasi(),
                    decoration: InputDecoration(
                      labelText: "Token / URL QR surat",
                      hintText: "Tempel token atau URL verifikasi",
                      isDense: true,
                      border: const OutlineInputBorder(),
                      prefixIcon: const Icon(Icons.qr_code_2, size: 20),
                      suffixIcon: IconButton(
                        tooltip: "Tempel dari papan klip",
                        onPressed: _loading ? null : _tempelDariPapanKlip,
                        icon: const Icon(Icons.content_paste, size: 18),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _loading ? null : _verifikasi,
                          icon: const Icon(Icons.verified_user_outlined, size: 18),
                          label: const Text("Verifikasi"),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _loading ? null : _pindai,
                          icon: const Icon(Icons.qr_code_scanner, size: 18),
                          label: const Text("Pindai QR"),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 36),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (!_loading && _error != null) _kartuGagal(_error!),
          if (!_loading && _hasil != null) _kartuHasil(_hasil!),
          const SizedBox(height: 16),
          const Text(
            "Halaman ini hanya menampilkan data minimal surat (nama, NIS, nomor, jenis, dan status). "
            "Bila QR kedaluwarsa atau surat tidak terdaftar, surat dianggap tidak sah.",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8), height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _kartuGagal(String pesan) => Card(
    color: const Color(0xFFFEF2F2),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.gpp_bad_outlined, color: Color(0xFFDC2626)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "QR tidak sah",
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF991B1B)),
                ),
                const SizedBox(height: 4),
                Text(pesan, style: const TextStyle(fontSize: 11, color: Color(0xFFB91C1C), height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  Widget _kartuHasil(Map hasil) {
    final valid = hasil["valid"] == true;
    final kedaluwarsa = hasil["kedaluwarsa"] == true;
    final color = valid ? const Color(0xFF059669) : (kedaluwarsa ? const Color(0xFFD97706) : const Color(0xFFDC2626));
    final judul = valid ? "Surat ASLI & BERLAKU" : (kedaluwarsa ? "Surat KEDALUWARSA" : "Surat TIDAK BERLAKU");
    final ikon = valid ? Icons.verified : (kedaluwarsa ? Icons.schedule : Icons.gpp_bad_outlined);
    final catatan = valid
        ? "QR cocok dengan surat yang diterbitkan sistem pondok."
        : kedaluwarsa
            ? "Masa berlaku QR sudah habis — minta surat baru ke admin pondok."
            : "Status surat tidak lagi mendukung verifikasi (dibatalkan/kedaluwarsa).";

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: color.withValues(alpha: 0.30)),
              ),
              child: Row(
                children: [
                  Icon(ikon, color: color, size: 28),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(judul, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: color)),
                        const SizedBox(height: 2),
                        Text(catatan, style: TextStyle(fontSize: 10.5, color: color.withValues(alpha: 0.9), height: 1.35)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _baris("Nama Santri", "${hasil["namaSantri"] ?? "-"}"),
            _baris("NIS", "${hasil["nisNo"] ?? "-"}"),
            _baris("Nomor Surat", "${hasil["suratNomor"] ?? "-"}"),
            _baris("Jenis Izin", "${hasil["jenis"] ?? "-"}"),
            _baris("Status Surat", "${hasil["status"] ?? "-"}"),
            _baris("Berlaku Sampai", _fmt(hasil["berlakuSampai"])),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                _chip(hasil["sudahCheckout"] == true ? "Sudah check-out" : "Belum check-out", const Color(0xFF0EA5E9)),
                _chip(hasil["sudahCheckin"] == true ? "Sudah check-in" : "Belum check-in", const Color(0xFF4F46E5)),
              ],
            ),
            const SizedBox(height: 10),
            const Text("Preview QR:", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF4F46E5))),
            const SizedBox(height: 4),
            QrImageView(
              data: "${_token.text}",
              version: QrVersions.auto,
              size: 200,
              backgroundColor: Colors.white,
              eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Color(0xFF0F172A)),
              dataModuleStyle: const QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.square,
                color: Color(0xFF0F172A),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _baris(String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 120,
          child: Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
        ),
        Expanded(
          child: Text(value, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
        ),
      ],
    ),
  );

  Widget _chip(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
    child: Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
  );
}
