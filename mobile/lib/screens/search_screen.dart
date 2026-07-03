import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/models.dart';
import '../widgets/note_card.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _queryCtrl = TextEditingController();
  List<NoteItem> _results = [];
  bool _searched = false;

  @override
  void dispose() {
    _queryCtrl.dispose();
    super.dispose();
  }

  void _search(String query) async {
    if (query.isEmpty) {
      setState(() { _results = []; _searched = false; });
      return;
    }
    final res = await ApiClient.request('GET', '/api/v1/notes/search?q=${Uri.encodeComponent(query)}');
    if (res.code == 0 && res.data != null) {
      final list = res.data!.values.first as List<dynamic>? ?? [];
      setState(() {
        _results = list.map((e) => NoteItem.fromJson(e as Map<String, dynamic>)).toList();
        _searched = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Search')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _queryCtrl,
            decoration: InputDecoration(
              hintText: 'Search notes...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _queryCtrl.text.isNotEmpty
                  ? IconButton(icon: const Icon(Icons.clear), onPressed: () { _queryCtrl.clear(); _search(''); })
                  : null,
            ),
            onChanged: _search,
            autofocus: true,
          ),
        ),
        Expanded(
          child: _searched && _results.isEmpty
              ? const Center(child: Text('No results'))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: _results.length,
                  itemBuilder: (_, i) => NoteCard(
                    note: _results[i],
                    onTap: () => Navigator.pushNamed(context, '/note-editor', arguments: _results[i].id),
                  ),
                ),
        ),
      ]),
    );
  }
}
