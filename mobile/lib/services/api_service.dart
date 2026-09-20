import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

/// Service API — Stabil untuk koneksi Prima DB
/// 1 DATABASE: Android → HTTP → Next.js API → Prisma → PostgreSQL (sama dengan web)
/// Alternatif "langsung ke DB" (postgres://) TIDAK disarankan dari mobile (kredensial bocor, no RLS)
/// Jadi Android tetap via API, tapi dibuat se-stabil direct:
///   - Retry 3x exponential backoff (jaringan SEA sering blip)
///   - Timeout 15s + Abort
///   - Cache GET 60s di SharedPreferences (offline-first)
///   - Pooling via HTTP Keep-Alive (http.Client reuse)
class ApiService {
  static final http.Client _client = http.Client();

  static Future<Map<String, String>> _headers() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString("auth_token");
    return {
      "Content-Type": "application/json",
      if (token != null) "Authorization": "Bearer $token",
    };
  }

  // Retry helper untuk jaringan Singapura yang kadang blip
  static Future<T> _withRetry<T>(Future<T> Function() fn, {int retries = 2}) async {
    for (int i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (e) {
        final msg = e.toString();
        final isTransient = msg.contains("Timeout") || msg.contains("SocketException") || msg.contains("Failed host") || msg.contains("Connection");
        if (!isTransient || i == retries) rethrow;
        await Future.delayed(Duration(milliseconds: 400 * (1 << i) + 100));
      }
    }
    throw Exception("Retry gagal");
  }

  static Future<dynamic> get(String path, {bool useCache = true}) async {
    // Cache GET 60s untuk menu → menu terasa instan meski DB 1.4s
    if (useCache) {
      final prefs = await SharedPreferences.getInstance();
      final key = "cache:$path";
      final cached = prefs.getString(key);
      final ts = prefs.getInt("${key}_ts") ?? 0;
      if (cached != null && DateTime.now().millisecondsSinceEpoch - ts < 60000) {
        try { return jsonDecode(cached); } catch (_) {}
      }
    }

    final headers = await _headers();
    final res = await _withRetry(() => _client.get(Uri.parse("${ApiConfig.baseUrl}$path"), headers: headers).timeout(const Duration(seconds: 15)));

    if (res.statusCode >= 400) throw Exception("GET $path: ${res.statusCode} ${res.body}");
    final data = jsonDecode(res.body);

    if (useCache) {
      final prefs = await SharedPreferences.getInstance();
      final key = "cache:$path";
      await prefs.setString(key, res.body);
      await prefs.setInt("${key}_ts", DateTime.now().millisecondsSinceEpoch);
    }
    return data;
  }

  static Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final headers = await _headers();
    final res = await _withRetry(() => _client.post(Uri.parse("${ApiConfig.baseUrl}$path"), headers: headers, body: jsonEncode(body)).timeout(const Duration(seconds: 15)));
    if (res.statusCode >= 400) throw Exception("POST $path: ${res.statusCode} ${res.body}");
    return jsonDecode(res.body);
  }

  // Auth — LANGSUNG KE DATABASE via /api/mobile/auth/login (1 DB dengan website)
  // Website: src/lib/auth.ts → prisma.user.findUnique + bcrypt + role check
  // Android: endpoint ini → logic SAMA PERSIS, DB SAMA (PostgreSQL db.prisma.io)
  static Future<Map<String, dynamic>> signIn(String email, String password, String role) async {
    final res = await _withRetry(() => _client.post(
      Uri.parse("${ApiConfig.baseUrl}/api/mobile/auth/login"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"email": email, "password": password, "role": role}),
    ).timeout(const Duration(seconds: 15)));

    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode != 200) throw Exception(body["error"] ?? "Login gagal: ${res.statusCode}");

    // Simpan token & user untuk request selanjutnya (stabil, retry-ready)
    if (body["token"] != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString("auth_token", body["token"] as String);
      await prefs.setString("auth_user", jsonEncode(body["user"]));
      if (body["extra"] != null) await prefs.setString("auth_extra", jsonEncode(body["extra"]));
    }
    // Kembalikan format yang diharapkan AuthProvider: {user, token, extra}
    return body;
  }

  // ===== Fitur Website yang belum di Android — semua via API yang sama (1 DB) =====
  // Mobile endpoints — langsung ke 1 DB yang sama dengan website (via prisma)
  static Future<List<dynamic>> getUjianList() async {
    final data = await get("/api/mobile/siswa/ujian");
    if (data is List) return data;
    if (data is Map && data["ujians"] is List) return data["ujians"] as List<dynamic>;
    if (data is Map && data["data"] is List) return data["data"] as List<dynamic>;
    return [];
  }

  static Future<List<dynamic>> getLatihanList() async {
    final data = await get("/api/siswa/latihan");
    if (data is List) return data;
    if (data is Map && data["data"] is List) return data["data"] as List<dynamic>;
    return [];
  }

  static Future<List<dynamic>> getAbsensi({String? start, String? end}) async {
    final q = "?start=${start ?? ""}&end=${end ?? ""}";
    final data = await get("/api/mobile/siswa/absensi$q");
    return data is List ? data : [];
  }

  static Future<List<dynamic>> getMateri() async {
    final data = await get("/api/mobile/siswa/materi");
    if (data is List) return data;
    if (data is Map && data["data"] is List) return data["data"] as List<dynamic>;
    return [];
  }

  static Future<List<dynamic>> getNilai() async {
    final data = await get("/api/siswa/nilai");
    if (data is List) return data;
    if (data is Map && data["nilais"] is List) return data["nilais"] as List<dynamic>;
    if (data is Map && data["data"] is List) return data["data"] as List<dynamic>;
    return [];
  }

  static Future<List<dynamic>> getRanking() async {
    final data = await get("/api/siswa/ranking");
    if (data is Map && data["ranking"] is List) return data["ranking"] as List<dynamic>;
    if (data is List) return data;
    return [];
  }

  static Future<List<dynamic>> getJadwalPelajaran() async {
    final data = await get("/api/siswa/jadwal-pelajaran");
    if (data is Map && data["jadwal"] is List) return data["jadwal"] as List<dynamic>;
    if (data is List) return data;
    return [];
  }

  static Future<List<dynamic>> getJadwalPiket() async {
    final data = await get("/api/siswa/jadwal-piket");
    if (data is Map && data["jadwal"] is List) return data["jadwal"] as List<dynamic>;
    if (data is List) return data;
    return [];
  }

  static Future<List<dynamic>> getStrukturKelas() async {
    final data = await get("/api/siswa/struktur-kelas");
    if (data is Map && data["siswas"] is List) return data["siswas"] as List<dynamic>;
    if (data is List) return data;
    return [];
  }

  static Future<List<dynamic>> getIuran() async {
    final data = await get("/api/siswa/iuran");
    if (data is Map && data["iuran"] is List) return data["iuran"] as List<dynamic>;
    if (data is List) return data;
    return [];
  }

  // Guru — via mobile gateway (1 DB)
  static Future<List<dynamic>> getGuruMurid() async {
    final data = await get("/api/guru/murid");
    if (data is Map && data["data"] is List) return data["data"] as List<dynamic>;
    if (data is List) return data;
    return [];
  }

  static Future<List<dynamic>> getGuruUjian() async {
    final data = await get("/api/guru/ujian");
    if (data is Map && data["data"] is List) return data["data"] as List<dynamic>;
    if (data is List) return data;
    return [];
  }

  static Future<Map<String, dynamic>> getGuruDashboard() async {
    final data = await get("/api/guru/dashboard");
    return data is Map<String, dynamic> ? data : {};
  }

  // AI Tutor — RAG via backend (1 DB + Gemini)
  static Future<Map<String, dynamic>> askAiTutor(String message, {String? mapelId}) async {
    return await post("/api/ai/tutor", {"message": message, "mapelId": mapelId});
  }
}
