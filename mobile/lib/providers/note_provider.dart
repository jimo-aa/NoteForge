import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/models.dart';

class NoteProvider extends ChangeNotifier {
  List<NoteItem> _notes = [];
  List<Notebook> _notebooks = [];
  List<Tag> _tags = [];
  bool _isLoading = false;
  String _filter = 'all';
  bool _showFavorites = false;

  List<NoteItem> get notes => _notes;
  List<Notebook> get notebooks => _notebooks;
  List<Tag> get tags => _tags;
  bool get isLoading => _isLoading;
  bool get showFavorites => _showFavorites;
  String get filter => _filter;
  List<NoteItem> get filteredNotes {
    var result = _showFavorites ? _notes.where((n) => n.isFavorite).toList() : _notes;
    if (_filter != 'all') result = result.where((n) => n.notebookId == _filter).toList();
    result.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return result;
  }

  void setFilter(String filter) {
    _filter = filter;
    notifyListeners();
  }

  void toggleFavorites() {
    _showFavorites = !_showFavorites;
    _filter = 'all';
    notifyListeners();
  }

  Future<void> loadData() async {
    _isLoading = true;
    notifyListeners();

    final notesRes = await ApiClient.listNotes();
    if (notesRes.code == 0 && notesRes.data != null) {
      final list = notesRes.data!['notes'] as List<dynamic>? ?? notesRes.data!.values.first as List<dynamic>? ?? [];
      _notes = list.map((e) => NoteItem.fromJson(e as Map<String, dynamic>)).toList();
    }

    final nbRes = await ApiClient.listNotebooks();
    if (nbRes.code == 0 && nbRes.data != null) {
      final list = nbRes.data!['notebooks'] as List<dynamic>? ?? nbRes.data!.values.first as List<dynamic>? ?? [];
      _notebooks = list.map((e) => Notebook.fromJson(e as Map<String, dynamic>)).toList();
    }

    final tagRes = await ApiClient.listTags();
    if (tagRes.code == 0 && tagRes.data != null) {
      final list = tagRes.data!['tags'] as List<dynamic>? ?? tagRes.data!.values.first as List<dynamic>? ?? [];
      _tags = list.map((e) => Tag.fromJson(e as Map<String, dynamic>)).toList();
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> deleteNote(String id) async {
    await ApiClient.deleteNote(id);
    _notes.removeWhere((n) => n.id == id);
    notifyListeners();
  }

  Future<void> createNotebook(String name) async {
    await ApiClient.createNotebook({'name': name});
    await loadData();
  }

  Future<void> deleteNotebook(String id) async {
    await ApiClient.deleteNotebook(id);
    await loadData();
  }
}
