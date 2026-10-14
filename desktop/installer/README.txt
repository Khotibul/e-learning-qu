E-LearningQu Desktop — Windows Installer
========================================

ISI PAKET
  E-LearningQu.Desktop.exe   aplikasi (self-contained, tanpa perlu install .NET)
  appsettings.json           konfigurasi (Backend.BaseUrl, dll)
  Install.cmd                installer: salin ke %LocalAppData%\Programs\E-LearningQu + shortcut
  Uninstall.cmd              hapus aplikasi + shortcut

CARA PAKAI
  1. Klik dua kali Install.cmd  (atau jalankan Setup.exe bila paket tersedia)
  2. Aplikasi terpasang di: %LocalAppData%\Programs\E-LearningQu
  3. Shortcut dibuat di Desktop dan Start Menu: "E-LearningQu Desktop"
  4. Untuk uninstall: klik dua kali Uninstall.cmd

CATATAN
  - Aplikasi butuh koneksi internet ke https://e-learning-qu.vercel.app
  - Backend URL bisa diubah di appsettings.json (folder instalasi)
  - Login multi-akun: Admin, Guru, Siswa, Ustadz, dll (satu per sesi)
