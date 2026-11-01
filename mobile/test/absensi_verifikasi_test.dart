import 'package:flutter_test/flutter_test.dart';

import 'package:e_learning_qu/widgets/verifikasi_widget.dart';

void main() {
  group('aturan metode absensi', () {
    test('foto selfie wajah hanya wajib saat absen masuk', () {
      expect(butuhFoto('FOTO', 'MASUK'), isTrue);
      expect(butuhFoto('FOTO', 'SELESAI'), isFalse);
      expect(butuhFoto('FOTO_SIDIK_JARI', 'MASUK'), isTrue);
      expect(butuhFoto('SIDIK_JARI', 'MASUK'), isFalse);
      expect(butuhFoto('GPS_SIDIK_JARI', 'MASUK'), isFalse);
    });

    test('GPS dan sidik jari wajib pada metode yang ditentukan Admin', () {
      expect(butuhGps('GPS_FOTO'), isTrue);
      expect(butuhGps('GPS_SIDIK_JARI'), isTrue);
      expect(butuhGps('GPS_FOTO_SIDIK_JARI'), isTrue);
      expect(butuhGps('FOTO'), isFalse);
      expect(butuhGps('TANPA'), isFalse);

      expect(butuhSidik('SIDIK_JARI'), isTrue);
      expect(butuhSidik('FOTO_SIDIK_JARI'), isTrue);
      expect(butuhSidik('GPS_SIDIK_JARI'), isTrue);
      expect(butuhSidik('FOTO'), isFalse);
      expect(butuhSidik('GPS_FOTO'), isFalse);
    });
  });

  group('jarak lokasi', () {
    test('haversine 0 untuk titik yang sama', () {
      expect(haversineMeter(-6.2, 106.8, -6.2, 106.8), closeTo(0, 0.001));
    });

    test('haversine menghitung jarak dalam meter', () {
      // ±111,32 km per 1 derajat lintang.
      expect(haversineMeter(-6.2, 106.8, -6.3, 106.8), closeTo(11119, 50));
    });
  });

  group('payload verifikasi', () {
    test('hanya mengirim bukti yang tersedia', () {
      final state = VerifState()..fotoUrl = '/api/upload/abc';
      expect(state.toJson(), {"fotoUrl": "/api/upload/abc"});

      state
        ..lat = -6.2
        ..lng = 106.8
        ..akurasiMeter = 12
        ..jarakMeter = 40
        ..gpsValid = true
        ..mock = false
        ..sidikOk = true
        ..sidikProvider = "fingerprint";
      final json = state.toJson();
      expect(json["fotoUrl"], '/api/upload/abc');
      expect(json["gps"], {
        "lat": -6.2,
        "lng": 106.8,
        "akurasiMeter": 12.0,
        "jarakMeter": 40,
        "gpsValid": true,
        "mock": false,
      });
      expect(json["sidikJari"], {"verified": true, "provider": "fingerprint"});
    });
  });
}
