import 'package:flutter/foundation.dart';
import 'strings_zh.dart';
import 'strings_en.dart';

/// 支持的语言代码
enum AppLocale {
  zh('zh', '中文'),
  en('en', 'English');

  final String code;
  final String displayName;
  const AppLocale(this.code, this.displayName);
}

/// 本地化管理器 — ChangeNotifier 支持响应式刷新
class LocaleProvider extends ChangeNotifier {
  AppLocale _locale = AppLocale.zh; // 默认中文

  AppLocale get locale => _locale;
  String get localeCode => _locale.code;

  /// 切换语言
  void setLocale(AppLocale locale) {
    if (_locale == locale) return;
    _locale = locale;
    notifyListeners();
  }

  /// 根据 key 获取当前语言的文本
  String tr(String key, {Map<String, String>? args}) {
    final map = _locale == AppLocale.zh ? zhStrings : enStrings;
    var text = map[key] ?? enStrings[key] ?? key;
    if (args != null) {
      for (final entry in args.entries) {
        text = text.replaceAll('{${entry.key}}', entry.value);
      }
    }
    return text;
  }
}
