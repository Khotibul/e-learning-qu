// 1 DATABASE — Flutter langsung ke API Next.js yang sama (PostgreSQL db.prisma.io)
// Web & Android baca/tulis tabel identik: users, siswa, guru, ujian, absensi, nilai, materi...

class ApiConfig {
  // Emulator Android → host localhost
  // Device fisik → ganti ke IP LAN, mis: http://192.168.1.5:3000
  // Produksi → https://e-learning-qu.vercel.app
  static const String baseUrlProd = "https://e-learning-qu.vercel.app";
  static const String baseUrlLocal = "http://10.0.2.2:3000";

  static String get baseUrl {
    const isProd = bool.fromEnvironment("dart.vm.product");
    if (isProd) return baseUrlProd;
    // Untuk debug di emulator, pakai local
    return baseUrlLocal;
  }

  // Endpoint yang dipakai (sama persis dengan web Next.js)
  static const String authSession = "/api/auth/session";
  static const String siswaUjian = "/api/siswa/ujian";
  static const String siswaAbsensi = "/api/siswa/absensi";
  static const String siteConfig = "/api/site-config";
  static const String guruJabatan = "/api/guru/jabatan";
}
