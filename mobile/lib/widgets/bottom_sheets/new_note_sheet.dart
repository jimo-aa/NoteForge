import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../providers/note_provider.dart';

Future<Map<String, dynamic>?> showNewNoteSheet(BuildContext context) {
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context, isScrollControlled: true,
    backgroundColor: context.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXl))),
    builder: (_) => const _NewNoteSheet(),
  );
}

class _NewNoteSheet extends StatefulWidget {
  const _NewNoteSheet();
  @override
  State<_NewNoteSheet> createState() => _NewNoteSheetState();
}

class _NewNoteSheetState extends State<_NewNoteSheet> {
  final _titleCtrl = TextEditingController();
  final _tagsCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  String? _nbId;

  @override
  void dispose() { _titleCtrl.dispose(); _tagsCtrl.dispose(); _contentCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final np = context.watch<NoteProvider>();
    final bi = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bi),
      child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(margin: const EdgeInsets.only(top: 12, bottom: 16), width: 36, height: 4,
          decoration: BoxDecoration(color: context.borderColor, borderRadius: BorderRadius.circular(2))),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('✚ 新建笔记', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.text)),
          const SizedBox(height: 16),
          _f('标题', TextField(controller: _titleCtrl, decoration: const InputDecoration(hintText: '笔记标题...'), autofocus: true)),
          const SizedBox(height: 14),
          _f('笔记本', DropdownButtonFormField<String?>(
            initialValue: _nbId,
            decoration: InputDecoration(hintText: '无', filled: true, fillColor: context.surface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTheme.radius), borderSide: BorderSide(color: context.borderLightColor))),
            items: [DropdownMenuItem(value: null, child: Text('无', style: TextStyle(color: context.textMutedColor))),
              ...np.notebooks.map((nb) => DropdownMenuItem(value: nb.id, child: Text('${nb.icon} ${nb.name}')))],
            onChanged: (v) => setState(() => _nbId = v),
          )),
          const SizedBox(height: 14),
          _f('标签（逗号分隔）', TextField(controller: _tagsCtrl, decoration: const InputDecoration(hintText: '如: Rust, 架构'))),
          const SizedBox(height: 14),
          _f('内容预览（可选）', TextField(controller: _contentCtrl, maxLines: 3, decoration: const InputDecoration(hintText: '可选的笔记内容...'))),
          const SizedBox(height: 20),
          Row(children: [
            Expanded(child: TextButton(
              onPressed: () => Navigator.pop(context),
              style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12), backgroundColor: AppTheme.borderLight, foregroundColor: AppTheme.textSecondary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radius))),
              child: const Text('取消', style: TextStyle(fontWeight: FontWeight.w600)))),
            const SizedBox(width: 8),
            Expanded(child: ElevatedButton(
              onPressed: () => Navigator.pop(context, {
                'title': _titleCtrl.text.trim(), 'notebookId': _nbId,
                'tags': _tagsCtrl.text.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList(),
                'content': _contentCtrl.text,
              }),
              child: const Text('创建', style: TextStyle(fontWeight: FontWeight.w600)))),
          ]),
          const SizedBox(height: 24),
        ])),
      ])),
    );
  }

  Widget _f(String l, Widget w) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(l, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.textSecondaryColor)),
    const SizedBox(height: 4), w,
  ]);
}
