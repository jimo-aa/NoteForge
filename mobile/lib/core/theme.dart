import 'package:flutter/material.dart';

/// NoteForge Mobile UIUX Design System
class AppTheme {
  // ── Light palette ──
  static const accent = Color(0xFF6366f1);
  static const accentSubtle = Color(0xFFeef2ff);
  static const accentGlow = Color(0x266366f1);

  static const bg = Color(0xFFf5f6fa);
  static const bgCard = Color(0xFFffffff);
  static const bgElevated = Color(0xFFffffff);
  static const text = Color(0xFF171a23);
  static const textSecondary = Color(0xFF5a5f73);
  static const textMuted = Color(0xFF989daf);
  static const border = Color(0xFFe6e8ee);
  static const borderLight = Color(0xFFf0f2f6);

  static const success = Color(0xFF10b981);
  static const warning = Color(0xFFf59e0b);
  static const danger = Color(0xFFef4444);

  // ── Dark palette ──
  static const bgDark = Color(0xFF0f101a);
  static const bgCardDark = Color(0xFF1a1b2e);
  static const bgElevatedDark = Color(0xFF1e1f35);
  static const textDark = Color(0xFFe4e6f0);
  static const textSecondaryDark = Color(0xFF989daf);
  static const textMutedDark = Color(0xFF5a5f73);
  static const borderDark = Color(0xFF2a2c42);
  static const borderLightDark = Color(0xFF1e2037);
  static const accentSubtleDark = Color(0xFF262840);

  static const radius = 10.0;
  static const radiusLg = 14.0;
  static const radiusXl = 20.0;

  static const fontFamily = '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';
  static const fontMono = '"JetBrains Mono","SF Mono","Consolas",monospace';

  static ThemeData get light => ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: bg,
        colorScheme: const ColorScheme.light(
          primary: accent,
          secondary: accent,
          surface: bgCard,
          error: danger,
        ),
        cardTheme: CardThemeData(
          color: bgCard,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusLg),
            side: const BorderSide(color: borderLight),
          ),
        ),
        dividerTheme: const DividerThemeData(color: borderLight, thickness: 1),
        snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
        fontFamily: fontFamily,
      );

  static ThemeData get dark => ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: bgDark,
        colorScheme: const ColorScheme.dark(
          primary: accent,
          secondary: accent,
          surface: bgCardDark,
          error: danger,
        ),
        cardTheme: CardThemeData(
          color: bgCardDark,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusLg),
            side: const BorderSide(color: borderDark),
          ),
        ),
        dividerTheme: const DividerThemeData(color: borderDark, thickness: 1),
        snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
        fontFamily: fontFamily,
      );
}

/// Theme‑aware color helpers — use in widget build methods.
extension ThemeColors on BuildContext {
  Color get surface => Theme.of(this).brightness == Brightness.dark ? AppTheme.bgCardDark : AppTheme.bgCard;
  Color get surfaceElevated => Theme.of(this).brightness == Brightness.dark ? AppTheme.bgElevatedDark : AppTheme.bgElevated;
  Color get textPrimary => Theme.of(this).brightness == Brightness.dark ? AppTheme.textDark : AppTheme.text;
  Color get textSecondaryColor => Theme.of(this).brightness == Brightness.dark ? AppTheme.textSecondaryDark : AppTheme.textSecondary;
  Color get textMutedColor => Theme.of(this).brightness == Brightness.dark ? AppTheme.textMutedDark : AppTheme.textMuted;
  Color get borderColor => Theme.of(this).brightness == Brightness.dark ? AppTheme.borderDark : AppTheme.border;
  Color get borderLightColor => Theme.of(this).brightness == Brightness.dark ? AppTheme.borderLightDark : AppTheme.borderLight;
  Color get accentSubtleBg => Theme.of(this).brightness == Brightness.dark ? AppTheme.accentSubtleDark : AppTheme.accentSubtle;

  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}
