import 'package:e_learning_qu/main.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('App menampilkan layar login saat belum ada sesi', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const ELearningQuApp());
    // Tunggu AuthProvider selesai membaca sesi tersimpan (layar loading singkat).
    await tester.pumpAndSettle();

    expect(find.text('E-Learning QU'), findsOneWidget);
  });
}
