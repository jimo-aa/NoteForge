import 'package:flutter/material.dart';
import '../core/theme.dart';

class FormatToolbar extends StatelessWidget {
  final void Function(String before, String after) onWrap;
  final void Function(String insert) onInsert;

  const FormatToolbar({super.key, required this.onWrap, required this.onInsert});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: AppTheme.surface2,
        border: Border(bottom: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
      ),
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _btn('B', '**', '**'), _btn('I', '*', '*'), _btn('S', '~~', '~~'),
          _divider(),
          _btn('H1', '# ', ''), _btn('H2', '## ', ''), _btn('H3', '### ', ''),
          _divider(),
          _btn('•', '- ', ''), _btn('1.', '1. ', ''),
          _btn('□', '- [ ] ', ''),
          _divider(),
          _btn('"', '> ', ''),
          _btn('</>', '```\n', '\n```'),
          _divider(),
          _btn('🔗', '[', '](url)'),
          _btn('—', '\n---\n', ''),
        ],
      ),
    );
  }

  Widget _btn(String label, String before, String after) {
    return GestureDetector(
      onTap: before.isEmpty ? () => onInsert(label) : () => onWrap(before, after),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        alignment: Alignment.center,
        child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
      ),
    );
  }

  Widget _divider() {
    return Container(width: 1, height: 20, margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      color: Colors.white.withValues(alpha: 0.08));
  }
}
