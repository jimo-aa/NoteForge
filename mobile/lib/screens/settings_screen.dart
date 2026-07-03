import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../providers/auth_provider.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Account', style: TextStyle(color: AppTheme.textSoft, fontSize: 16, fontWeight: FontWeight.w600)),
                const SizedBox(height: 12),
                _row('Name', auth.user?.username ?? '-'),
                _row('Email', auth.user?.email ?? '-'),
              ]),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('About', style: TextStyle(color: AppTheme.textSoft, fontSize: 16, fontWeight: FontWeight.w600)),
                const SizedBox(height: 12),
                _row('Version', '1.0.0'),
                _row('Platform', 'Flutter Mobile'),
              ]),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red[700]),
              onPressed: () {
                auth.logout();
                Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
              },
              child: const Text('Logout'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: TextStyle(color: AppTheme.textMuted, fontSize: 14)),
        Text(value, style: const TextStyle(fontSize: 14)),
      ]),
    );
  }
}
