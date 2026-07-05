import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/models.dart';

class AuthProvider extends ChangeNotifier {
  AuthUser? _user;
  bool _isLoading = false;
  bool _isAuthenticated = false;

  AuthUser? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;

  /// Restore session from stored token
  Future<void> hydrate() async {
    final token = await ApiClient.accessToken;
    if (token != null) {
      _isAuthenticated = true;
      // Fetch fresh profile
      final res = await ApiClient.getProfile();
      if (res.isSuccess && res.data != null) {
        _user = AuthUser.fromJson(res.data as Map<String, dynamic>);
      }
      notifyListeners();
    }
  }

  Future<String?> login(String email, String password) async {
    _isLoading = true; notifyListeners();
    final res = await ApiClient.login(email, password);
    if (res.isSuccess && res.data != null) {
      final d = res.data as Map<String, dynamic>;
      await ApiClient.saveTokens(d['accessToken'] as String, d['refreshToken'] as String);
      final userData = d['user'] as Map<String, dynamic>;
      _user = AuthUser.fromJson(userData);
      _isAuthenticated = true;
      _isLoading = false; notifyListeners();
      return null;
    }
    _isLoading = false; notifyListeners();
    return res.message ?? '登录失败';
  }

  Future<String?> register(String name, String email, String password) async {
    _isLoading = true; notifyListeners();
    final res = await ApiClient.register(name, email, password);
    if (res.isSuccess && res.data != null) {
      final d = res.data as Map<String, dynamic>;
      await ApiClient.saveTokens(d['accessToken'] as String, d['refreshToken'] as String);
      final userData = d['user'] as Map<String, dynamic>;
      _user = AuthUser.fromJson(userData);
      _isAuthenticated = true;
      _isLoading = false; notifyListeners();
      return null;
    }
    _isLoading = false; notifyListeners();
    return res.message ?? '注册失败';
  }

  Future<void> logout() async {
    await ApiClient.clearTokens();
    _user = null;
    _isAuthenticated = false;
    notifyListeners();
  }
}
