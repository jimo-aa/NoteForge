import 'package:flutter/material.dart';
import '../../core/theme.dart';

Future<String?> showThemeSheet(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    backgroundColor: context.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXl))),
    builder: (_) => const _ThemeSheet(),
  );
}

class _ThemeSheet extends StatefulWidget {
  const _ThemeSheet();
  @override
  State<_ThemeSheet> createState() => _ThemeSheetState();
}

class _ThemeSheetState extends State<_ThemeSheet> {
  String _mode = 'system';

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(margin: const EdgeInsets.only(top: 12, bottom: 16), width: 36, height: 4,
        decoration: BoxDecoration(color: context.borderColor, borderRadius: BorderRadius.circular(2))),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('🎨 主题与外观', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.text)),
        const SizedBox(height: 16),
        _l('主题模式', Row(children: [
          _modeBtn('light', '☀️', '浅色'),
          const SizedBox(width: 8),
          _modeBtn('dark', '🌙', '深色'),
          const SizedBox(width: 8),
          _modeBtn('system', '💻', '系统'),
        ])),
        const SizedBox(height: 20),
        SizedBox(width: double.infinity, child: ElevatedButton(
          onPressed: () => Navigator.pop(context, _mode),
          child: const Text('应用', style: TextStyle(fontWeight: FontWeight.w600)))),
        const SizedBox(height: 24),
      ])),
    ]));
  }

  Widget _l(String l, Widget w) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(l, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.textSecondaryColor)),
    const SizedBox(height: 4), w,
  ]);

  Widget _modeBtn(String mode, String icon, String label) {
    final sel = _mode == mode;
    return Expanded(child: GestureDetector(
      onTap: () => setState(() => _mode = mode),
      child: Container(padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(border: Border.all(color: sel ? AppTheme.accent : context.borderLightColor, width: sel ? 2 : 1),
          borderRadius: BorderRadius.circular(AppTheme.radius), color: context.surface),
        alignment: Alignment.center, child: Text('$icon $label', style: const TextStyle(fontSize: 13))),
    ));
  }
}
