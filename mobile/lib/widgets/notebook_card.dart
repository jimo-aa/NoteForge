import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../l10n/locale_provider.dart';

class NotebookCard extends StatelessWidget {
  final Notebook notebook;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;
  const NotebookCard({super.key, required this.notebook, required this.onTap, this.onLongPress});

  @override
  Widget build(BuildContext context) {
    final l10n = context.watch<LocaleProvider>();
    return GestureDetector(
      onTap: onTap, onLongPress: onLongPress,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: context.surface, borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          border: Border.all(color: context.borderLightColor),
          boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 3, offset: Offset(0, 1))],
        ),
        child: Row(children: [
          Container(width: 40, height: 40,
            decoration: BoxDecoration(color: _c(notebook.color).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
            alignment: Alignment.center, child: Text(notebook.icon.isNotEmpty ? notebook.icon : '📓', style: const TextStyle(fontSize: 20))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(notebook.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(l10n.tr('notebooks.noteCount', args: {'count': '${notebook.noteCount}'}), style: TextStyle(fontSize: 12, color: context.textMutedColor)),
          ])),
          Container(width: 8, height: 8, decoration: BoxDecoration(color: _c(notebook.color), shape: BoxShape.circle)),
          const SizedBox(width: 8),
          Text('›', style: TextStyle(fontSize: 14, color: context.textMutedColor)),
        ]),
      ),
    );
  }

  Color _c(String h) {
    try { return Color(int.parse(h.replaceFirst('#', 'FF'), radix: 16)); } catch (_) { return AppTheme.accent; }
  }
}
