import 'package:flutter/material.dart';
import '../../core/theme.dart';

const _icons = ['📓','📔','📙','📕','📚','📖','📝','✏️','📋','📰','📑','🗂️','💻','🎯','🔄','🤖'];
const _colors = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#64748b'];

Future<Map<String, String>?> showNewNotebookSheet(BuildContext context) {
  return showModalBottomSheet<Map<String, String>>(
    context: context, isScrollControlled: true,
    backgroundColor: context.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXl))),
    builder: (_) => const _Sheet(),
  );
}

class _Sheet extends StatefulWidget {
  const _Sheet();
  @override
  State<_Sheet> createState() => _SheetState();
}

class _SheetState extends State<_Sheet> {
  final _nameCtrl = TextEditingController();
  String _icon = '📓';
  String _color = '#6366f1';

  @override
  void dispose() { _nameCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final bi = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bi),
      child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(margin: const EdgeInsets.only(top: 12, bottom: 16), width: 36, height: 4,
          decoration: BoxDecoration(color: context.borderColor, borderRadius: BorderRadius.circular(2))),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('📓 新建笔记本', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.text)),
          const SizedBox(height: 16),
          _f('名称', TextField(controller: _nameCtrl, decoration: const InputDecoration(hintText: '给笔记本起个名字吧'), autofocus: true, onChanged: (_) => setState(() {}))),
          const SizedBox(height: 14),
          _f('图标', Wrap(spacing: 6, runSpacing: 6, children: _icons.map((ic) => GestureDetector(
            onTap: () => setState(() => _icon = ic),
            child: Container(width: 38, height: 38,
              decoration: BoxDecoration(border: Border.all(color: ic == _icon ? AppTheme.accent : context.borderColor, width: ic == _icon ? 2 : 1),
                borderRadius: BorderRadius.circular(8), color: ic == _icon ? context.accentSubtleBg : context.surface),
              alignment: Alignment.center,
              child: Transform.scale(scale: ic == _icon ? 1.12 : 1.0, child: Text(ic, style: const TextStyle(fontSize: 18))),
            ),
          )).toList())),
          const SizedBox(height: 14),
          _f('颜色', Wrap(spacing: 6, runSpacing: 6, children: _colors.map((c) {
            final sel = c == _color;
            return GestureDetector(onTap: () => setState(() => _color = c),
              child: Container(width: 30, height: 30, decoration: BoxDecoration(color: _parse(c), shape: BoxShape.circle, border: Border.all(color: sel ? AppTheme.text : Colors.transparent, width: 2))));
          }).toList())),
          const SizedBox(height: 12),
          // Preview
          Container(padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: context.surface, borderRadius: BorderRadius.circular(AppTheme.radius), border: Border.all(color: context.borderLightColor)),
            child: Row(children: [
              Text(_icon, style: const TextStyle(fontSize: 20)),
              const SizedBox(width: 10),
              Expanded(child: Text(_nameCtrl.text.isNotEmpty ? _nameCtrl.text : '笔记本名称', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.text))),
              Container(width: 8, height: 8, decoration: BoxDecoration(color: _parse(_color), shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Text('0 条笔记', style: TextStyle(fontSize: 12, color: context.textMutedColor)),
            ])),
          const SizedBox(height: 20),
          Row(children: [
            Expanded(child: TextButton(
              onPressed: () => Navigator.pop(context),
              style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12), backgroundColor: AppTheme.borderLight, foregroundColor: AppTheme.textSecondary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radius))),
              child: const Text('取消', style: TextStyle(fontWeight: FontWeight.w600)))),
            const SizedBox(width: 8),
            Expanded(child: ElevatedButton(
              onPressed: () => Navigator.pop(context, {'name': _nameCtrl.text.isNotEmpty ? _nameCtrl.text : 'New Notebook', 'icon': _icon, 'color': _color}),
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

  Color _parse(String h) {
    try { return Color(int.parse(h.replaceFirst('#', 'FF'), radix: 16)); } catch (_) { return AppTheme.accent; }
  }
}
