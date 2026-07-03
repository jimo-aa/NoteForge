import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/note_provider.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/home_screen.dart';
import 'screens/note_editor_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/search_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const NoteForgeApp());
}

class NoteForgeApp extends StatelessWidget {
  const NoteForgeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..hydrate()),
        ChangeNotifierProvider(create: (_) => NoteProvider()),
      ],
      child: MaterialApp(
        title: 'NoteForge',
        theme: AppTheme.dark,
        debugShowCheckedModeBanner: false,
        initialRoute: '/loading',
        onGenerateRoute: (settings) {
          switch (settings.name) {
            case '/loading':
              return MaterialPageRoute(builder: (_) => const _LoadingScreen());
            case '/login':
              return MaterialPageRoute(builder: (_) => const LoginScreen());
            case '/register':
              return MaterialPageRoute(builder: (_) => const RegisterScreen());
            case '/home':
              return MaterialPageRoute(builder: (_) => const HomeScreen());
            case '/note-editor':
              final noteId = settings.arguments as String? ?? 'new';
              return MaterialPageRoute(builder: (_) => NoteEditorScreen(noteId: noteId));
            case '/settings':
              return MaterialPageRoute(builder: (_) => const SettingsScreen());
            case '/search':
              return MaterialPageRoute(builder: (_) => const SearchScreen());
            default:
              return MaterialPageRoute(builder: (_) => const LoginScreen());
          }
        },
      ),
    );
  }
}

class _LoadingScreen extends StatefulWidget {
  const _LoadingScreen();

  @override
  State<_LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends State<_LoadingScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 100), () {
      if (!mounted) return;
      final auth = context.read<AuthProvider>();
      if (auth.isAuthenticated) {
        Navigator.pushReplacementNamed(context, '/home');
      } else {
        Navigator.pushReplacementNamed(context, '/login');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('⚒', style: TextStyle(fontSize: 48)),
          const SizedBox(height: 16),
          Text('NoteForge', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 24),
          const CircularProgressIndicator(),
        ]),
      ),
    );
  }
}
