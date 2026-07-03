import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/note_provider.dart';
import '../widgets/bottom_sheets/theme_sheet.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final np = context.watch<NoteProvider>();
    return Scaffold(
      body: ListView(padding: const EdgeInsets.only(bottom: 80), children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 8), child: Text('我的', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: context.textPrimary))),
        Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 16), child: Row(children: [
          _avatar(context, auth),
          const SizedBox(width: 16),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(auth.user?.username ?? 'Forge User', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: context.textPrimary)),
            Text(auth.user?.email ?? 'user@noteforge.app', style: TextStyle(fontSize: 13, color: context.textMutedColor)),
          ]),
        ])),
        _statsRow(context, np),
        const SizedBox(height: 16),
        _menuRow(context, '☁️', '同步与备份', () {}),
        _menuRow(context, '🎨', '主题与外观', () => showThemeSheet(context)),
        _menuRow(context, '🔒', '加密与安全', () {}),
        _menuRow(context, '💾', '存储管理', () {}),
        const Divider(height: 24),
        _menuRow(context, '💬', '意见反馈', () {}),
        _menuRow(context, 'ℹ️', '关于 NoteForge', () {}),
        const Divider(height: 24),
        _dangerRow(context, '🚪', '退出登录', () => _logout(context, auth)),
      ]),
    );
  }
}

Widget _avatar(BuildContext ctx, AuthProvider auth) {
  final letter = (auth.user?.username.isNotEmpty == true) ? auth.user!.username[0].toUpperCase() : 'F';
  return Container(width: 56, height: 56,
    decoration: const BoxDecoration(gradient: LinearGradient(colors: [AppTheme.accent, Color(0xFF8b5cf6)]), shape: BoxShape.circle,
      boxShadow: [BoxShadow(color: AppTheme.accentGlow, blurRadius: 12, offset: Offset(0, 4))]),
    alignment: Alignment.center,
    child: Text(letter, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w600)));
}

Widget _statCard(BuildContext ctx, String label, String value) {
  return Expanded(child: Container(
    padding: const EdgeInsets.symmetric(vertical: 12),
    decoration: BoxDecoration(color: ctx.surface, borderRadius: BorderRadius.circular(AppTheme.radiusLg), border: Border.all(color: ctx.borderLightColor)),
    child: Column(children: [
      Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppTheme.text)),
      Text(label, style: TextStyle(fontSize: 11, color: ctx.textMutedColor)),
    ]),
  ));
}

Widget _statsRow(BuildContext ctx, NoteProvider np) {
  return Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Row(children: [
    _statCard(ctx, '笔记', '${np.totalNoteCount}'), const SizedBox(width: 8),
    _statCard(ctx, '笔记本', '${np.notebooks.length}'), const SizedBox(width: 8),
    _statCard(ctx, '版本', '${np.notes.fold(0, (s, n) => s + n.version)}'), const SizedBox(width: 8),
    _statCard(ctx, '收藏', '${np.favoriteCount}'),
  ]));
}

Widget _menuRow(BuildContext ctx, String icon, String text, VoidCallback onTap) {
  return GestureDetector(onTap: onTap, child: Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
    child: Row(children: [
      Container(width: 32, height: 32, decoration: BoxDecoration(color: ctx.accentSubtleBg, borderRadius: BorderRadius.circular(8)),
        alignment: Alignment.center, child: Text(icon, style: const TextStyle(fontSize: 15))),
      const SizedBox(width: 12),
      Expanded(child: Text(text, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: ctx.textPrimary))),
      Text('›', style: TextStyle(fontSize: 14, color: ctx.textMutedColor)),
    ])));
}

Widget _dangerRow(BuildContext ctx, String icon, String text, VoidCallback onTap) {
  return GestureDetector(onTap: onTap, child: Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
    child: Row(children: [
      Container(width: 32, height: 32, decoration: BoxDecoration(color: AppTheme.danger.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
        alignment: Alignment.center, child: Text(icon, style: const TextStyle(fontSize: 15))),
      const SizedBox(width: 12),
      Expanded(child: Text(text, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppTheme.danger))),
      Text('›', style: TextStyle(fontSize: 14, color: ctx.textMutedColor)),
    ])));
}

Future<void> _logout(BuildContext ctx, AuthProvider auth) async {
  final ok = await showDialog<bool>(context: ctx, builder: (_) => AlertDialog(
    title: const Text('确认退出？'),
    actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
      TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('退出', style: TextStyle(color: Colors.red)))],
  ));
  if (ok == true && ctx.mounted) { auth.logout(); Navigator.pushNamedAndRemoveUntil(ctx, '/login', (_) => false); }
}
