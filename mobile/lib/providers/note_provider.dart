import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/models.dart';

/// Parses backend `ApiResponse<PageResponse<T>>` data into a list.
List<T> _parseItems<T>(dynamic data, T Function(Map<String, dynamic>) fromJson) {
  if (data == null) return [];
  // Paginated: {items: [...], page, size, total}
  if (data is Map && data.containsKey('items')) {
    return (data['items'] as List<dynamic>?)?.map((e) => fromJson(e as Map<String, dynamic>)).toList() ?? [];
  }
  // Flat list: [...]
  if (data is List) {
    return data.map((e) => fromJson(e as Map<String, dynamic>)).toList();
  }
  // Single object — wrap it
  return [fromJson(data as Map<String, dynamic>)];
}

class NoteProvider extends ChangeNotifier {
  List<NoteItem> _notes = [];
  List<Notebook> _notebooks = [];
  List<Tag> _tags = [];
  bool _isLoading = false;
  String? _error;
  String _filter = 'all';
  bool _showFavorites = false;

  List<NoteItem> get notes => _notes;
  String? get error => _error;
  List<Notebook> get notebooks => _notebooks;
  List<Tag> get tags => _tags;
  bool get isLoading => _isLoading;
  bool get showFavorites => _showFavorites;
  String get filter => _filter;
  int get totalNoteCount => _notes.length;
  int get favoriteCount => _notes.where((n) => n.isFavorite).length;

  List<NoteItem> get filteredNotes {
    var r = _showFavorites ? _notes.where((n) => n.isFavorite).toList() : _notes;
    if (_filter != 'all') r = r.where((n) => n.notebookId == _filter).toList();
    r.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return r;
  }

  void setFilter(String f) { _filter = f; notifyListeners(); }
  void toggleFavorites() { _showFavorites = !_showFavorites; if (_showFavorites) _filter = 'all'; notifyListeners(); }

  /// Full data load from backend
  Future<void> loadData() async {
    _isLoading = true; notifyListeners();

    _error = null;
    try {
      final results = await Future.wait([
        ApiClient.listNotes(size: 200),
        ApiClient.listNotebooks(),
        ApiClient.listTags(),
      ]);

      if (results[0].isSuccess) {
        _notes = _parseItems(results[0].data, NoteItem.fromJson);
      } else {
        _error = results[0].message ?? '笔记加载失败';
      }
      if (results[1].isSuccess) {
        _notebooks = _parseItems(results[1].data, Notebook.fromJson);
      }
      if (results[2].isSuccess) {
        _tags = _parseItems(results[2].data, Tag.fromJson);
      }
    } catch (e) {
      _error = '网络连接失败: $e';
    }
    _isLoading = false; notifyListeners();
  }

  // ── CRUD ──

  Future<NoteItem?> createNote({required String title, String content = '', String? notebookId, List<String> tags = const [], bool isPinned = false, bool isFavorite = false}) async {
    final res = await ApiClient.createNote({
      'title': title, 'content': content, 'notebookId': notebookId, 'tags': tags,
    });
    if (res.isSuccess && res.data != null) {
      final note = NoteItem.fromJson(res.data as Map<String, dynamic>);
      _notes.add(note); notifyListeners();
      return note;
    }
    return null;
  }

  Future<NoteItem?> updateNote(String id, {String? title, String? content, String? notebookId, List<String>? tags, bool? isPinned, bool? isFavorite}) async {
    final body = <String, dynamic>{};
    if (title != null) body['title'] = title;
    if (content != null) body['content'] = content;
    if (notebookId != null) body['notebookId'] = notebookId;
    if (tags != null) body['tags'] = tags;
    if (isPinned != null) body['isPinned'] = isPinned;
    if (isFavorite != null) body['isFavorite'] = isFavorite;

    final res = await ApiClient.updateNote(id, body);
    if (res.isSuccess && res.data != null) {
      final note = NoteItem.fromJson(res.data as Map<String, dynamic>);
      final i = _notes.indexWhere((n) => n.id == id);
      if (i != -1) _notes[i] = note;
      notifyListeners();
      return note;
    }
    return null;
  }

  Future<bool> deleteNote(String id) async {
    final res = await ApiClient.deleteNote(id);
    if (res.isSuccess) {
      _notes.removeWhere((n) => n.id == id);
      notifyListeners();
      return true;
    }
    return false;
  }

  Future<bool> createNotebook(String name, {String icon = '📓', String color = '#6366f1'}) async {
    final res = await ApiClient.createNotebook(name, icon: icon, color: color);
    if (res.isSuccess && res.data != null) {
      _notebooks.add(Notebook.fromJson(res.data as Map<String, dynamic>));
      notifyListeners();
      return true;
    }
    return false;
  }

  Future<bool> deleteNotebook(String id) async {
    final res = await ApiClient.deleteNotebook(id);
    if (res.isSuccess) {
      _notebooks.removeWhere((nb) => nb.id == id);
      _notes.removeWhere((n) => n.notebookId == id);
      notifyListeners();
      return true;
    }
    return false;
  }

  /// Local full-text search across loaded notes
  List<NoteItem> searchNotes(String q) {
    if (q.isEmpty) return [];
    final lq = q.toLowerCase();
    return _notes.where((n) =>
      n.title.toLowerCase().contains(lq) ||
      n.content.toLowerCase().contains(lq) ||
      n.tags.any((t) => t.toLowerCase().contains(lq))
    ).toList();
  }
}
