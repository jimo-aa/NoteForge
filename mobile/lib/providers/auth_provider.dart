import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/api_client.dart';
import '../core/models.dart';

class AuthProvider extends ChangeNotifier {
  AuthUser? _user;
  bool _isLoading = false;
  bool _isAuthenticated = false;

  AuthUser? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;

  Future<void> hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('noteforge:auth:access-token');
    if (token != null) {
      _isAuthenticated = true;
      final userJson = prefs.getString('noteforge:auth:user');
      if (userJson != null) {
        _user = AuthUser.fromJson({'id': '', 'name': '', 'email': ''});
      }
      notifyListeners();
    }
  }

  Future<String?> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();

    final res = await ApiClient.login(email, password);
    if (res.code == 0 && res.data != null) {
      final access = res.data!['accessToken'] as String;
      final refresh = res.data!['refreshToken'] as String;
      final userData = res.data!['user'] as Map<String, dynamic>;
      await ApiClient.saveTokens(access, refresh);
      _user = AuthUser.fromJson(userData);
      _isAuthenticated = true;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('noteforge:auth:user', userData.toString());

      _isLoading = false;
      notifyListeners();
      return null;
    }
    _isLoading = false;
    notifyListeners();
    return res.message ?? 'Login failed';
  }

  Future<String?> register(String name, String email, String password) async {
    _isLoading = true;
    notifyListeners();

    final res = await ApiClient.register(name, email, password);
    if (res.code == 0 && res.data != null) {
      final access = res.data!['accessToken'] as String;
      final refresh = res.data!['refreshToken'] as String;
      final userData = res.data!['user'] as Map<String, dynamic>;
      await ApiClient.saveTokens(access, refresh);
      _user = AuthUser.fromJson(userData);
      _isAuthenticated = true;
      _isLoading = false;
      notifyListeners();
      return null;
    }
    _isLoading = false;
    notifyListeners();
    return res.message ?? 'Registration failed';
  }

  Future<void> logout() async {
    await ApiClient.clearTokens();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('noteforge:auth:user');
    _user = null;
    _isAuthenticated = false;
    notifyListeners();
  }
}
