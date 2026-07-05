import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/app_icons.dart';
import '../../core/theme.dart';
import '../../l10n/locale_provider.dart';
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
  IconData _icon = AppIcons.notebookIcons[0];
  String _color = '#6366f1';

  @override
  void dispose() { _nameCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final l10n = context.watch<LocaleProvider>();
    final bi = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bi),
      child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(margin: const EdgeInsets.only(top: 12, bottom: 16), width: 36, height: 4,
          decoration: BoxDecoration(color: context.borderColor, borderRadius: BorderRadius.circular(2))),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [const Icon(AppIcons.notebook, size: 20, color: AppTheme.accent), const SizedBox(width: 8), Text(l10n.tr('sheet.newNotebook'), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: context.textPrimary))]),
          const SizedBox(height: 16),
          _field(l10n.tr('sheet.notebookName'), TextField(controller: _nameCtrl, decoration: InputDecoration(hintText: l10n.tr('sheet.notebookNameHint')), autofocus: true, onChanged: (_) => setState(() {}))),
          const SizedBox(height: 14),
          _field(l10n.tr('sheet.icon'), Wrap(spacing: 6, runSpacing: 6, children: AppIcons.notebookIcons.map((ic) => GestureDetector(
            onTap: () => setState(() => _icon = ic),
            child: Container(width: 38, height: 38,
              decoration: BoxDecoration(border: Border.all(color: ic == _icon ? AppTheme.accent : context.borderColor, width: ic == _icon ? 2 : 1),
                borderRadius: BorderRadius.circular(8), color: ic == _icon ? context.accentSubtleBg : context.surface),
              alignment: Alignment.center,
              child: Icon(ic, size: 20, color: ic == _icon ? AppTheme.accent : context.textSecondaryColor),
            ),
          )).toList())),
          const SizedBox(height: 14),
          _field(l10n.tr('sheet.color'), Wrap(spacing: 6, runSpacing: 6, children: _colors.map((c) {
            final sel = c == _color;
            return GestureDetector(onTap: () => setState(() => _color = c),
              child: Container(width: 30, height: 30, decoration: BoxDecoration(color: _parse(c), shape: BoxShape.circle, border: Border.all(color: sel ? AppTheme.text : Colors.transparent, width: 2))));
          }).toList())),
          const SizedBox(height: 12),
          Container(padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: context.surface, borderRadius: BorderRadius.circular(AppTheme.radius), border: Border.all(color: context.borderLightColor)),
            child: Row(children: [
              Icon(_icon, size: 22, color: AppTheme.accent),
              const SizedBox(width: 10),
              Expanded(child: Text(_nameCtrl.text.isNotEmpty ? _nameCtrl.text : l10n.tr('sheet.notebookNameHint'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.text))),
              Container(width: 8, height: 8, decoration: BoxDecoration(color: _parse(_color), shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Text(l10n.tr('notebooks.noteCount', args: {'count': '0'}), style: TextStyle(fontSize: 12, color: context.textMutedColor)),
            ])),
          const SizedBox(height: 20),
          Row(children: [
            Expanded(child: TextButton(
              onPressed: () => Navigator.pop(context),
              style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12), backgroundColor: AppTheme.borderLight, foregroundColor: AppTheme.textSecondary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radius))),
              child: Text(l10n.tr('sheet.cancel'), style: const TextStyle(fontWeight: FontWeight.w600)))),
            const SizedBox(width: 8),
            Expanded(child: ElevatedButton(
              onPressed: () => Navigator.pop(context, {'name': _nameCtrl.text.isNotEmpty ? _nameCtrl.text : 'New Notebook', 'icon': _icon, 'color': _color}),
              child: Text(l10n.tr('sheet.create'), style: const TextStyle(fontWeight: FontWeight.w600)))),
          ]),
          const SizedBox(height: 24),
        ])),
      ])),
    );
  }

  Widget _field(String l, Widget w) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(l, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.textSecondaryColor)),
    const SizedBox(height: 4), w,
  ]);

  Color _parse(String h) {
    try { return Color(int.parse(h.replaceFirst('#', 'FF'), radix: 16)); } catch (_) { return AppTheme.accent; }
  }
}
