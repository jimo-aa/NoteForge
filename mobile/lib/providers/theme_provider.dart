import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Font size scale presets
const Map<String, double> fontSizeScales = {
  'small': 0.85,
  'medium': 1.0,
  'large': 1.15,
  'extraLarge': 1.3,
};

/// Theme provider — mode, font size, accent color, with SharedPreferences persistence
class ThemeProvider extends ChangeNotifier {
  ThemeMode _mode = ThemeMode.dark;
  String _fontSizeKey = 'medium';
  Color _accentColor = const Color(0xFF6366f1);

  ThemeMode get mode => _mode;
  String get fontSizeKey => _fontSizeKey;
  double get fontSizeScale => fontSizeScales[_fontSizeKey] ?? 1.0;
  Color get accentColor => _accentColor;

  // ── Init ──

  Future<void> hydrate() async {
    final p = await SharedPreferences.getInstance();
    final modeStr = p.getString('theme_mode') ?? 'dark';
    _mode = _parseMode(modeStr);
    _fontSizeKey = p.getString('theme_font_size') ?? 'medium';
    final hex = p.getString('theme_accent_color') ?? '#6366f1';
    _accentColor = _parseHex(hex);
    notifyListeners();
  }

  // ── Mode ──

  void setMode(ThemeMode mode) { _mode = mode; _save(); }
  void setModeFromString(String s) { _mode = _parseMode(s); _save(); }

  // ── Font size ──

  void setFontSize(String key) {
    if (!fontSizeScales.containsKey(key)) return;
    _fontSizeKey = key;
    _save();
  }

  // ── Accent color ──

  void setAccentColor(Color c) { _accentColor = c; _save(); }
  void setAccentColorFromHex(String hex) { _accentColor = _parseHex(hex); _save(); }

  // ── Persistence ──

  Future<void> _save() async {
    notifyListeners();
    final p = await SharedPreferences.getInstance();
    await p.setString('theme_mode', _modeToStr(_mode));
    await p.setString('theme_font_size', _fontSizeKey);
    await p.setString('theme_accent_color', '#${_accentColor.toARGB32().toRadixString(16).substring(2)}');
  }

  // ── Helpers ──

  ThemeMode _parseMode(String s) {
    switch (s) {
      case 'light': return ThemeMode.light;
      case 'dark': return ThemeMode.dark;
      default: return ThemeMode.system;
    }
  }

  String _modeToStr(ThemeMode m) {
    if (m == ThemeMode.light) return 'light';
    if (m == ThemeMode.dark) return 'dark';
    return 'system';
  }

  Color _parseHex(String hex) {
    try {
      return Color(int.parse(hex.replaceFirst('#', 'FF'), radix: 16));
    } catch (_) {
      return const Color(0xFF6366f1);
    }
  }
}
