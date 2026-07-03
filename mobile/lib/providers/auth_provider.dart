import 'package:flutter/foundation.dart';
import '../core/models.dart';

class AuthProvider extends ChangeNotifier {
  AuthUser? _user;
  bool _isLoading = false;
  bool _isAuthenticated = false;

  AuthUser? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;

  Future<void> hydrate() async {
    _user = AuthUser(id: 'mock-user-001', username: 'Forge User', email: 'user@noteforge.app');
    _isAuthenticated = true;
    notifyListeners();
  }

  Future<String?> login(String email, String password) async {
    _isLoading = true; notifyListeners();
    await Future.delayed(const Duration(milliseconds: 300));
    _user = AuthUser(id: 'mock-user-001', username: email.split('@').first, email: email);
    _isAuthenticated = true; _isLoading = false; notifyListeners();
    return null;
  }

  Future<String?> register(String name, String email, String password) async {
    _isLoading = true; notifyListeners();
    await Future.delayed(const Duration(milliseconds: 300));
    _user = AuthUser(id: 'mock-user-001', username: name, email: email);
    _isAuthenticated = true; _isLoading = false; notifyListeners();
    return null;
  }

  Future<void> logout() async {
    _user = null; _isAuthenticated = false; notifyListeners();
  }
}
