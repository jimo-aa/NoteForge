import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../l10n/locale_provider.dart';
import '../providers/note_provider.dart';
import '../widgets/note_card.dart';

class FavoritesScreen extends StatelessWidget {
  const FavoritesScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final np = context.watch<NoteProvider>();
    final l10n = context.watch<LocaleProvider>();
    final fav = np.notes.where((n) => n.isFavorite).toList();
    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 8), child: Row(children: [
          Text(l10n.tr('favorites.title'), style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: context.textPrimary)),
        ])),
        Expanded(child: fav.isEmpty
          ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.star_border, size: 64, color: context.textMutedColor),
              const SizedBox(height: 12),
              Text(l10n.tr('favorites.noFavorites'), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: context.textSecondaryColor)),
              const SizedBox(height: 4),
              Text(l10n.tr('favorites.addHint'), style: TextStyle(fontSize: 13, color: context.textMutedColor)),
            ]))
          : ListView.builder(padding: const EdgeInsets.fromLTRB(12, 0, 12, 80), itemCount: fav.length,
              itemBuilder: (_, i) => NoteCard(note: fav[i], onTap: () => Navigator.pushNamed(context, '/note-editor', arguments: fav[i].id)))),
      ]),
    );
  }
}
