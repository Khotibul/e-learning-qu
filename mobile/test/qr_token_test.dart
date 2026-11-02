import "package:flutter_test/flutter_test.dart";

import "package:e_learning_qu/utils/qr_token.dart";

void main() {
  const token = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678abcdef01";

  group("tokenDariQr", () {
    test("mengambil token dari URL verifikasi surat", () {
      expect(tokenDariQr("https://pondok.example.com/api/izin/verifikasi?token=$token"), token);
      expect(tokenDariQr("https://pondok.example.com/verifikasi?t=$token&x=1"), token);
    });

    test("menerima token mentah", () {
      expect(tokenDariQr(token), token);
      expect(tokenDariQr("  $token\n"), token);
    });

    test("menolak QR yang bukan token izin", () {
      expect(tokenDariQr(null), isNull);
      expect(tokenDariQr(""), isNull);
      expect(tokenDariQr("https://pondok.example.com/absensi"), isNull);
      expect(tokenDariQr("halo dunia"), isNull);
      expect(tokenDariQr("https://pondok.example.com/api/izin/verifikasi?token=pendek"), isNull);
    });
  });
}
