import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'l10n/locale_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/note_provider.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/notes_screen.dart';
import 'screens/search_screen.dart';
import 'screens/notebooks_screen.dart';
import 'screens/favorites_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/editor_screen.dart';
import 'widgets/bottom_sheets/new_note_sheet.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const NoteForgeApp());
}

class NoteForgeApp extends StatefulWidget {
  const NoteForgeApp({super.key});
  @override
  State<NoteForgeApp> createState() => _NoteForgeAppState();
}

class _NoteForgeAppState extends State<NoteForgeApp> {
  final ThemeMode _themeMode = ThemeMode.dark;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()..hydrate()),
        ChangeNotifierProvider(create: (_) => NoteProvider()),
      ],
      child: Consumer<LocaleProvider>(
        builder: (ctx, localeProv, _) {
          return MaterialApp(
            title: localeProv.tr('appName'),
            locale: Locale(localeProv.localeCode),
            supportedLocales: const [Locale('zh'), Locale('en')],
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            themeMode: _themeMode,
            debugShowCheckedModeBanner: false,
            home: const _AppShell(),
            onGenerateRoute: (settings) {
              switch (settings.name) {
                case '/login':
                  return MaterialPageRoute(builder: (_) => const LoginScreen());
                case '/register':
                  return MaterialPageRoute(builder: (_) => const RegisterScreen());
                case '/note-editor':
                  final noteId = settings.arguments as String? ?? 'new';
                  return MaterialPageRoute(builder: (_) => EditorScreen(noteId: noteId));
                default:
                  return MaterialPageRoute(builder: (_) => const _AppShell());
              }
            },
          );
        },
      ),
    );
  }
}

class _AppShell extends StatelessWidget {
  const _AppShell();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (!auth.isAuthenticated) return const LoginScreen();
    return const _MainApp();
  }
}

class _MainApp extends StatefulWidget {
  const _MainApp();
  @override
  State<_MainApp> createState() => _MainAppState();
}

class _MainAppState extends State<_MainApp> {
  int _tab = 0;

  void _onNbTap(String id) {
    setState(() => _tab = 0);
    context.read<NoteProvider>().setFilter(id);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.watch<LocaleProvider>();
    final tabs = <Widget>[
      const NotesScreen(),
      const SearchScreen(),
      NotebooksScreen(onNotebookTap: _onNbTap),
      const FavoritesScreen(),
      const ProfileScreen(),
    ];
    final items = [
      ('📄', l10n.tr('home.title')),
      ('🔍', l10n.tr('search.title')),
      ('📓', l10n.tr('notebooks.title')),
      ('⭐', l10n.tr('favorites.title')),
      ('👤', l10n.tr('profile.title')),
    ];

    return Scaffold(
      body: IndexedStack(index: _tab, children: tabs),
      bottomNavigationBar: Container(
        color: context.surface,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(children: items.asMap().entries.map((e) => _tabItem(e.key, e.value.$1, e.value.$2)).toList()),
          ),
        ),
      ),
      floatingActionButton: _tab == 0
          ? FloatingActionButton(
              onPressed: _newNote,
              backgroundColor: AppTheme.accent,
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
    );
  }

  Widget _tabItem(int i, String icon, String label) {
    final active = i == _tab;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = i),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(icon, style: TextStyle(fontSize: 21, color: active ? null : context.textMutedColor)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, fontWeight: active ? FontWeight.w600 : FontWeight.w500, color: active ? AppTheme.accent : context.textMutedColor)),
          ]),
        ),
      ),
    );
  }

  Future<void> _newNote() async {
    final result = await showNewNoteSheet(context);
    if (result != null && mounted) {
      context.read<NoteProvider>().createNote(
        title: result['title'] as String? ?? '',
        content: result['content'] as String? ?? '',
        notebookId: result['notebookId'] as String?,
        tags: result['tags'] as List<String>? ?? [],
      );
    }
  }
}
