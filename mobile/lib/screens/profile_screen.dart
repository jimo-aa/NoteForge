import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_icons.dart';
import '../core/theme.dart';
import '../l10n/locale_provider.dart';
import '../providers/auth_provider.dart';
import '../providers/note_provider.dart';
import '../widgets/toast_manager.dart';
import '../widgets/bottom_sheets/theme_sheet.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final np = context.watch<NoteProvider>();
    final l10n = context.watch<LocaleProvider>();
    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: ListView(padding: const EdgeInsets.only(bottom: 80), children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 8), child: Text(l10n.tr('profile.title'), style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: context.textPrimary))),
        Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 16), child: Row(children: [
          _avatar(context, auth),
          const SizedBox(width: 16),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(auth.user?.username ?? l10n.tr('profile.defaultUsername'), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: context.textPrimary)),
            Text(auth.user?.email ?? l10n.tr('profile.defaultEmail'), style: TextStyle(fontSize: 13, color: context.textMutedColor)),
          ]),
        ])),
        _statsRow(context, np, l10n),
        const SizedBox(height: 16),
        _menuRow(context, AppIcons.syncBackup, l10n.tr('profile.syncBackup'), () => toastKey.currentState?.show(ToastType.info, '即将推出')),
        _menuRow(context, AppIcons.theme, l10n.tr('profile.themeAppearance'), () => showThemeSheet(context)),
        _menuRow(context, AppIcons.security, l10n.tr('profile.encryption'), () => toastKey.currentState?.show(ToastType.info, '即将推出')),
        _menuRow(context, AppIcons.storage, l10n.tr('profile.storage'), () => toastKey.currentState?.show(ToastType.info, '即将推出')),
        const Divider(height: 24),
        _menuRow(context, AppIcons.feedback, l10n.tr('profile.feedback'), () => toastKey.currentState?.show(ToastType.info, '即将推出')),
        _menuRow(context, AppIcons.about, l10n.tr('profile.about'), () => toastKey.currentState?.show(ToastType.info, '即将推出')),
        const Divider(height: 24),
        _dangerRow(context, AppIcons.logout, l10n.tr('profile.logout'), () => _logout(context, auth, l10n)),
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

Widget _statsRow(BuildContext ctx, NoteProvider np, LocaleProvider l10n) {
  return Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Row(children: [
    _statCard(ctx, l10n.tr('profile.notes'), '${np.totalNoteCount}'), const SizedBox(width: 8),
    _statCard(ctx, l10n.tr('profile.notebooks'), '${np.notebooks.length}'), const SizedBox(width: 8),
    _statCard(ctx, l10n.tr('profile.versions'), '${np.notes.fold(0, (s, n) => s + n.version)}'), const SizedBox(width: 8),
    _statCard(ctx, l10n.tr('profile.favorites'), '${np.favoriteCount}'),
  ]));
}

Widget _menuRow(BuildContext ctx, IconData icon, String text, VoidCallback onTap) {
  return GestureDetector(onTap: onTap, child: Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
    child: Row(children: [
      Container(width: 32, height: 32, decoration: BoxDecoration(color: ctx.accentSubtleBg, borderRadius: BorderRadius.circular(8)),
        alignment: Alignment.center, child: Icon(icon, size: 18, color: AppTheme.accent)),
      const SizedBox(width: 12),
      Expanded(child: Text(text, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: ctx.textPrimary))),
      Icon(AppIcons.chevronRight, size: 18, color: ctx.textMutedColor),
    ])));
}

Widget _dangerRow(BuildContext ctx, IconData icon, String text, VoidCallback onTap) {
  return GestureDetector(onTap: onTap, child: Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
    child: Row(children: [
      Container(width: 32, height: 32, decoration: BoxDecoration(color: AppTheme.danger.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
        alignment: Alignment.center, child: Icon(icon, size: 18, color: AppTheme.danger)),
      const SizedBox(width: 12),
      Expanded(child: Text(text, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppTheme.danger))),
      Icon(AppIcons.chevronRight, size: 18, color: ctx.textMutedColor),
    ])));
}

Future<void> _logout(BuildContext ctx, AuthProvider auth, LocaleProvider l10n) async {
  final ok = await showDialog<bool>(context: ctx, builder: (_) => AlertDialog(
    title: Text(l10n.tr('profile.logoutConfirm')),
    actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l10n.tr('sheet.cancel'))),
      TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l10n.tr('profile.logout'), style: const TextStyle(color: Colors.red)))],
  ));
  if (ok == true && ctx.mounted) { auth.logout(); Navigator.pushNamedAndRemoveUntil(ctx, '/login', (_) => false); }
}
