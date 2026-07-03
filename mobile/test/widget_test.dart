import 'package:flutter_test/flutter_test.dart';
import 'package:noteforge_mobile/main.dart';

void main() {
  testWidgets('App loads loading screen', (WidgetTester tester) async {
    await tester.pumpWidget(const NoteForgeApp());
    expect(find.text('NoteForge'), findsOneWidget);
  });
}
