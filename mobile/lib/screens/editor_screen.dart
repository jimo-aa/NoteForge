import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_icons.dart';
import '../core/theme.dart';
import '../l10n/locale_provider.dart';
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
  bool _isPinned = false;
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
      _isFavorite = n.isFavorite; _isPinned = n.isPinned; _wordCount = n.wordCount;
    }
    setState(() => _isLoading = false);
  }

  void _onChanged(String t) {
    _wordCount = t.replaceAll(RegExp(r'\s'), '').length;
    setState(() => _saveStatus = 'saving');
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 400), () { if (mounted) setState(() => _saveStatus = 'saved'); });
  }

  Future<void> _save() async {
    setState(() => _saveStatus = 'saving');
    final np = context.read<NoteProvider>();
    final l10n = context.read<LocaleProvider>();
    bool ok;
    if (widget.noteId == 'new') {
      ok = (await np.createNote(title: _titleCtrl.text.isNotEmpty ? _titleCtrl.text : l10n.tr('editor.untitled'),
        content: _contentCtrl.text, notebookId: _notebookId, tags: _tags, isPinned: _isPinned, isFavorite: _isFavorite)) != null;
    } else {
      ok = (await np.updateNote(widget.noteId, title: _titleCtrl.text, content: _contentCtrl.text, notebookId: _notebookId, tags: _tags, isPinned: _isPinned, isFavorite: _isFavorite)) != null;
    }
    if (!mounted) return;
    setState(() => _saveStatus = ok ? 'saved' : 'unsaved');
    if (ok) {
      toastKey.currentState?.show(ToastType.success, '✓');
      Future.delayed(const Duration(milliseconds: 300), () { if (mounted) Navigator.pop(context); });
    }
  }

  Future<void> _delete() async {
    final l10n = context.read<LocaleProvider>();
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: Text(l10n.tr('editor.deleteTitle')), content: Text(l10n.tr('editor.deleteConfirm')),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: Text(l10n.tr('editor.cancel'))),
        TextButton(onPressed: () => Navigator.pop(context, true), child: Text(l10n.tr('editor.delete'), style: const TextStyle(color: Colors.red)))],
    ));
    if (ok == true && widget.noteId != 'new' && mounted) {
      await context.read<NoteProvider>().deleteNote(widget.noteId);
      if (mounted) Navigator.pop(context);
    }
  }

  void _fmt(String a) {
    final t = _contentCtrl.text; final sel = _contentCtrl.selection;
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

  Widget _notebookSelector(BuildContext ctx, LocaleProvider l10n) {
    final np = ctx.watch<NoteProvider>();
    final nb = _notebookId != null ? np.notebooks.where((n) => n.id == _notebookId).firstOrNull : null;
    return GestureDetector(
      onTap: () async {
        final result = await showModalBottomSheet<String>(
          context: ctx, backgroundColor: ctx.surface,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXl))),
          builder: (_) => Column(mainAxisSize: MainAxisSize.min, children: [
            Padding(padding: const EdgeInsets.all(16), child: Text('移动到笔记本', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: ctx.textPrimary))),
            ListTile(title: Text('无', style: TextStyle(color: ctx.textPrimary)), onTap: () => Navigator.pop(ctx, null)),
            ...np.notebooks.map((nb) => ListTile(
              leading: Text(nb.icon, style: const TextStyle(fontSize: 18)),
              title: Text(nb.name, style: TextStyle(color: ctx.textPrimary)),
              trailing: nb.id == _notebookId ? const Icon(Icons.check, size: 18, color: AppTheme.accent) : null,
              onTap: () => Navigator.pop(ctx, nb.id),
            )),
          ]),
        );
        if (result != null) setState(() => _notebookId = result);
      },
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(nb != null ? '${nb.icon} ${nb.name}' : l10n.tr('editor.none'), style: TextStyle(fontSize: 13, color: context.textSecondaryColor)),
        const SizedBox(width: 4),
        Icon(AppIcons.chevronRight, size: 14, color: context.textMutedColor),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.watch<LocaleProvider>();
    if (_isLoading) return const Scaffold(resizeToAvoidBottomInset: false, body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: Column(children: [
        Container(padding: const EdgeInsets.fromLTRB(4, 8, 12, 8), color: context.surface,
          child: Row(children: [
            IconButton(icon: const Icon(AppIcons.back, size: 20), onPressed: () => Navigator.pop(context)),
            Expanded(child: Text(widget.noteId == 'new' ? l10n.tr('editor.newNote') : (_titleCtrl.text.isNotEmpty ? _titleCtrl.text : l10n.tr('editor.editNote')),
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: context.textPrimary), maxLines: 1, overflow: TextOverflow.ellipsis)),
            IconButton(icon: Icon(AppIcons.pin, size: 20, color: _isPinned ? AppTheme.warning : context.textSecondaryColor), onPressed: () => setState(() => _isPinned = !_isPinned)),
            IconButton(icon: Icon(_isFavorite ? AppIcons.favorite : AppIcons.favoriteBorder, size: 20, color: _isFavorite ? AppTheme.warning : context.textSecondaryColor), onPressed: () => setState(() => _isFavorite = !_isFavorite)),
            IconButton(icon: const Icon(AppIcons.save, size: 20), onPressed: _save),
            if (widget.noteId != 'new') IconButton(icon: Icon(AppIcons.delete, size: 20, color: AppTheme.danger.withValues(alpha: 0.7)), onPressed: _delete),
          ])),
        Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6), color: context.surface,
          child: Wrap(spacing: 4, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
            ..._tags.map((t) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
              decoration: BoxDecoration(color: context.accentSubtleBg, borderRadius: BorderRadius.circular(12)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(t, style: const TextStyle(fontSize: 12, color: AppTheme.accent)),
                const SizedBox(width: 4),
                GestureDetector(onTap: () => _removeTag(t), child: const Icon(AppIcons.close, size: 14, color: AppTheme.accent)),
              ]),
            )),
            SizedBox(width: 60, height: 24, child: TextField(
              controller: _tagCtrl, decoration: const InputDecoration(hintText: '+', hintStyle: TextStyle(fontSize: 12, color: AppTheme.textMuted), border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.only(left: 4)),
              style: const TextStyle(fontSize: 12), onSubmitted: (_) => _addTag())),
          ])),
        // Properties: notebook + pin status
        Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6), color: context.surface,
          child: Row(children: [
            Icon(AppIcons.folder, size: 16, color: context.textMutedColor),
            const SizedBox(width: 6),
            Expanded(child: _notebookSelector(context, l10n)),
            if (_isPinned) ...[
              const SizedBox(width: 8),
              Icon(AppIcons.pin, size: 14, color: AppTheme.warning),
              const SizedBox(width: 4),
              Text('已置顶', style: TextStyle(fontSize: 11, color: AppTheme.warning)),
            ],
          ])),
        Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(children: [
          TextField(controller: _titleCtrl,
            decoration: InputDecoration(hintText: l10n.tr('editor.titleHint'), hintStyle: TextStyle(color: context.textMutedColor), border: InputBorder.none, contentPadding: EdgeInsets.zero),
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, height: 1.3, color: context.textPrimary),
            onChanged: (_) => _onChanged(_contentCtrl.text)),
          const SizedBox(height: 8),
          TextField(controller: _contentCtrl,
            decoration: InputDecoration(hintText: l10n.tr('editor.contentHint'), hintStyle: TextStyle(color: context.textMutedColor), border: InputBorder.none, contentPadding: EdgeInsets.zero),
            style: TextStyle(fontSize: 15, height: 1.8, color: context.textPrimary),
            maxLines: null, minLines: 12, onChanged: _onChanged),
          const SizedBox(height: 80),
        ]))),
        Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6), color: context.surface,
          child: Row(children: [
            Container(width: 6, height: 6,
              decoration: BoxDecoration(shape: BoxShape.circle, color: _saveStatus == 'saved' ? AppTheme.success : AppTheme.warning)),
            const SizedBox(width: 4),
            Text(_saveStatus == 'saved' ? l10n.tr('editor.saved') : l10n.tr('editor.saving'), style: TextStyle(fontSize: 11, color: context.textMutedColor)),
            const SizedBox(width: 16),
            Text(l10n.tr('editor.wordCountLabel', args: {'count': '$_wordCount'}), style: TextStyle(fontSize: 11, color: context.textMutedColor)),
            const Spacer(),
            Text(l10n.tr('editor.justNow'), style: TextStyle(fontSize: 11, color: context.textMutedColor)),
          ])),
      ]),
      floatingActionButton: Padding(padding: const EdgeInsets.only(bottom: 8), child: FormatBar(onFormat: _fmt)),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }
}
