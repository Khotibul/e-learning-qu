// 1 DATABASE — Flutter langsung ke API Next.js Vercel yang sama (PostgreSQL db.prisma.io)
// Web & Android baca/tulis tabel identik: users, siswa, guru, ujian, absensi, nilai, materi...
// Android sekarang LANGSUNG ke e-learning-qu.vercel.app — tidak perlu local 10.0.2.2 lagi
// Untuk debug lokal, build dengan: flutter run --dart-define=API_URL=http://10.0.2.2:3000

class ApiConfig {
  static const String baseUrlProd = "https://e-learning-qu.vercel.app";
  static const String baseUrlLocal = "http://10.0.2.2:3000";

  static String get baseUrl {
    const override = String.fromEnvironment("API_URL");
    if (override.isNotEmpty) return override;
    // Default: langsung ke Vercel produksi — 1 DB yang sama dengan website
    return baseUrlProd;
  }

  // Endpoint yang dipakai (sama persis dengan web Next.js)
  static const String authSession = "/api/auth/session";
  static const String siswaUjian = "/api/siswa/ujian";
  static const String siswaAbsensi = "/api/siswa/absensi";
  static const String siteConfig = "/api/site-config";
  static const String guruJabatan = "/api/guru/jabatan";
}
