import 'package:flutter/material.dart';

/// Palet warna aplikasi.
///
/// Arah desain: tenang dan berkelas — dasar slate terang, ungu-indigo sebagai
/// warna utama (sama dengan web), teal sebagai aksen, emas hanya untuk hal yang
/// layak ditonjolkan (streak/pencapaian).
class AppColors {
  const AppColors._();

  static const ink = Color(0xFF0B1220);
  static const inkSoft = Color(0xFF475569);
  static const inkMuted = Color(0xFF94A3B8);

  static const primary = Color(0xFF4F46E5);
  static const primaryDeep = Color(0xFF312E81);
  static const primarySoft = Color(0xFFEDEBFF);

  static const accent = Color(0xFF0D9488);
  static const accentSoft = Color(0xFFE6F7F4);

  static const gold = Color(0xFFB98900);
  static const rose = Color(0xFFDB2777);

  static const success = Color(0xFF059669);
  static const warning = Color(0xFFD97706);
  static const danger = Color(0xFFDC2626);

  static const surface = Color(0xFFF7F8FC);
  static const card = Color(0xFFFFFFFF);
  static const border = Color(0xFFE8EAF4);
  static const borderStrong = Color(0xFFD9DDEB);
}

/// Gradien siap pakai agar warna antar layar tidak saling menyimpang.
class AppGradients {
  const AppGradients._();

  static const brand = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2A2568), Color(0xFF4F46E5), Color(0xFF0E7490)],
  );

  static const indigo = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF4338CA), Color(0xFF6366F1)]);
  static const violet = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF6D28D9), Color(0xFFA855F7)]);
  static const teal = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF0F766E), Color(0xFF2DD4BF)]);
  static const sky = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF0369A1), Color(0xFF38BDF8)]);
  static const amber = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF9A6700), Color(0xFFF0B429)]);
  static const rose = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF9F1239), Color(0xFFF472B6)]);
  static const emerald = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF047857), Color(0xFF34D399)]);
  static const slate = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF334155), Color(0xFF64748B)]);

  /// Latar halaman: ungu sangat tipis -> putih -> hijau laut sangat tipis.
  static const backdrop = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFEDEFFB), Color(0xFFF8F9FD), Color(0xFFF1FAF8)],
    stops: [0.0, 0.45, 1.0],
  );
}

class AppShadows {
  const AppShadows._();

  static const soft = <BoxShadow>[
    BoxShadow(color: Color(0x0F1E1B4B), blurRadius: 20, offset: Offset(0, 8), spreadRadius: -8),
  ];
  static const lift = <BoxShadow>[
    BoxShadow(color: Color(0x1F1E1B4B), blurRadius: 26, offset: Offset(0, 12), spreadRadius: -6),
  ];
  static const brand = <BoxShadow>[
    BoxShadow(color: Color(0x33312E81), blurRadius: 28, offset: Offset(0, 14), spreadRadius: -10),
  ];
}

class AppTheme {
  const AppTheme._();

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
    ).copyWith(
      primary: AppColors.primary,
      secondary: AppColors.accent,
      surface: AppColors.card,
      error: AppColors.danger,
    );

    final base = ThemeData(useMaterial3: true, colorScheme: scheme);
    final text = base.textTheme;

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.surface,
      textTheme: text.copyWith(
        headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.6, color: AppColors.ink),
        titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.3, color: AppColors.ink),
        titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.ink),
        titleSmall: text.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: AppColors.ink),
        bodyMedium: text.bodyMedium?.copyWith(color: AppColors.inkSoft),
        bodySmall: text.bodySmall?.copyWith(color: AppColors.inkMuted),
        labelSmall: text.labelSmall?.copyWith(color: AppColors.inkMuted, letterSpacing: 0.2),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        foregroundColor: AppColors.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.ink, letterSpacing: -0.2),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: AppColors.card,
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 68,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        indicatorColor: AppColors.primarySoft,
        indicatorShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 11,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? AppColors.primary : AppColors.inkMuted,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 22,
            color: states.contains(WidgetState.selected) ? AppColors.primary : AppColors.inkMuted,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          // Lebar 0, bukan infinity: tombol di dalam Row akan gagal layout bila
          // minimumSize memaksa lebar tak hingga (Size.fromHeight).
          minimumSize: const Size(0, 52),
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: 0.1),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          minimumSize: const Size(0, 48),
          side: const BorderSide(color: AppColors.borderStrong),
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        labelStyle: const TextStyle(color: AppColors.inkMuted, fontSize: 13),
        floatingLabelStyle: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w600),
        hintStyle: const TextStyle(color: AppColors.inkMuted, fontSize: 13),
        prefixIconColor: AppColors.inkMuted,
        suffixIconColor: AppColors.inkMuted,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.borderStrong)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.borderStrong)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.primary, width: 1.6)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.danger)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.ink,
        contentTextStyle: const TextStyle(color: Colors.white, fontSize: 13),
        insetPadding: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 1, space: 1),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primary,
        linearTrackColor: Color(0xFFEFF1F8),
        circularTrackColor: Color(0xFFEFF1F8),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.inkSoft,
        elevation: 2,
        highlightElevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      splashFactory: InkSparkle.splashFactory,
    );
  }
}
