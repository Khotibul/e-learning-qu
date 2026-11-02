import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

/// Riwayat verifikasi QR terakhir (disimpan lokal di perangkat petugas).
/// Hanya menyimpan data minimal yang dikembalikan endpoint publik verifikasi.
class VerifikasiLog {
  static const String _key = "verifikasi_qr_log";
  static const String _keyFilter = "verifikasi_qr_filter";
  static const int _maks = 30;

  /// Terbaru lebih dulu.
  static Future<List<Map<String, dynamic>>> semua() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    try {
      final data = jsonDecode(raw);
      if (data is! List) return [];
      return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    } catch (_) {
      return [];
    }
  }

  /// Filter status terakhir yang dipilih petugas (SEMUA/SAH/KEDALUWARSA/...).
  static Future<String> filterTersimpan() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyFilter) ?? "SEMUA";
  }

  static Future<void> simpanFilter(String filter) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyFilter, filter);
  }

  static Future<void> tambah({
    required String token,
    Map? hasil,
    String? error,
    String? sumber,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final lama = await semua();
    final h = hasil ?? const {};
    final entri = <String, dynamic>{
      "token": token,
      "waktu": DateTime.now().toIso8601String(),
      "valid": h["valid"] == true,
      "kedaluwarsa": h["kedaluwarsa"] == true,
      "suratNomor": h["suratNomor"],
      "namaSantri": h["namaSantri"],
      "nisNo": h["nisNo"],
      "status": h["status"],
      "jenis": h["jenis"],
      "error": ?error,
      "sumber": ?sumber,
    };
    final baru = [entri, ...lama].take(_maks).toList();
    await prefs.setString(_key, jsonEncode(baru));
  }

  /// Hapus satu entri dari riwayat. Pencocokan memakai token + waktu karena
  /// entri tidak punya id sendiri. Mengembalikan true bila ada yang terhapus.
  static Future<bool> hapusEntri(Map<String, dynamic> entri) async {
    final prefs = await SharedPreferences.getInstance();
    final lama = await semua();
    final token = "${entri["token"] ?? ""}";
    final waktu = "${entri["waktu"] ?? ""}";
    final sisa = <Map<String, dynamic>>[];
    var terhapus = false;
    for (final e in lama) {
      if (!terhapus && "${e["token"] ?? ""}" == token && "${e["waktu"] ?? ""}" == waktu) {
        terhapus = true;
        continue;
      }
      sisa.add(e);
    }
    if (!terhapus) return false;
    await prefs.setString(_key, jsonEncode(sisa));
    return true;
  }

  static Future<void> bersihkan() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
