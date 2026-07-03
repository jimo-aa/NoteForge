import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../providers/note_provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/note_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => context.read<NoteProvider>().loadData());
  }

  @override
  Widget build(BuildContext context) {
    final noteProv = context.watch<NoteProvider>();
    final auth = context.watch<AuthProvider>();
    final notes = noteProv.filteredNotes;

    return Scaffold(
      appBar: AppBar(
        title: Text('⚒ NoteForge', style: const TextStyle(fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => Navigator.pushNamed(context, '/search'),
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'logout') auth.logout();
              if (v == 'settings') Navigator.pushNamed(context, '/settings');
            },
            itemBuilder: (_) => [
              PopupMenuItem(value: 'settings', child: Text('${auth.user?.username ?? 'User'} — Settings')),
              const PopupMenuDivider(),
              const PopupMenuItem(value: 'logout', child: Text('Logout')),
            ],
          ),
        ],
      ),
      body: Column(children: [
        // Notebook filter bar
        Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              _buildFilterChip('All', noteProv.filter == 'all' && !noteProv.showFavorites, () { noteProv.setFilter('all'); if (noteProv.showFavorites) noteProv.toggleFavorites(); }),
              const SizedBox(width: 6),
              _buildFilterChip('⭐ Favorites', noteProv.showFavorites, () => noteProv.toggleFavorites()),
              if (noteProv.notebooks.isNotEmpty) ...[
                const SizedBox(width: 6),
                ...noteProv.notebooks.map((nb) => Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: _buildFilterChip('${nb.icon} ${nb.name}', noteProv.filter == nb.id, () => noteProv.setFilter(nb.id)),
                )),
              ],
            ],
          ),
        ),
        // Note list
        Expanded(
          child: noteProv.isLoading
              ? const Center(child: CircularProgressIndicator())
              : notes.isEmpty
                  ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.note_add_outlined, size: 64, color: AppTheme.textMuted),
                      const SizedBox(height: 16),
                      Text('No notes yet', style: TextStyle(color: AppTheme.textSoft, fontSize: 18)),
                      const SizedBox(height: 8),
                      Text('Create your first note', style: TextStyle(color: AppTheme.textMuted, fontSize: 14)),
                    ]))
                  : RefreshIndicator(
                      onRefresh: () => noteProv.loadData(),
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        itemCount: notes.length,
                        itemBuilder: (_, i) => NoteCard(
                          note: notes[i],
                          onTap: () => Navigator.pushNamed(context, '/note-editor', arguments: notes[i].id),
                        ),
                      ),
                    ),
        ),
      ]),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppTheme.accent,
        onPressed: () => Navigator.pushNamed(context, '/note-editor', arguments: 'new'),
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildFilterChip(String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: active ? AppTheme.accent : AppTheme.surface2,
          borderRadius: BorderRadius.circular(20),
        ),
        alignment: Alignment.center,
        child: Text(label, style: TextStyle(fontSize: 13, color: active ? Colors.white : AppTheme.textSoft)),
      ),
    );
  }
}

// NoteProvider exposes filter, showFavorites via public getters
