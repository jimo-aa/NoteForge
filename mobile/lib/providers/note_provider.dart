import 'package:flutter/foundation.dart';
import '../core/models.dart';

int _ago(int m) => DateTime.now().millisecondsSinceEpoch - m * 60000;

class NoteProvider extends ChangeNotifier {
  List<NoteItem> _notes = [];
  List<Notebook> _notebooks = [];
  List<Tag> _tags = [];
  bool _isLoading = false;
  String _filter = 'all';
  bool _showFavorites = false;
  int _nextId = 100;

  List<NoteItem> get notes => _notes;
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

  Future<void> loadData() async {
    _isLoading = true; notifyListeners();
    await Future.delayed(const Duration(milliseconds: 200));
    if (_notes.isEmpty && _notebooks.isEmpty) _initMock();
    _isLoading = false; notifyListeners();
  }

  void _initMock() {
    _notebooks = [
      Notebook(id: 'nb-1', name: '默认笔记本', icon: '📓', color: '#f59e0b', noteCount: 3),
      Notebook(id: 'nb-2', name: '技术笔记', icon: '💻', color: '#6366f1', noteCount: 3),
      Notebook(id: 'nb-3', name: '项目文档', icon: '🗂️', color: '#8b5cf6', noteCount: 2),
      Notebook(id: 'nb-4', name: '个人日记', icon: '📖', color: '#ec4899', noteCount: 1),
    ];
    _tags = [
      Tag(id: 'tag-1', name: '架构', color: '#6366f1', noteCount: 2),
      Tag(id: 'tag-2', name: 'Rust', color: '#ef4444', noteCount: 2),
    ];
    _notes = [
      NoteItem(id: 'note-1', notebookId: 'nb-2', title: 'NoteForge 架构设计',
        content: '# NoteForge 架构设计\n\n## 系统概览\nNoteForge 采用 **离线优先** 架构。',
        contentPlain: '系统概览 — NoteForge 采用离线优先架构，核心由 Rust 引擎驱动…',
        tags: ['架构', 'Rust'], isPinned: true, wordCount: 86, version: 3, createdAt: _ago(1440), updatedAt: _ago(5)),
      NoteItem(id: 'note-2', notebookId: 'nb-2', title: 'Rust 内存安全入门',
        content: '## 所有权系统\n\n所有权是 Rust 最独特的特性。',
        contentPlain: '所有权系统是 Rust 最独特的特性，编译期保证内存安全…',
        tags: ['Rust'], isFavorite: true, wordCount: 42, version: 2, createdAt: _ago(2880), updatedAt: _ago(60)),
      NoteItem(id: 'note-3', notebookId: 'nb-2', title: 'Tauri vs Electron 对比分析',
        content: 'Tauri 仅需 WebView + Rust 二进制，通常小于 5MB。',
        contentPlain: '安装包体积对比：Tauri 仅需系统 WebView + Rust 二进制…',
        tags: ['Tauri'], wordCount: 35, version: 1, createdAt: _ago(4320), updatedAt: _ago(180)),
      NoteItem(id: 'note-4', notebookId: 'nb-3', title: 'CRDT 同步协议设计',
        content: 'CRDT 是一种无需中心化协调即可合并的数据结构。',
        contentPlain: 'CRDT 是一种无需中心化协调即可合并的数据结构…',
        tags: ['架构'], isFavorite: true, wordCount: 28, version: 5, createdAt: _ago(5760), updatedAt: _ago(1440)),
      NoteItem(id: 'note-5', notebookId: 'nb-1', title: '2026 Q3 学习计划',
        content: '- [ ] 深入 Rust 异步编程\n- [ ] 学习 Tauri 插件开发',
        contentPlain: '- [ ] 深入 Rust 异步编程\n- [ ] 学习 Tauri 插件开发…',
        tags: ['计划'], wordCount: 18, version: 1, createdAt: _ago(10080), updatedAt: _ago(2880)),
      NoteItem(id: 'note-6', notebookId: 'nb-1', title: 'AI Prompt 工程最佳实践',
        content: '结构化 Prompt — 写清晰明确的指令。',
        contentPlain: '结构化 Prompt — 写清晰明确的指令，给模型足够的上下文…',
        tags: ['AI'], isFavorite: true, wordCount: 22, version: 2, createdAt: _ago(20160), updatedAt: _ago(7200)),
      NoteItem(id: 'note-7', notebookId: 'nb-3', title: 'Q2 项目复盘报告', content: 'Q2 复盘 — 架构设计、三端对齐。',
        contentPlain: 'Q2 项目复盘 — 架构设计、三端对齐、性能优化…',
        tags: [], isPinned: true, wordCount: 35, version: 1, createdAt: _ago(30240), updatedAt: _ago(4320)),
      NoteItem(id: 'note-8', notebookId: 'nb-4', title: '今天的心情', content: '今天天气不错，项目进展顺利。',
        contentPlain: '今天天气不错，项目进展顺利。完成了移动端的 UI 重构。',
        tags: [], wordCount: 15, version: 1, createdAt: _ago(720), updatedAt: _ago(720)),
    ];
  }

  NoteItem createNote({required String title, String content = '', String? notebookId, List<String> tags = const [], bool isPinned = false, bool isFavorite = false}) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final n = NoteItem(id: 'note-${_nextId++}', title: title, content: content,
      contentPlain: content.replaceAll(RegExp(r'[#*\[\]()`>_-]'), '').trim(),
      notebookId: notebookId, tags: tags, isPinned: isPinned, isFavorite: isFavorite,
      wordCount: content.replaceAll(RegExp(r'\s'), '').length, version: 1, createdAt: now, updatedAt: now);
    _notes.add(n); _updateNb(); notifyListeners(); return n;
  }

  void updateNote(String id, {String? title, String? content, String? notebookId, List<String>? tags, bool? isPinned, bool? isFavorite}) {
    final i = _notes.indexWhere((n) => n.id == id);
    if (i == -1) return;
    final o = _notes[i]; final nc = content ?? o.content;
    _notes[i] = NoteItem(id: o.id, userId: o.userId, notebookId: notebookId ?? o.notebookId,
      title: title ?? o.title, content: nc, contentPlain: nc.replaceAll(RegExp(r'[#*\[\]()`>_-]'), '').trim(),
      tags: tags ?? o.tags, isPinned: isPinned ?? o.isPinned, isFavorite: isFavorite ?? o.isFavorite,
      wordCount: nc.replaceAll(RegExp(r'\s'), '').length, version: o.version + 1, createdAt: o.createdAt, updatedAt: DateTime.now().millisecondsSinceEpoch);
    notifyListeners();
  }

  void deleteNote(String id) { _notes.removeWhere((n) => n.id == id); _updateNb(); notifyListeners(); }

  void createNotebook(String name, {String icon = '📓', String color = '#6366f1'}) {
    _notebooks.add(Notebook(id: 'nb-${_nextId++}', name: name, icon: icon, color: color, noteCount: 0));
    notifyListeners();
  }

  void deleteNotebook(String id) { _notebooks.removeWhere((nb) => nb.id == id); _notes.removeWhere((n) => n.notebookId == id); _updateNb(); notifyListeners(); }

  List<NoteItem> searchNotes(String q) {
    if (q.isEmpty) return [];
    final lq = q.toLowerCase();
    return _notes.where((n) => n.title.toLowerCase().contains(lq) || n.content.toLowerCase().contains(lq) || n.tags.any((t) => t.toLowerCase().contains(lq))).toList();
  }

  void _updateNb() {
    for (int i = 0; i < _notebooks.length; i++) {
      final nb = _notebooks[i];
      _notebooks[i] = Notebook(id: nb.id, name: nb.name, icon: nb.icon, color: nb.color, noteCount: _notes.where((n) => n.notebookId == nb.id).length);
    }
  }
}
