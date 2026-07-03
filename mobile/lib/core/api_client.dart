import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiResponse<T> {
  final int code;
  final T? data;
  final String? message;

  ApiResponse({required this.code, this.data, this.message});
}

class ApiClient {
  static const String _baseUrl = String.fromEnvironment('API_BASE', defaultValue: 'http://10.0.2.2:8000');
  static const String _tokenKey = 'noteforge:auth:access-token';
  static const String _refreshKey = 'noteforge:auth:refresh-token';

  static Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  static Future<void> saveTokens(String access, String refresh) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, access);
    await prefs.setString(_refreshKey, refresh);
  }

  static Future<void> clearTokens() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_refreshKey);
  }

  static Future<ApiResponse<Map<String, dynamic>>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final token = await _getToken();
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (token != null) headers['Authorization'] = 'Bearer $token';

    final uri = Uri.parse('$_baseUrl$path');
    late http.Response response;

    try {
      switch (method) {
        case 'GET':
          response = await http.get(uri, headers: headers);
          break;
        case 'POST':
          response = await http.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
          break;
        case 'PUT':
          response = await http.put(uri, headers: headers, body: body != null ? jsonEncode(body) : null);
          break;
        case 'DELETE':
          response = await http.delete(uri, headers: headers);
          break;
        default:
          return ApiResponse(code: -1, message: 'Unknown method');
      }

      final json = jsonDecode(response.body) as Map<String, dynamic>;
      return ApiResponse(
        code: json['code'] as int? ?? -1,
        data: json['data'] as Map<String, dynamic>?,
        message: json['message'] as String?,
      );
    } catch (e) {
      return ApiResponse(code: -1, message: 'Network error: $e');
    }
  }

  // ── Auth ──

  static Future<ApiResponse<Map<String, dynamic>>> login(String email, String password) =>
      request('POST', '/api/v1/auth/login', body: {'email': email, 'password': password});

  static Future<ApiResponse<Map<String, dynamic>>> register(String name, String email, String password) =>
      request('POST', '/api/v1/auth/register', body: {'name': name, 'email': email, 'password': password});

  // ── Notes ──

  static Future<ApiResponse<Map<String, dynamic>>> listNotes() => request('GET', '/api/v1/notes');

  static Future<ApiResponse<Map<String, dynamic>>> getNote(String id) => request('GET', '/api/v1/notes/$id');

  static Future<ApiResponse<Map<String, dynamic>>> createNote(Map<String, dynamic> data) =>
      request('POST', '/api/v1/notes', body: data);

  static Future<ApiResponse<Map<String, dynamic>>> updateNote(String id, Map<String, dynamic> data) =>
      request('PUT', '/api/v1/notes/$id', body: data);

  static Future<ApiResponse<Map<String, dynamic>>> deleteNote(String id) =>
      request('DELETE', '/api/v1/notes/$id');

  // ── Notebooks ──

  static Future<ApiResponse<Map<String, dynamic>>> listNotebooks() => request('GET', '/api/v1/notebooks');

  static Future<ApiResponse<Map<String, dynamic>>> createNotebook(Map<String, dynamic> data) =>
      request('POST', '/api/v1/notebooks', body: data);

  static Future<ApiResponse<Map<String, dynamic>>> deleteNotebook(String id) =>
      request('DELETE', '/api/v1/notebooks/$id');

  // ── Tags ──

  static Future<ApiResponse<Map<String, dynamic>>> listTags() => request('GET', '/api/v1/tags');
}
