import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Generic API response — mirrors backend `ApiResponse<T>`.
class ApiResponse {
  final int code;
  final dynamic data;
  final String? message;

  ApiResponse({required this.code, this.data, this.message});

  bool get isSuccess => code == 0;
}

/// REST client matching backend Spring Boot controllers.
/// Base URL defaults to API Gateway (port 8000).
class ApiClient {
  static const String _base = String.fromEnvironment('API_BASE', defaultValue: 'http://10.0.2.2:8000');
  static const _tokenKey = 'noteforge:access-token';
  static const _refreshKey = 'noteforge:refresh-token';

  // ── Token management ──

  static Future<String?> get accessToken async {
    final p = await SharedPreferences.getInstance();
    return p.getString(_tokenKey);
  }

  static Future<void> saveTokens(String access, String refresh) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_tokenKey, access);
    await p.setString(_refreshKey, refresh);
  }

  static Future<void> clearTokens() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_tokenKey);
    await p.remove(_refreshKey);
  }

  // ── Core request ──

  static Future<ApiResponse> _request(String method, String path, {Map<String, dynamic>? body, Map<String, String>? params}) async {
    final token = await accessToken;
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null) headers['Authorization'] = 'Bearer $token';

    var uri = Uri.parse('$_base$path');
    if (params != null) uri = uri.replace(queryParameters: params);

    try {
      late http.Response res;
      final encoded = body != null ? jsonEncode(body) : null;
      switch (method) {
        case 'GET':    res = await http.get(uri, headers: headers); break;
        case 'POST':   res = await http.post(uri, headers: headers, body: encoded); break;
        case 'PUT':    res = await http.put(uri, headers: headers, body: encoded); break;
        case 'DELETE': res = await http.delete(uri, headers: headers); break;
        default: return ApiResponse(code: -1, message: 'Unknown method');
      }
      final json = jsonDecode(res.body) as Map<String, dynamic>;
      return ApiResponse(code: json['code'] as int? ?? -1, data: json['data'], message: json['message']);
    } catch (e) {
      return ApiResponse(code: -1, message: 'Network error: $e');
    }
  }

  /// GET with query params
  static Future<ApiResponse> get(String path, {Map<String, String>? params}) => _request('GET', path, params: params);

  /// POST with JSON body
  static Future<ApiResponse> post(String path, {Map<String, dynamic>? body}) => _request('POST', path, body: body);

  /// PUT with JSON body
  static Future<ApiResponse> put(String path, {Map<String, dynamic>? body}) => _request('PUT', path, body: body);

  /// DELETE
  static Future<ApiResponse> delete(String path) => _request('DELETE', path);

  // ═══════════════════════════════════════════════════════════════
  // Auth API — user-service via gateway
  // ═══════════════════════════════════════════════════════════════

  static Future<ApiResponse> login(String email, String password) =>
      post('/api/v1/auth/login', body: {'email': email, 'password': password});

  static Future<ApiResponse> register(String name, String email, String password) =>
      post('/api/v1/auth/register', body: {'name': name, 'email': email, 'password': password});

  static Future<ApiResponse> getProfile() => get('/api/v1/auth/me');

  // ═══════════════════════════════════════════════════════════════
  // Notes API — note-service via gateway
  // ═══════════════════════════════════════════════════════════════

  /// List notes with optional filters. Returns paginated `data.items`.
  static Future<ApiResponse> listNotes({String? notebookId, bool? isFavorite, bool? isPinned, int page = 0, int size = 50}) {
    final p = <String, String>{'page': '$page', 'size': '$size'};
    if (notebookId != null) p['notebookId'] = notebookId;
    if (isFavorite != null) p['isFavorite'] = '$isFavorite';
    if (isPinned != null) p['isPinned'] = '$isPinned';
    return get('/api/v1/notes', params: p);
  }

  static Future<ApiResponse> getNote(String id) => get('/api/v1/notes/$id');

  static Future<ApiResponse> createNote(Map<String, dynamic> data) => post('/api/v1/notes', body: data);

  static Future<ApiResponse> updateNote(String id, Map<String, dynamic> data) => put('/api/v1/notes/$id', body: data);

  static Future<ApiResponse> deleteNote(String id) => delete('/api/v1/notes/$id');

  /// Full-text search. Returns paginated `data.items`.
  static Future<ApiResponse> searchNotes(String query, {int page = 0, int size = 20}) =>
      get('/api/v1/notes/search', params: {'q': query, 'page': '$page', 'size': '$size'});

  // ═══════════════════════════════════════════════════════════════
  // Notebooks API
  // ═══════════════════════════════════════════════════════════════

  static Future<ApiResponse> listNotebooks() => get('/api/v1/notebooks');

  static Future<ApiResponse> createNotebook(String name, {String? icon, String? color}) {
    final p = <String, String>{'name': name};
    if (icon != null) p['icon'] = icon;
    if (color != null) p['color'] = color;
    return _request('POST', '/api/v1/notebooks', params: p);
  }

  static Future<ApiResponse> deleteNotebook(String id) => delete('/api/v1/notebooks/$id');

  // ═══════════════════════════════════════════════════════════════
  // Tags API
  // ═══════════════════════════════════════════════════════════════

  static Future<ApiResponse> listTags() => get('/api/v1/tags');

  // ═══════════════════════════════════════════════════════════════
  // Search API (global)
  // ═══════════════════════════════════════════════════════════════

  static Future<ApiResponse> globalSearch(String query, {String mode = 'fulltext', String? tag, int page = 0, int size = 20}) {
    final p = <String, String>{'q': query, 'mode': mode, 'page': '$page', 'size': '$size'};
    if (tag != null) p['tag'] = tag;
    return get('/api/v1/search', params: p);
  }
}
