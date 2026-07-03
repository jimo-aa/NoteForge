import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../providers/note_provider.dart';
import '../widgets/format_bar.dart';
import '../widgets/toast_manager.dart';

class EditorScreen extends StatefulWidget {
  final String noteId;
  const EditorScreen({super.key, required this.noteId});
  @override
  State<EditorScreen> createState() => _EditorScreenState();
}

class _EditorScreenState extends State<EditorScreen> {
  final _titleCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  final _tagCtrl = TextEditingController();
  bool _isLoading = true;
  bool _isFavorite = false;
  List<String> _tags = [];
  String? _notebookId;
  int _wordCount = 0;
  String _saveStatus = 'saved';
  Timer? _saveTimer;

  @override
  void initState() { super.initState(); _load(); }
  @override
  void dispose() { _titleCtrl.dispose(); _contentCtrl.dispose(); _tagCtrl.dispose(); _saveTimer?.cancel(); super.dispose(); }

  void _load() {
    if (widget.noteId == 'new') { setState(() => _isLoading = false); return; }
    final n = context.read<NoteProvider>().notes.where((n) => n.id == widget.noteId).firstOrNull;
    if (n != null) {
      _titleCtrl.text = n.title; _contentCtrl.text = n.content;
      _notebookId = n.notebookId; _tags = List.from(n.tags);
      _isFavorite = n.isFavorite; _wordCount = n.wordCount;
    }
    setState(() => _isLoading = false);
  }

  void _onChanged(String t) {
    _wordCount = t.replaceAll(RegExp(r'\s'), '').length;
    setState(() => _saveStatus = 'saving');
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 400), () { if (mounted) setState(() => _saveStatus = 'saved'); });
  }

  void _save() {
    setState(() => _saveStatus = 'saving');
    final np = context.read<NoteProvider>();
    if (widget.noteId == 'new') {
      np.createNote(title: _titleCtrl.text.isNotEmpty ? _titleCtrl.text : '未命名笔记',
        content: _contentCtrl.text, notebookId: _notebookId, tags: _tags, isFavorite: _isFavorite);
    } else {
      np.updateNote(widget.noteId, title: _titleCtrl.text, content: _contentCtrl.text, notebookId: _notebookId, tags: _tags, isFavorite: _isFavorite);
    }
    setState(() => _saveStatus = 'saved');
    toastKey.currentState?.show(ToastType.success, '✓');
    Future.delayed(const Duration(milliseconds: 300), () { if (mounted) Navigator.pop(context); });
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('删除笔记'), content: const Text('确定要删除吗？'),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
        TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('删除', style: TextStyle(color: Colors.red)))],
    ));
    if (ok == true && widget.noteId != 'new' && mounted) {
      context.read<NoteProvider>().deleteNote(widget.noteId);
      Navigator.pop(context);
    }
  }

  void _fmt(String a) {
    final t = _contentCtrl.text;
    final sel = _contentCtrl.selection;
    String r; int p;
    switch (a) {
      case 'bold': r = _wrap(t, sel, '**', '**'); p = sel.isValid && sel.start != sel.end ? sel.start + 2 : sel.baseOffset + 2;
      case 'italic': r = _wrap(t, sel, '*', '*'); p = sel.isValid && sel.start != sel.end ? sel.start + 1 : sel.baseOffset + 1;
      case 'strike': r = _wrap(t, sel, '~~', '~~'); p = sel.isValid && sel.start != sel.end ? sel.start + 2 : sel.baseOffset + 2;
      case 'code': r = _wrap(t, sel, '`', '`'); p = sel.isValid && sel.start != sel.end ? sel.start + 1 : sel.baseOffset + 1;
      case 'heading': r = _lineStart(t, sel, '# '); p = sel.baseOffset + 2;
      case 'list': r = _lineStart(t, sel, '- '); p = sel.baseOffset + 2;
      case 'todo': r = _lineStart(t, sel, '- [ ] '); p = sel.baseOffset + 6;
      case 'quote': r = _lineStart(t, sel, '> '); p = sel.baseOffset + 2;
      default: return;
    }
    _contentCtrl.value = TextEditingValue(text: r, selection: TextSelection.collapsed(offset: p.clamp(0, r.length)));
    _onChanged(r);
  }

  String _wrap(String t, TextSelection s, String b, String a) {
    if (!s.isValid || s.start == s.end) { final p = s.baseOffset; return '${t.substring(0, p)}$b$a${t.substring(p)}'; }
    return '${t.substring(0, s.start)}$b${t.substring(s.start, s.end)}$a${t.substring(s.end)}';
  }
  String _lineStart(String t, TextSelection s, String p) { final ls = t.lastIndexOf('\n', s.baseOffset - 1) + 1; return '${t.substring(0, ls)}$p${t.substring(ls)}'; }

  void _addTag() { final tag = _tagCtrl.text.trim(); if (tag.isNotEmpty && !_tags.contains(tag)) { setState(() => _tags.add(tag)); _tagCtrl.clear(); } }
  void _removeTag(String t) => setState(() => _tags.remove(t));

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      body: Column(children: [
        // Toolbar
        Container(padding: const EdgeInsets.fromLTRB(4, 8, 12, 8), color: context.surface,
          child: Row(children: [
            IconButton(icon: const Icon(Icons.arrow_back, size: 20), onPressed: () => Navigator.pop(context)),
            Expanded(child: Text(widget.noteId == 'new' ? '新建笔记' : (_titleCtrl.text.isNotEmpty ? _titleCtrl.text : '编辑笔记'),
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: context.textPrimary), maxLines: 1, overflow: TextOverflow.ellipsis)),
            IconButton(icon: Icon(_isFavorite ? Icons.star : Icons.star_border, size: 20, color: _isFavorite ? AppTheme.warning : context.textSecondaryColor), onPressed: () => setState(() => _isFavorite = !_isFavorite)),
            IconButton(icon: const Icon(Icons.check, size: 20), onPressed: _save),
            if (widget.noteId != 'new') IconButton(icon: Icon(Icons.delete_outline, size: 20, color: AppTheme.danger.withValues(alpha: 0.7)), onPressed: _delete),
          ])),
        // Tags
        Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6), color: context.surface,
          child: Wrap(spacing: 4, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
            ..._tags.map((t) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
              decoration: BoxDecoration(color: context.accentSubtleBg, borderRadius: BorderRadius.circular(12)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(t, style: const TextStyle(fontSize: 12, color: AppTheme.accent)),
                const SizedBox(width: 4),
                GestureDetector(onTap: () => _removeTag(t), child: const Text('×', style: TextStyle(fontSize: 14, color: AppTheme.accent))),
              ]),
            )),
            SizedBox(width: 60, height: 24, child: TextField(
              controller: _tagCtrl, decoration: const InputDecoration(hintText: '+', hintStyle: TextStyle(fontSize: 12, color: AppTheme.textMuted), border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.only(left: 4)),
              style: const TextStyle(fontSize: 12), onSubmitted: (_) => _addTag())),
          ])),
        // Content
        Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(children: [
          TextField(controller: _titleCtrl,
            decoration: InputDecoration(hintText: '笔记标题...', hintStyle: TextStyle(color: context.textMutedColor), border: InputBorder.none, contentPadding: EdgeInsets.zero),
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, height: 1.3, color: context.textPrimary),
            onChanged: (_) => _onChanged(_contentCtrl.text)),
          const SizedBox(height: 8),
          TextField(controller: _contentCtrl,
            decoration: InputDecoration(hintText: '开始写作...', hintStyle: TextStyle(color: context.textMutedColor), border: InputBorder.none, contentPadding: EdgeInsets.zero),
            style: TextStyle(fontSize: 15, height: 1.8, color: context.textPrimary),
            maxLines: null, minLines: 12, onChanged: _onChanged),
          const SizedBox(height: 80),
        ]))),
        // Status bar
        Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6), color: context.surface,
          child: Row(children: [
            Container(width: 6, height: 6,
              decoration: BoxDecoration(shape: BoxShape.circle, color: _saveStatus == 'saved' ? AppTheme.success : AppTheme.warning)),
            const SizedBox(width: 4),
            Text(_saveStatus == 'saved' ? '已保存' : '保存中...', style: TextStyle(fontSize: 11, color: context.textMutedColor)),
            const SizedBox(width: 16),
            Text('字数 $_wordCount', style: TextStyle(fontSize: 11, color: context.textMutedColor)),
            const Spacer(),
            Text('刚刚', style: TextStyle(fontSize: 11, color: context.textMutedColor)),
          ])),
      ]),
      floatingActionButton: Padding(padding: const EdgeInsets.only(bottom: 8), child: FormatBar(onFormat: _fmt)),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }
}
