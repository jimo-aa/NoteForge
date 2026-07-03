import 'package:flutter/material.dart';
import '../core/theme.dart';

class FormatBar extends StatelessWidget {
  final void Function(String action) onFormat;
  const FormatBar({super.key, required this.onFormat});

  @override
  Widget build(BuildContext context) {
    final txtColor = context.textSecondaryColor;
    final bgColor = context.surfaceElevated;
    final bdrColor = context.borderColor;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        border: Border.all(color: bdrColor),
        boxShadow: const [BoxShadow(color: Color(0x1A000000), blurRadius: 16, offset: Offset(0, 8))],
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        _b('B', () => onFormat('bold'), txtColor, fontWeight: FontWeight.bold),
        _b('I', () => onFormat('italic'), txtColor, fontStyle: FontStyle.italic),
        _b('S', () => onFormat('strike'), txtColor, decoration: TextDecoration.lineThrough),
        _d(bdrColor),
        _c('`', () => onFormat('code'), txtColor),
        _b('H', () => onFormat('heading'), txtColor, fontWeight: FontWeight.bold),
        _d(bdrColor),
        _b('•', () => onFormat('list'), txtColor),
        _b('☐', () => onFormat('todo'), txtColor),
        _b('❝', () => onFormat('quote'), txtColor),
      ]),
    );
  }

  Widget _b(String l, VoidCallback t, Color c, {FontWeight? fontWeight, FontStyle? fontStyle, TextDecoration? decoration}) =>
    GestureDetector(onTap: t, child: Container(width: 36, height: 36, alignment: Alignment.center,
      child: Text(l, style: TextStyle(fontSize: 15, fontWeight: fontWeight, fontStyle: fontStyle, decoration: decoration, color: c))));

  Widget _c(String l, VoidCallback t, Color c) =>
    GestureDetector(onTap: t, child: Container(width: 36, height: 36, alignment: Alignment.center,
      child: Text(l, style: TextStyle(fontSize: 15, fontFamily: AppTheme.fontMono, color: c))));

  Widget _d(Color c) => Container(width: 1, height: 20, margin: const EdgeInsets.symmetric(horizontal: 2), color: c.withValues(alpha: 0.5));
}
