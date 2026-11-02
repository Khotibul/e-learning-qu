/// Ambil token izin dari isi QR.
///
/// Surat izin digital mencetak QR berisi URL verifikasi
/// (`.../api/izin/verifikasi?token=<hex>`), sedangkan sebagian kartu/token
/// hanya memuat token mentah. Keduanya harus bisa dipindai petugas gerbang.
String? tokenDariQr(String? raw) {
  final teks = (raw ?? "").trim();
  if (teks.isEmpty) return null;

  // URL atau teks yang memuat parameter ?token= / &token= (juga ?t=).
  final cocok = RegExp(r"[?&](?:token|t)=([^&\s#]+)", caseSensitive: false).firstMatch(teks);
  if (cocok != null) {
    final nilai = Uri.decodeComponent(cocok.group(1)!).trim();
    if (nilai.length >= 16) return nilai;
  }

  // Token mentah (hex 48 karakter dari server, atau kode sejenis).
  if (RegExp(r"^[A-Za-z0-9_-]{16,}$").hasMatch(teks)) return teks;

  return null;
}
