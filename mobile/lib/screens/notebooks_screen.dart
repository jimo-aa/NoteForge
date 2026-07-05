import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_icons.dart';
import '../core/theme.dart';
import '../l10n/locale_provider.dart';
import '../providers/note_provider.dart';
import '../widgets/notebook_card.dart';
import '../widgets/bottom_sheets/new_notebook_sheet.dart';

class NotebooksScreen extends StatefulWidget {
  final void Function(String notebookId)? onNotebookTap;
  const NotebooksScreen({super.key, this.onNotebookTap});
  @override
  State<NotebooksScreen> createState() => _NotebooksScreenState();
}

class _NotebooksScreenState extends State<NotebooksScreen> {
  @override
  Widget build(BuildContext context) {
    final np = context.watch<NoteProvider>();
    final l10n = context.watch<LocaleProvider>();
    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 12, 8, 8), child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(l10n.tr('notebooks.title'), style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: context.textPrimary)),
            IconButton(icon: const Icon(Icons.add, color: AppTheme.accent, size: 22), onPressed: () => _create(context)),
          ],
        )),
        Expanded(child: np.notebooks.isEmpty && !np.isLoading
          ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.book_outlined, size: 64, color: AppTheme.textMuted),
              const SizedBox(height: 12),
              Text(l10n.tr('notebooks.title'), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: context.textSecondaryColor)),
            ]))
          : ListView(padding: const EdgeInsets.fromLTRB(12, 4, 12, 80), children: [
              _allCard(context, np, l10n),
              const SizedBox(height: 6),
              ...np.notebooks.map((nb) => Padding(padding: const EdgeInsets.only(bottom: 6),
                child: NotebookCard(notebook: nb, onTap: () => widget.onNotebookTap?.call(nb.id), onLongPress: () => _delete(context, nb, l10n)))),
            ])),
      ]),
    );
  }

  Widget _allCard(BuildContext ctx, NoteProvider np, LocaleProvider l10n) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    decoration: BoxDecoration(color: context.surface, borderRadius: BorderRadius.circular(AppTheme.radiusLg), border: Border.all(color: context.borderLightColor)),
    child: Row(children: [
      Container(width: 40, height: 40, decoration: BoxDecoration(color: context.accentSubtleBg, borderRadius: BorderRadius.circular(10)),
        alignment: Alignment.center, child: const Icon(AppIcons.allNotes, size: 20, color: AppTheme.accent)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(l10n.tr('notebooks.allNotes'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        Text(l10n.tr('notebooks.noteCount', args: {'count': '${np.totalNoteCount}'}), style: TextStyle(fontSize: 12, color: context.textMutedColor)),
      ])),
      Container(width: 8, height: 8, decoration: const BoxDecoration(color: AppTheme.accent, shape: BoxShape.circle)),
      const SizedBox(width: 8),
      Icon(AppIcons.chevronRight, size: 18, color: context.textMutedColor),
    ]),
  );

  Future<void> _create(BuildContext ctx) async {
    final r = await showNewNotebookSheet(ctx);
    if (r != null && mounted) {
      await context.read<NoteProvider>().createNotebook(r['name']!, icon: r['icon']!, color: r['color']!);
    }
  }

  Future<void> _delete(BuildContext ctx, var nb, LocaleProvider l10n) async {
    final ok = await showDialog<bool>(context: ctx, builder: (_) => AlertDialog(
      title: Text(l10n.tr('notebooks.deleteTitle')),
      content: Text(l10n.tr('notebooks.deleteConfirmMsg', args: {'name': nb.name})),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l10n.tr('sheet.cancel'))),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l10n.tr('notebooks.delete'), style: const TextStyle(color: Colors.red)))],
    ));
    if (ok == true && mounted) { await context.read<NoteProvider>().deleteNotebook(nb.id); }
  }
}
