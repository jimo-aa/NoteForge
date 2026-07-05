import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../l10n/locale_provider.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _pwdCtrl = TextEditingController();
  String? _error;

  @override
  void dispose() { _emailCtrl.dispose(); _pwdCtrl.dispose(); super.dispose(); }

  Future<void> _login() async {
    setState(() => _error = null);
    final err = await context.read<AuthProvider>().login(_emailCtrl.text.trim(), _pwdCtrl.text);
    if (err != null && mounted) setState(() => _error = err);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final l10n = context.watch<LocaleProvider>();
    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('⚒ NoteForge', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(l10n.tr('login.subtitle'), style: TextStyle(color: context.textMutedColor, fontSize: 14)),
            const SizedBox(height: 32),
            if (_error != null) Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.red.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
              child: Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
            ),
            if (_error != null) const SizedBox(height: 16),
            TextField(controller: _emailCtrl, decoration: InputDecoration(labelText: l10n.tr('login.email')), keyboardType: TextInputType.emailAddress),
            const SizedBox(height: 12),
            TextField(controller: _pwdCtrl, decoration: InputDecoration(labelText: l10n.tr('login.password')), obscureText: true),
            const SizedBox(height: 24),
            ElevatedButton(onPressed: auth.isLoading ? null : _login, child: Text(auth.isLoading ? l10n.tr('login.signingIn') : l10n.tr('login.signIn'))),
            const SizedBox(height: 16),
            TextButton(onPressed: () => Navigator.pushReplacementNamed(context, '/register'), child: Text(l10n.tr('login.dontHaveAccount'))),
          ]),
        ),
      ),
    );
  }
}
