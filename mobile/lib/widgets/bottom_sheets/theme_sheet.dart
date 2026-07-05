import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/app_icons.dart';
import '../../core/theme.dart';
import '../../l10n/locale_provider.dart';
import '../../providers/theme_provider.dart';

const _accents = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

void showThemeSheet(BuildContext context) {
  showModalBottomSheet(
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
  late String _mode;
  late String _fontSize;
  late String _accentHex;

  @override
  void initState() {
    super.initState();
    // Snapshot current values from provider (read, not watch)
    final tp = context.read<ThemeProvider>();
    _mode = tp.mode == ThemeMode.light ? 'light' : tp.mode == ThemeMode.dark ? 'dark' : 'system';
    _fontSize = tp.fontSizeKey;
    _accentHex = '#${tp.accentColor.toARGB32().toRadixString(16).substring(2).toUpperCase()}';
    // Normalize to known list
    if (!_accents.contains(_accentHex)) _accentHex = _accents.first;
  }

  Color _parseHex(String h) {
    try { return Color(int.parse(h.replaceFirst('#', 'FF'), radix: 16)); } catch (_) { return AppTheme.accent; }
  }

  @override
  Widget build(BuildContext context) {
    final tp = context.read<ThemeProvider>();
    final l10n = context.watch<LocaleProvider>();

    return SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(margin: const EdgeInsets.only(top: 12, bottom: 16), width: 36, height: 4,
        decoration: BoxDecoration(color: context.borderColor, borderRadius: BorderRadius.circular(2))),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [const Icon(AppIcons.theme, size: 20, color: AppTheme.accent), const SizedBox(width: 8), Text(l10n.tr('theme.title'), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: context.textPrimary))]),
        const SizedBox(height: 16),

        // Theme mode
        _field(l10n.tr('theme.mode'), Row(children: [
          _modeBtn('light', AppIcons.lightMode, l10n.tr('theme.light')),
          const SizedBox(width: 8),
          _modeBtn('dark', AppIcons.darkMode, l10n.tr('theme.dark')),
          const SizedBox(width: 8),
          _modeBtn('system', AppIcons.systemMode, l10n.tr('theme.system')),
        ])),
        const SizedBox(height: 16),

        // Font size
        _field(l10n.tr('theme.fontSize'), DropdownButtonFormField<String>(
          initialValue: _fontSize,
          items: ['small', 'medium', 'large', 'extraLarge'].map((k) {
            String label;
            switch (k) {
              case 'small': label = l10n.tr('theme.small');
              case 'medium': label = l10n.tr('theme.medium');
              case 'large': label = l10n.tr('theme.large');
              case 'extraLarge': label = l10n.tr('theme.extraLarge');
              default: label = k;
            }
            return DropdownMenuItem(value: k, child: Text(label));
          }).toList(),
          onChanged: (v) { if (v != null) { setState(() => _fontSize = v); tp.setFontSize(v); } },
          decoration: InputDecoration(
            filled: true, fillColor: context.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTheme.radius), borderSide: BorderSide(color: context.borderLightColor)),
          ),
        )),
        const SizedBox(height: 16),

        // Accent color
        _field(l10n.tr('sheet.color'), Wrap(spacing: 8, runSpacing: 8, children: _accents.map((c) {
          final sel = c == _accentHex;
          return GestureDetector(
            onTap: () { setState(() => _accentHex = c); tp.setAccentColorFromHex(c); },
            child: Container(width: 36, height: 36,
              decoration: BoxDecoration(color: _parseHex(c), shape: BoxShape.circle,
                border: Border.all(color: sel ? AppTheme.text : Colors.transparent, width: 3))),
          );
        }).toList())),
        const SizedBox(height: 20),

        // Apply button
        SizedBox(width: double.infinity, child: ElevatedButton(
          onPressed: () { tp.setModeFromString(_mode); Navigator.pop(context); },
          child: Text(l10n.tr('theme.apply'), style: const TextStyle(fontWeight: FontWeight.w600)))),
        const SizedBox(height: 24),
      ])),
    ]));
  }

  Widget _field(String l, Widget w) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(l, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.textSecondaryColor)),
    const SizedBox(height: 4), w,
  ]);

  Widget _modeBtn(String mode, IconData icon, String label) {
    final sel = _mode == mode;
    return Expanded(child: GestureDetector(
      onTap: () => setState(() => _mode = mode),
      child: Container(padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(border: Border.all(color: sel ? AppTheme.accent : context.borderLightColor, width: sel ? 2 : 1),
          borderRadius: BorderRadius.circular(AppTheme.radius), color: context.surface),
        alignment: Alignment.center,
        child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 16, color: sel ? AppTheme.accent : context.textSecondaryColor), const SizedBox(width: 4), Text(label, style: TextStyle(fontSize: 13, color: sel ? AppTheme.accent : context.textPrimary))])),
    ));
  }
}
