import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/api_client.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../providers/note_provider.dart';

class NoteEditorScreen extends StatefulWidget {
  final String noteId;
  const NoteEditorScreen({super.key, required this.noteId});

  @override
  State<NoteEditorScreen> createState() => _NoteEditorScreenState();
}

class _NoteEditorScreenState extends State<NoteEditorScreen> {
  final _titleCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  bool _isLoading = true;
  bool _isSaving = false;
  bool _showProps = false;
  String? _currentNotebookId;
  List<String> _tags = [];
  final _tagCtrl = TextEditingController();
  bool _isPinned = false;
  bool _isFavorite = false;

  @override
  void initState() {
    super.initState();
    _loadNote();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    _tagCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadNote() async {
    if (widget.noteId == 'new') {
      setState(() => _isLoading = false);
      return;
    }
    final res = await ApiClient.getNote(widget.noteId);
    if (res.code == 0 && res.data != null) {
      final note = NoteItem.fromJson(res.data!);
      _titleCtrl.text = note.title;
      _contentCtrl.text = note.content;
      _currentNotebookId = note.notebookId;
      _tags = note.tags;
      _isPinned = note.isPinned;
      _isFavorite = note.isFavorite;
    }
    setState(() => _isLoading = false);
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);
    final data = {
      'title': _titleCtrl.text,
      'content': _contentCtrl.text,
      'notebookId': _currentNotebookId,
      'tags': _tags,
      'isPinned': _isPinned,
      'isFavorite': _isFavorite,
    };

    if (widget.noteId == 'new') {
      await ApiClient.createNote(data);
    } else {
      await ApiClient.updateNote(widget.noteId, data);
    }
    if (mounted) {
      context.read<NoteProvider>().loadData();
      setState(() => _isSaving = false);
      Navigator.pop(context);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Note'),
        content: const Text('Are you sure?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirmed == true && widget.noteId != 'new') {
      await ApiClient.deleteNote(widget.noteId);
      if (mounted) {
        context.read<NoteProvider>().loadData();
        Navigator.pop(context);
      }
    }
  }

  void _addTag() {
    final tag = _tagCtrl.text.trim();
    if (tag.isEmpty || _tags.contains(tag)) return;
    setState(() => _tags.add(tag));
    _tagCtrl.clear();
  }

  void _removeTag(String tag) => setState(() => _tags.remove(tag));

  @override
  Widget build(BuildContext context) {
    final noteProv = context.watch<NoteProvider>();

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.noteId == 'new' ? 'New Note' : 'Edit Note'),
        actions: [
          if (widget.noteId != 'new')
            IconButton(icon: Icon(Icons.delete_outline, color: Colors.red[400]), onPressed: _delete),
          IconButton(
            icon: _isSaving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check),
            onPressed: _isSaving ? null : _save,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(children: [
                TextField(
                  controller: _titleCtrl,
                  decoration: const InputDecoration(labelText: 'Title', border: InputBorder.none),
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                // Tags
                Wrap(spacing: 6, runSpacing: 4, children: [
                  ..._tags.map((t) => Chip(
                        label: Text('#$t', style: const TextStyle(fontSize: 12)),
                        deleteIcon: const Icon(Icons.close, size: 14),
                        onDeleted: () => _removeTag(t),
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        visualDensity: VisualDensity.compact,
                      )),
                  SizedBox(
                    width: 100,
                    child: TextField(
                      controller: _tagCtrl,
                      decoration: const InputDecoration(labelText: 'Tag', border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.symmetric(vertical: 8, horizontal: 4)),
                      style: const TextStyle(fontSize: 12),
                      onSubmitted: (_) => _addTag(),
                    ),
                  ),
                ]),
                const SizedBox(height: 8),
                // Properties toggle
                Row(children: [
                  FilterChip(label: const Text('📌 Pin'), selected: _isPinned, onSelected: (v) => setState(() => _isPinned = v)),
                  const SizedBox(width: 8),
                  FilterChip(label: const Text('⭐ Favorite'), selected: _isFavorite, onSelected: (v) => setState(() => _isFavorite = v)),
                  const Spacer(),
                  TextButton.icon(
                    icon: const Icon(Icons.info_outline, size: 16),
                    label: const Text('Details'),
                    onPressed: () => setState(() => _showProps = !_showProps),
                  ),
                ]),
                if (_showProps) Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(color: AppTheme.surface2, borderRadius: BorderRadius.circular(8)),
                  child: Column(children: [
                    _propRow('Notebook', DropdownButton<String?>(
                      value: _currentNotebookId,
                      items: [const DropdownMenuItem(value: null, child: Text('None')), ...noteProv.notebooks.map((nb) => DropdownMenuItem(value: nb.id, child: Text('${nb.icon} ${nb.name}')))],
                      onChanged: (v) => setState(() => _currentNotebookId = v),
                      underline: const SizedBox(),
                      isDense: true,
                    )),
                  ]),
                ),
                const SizedBox(height: 8),
                // Content
                TextField(
                  controller: _contentCtrl,
                  decoration: const InputDecoration(labelText: 'Content', border: InputBorder.none, alignLabelWithHint: true),
                  maxLines: null,
                  minLines: 10,
                  style: const TextStyle(fontSize: 15, height: 1.6),
                ),
              ]),
            ),
    );
  }

  Widget _propRow(String label, Widget value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [SizedBox(width: 100, child: Text(label, style: TextStyle(color: AppTheme.textMuted, fontSize: 13))), Expanded(child: value)]),
    );
  }
}
