import 'package:flutter/material.dart';

class AppTheme {
  static const Color accent = Color(0xFF6A63FF);
  static const Color bg = Color(0xFF080B15);
  static const Color surface = Color(0xFF111424);
  static const Color surface2 = Color(0xFF20223A);
  static const Color text = Color(0xFFF4F6FF);
  static const Color textSoft = Color(0xFFB8C0DD);
  static const Color textMuted = Color(0xFF7D87A6);
  static const Color line = Color(0x14FFFFFF);
  static const Color good = Color(0xFF21D392);

  static ThemeData get dark => ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: bg,
        colorScheme: ColorScheme.dark(
          primary: accent,
          secondary: accent,
          surface: surface,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: surface,
          foregroundColor: text,
          elevation: 0,
        ),
        cardTheme: CardThemeData(
          color: surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: surface,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.14)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.14)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: accent),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: accent,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(foregroundColor: accent),
        ),
        dividerTheme: DividerThemeData(color: Colors.white.withValues(alpha: 0.08)),
      );
}
