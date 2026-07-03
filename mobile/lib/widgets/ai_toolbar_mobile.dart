import 'dart:async';
import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/theme.dart';

class AiToolbarMobile extends StatefulWidget {
  final String text;
  final String noteContent;
  final void Function(String content, String mode) onInsert;

  const AiToolbarMobile({
    super.key,
    required this.text,
    required this.noteContent,
    required this.onInsert,
  });

  @override
  State<AiToolbarMobile> createState() => _AiToolbarMobileState();
}

class _AiToolbarMobileState extends State<AiToolbarMobile> {
  bool _isStreaming = false;
  String _streamContent = '';
  String _selectedTone = 'clear';
  String _selectedLang = 'zh-CN';

  Future<void> _startAction(String action, {String? tone, String? lang}) async {
    setState(() { _isStreaming = true; _streamContent = ''; });

    try {
      final res = await ApiClient.request('POST', '/api/v1/ai/write', body: {
        'action': action,
        'text': widget.text,
        'context': widget.noteContent,
        if (tone != null) 'tone': tone,
        if (lang != null) 'targetLang': lang,
      });

      if (res.code == 0 && res.data != null) {
        final content = res.data!['content'] as String? ?? '';
        setState(() => _streamContent = content);
        widget.onInsert(content, action);
      } else {
        _showError(res.message ?? 'AI error');
      }
    } catch (e) {
      _showError('Network error: $e');
    }

    setState(() => _isStreaming = false);
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.red[700]));
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: AppTheme.surface2,
        border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
      ),
      child: _isStreaming
          ? Row(children: [
              const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
              const SizedBox(width: 8),
              Expanded(child: Text(_streamContent.isNotEmpty ? _streamContent : 'AI thinking...',
                  style: const TextStyle(fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis)),
            ])
          : SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                _btn('✍ Continue', () => _startAction('continue')),
                const SizedBox(width: 4),
                _btn('✏ Rewrite', () => _showTonePicker()),
                const SizedBox(width: 4),
                _btn('🌐 Translate', () => _showLangPicker()),
                const SizedBox(width: 4),
                _btn('→ Complete', () => _startAction('complete')),
              ]),
            ),
    );
  }

  Widget _btn(String label, VoidCallback onTap) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFFB8C0DD)))),
      ),
    );
  }

  void _showTonePicker() {
    final tones = ['clear', 'professional', 'academic', 'simple', 'creative'];
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF111424),
      builder: (_) => Column(mainAxisSize: MainAxisSize.min, children: tones.map((t) => ListTile(
        title: Text(t[0].toUpperCase() + t.substring(1)),
        trailing: _selectedTone == t ? const Icon(Icons.check, color: Color(0xFF6A63FF)) : null,
        onTap: () { Navigator.pop(context); setState(() => _selectedTone = t); _startAction('rewrite', tone: t); },
      )).toList()),
    );
  }

  void _showLangPicker() {
    final langs = {'zh-CN': '中文', 'en-US': 'English', 'ja': '日本語', 'ko': '한국어'};
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF111424),
      builder: (_) => Column(mainAxisSize: MainAxisSize.min, children: langs.entries.map((e) => ListTile(
        title: Text('${e.value} (${e.key})'),
        trailing: _selectedLang == e.key ? const Icon(Icons.check, color: Color(0xFF6A63FF)) : null,
        onTap: () { Navigator.pop(context); setState(() => _selectedLang = e.key); _startAction('translate', lang: e.key); },
      )).toList()),
    );
  }
}
