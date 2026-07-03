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
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 8), child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('笔记', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: context.textPrimary)),
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
          Text('晚上好 👋', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: context.textPrimary)),
          Text('今天有 ${np.totalNoteCount} 篇笔记待整理', style: TextStyle(fontSize: 13, color: context.textMutedColor)),
        ])),
        Expanded(child: np.isLoading
          ? const Center(child: CircularProgressIndicator())
          : notes.isEmpty && pinned.isEmpty ? _empty(l10n)
          : RefreshIndicator(onRefresh: () => np.loadData(), child: ListView(padding: const EdgeInsets.only(bottom: 80), children: [
            if (pinned.isNotEmpty) ...[
              Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 6), child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('📌 已固定', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.textMutedColor, letterSpacing: 0.5)),
                  Text('${pinned.length}', style: TextStyle(fontSize: 11, color: context.textMutedColor)),
                ],
              )),
              ...pinned.map((n) => Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: NoteCard(note: n, onTap: () => Navigator.pushNamed(context, '/note-editor', arguments: n.id)))),
            ],
            if (notes.isNotEmpty) ...[
              Padding(padding: EdgeInsets.fromLTRB(16, pinned.isNotEmpty ? 4 : 8, 16, 6),
                child: Text('最近更新', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.textMutedColor, letterSpacing: 0.5))),
              ...notes.map((n) => Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: NoteCard(note: n, onTap: () => Navigator.pushNamed(context, '/note-editor', arguments: n.id)))),
            ],
          ]))),
      ]),
    );
  }

  Widget _empty(LocaleProvider l10n) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Icon(Icons.note_add_outlined, size: 64, color: context.textMutedColor.withValues(alpha: 0.5)),
    const SizedBox(height: 12),
    Text('暂无笔记', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: context.textSecondaryColor)),
    const SizedBox(height: 4),
    Text('创建你的第一条笔记', style: TextStyle(fontSize: 13, color: context.textMutedColor)),
  ]));
}
