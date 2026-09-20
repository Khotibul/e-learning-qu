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
    _user = User.fromJson(Map<String, dynamic>.from(u as Map));
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString("auth_user", jsonEncode(u));
    notifyListeners();
  }

  Future<void> signInWithGoogleUser(Map<String, dynamic> userJson) async {
    _user = User.fromJson(Map<String, dynamic>.from(userJson));
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString("auth_user", jsonEncode(userJson));
    notifyListeners();
  }

  Future<void> signOut() async {
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove("auth_user");
    await prefs.remove("auth_token");
    notifyListeners();
  }
}
