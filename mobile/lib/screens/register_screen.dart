import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../providers/auth_provider.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _pwdCtrl = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _pwdCtrl.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    setState(() => _error = null);
    final auth = context.read<AuthProvider>();
    final err = await auth.register(_nameCtrl.text.trim(), _emailCtrl.text.trim(), _pwdCtrl.text);
    if (err != null) setState(() => _error = err);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('⚒ NoteForge', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('Create your account', style: TextStyle(color: AppTheme.textMuted, fontSize: 14)),
            const SizedBox(height: 32),
            if (_error != null) Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.red.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
              child: Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
            ),
            if (_error != null) const SizedBox(height: 16),
            TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Name')),
            const SizedBox(height: 12),
            TextField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email'), keyboardType: TextInputType.emailAddress),
            const SizedBox(height: 12),
            TextField(controller: _pwdCtrl, decoration: const InputDecoration(labelText: 'Password'), obscureText: true),
            const SizedBox(height: 24),
            ElevatedButton(onPressed: auth.isLoading ? null : _register, child: Text(auth.isLoading ? 'Creating...' : 'Create Account')),
            const SizedBox(height: 16),
            TextButton(onPressed: () => Navigator.pushReplacementNamed(context, '/login'), child: const Text('Already have an account? Sign in')),
          ]),
        ),
      ),
    );
  }
}
