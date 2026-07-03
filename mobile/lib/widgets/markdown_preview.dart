import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import '../core/theme.dart';

class MarkdownPreview extends StatelessWidget {
  final String markdown;

  const MarkdownPreview({super.key, required this.markdown});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
      ),
      child: Markdown(
        data: markdown.isNotEmpty ? markdown : '*No content*',
        styleSheet: MarkdownStyleSheet(
          h1: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: AppTheme.text, height: 1.4),
          h2: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.text, height: 1.3),
          h3: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.text, height: 1.3),
          p: TextStyle(fontSize: 15, color: AppTheme.text, height: 1.7),
          listBullet: TextStyle(fontSize: 15, color: AppTheme.accent),
          code: TextStyle(fontSize: 13, color: AppTheme.accent, backgroundColor: Color(0x1A6A63FF)),
          codeblockDecoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(6),
          ),
          blockquoteDecoration: BoxDecoration(
            border: Border(left: BorderSide(color: AppTheme.accent, width: 3)),
            color: AppTheme.accent.withValues(alpha: 0.05),
          ),
          blockquote: TextStyle(color: AppTheme.textSoft, fontStyle: FontStyle.italic),
          horizontalRuleDecoration: BoxDecoration(
            border: Border(top: BorderSide(color: AppTheme.line, width: 1)),
          ),
          strong: TextStyle(fontWeight: FontWeight.bold),
          em: TextStyle(fontStyle: FontStyle.italic),
          del: TextStyle(decoration: TextDecoration.lineThrough),
          tableBorder: TableBorder.all(color: AppTheme.line, width: 1),
          tableHead: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.text),
          tableBody: TextStyle(color: AppTheme.textSoft),
          tableCellsPadding: const EdgeInsets.all(8),
          checkbox: TextStyle(color: AppTheme.accent),
        ),
        shrinkWrap: true,
        selectable: true,
      ),
    );
  }
}
