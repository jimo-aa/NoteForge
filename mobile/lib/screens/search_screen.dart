import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../l10n/locale_provider.dart';
import '../providers/note_provider.dart';
import '../widgets/note_card.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});
  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _ctrl = TextEditingController();
  List<NoteItem> _results = [];
  bool _searched = false;
  Timer? _deb;

  @override
  void dispose() { _ctrl.dispose(); _deb?.cancel(); super.dispose(); }

  void _onChange(String q) {
    _deb?.cancel();
    _deb = Timer(const Duration(milliseconds: 200), () => _search(q));
  }

  void _search(String q) {
    if (q.isEmpty) { setState(() { _results = []; _searched = false; }); return; }
    setState(() { _results = context.read<NoteProvider>().searchNotes(q); _searched = true; });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.watch<LocaleProvider>();
    return Scaffold(
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(children: [
            Text(l10n.tr('search.title'), style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: context.textPrimary)),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
          child: Container(
            decoration: BoxDecoration(color: context.surface, borderRadius: BorderRadius.circular(AppTheme.radiusLg), border: Border.all(color: context.borderLightColor)),
            child: TextField(
              controller: _ctrl,
              decoration: InputDecoration(
                hintText: l10n.tr('search.hint'), hintStyle: TextStyle(color: context.textMutedColor),
                prefixIcon: Icon(Icons.search, size: 20, color: context.textMutedColor),
                suffixIcon: _ctrl.text.isNotEmpty ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () { _ctrl.clear(); setState(() { _results = []; _searched = false; }); }) : null,
                border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onChanged: _onChange,
            ),
          ),
        ),
        Expanded(child: _searched ? _results.isEmpty
          ? Center(child: Text(l10n.tr('search.noResults'), style: TextStyle(color: context.textSecondaryColor)))
          : ListView.builder(padding: const EdgeInsets.fromLTRB(12, 0, 12, 80), itemCount: _results.length,
              itemBuilder: (_, i) => NoteCard(note: _results[i], onTap: () => Navigator.pushNamed(context, '/note-editor', arguments: _results[i].id)))
          : _buildHints(l10n)),
      ]),
    );
  }

  Widget _buildHints(LocaleProvider l10n) {
    return ListView(padding: const EdgeInsets.only(bottom: 80), children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(l10n.tr('search.recent'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.textMutedColor, letterSpacing: 0.5)),
          GestureDetector(onTap: () {}, child: Text(l10n.tr('search.clear'), style: const TextStyle(fontSize: 12, color: AppTheme.accent))),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Wrap(spacing: 6, runSpacing: 6, children: [
          _chip('Rust 架构'), _chip('Tauri 插件'), _chip('CRDT 同步'),
        ]),
      ),
      const SizedBox(height: 12),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
        child: Text(l10n.tr('search.quickSearch'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.textMutedColor, letterSpacing: 0.5)),
      ),
      _hintItem('🏷', l10n.tr('search.byTag')),
      _hintItem('📓', l10n.tr('search.byNotebook')),
      _hintItem('🔍', l10n.tr('search.fullText')),
    ]);
  }

  Widget _chip(String label) => GestureDetector(
    onTap: () { _ctrl.text = label; _search(label); },
    child: Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(color: context.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: context.borderLightColor)),
      child: Text(label, style: TextStyle(fontSize: 13, color: context.textSecondaryColor))));

  Widget _hintItem(String icon, String text) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16),
    child: Container(padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: context.borderLightColor))),
      child: Row(children: [
        Container(width: 28, height: 28, decoration: BoxDecoration(color: context.accentSubtleBg, borderRadius: BorderRadius.circular(6)), alignment: Alignment.center, child: Text(icon, style: const TextStyle(fontSize: 13))),
        const SizedBox(width: 12),
        Expanded(child: Text(text, style: TextStyle(fontSize: 14, color: context.textSecondaryColor))),
        Text('→', style: TextStyle(fontSize: 14, color: context.textMutedColor)),
      ])));
}
