import 'package:flutter/material.dart';
import '../core/models.dart';
import '../core/theme.dart';

class NoteCard extends StatelessWidget {
  final NoteItem note;
  final VoidCallback onTap;
  const NoteCard({super.key, required this.note, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
        decoration: BoxDecoration(
          color: context.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          border: Border(
            left: note.isPinned ? const BorderSide(color: AppTheme.warning, width: 3) : BorderSide(color: context.borderLightColor),
            top: BorderSide(color: context.borderLightColor),
            right: BorderSide(color: context.borderLightColor),
            bottom: BorderSide(color: context.borderLightColor),
          ),
          boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 3, offset: Offset(0, 1))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _icon(context.accentSubtleBg),
            const SizedBox(width: 8),
            Expanded(child: Text(note.title.isNotEmpty ? note.title : '无标题',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, height: 1.4), maxLines: 2, overflow: TextOverflow.ellipsis)),
          ]),
          if (note.contentPlain.isNotEmpty || note.content.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(note.contentPlain.isNotEmpty ? note.contentPlain : note.content,
              style: TextStyle(fontSize: 13, color: context.textSecondaryColor, height: 1.5), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
          const SizedBox(height: 6),
          Row(children: [
            Text(_relDate(note.updatedAt), style: TextStyle(fontSize: 11, color: context.textMutedColor)),
            if (note.tags.isNotEmpty) ...[
              const SizedBox(width: 8),
              ...note.tags.take(2).map((t) => Container(
                margin: const EdgeInsets.only(right: 4), padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(color: context.accentSubtleBg, borderRadius: BorderRadius.circular(4)),
                child: Text('#$t', style: const TextStyle(fontSize: 10, color: AppTheme.accent)))),
            ],
            const Spacer(),
            if (note.isFavorite) const Padding(padding: EdgeInsets.only(right: 4), child: Icon(Icons.star, size: 14, color: AppTheme.warning)),
            Text('${note.wordCount}', style: TextStyle(fontSize: 11, color: context.textMutedColor)),
          ]),
        ]),
      ),
    );
  }

  Widget _icon(Color bg) {
    final e = note.tags.contains('架构') ? '📘' : note.tags.contains('Rust') ? '⚡' : note.tags.contains('计划') ? '🎯' : note.isPinned ? '📌' : '📝';
    return Container(width: 32, height: 32,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      alignment: Alignment.center, child: Text(e, style: const TextStyle(fontSize: 15)));
  }

  String _relDate(int ts) {
    if (ts == 0) return '';
    final d = DateTime.now().millisecondsSinceEpoch - ts;
    final m = d ~/ 60000;
    if (m < 1) return '刚刚';
    if (m < 60) return '$m分钟前';
    final h = m ~/ 60;
    if (h < 24) return '$h小时前';
    final da = h ~/ 24;
    if (da < 30) return '$da天前';
    final dt = DateTime.fromMillisecondsSinceEpoch(ts);
    return '${dt.month}/${dt.day}';
  }
}
