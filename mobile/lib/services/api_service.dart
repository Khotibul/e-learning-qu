import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

class ApiService {
  static Future<Map<String, String>> _headers() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString("auth_token");
    return {
      "Content-Type": "application/json",
      if (token != null) "Authorization": "Bearer $token",
    };
  }

  static Future<dynamic> get(String path) async {
    final headers = await _headers();
    final res = await http.get(Uri.parse("${ApiConfig.baseUrl}$path"), headers: headers).timeout(const Duration(seconds: 15));
    if (res.statusCode >= 400) throw Exception("GET $path: ${res.statusCode} ${res.body}");
    return jsonDecode(res.body);
  }

  static Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final headers = await _headers();
    final res = await http.post(Uri.parse("${ApiConfig.baseUrl}$path"), headers: headers, body: jsonEncode(body)).timeout(const Duration(seconds: 15));
    if (res.statusCode >= 400) throw Exception("POST $path: ${res.statusCode} ${res.body}");
    return jsonDecode(res.body);
  }

  // Auth — pakai endpoint NextAuth yang sama (1 DB)
  static Future<Map<String, dynamic>> signIn(String email, String password, String role) async {
    // Next.js credentials: POST /api/auth/callback/credentials
    final res = await http.post(
      Uri.parse("${ApiConfig.baseUrl}/api/auth/callback/credentials"),
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: "email=${Uri.encodeComponent(email)}&password=${Uri.encodeComponent(password)}&role=$role&csrfToken=&callbackUrl=/",
    );
    if (res.statusCode != 200 && res.statusCode != 302) throw Exception("Login gagal: ${res.statusCode}");
    // Ambil session
    final session = await get("/api/auth/session");
    return session;
  }

  static Future<List<dynamic>> getUjianList() async {
    final data = await get("/api/siswa/ujian");
    // API bisa return {ujians: []} atau langsung list — handle kedua
    if (data is List) return data;
    if (data is Map && data["ujians"] is List) return data["ujians"];
    return [];
  }

  static Future<List<dynamic>> getAbsensi({String? start, String? end}) async {
    final q = "?start=${start ?? ""}&end=${end ?? ""}";
    final data = await get("/api/siswa/absensi$q");
    return data is List ? data : [];
  }
}
