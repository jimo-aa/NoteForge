import 'package:flutter/material.dart';
import '../core/models.dart';
import '../core/theme.dart';

class NoteCard extends StatelessWidget {
  final NoteItem note;
  final VoidCallback onTap;

  const NoteCard({super.key, required this.note, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border: note.isPinned ? const Border(left: BorderSide(color: AppTheme.accent, width: 3)) : null,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text(note.title.isNotEmpty ? note.title : 'Untitled',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
              if (note.isPinned) const Icon(Icons.push_pin, size: 14, color: AppTheme.textMuted),
              if (note.isFavorite) const Icon(Icons.star, size: 14, color: Colors.amber),
            ]),
            const SizedBox(height: 4),
            Text(note.contentPlain.isNotEmpty ? note.contentPlain : note.content,
                style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
                maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 8),
            Row(children: [
              Text(_formatDate(note.updatedAt), style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
              if (note.tags.isNotEmpty) ...[
                const SizedBox(width: 8),
                Text('#${note.tags.first}', style: TextStyle(fontSize: 11, color: AppTheme.textSoft)),
              ],
              const Spacer(),
              Text('${note.wordCount}', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
            ]),
          ]),
        ),
      ),
    );
  }

  String _formatDate(int ts) {
    if (ts == 0) return '';
    final d = DateTime.fromMillisecondsSinceEpoch(ts);
    return '${d.month}/${d.day}/${d.year}';
  }
}
