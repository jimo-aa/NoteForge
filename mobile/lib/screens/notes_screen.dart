import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../l10n/locale_provider.dart';
import '../providers/note_provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/note_card.dart';

class NotesScreen extends StatefulWidget {
  const NotesScreen({super.key});
  @override
  State<NotesScreen> createState() => _NotesScreenState();
}

class _NotesScreenState extends State<NotesScreen> {
  @override
  void initState() { super.initState(); context.read<NoteProvider>().loadData(); }

  @override
  Widget build(BuildContext context) {
    final np = context.watch<NoteProvider>();
    final auth = context.watch<AuthProvider>();
    final l10n = context.watch<LocaleProvider>();
    final pinned = np.notes.where((n) => n.isPinned).toList();
    final notes = np.filteredNotes.where((n) => !n.isPinned).toList();

    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 8), child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(l10n.tr('home.title'), style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: context.textPrimary)),
            Container(width: 34, height: 34,
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [AppTheme.accent, Color(0xFF8b5cf6)]), shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: AppTheme.accentGlow, blurRadius: 8, offset: Offset(0, 2))]),
              alignment: Alignment.center,
              child: Text(auth.user?.username.isNotEmpty == true ? auth.user!.username[0].toUpperCase() : 'F',
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600))),
          ],
        )),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l10n.tr('home.greeting'), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: context.textPrimary)),
          Text(l10n.tr('home.greetingSub', args: {'count': '${np.totalNoteCount}'}), style: TextStyle(fontSize: 13, color: context.textMutedColor)),
        ])),
        if (np.error != null)
          Container(width: double.infinity, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: AppTheme.danger.withValues(alpha: 0.1),
            child: Row(children: [
              const Icon(Icons.error_outline, size: 16, color: AppTheme.danger),
              const SizedBox(width: 8),
              Expanded(child: Text(np.error!, style: const TextStyle(fontSize: 12, color: AppTheme.danger))),
              GestureDetector(onTap: () => np.loadData(), child: const Text('重试', style: TextStyle(fontSize: 12, color: AppTheme.accent))),
            ])),
        Expanded(child: np.isLoading
          ? const Center(child: CircularProgressIndicator())
          : notes.isEmpty && pinned.isEmpty ? _empty(l10n, context)
          : RefreshIndicator(onRefresh: () => np.loadData(), child: ListView(padding: const EdgeInsets.only(bottom: 80), children: [
            if (pinned.isNotEmpty) ...[
              Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 6), child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(l10n.tr('home.pinned'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.textMutedColor, letterSpacing: 0.5)),
                  Text(l10n.tr('home.pinnedCountNum', args: {'count': '${pinned.length}'}), style: TextStyle(fontSize: 11, color: context.textMutedColor)),
                ],
              )),
              ...pinned.map((n) => Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: NoteCard(note: n, onTap: () => Navigator.pushNamed(context, '/note-editor', arguments: n.id)))),
            ],
            if (notes.isNotEmpty) ...[
              Padding(padding: EdgeInsets.fromLTRB(16, pinned.isNotEmpty ? 4 : 8, 16, 6),
                child: Text(l10n.tr('home.recent'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.textMutedColor, letterSpacing: 0.5))),
              ...notes.map((n) => Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: NoteCard(note: n, onTap: () => Navigator.pushNamed(context, '/note-editor', arguments: n.id)))),
            ],
          ]))),
      ]),
    );
  }

  Widget _empty(LocaleProvider l10n, BuildContext ctx) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Icon(Icons.note_add_outlined, size: 64, color: ctx.textMutedColor.withValues(alpha: 0.5)),
    const SizedBox(height: 12),
    Text(l10n.tr('home.noNotes'), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: ctx.textSecondaryColor)),
    const SizedBox(height: 4),
    Text(l10n.tr('home.createFirstNote'), style: TextStyle(fontSize: 13, color: ctx.textMutedColor)),
  ]));
}