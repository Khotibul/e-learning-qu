import 'package:e_learning_qu/providers/auth_provider.dart';
import 'package:e_learning_qu/screens/guru/dashboard.dart';
import 'package:e_learning_qu/screens/guru/pengaturan.dart';
import 'package:e_learning_qu/screens/auth/login_screen.dart';
import 'package:e_learning_qu/screens/siswa/absensi_harian.dart';
import 'package:e_learning_qu/screens/siswa/dashboard.dart';
import 'package:e_learning_qu/screens/siswa/pengaturan.dart';
import 'package:e_learning_qu/screens/siswa/ujian.dart';
import 'package:e_learning_qu/widgets/absensi_wajah_card.dart';
import 'package:e_learning_qu/theme/app_theme.dart';
import 'package:e_learning_qu/widgets/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Regresi tata letak: dashboard harus bisa dirender di layar sempit tanpa
/// teks terpotong atau RenderFlex overflow. Ditambahkan setelah ditemukan
/// overflow 4,9 px dan label "Absensi/AI Tutor" terpotong pada lebar 320dp.
Future<void> pumpDiLayar(WidgetTester tester, Widget child, double lebarDp, {bool withAuth = false}) async {
  // Tinggi dibuat besar supaya seluruh bagian dashboard ikut ditata.
  tester.view.physicalSize = Size(lebarDp * 2, 5600);
  tester.view.devicePixelRatio = 2.0;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({});

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: withAuth ? ChangeNotifierProvider(create: (_) => AuthProvider(), child: child) : child,
    ),
  );
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(seconds: 2));
}

void main() {
  for (final lebar in [320.0, 360.0, 412.0]) {
    testWidgets("dashboard siswa rapi di ${lebar.toInt()}dp", (tester) async {
      await pumpDiLayar(tester, const SiswaDashboard(), lebar);
      expect(tester.takeException(), isNull);
    });

    testWidgets("dashboard guru rapi di ${lebar.toInt()}dp", (tester) async {
      await pumpDiLayar(tester, const GuruDashboard(), lebar, withAuth: true);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets("kartu absensi wajah rapi di 320dp", (tester) async {
    await pumpDiLayar(
      tester,
      const Scaffold(
        body: Padding(padding: EdgeInsets.all(16), child: AbsensiWajahCard()),
      ),
      320,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets("layar absensi harian rapi di 320dp", (tester) async {
    await pumpDiLayar(tester, const SiswaAbsensiHarian(), 320);
    expect(tester.takeException(), isNull);
  });

  testWidgets("form profil siswa (data diri & keluarga) rapi di 320dp", (tester) async {
    await pumpDiLayar(tester, const SiswaPengaturanNew(), 320, withAuth: true);
    expect(tester.takeException(), isNull);
  });

  testWidgets("form profil guru (data diri & keluarga) rapi di 320dp", (tester) async {
    await pumpDiLayar(tester, const GuruPengaturan(), 320, withAuth: true);
    expect(tester.takeException(), isNull);
  });

  testWidgets("login hanya menampilkan peran Siswa dan Guru di 320dp", (tester) async {
    await pumpDiLayar(tester, const LoginScreen(), 320, withAuth: true);
    expect(find.text("Siswa"), findsOneWidget);
    expect(find.text("Guru"), findsOneWidget);
    expect(find.text("Admin"), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets("layar daftar ujian rapi di 320dp", (tester) async {
    await pumpDiLayar(tester, const SiswaUjian(), 320);
    expect(tester.takeException(), isNull);
  });

  testWidgets("header rapi dengan nama panjang dan badge jabatan", (tester) async {
    await pumpDiLayar(
      tester,
      const Scaffold(
        body: DashboardHeader(
          greeting: "Selamat datang,",
          name: "Muhammad Abdurrahman Al-Fatih",
          subtitle: "XII RPL 2 • Rekayasa Perangkat Lunak • Semester Ganjil 2026/2027",
          badge: "BENDAHARA",
        ),
      ),
      320,
    );
    expect(tester.takeException(), isNull);
    expect(find.text("Muhammad Abdurrahman Al-Fatih"), findsOneWidget);
  });
}
