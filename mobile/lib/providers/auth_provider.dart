import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  User? _user;
  bool _loading = true;
  User? get user => _user;
  Role? get role => _user?.role;
  bool get isLoggedIn => _user != null;
  bool get loading => _loading;

  AuthProvider() { _load(); }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString("auth_user");
    if (raw != null) {
      try {
        final Map<String, dynamic> j = jsonDecode(raw) as Map<String, dynamic>;
        _user = User.fromJson(j);
      } catch (_) {}
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> signIn(String email, String password, Role role) async {
    final session = await ApiService.signIn(email, password, roleToString(role));
    final u = session["user"];
    if (u == null) throw Exception("Session kosong");
    // Gabungkan extra (jabatan/kelas/guruId/siswaId) agar gating fitur sama dengan website.
    final merged = Map<String, dynamic>.from(u as Map);
    final extra = session["extra"];
    if (extra is Map) {
      for (final key in ["jabatan", "kelas", "guruId", "siswaId"]) {
        final v = extra[key];
        if (v != null) merged[key] = v;
      }
    }
    _user = User.fromJson(merged);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString("auth_user", jsonEncode(merged));
    notifyListeners();
  }

  Future<void> signInWithGoogleUser(Map<String, dynamic> userJson, {Map<String, dynamic>? extra}) async {
    final merged = Map<String, dynamic>.from(userJson);
    if (extra != null) {
      for (final key in ["jabatan", "kelas", "guruId", "siswaId"]) {
        final v = extra[key];
        if (v != null) merged[key] = v;
      }
    }
    _user = User.fromJson(merged);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString("auth_user", jsonEncode(merged));
    notifyListeners();
  }

  Future<void> signOut() async {
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove("auth_user");
    await prefs.remove("auth_token");
    notifyListeners();
  }

  void refreshName(String name) {
    if (_user == null) return;
    _user = User(
      id: _user!.id, email: _user!.email, name: name, image: _user!.image, role: _user!.role,
      jabatan: _user!.jabatan, kelas: _user!.kelas, guruId: _user!.guruId, siswaId: _user!.siswaId,
    );
    SharedPreferences.getInstance().then((prefs) => prefs.setString("auth_user", jsonEncode(_user!.toJson())));
    notifyListeners();
  }
}
