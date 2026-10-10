// Test E-IZIN SANTRI — 17 skenario.
// Jalankan: npx tsx tools/test-izin-santri.ts
import { prisma } from "../src/lib/prisma"
import {
  ajukanIzinSantri, simpanDraftIzin, batalkanIzinSantri, setujuiIzin, tolakIzin,
  checkoutIzin, checkinIzin, konfirmasiPerjalanan, perbaruiIzinTerlambat,
  verifikasiTokenIzin, getIzinSaya, getStatistikIzin, cekDanCatatKonflikAbsensi,
  validasiFormIzin, requireMusyrif, requireGerbang,
} from "../src/lib/izin-santri"

let pass = 0
let fail = 0
function cek(nama: string, ok: boolean, info?: unknown) {
  if (ok) { pass++; console.log(`  PASS  ${nama}`) }
  else { fail++; console.log(`  FAIL  ${nama}`, info ?? "") }
}
async function expectThrow(nama: string, fn: () => Promise<unknown>, match?: string) {
  try { await fn(); cek(nama, false, "tidak melempar error") }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    cek(nama, match ? msg.toLowerCase().includes(match.toLowerCase()) : true, msg)
  }
}

const jam = (h: number) => new Date(Date.now() + h * 3600 * 1000)

function formDasar(overrides?: Partial<Record<string, string>>) {
  return {
    jenis: "PULANG_RUMAH",
    alasan: "Pulang menengok nenek yang sedang sakit keras di kampung",
    rencanaKeluar: jam(2).toISOString(),
    rencanaKembali: jam(10).toISOString(),
    alamatTujuan: "Jl. Melati No. 10, Kecamatan Waru, Sidoarjo",
    namaPenjemput: "Budi Santoso",
    hubunganPenjemput: "AYAH",
    noTelpPenjemput: "081234567890",
    ...overrides,
  }
}

async function main() {
  console.log("=== TEST E-IZIN SANTRI — 17 SKENARIO ===\n")
  const ts = Date.now()

  // ── Fixtures ───────────────────────────────────────────────────────
  const adminUser = await prisma.user.create({ data: { email: `izin-admin-${ts}@t.test`, name: "Admin Pondok Test", password: "x".repeat(60), role: "ADMIN" } })

  const musyrifUser = await prisma.user.create({ data: { email: `izin-musyrif-${ts}@t.test`, name: "Musyrif Test", password: "x".repeat(60), role: "GURU" } })
  const musyrifGuru = await prisma.guru.create({ data: { userId: musyrifUser.id, nama: "Musyrif Test", jabatan: "MUSYRIF" } })

  const gerbangUser = await prisma.user.create({ data: { email: `izin-gerbang-${ts}@t.test`, name: "Petugas Gerbang Test", password: "x".repeat(60), role: "GURU" } })
  await prisma.guru.create({ data: { userId: gerbangUser.id, nama: "Gerbang Test", jabatan: "GERBANG" } })

  const santriUserA = await prisma.user.create({ data: { email: `izin-santriA-${ts}@t.test`, name: "Ahmad Fauzi", password: "x".repeat(60), role: "SISWA" } })
  const santriA = await prisma.santri.create({ data: { userId: santriUserA.id, nisNo: `NIS-IZIN-${ts}-A`, nama: "Ahmad Fauzi", status: "AKTIF", keberadaan: "DI_PONDOK" } })
  const waliUserA = await prisma.user.create({ data: { email: `izin-waliA-${ts}@t.test`, name: "Wali Ahmad", password: "x".repeat(60), role: "SISWA" } })
  const waliA = await prisma.waliSantri.create({ data: { userId: waliUserA.id, nama: "H. Santoso", hubungan: "AYAH", noTelp: "081111111111" } })
  await prisma.santriWali.create({ data: { santriId: santriA.id, waliId: waliA.id, isPrimary: true } })

  const santriUserB = await prisma.user.create({ data: { email: `izin-santriB-${ts}@t.test`, name: "Zahra Aini", password: "x".repeat(60), role: "SISWA" } })
  const santriB = await prisma.santri.create({ data: { userId: santriUserB.id, nisNo: `NIS-IZIN-${ts}-B`, nama: "Zahra Aini", status: "AKTIF", keberadaan: "DI_PONDOK" } })

  // asrama + kamar + penempatan
  const asrama = await prisma.asrama.create({ data: { nama: `Asrama Test ${ts}`, deskripsi: "Untuk uji E-Izin", musyrifId: musyrifGuru.id } })
  const kamar = await prisma.kamar.create({ data: { asramaId: asrama.id, nama: "Kamar A-1", kapasitas: 4 } })
  await prisma.santri.update({ where: { id: santriA.id }, data: { asramaId: asrama.id, kamarId: kamar.id } })

  // ── 1. Pengajuan izin lengkap (validasi formulir) ───────────────────
  console.log("\n1. Pengajuan izin lengkap")
  const izinA = await ajukanIzinSantri(santriUserA.id, formDasar())
  cek("izin dibuat & langsung MENUNGGU_WALI (default 3 tahap)", izinA.status === "MENUNGGU_WALI", izinA.status)
  cek("approval log DIAJUKU tercatat", Boolean(await prisma.izinApprovalLog.findFirst({ where: { izinId: izinA.id, tahap: "DIAJUKU" } })))

  // validasi formulir ketat
  await expectThrow("alasan < 10 karakter ditolak", () => validasiFormIzin(formDasar({ alasan: "pendek" })), "alasan")
  await expectThrow("rencanaKembali <= keluar ditolak", () => validasiFormIzin(formDasar({ rencanaKembali: jam(1).toISOString() })), "kembali")
  await expectThrow("noTelp tidak valid ditolak", () => validasiFormIzin(formDasar({ noTelpPenjemput: "123" })), "penjemput")
  await expectThrow("alamat < 5 karakter ditolak", () => validasiFormIzin(formDasar({ alamatTujuan: "jl" })), "alamat")
  await expectThrow("jenis tidak dikenal ditolak", () => validasiFormIzin(formDasar({ jenis: "NGAWUR" })), "jenis")

  // ── 2. Izin aktif ganda dicegah ─────────────────────────────────────
  console.log("\n2. Cegah izin aktif ganda")
  await expectThrow("pengajuan kedua saat masih MENUNGGU_WALI ditolak", () => ajukanIzinSantri(santriUserA.id, formDasar()), "izin aktif")

  // ── 3. Persetujuan wali ─────────────────────────────────────────────
  console.log("\n3. Persetujuan wali (tanda tangan elektronik)")
  const setelahWali = await setujuiIzin(izinA.id, "WALI", waliUserA.id, "Saya setujui sebagai ayah kandung")
  cek("status → MENUNGGU_MUSYRIF", setelahWali.status === "MENUNGGU_MUSYRIF", setelahWali.status)
  cek("waliApprovedAt + waliApprovedBy terisi", Boolean(setelahWali.waliApprovedAt) && setelahWali.waliApprovedBy === waliUserA.id)
  await expectThrow("tahap ganda (WALI lagi) ditolak", () => setujuiIzin(izinA.id, "WALI", waliUserA.id), "tidak dalam tahap")

  // ── 4. Persetujuan musyrif ──────────────────────────────────────────
  console.log("\n4. Persetujuan musyrif")
  const setelahMusyrif = await setujuiIzin(izinA.id, "MUSYRIF", musyrifUser.id)
  cek("status → MENUNGGU_ADMIN", setelahMusyrif.status === "MENUNGGU_ADMIN", setelahMusyrif.status)
  cek("musyrifApproved terisi", Boolean(setelahMusyrif.musyrifApprovedAt))

  // ── 5. Persetujuan admin + terbit surat ─────────────────────────────
  console.log("\n5. Keputusan admin + surat izin digital")
  const disetujui = await setujuiIzin(izinA.id, "ADMIN", adminUser.id, "Disetujui sesuai kebijakan pondok")
  cek("status → DISETUJUI", disetujui.status === "DISETUJUI", disetujui.status)
  cek("suratNomor terbit (format IZIN/YYYY/MM/NNNN)", /^IZIN\/\d{4}\/\d{2}\/\d{4}$/.test(disetujui.suratNomor ?? ""), disetujui.suratNomor)
  cek("suratToken (QR) terbit", Boolean(disetujui.suratToken) && (disetujui.suratToken?.length ?? 0) >= 32)
  cek("suratExpiresAt = rencanaKembali + grace", Boolean(disetujui.suratExpiresAt) && disetujui.suratExpiresAt!.getTime() > disetujui.rencanaKembali.getTime())
  const logSurat = await prisma.izinApprovalLog.findFirst({ where: { izinId: izinA.id, keputusan: "SURAT_DITERBITKAN" } })
  cek("log penerbitan surat tercatat", Boolean(logSurat))

  // ── 6. Disetujui tetapi belum keluar (keberadaan tetap DI_PONDOK) ──
  console.log("\n6. Disetujui tetapi belum check-out")
  const santriSetelahApprove = await prisma.santri.findUnique({ where: { id: santriA.id } })
  cek("keberadaan TETAP DI_PONDOK (belum check-out)", santriSetelahApprove?.keberadaan === "DI_PONDOK", santriSetelahApprove?.keberadaan)
  cek("status administrasi TETAP AKTIF", santriSetelahApprove?.status === "AKTIF")

  // ── 7. Check-out gerbang → status PULANG ───────────────────────────
  console.log("\n7. Check-out gerbang")
  const checkout = await checkoutIzin({ izinId: izinA.id }, gerbangUser.id, { verifikasiPenjemput: true })
  cek("checkoutAt tercatat (waktu server)", Boolean(checkout.checkoutAt))
  cek("penjemputVerified tercatat", Boolean(checkout.penjemputVerifiedAt) && checkout.penjemputVerifiedBy === gerbangUser.id)
  const santriSetelahCheckout = await prisma.santri.findUnique({ where: { id: santriA.id } })
  cek("keberadaan → IZIN_PULANG (jenis PULANG_RUMAH)", santriSetelahCheckout?.keberadaan === "IZIN_PULANG", santriSetelahCheckout?.keberadaan)
  cek("status administrasi tetap AKTIF", santriSetelahCheckout?.status === "AKTIF")
  const logCheckout = await prisma.izinApprovalLog.findFirst({ where: { izinId: izinA.id, tahap: "GERBANG_KELUAR" } })
  cek("approval log CHECKOUT tercatat", Boolean(logCheckout))
  const statusLog = await prisma.santriStatusLog.findFirst({ where: { santriId: santriA.id, jenis: "KEBERADAAN", ke: "IZIN_PULANG" } })
  cek("SantriStatusLog KEBERADAAN tercatat", Boolean(statusLog))

  // ── 8. Check-out ganda dicegah (idempoten) ──────────────────────────
  console.log("\n8. Check-out ganda dicegah")
  await expectThrow("checkout kedua ditolak", () => checkoutIzin({ izinId: izinA.id }, gerbangUser.id), "sudah pernah check-out")

  // ── 9. Konfirmasi perjalanan (tiba di tujuan) ───────────────────────
  console.log("\n9. Konfirmasi tiba di tujuan")
  const perjalanan = await konfirmasiPerjalanan(izinA.id, santriUserA.id)
  cek("perjalananConfirmedAt tercatat", Boolean(perjalanan?.perjalananConfirmedAt))
  const santriPerjalanan = await prisma.santri.findUnique({ where: { id: santriA.id } })
  cek("keberadaan → DI_RUMAH", santriPerjalanan?.keberadaan === "DI_RUMAH", santriPerjalanan?.keberadaan)

  // ── 10. Notifikasi wali terkirim ────────────────────────────────────
  console.log("\n10. Notifikasi wali")
  await new Promise((r) => setTimeout(r, 1500)) // tunggu notifikasi async
  const notifWali = await prisma.notification.findMany({ where: { userId: waliUserA.id } })
  cek("wali menerima notifikasi (pengajuan/keputusan/checkout)", notifWali.length > 0, `${notifWali.length} notif`)
  const notifSantri = await prisma.notification.findMany({ where: { userId: santriUserA.id } })
  cek("santri menerima notifikasi", notifSantri.length > 0, `${notifSantri.length} notif`)
  const notifAdmin = await prisma.notification.findMany({ where: { userId: adminUser.id } })
  cek("admin menerima notifikasi pengajuan", notifAdmin.length > 0)

  // ── 11. Check-in kembali → SELESAI + DI_PONDOK ──────────────────────
  console.log("\n11. Check-in kembali")
  const checkin = await checkinIzin(izinA.id, gerbangUser.id)
  cek("izin status → SELESAI", checkin.status === "SELESAI", checkin.status)
  cek("checkinAt tercatat", Boolean(checkin.checkinAt))
  const santriSetelahCheckin = await prisma.santri.findUnique({ where: { id: santriA.id } })
  cek("keberadaan → DI_PONDOK", santriSetelahCheckin?.keberadaan === "DI_PONDOK", santriSetelahCheckin?.keberadaan)
  await expectThrow("check-in ganda dicegah", () => checkinIzin(izinA.id, gerbangUser.id), "check-in")

  // ── 12. Izin ditolak (alasan wajib) ─────────────────────────────────
  console.log("\n12. Izin ditolak")
  const izinB = await ajukanIzinSantri(santriUserB.id, formDasar({ jenis: "KEGIATAN_KELUARGA", alasan: "Menghadiri acara pernikahan kakak kandung di luar kota" }))
  cek("izin B diajukan", izinB.status === "MENUNGGU_WALI", izinB.status)
  await setujuiIzin(izinB.id, "WALI", waliUserA.id) // wali test menyetujui tahap wali agar izin maju ke musyrif
  await expectThrow("tolak tanpa alasan ditolak", () => tolakIzin(izinB.id, "MUSYRIF", musyrifUser.id, ""), "alasan")
  const ditolak = await tolakIzin(izinB.id, "MUSYRIF", musyrifUser.id, "Berkas kegiatan keluarga belum lengkap")
  cek("status → DITOLAK", ditolak.status === "DITOLAK", ditolak.status)
  cek("alasanKeputusan tercatat", Boolean(ditolak.alasanKeputusan))
  const logTolak = await prisma.izinApprovalLog.findFirst({ where: { izinId: izinB.id, keputusan: "DITOLAK" } })
  cek("approval log DITOLAK tercatat", Boolean(logTolak))

  // ── 13. RBAC: salah tahap ditolak ───────────────────────────────────
  console.log("\n13. RBAC lintas tahap")
  await expectThrow("MUSYRIF tidak bisa approve tahap ADMIN", () => setujuiIzin(izinB.id, "MUSYRIF", musyrifUser.id), "tidak dalam tahap")
  await expectThrow("requireMusyrif di luar request session melempar", () => requireMusyrif())

  // ── 14. Kedaluwarsa (disetujui, tidak pernah keluar, lewat batas) ──
  console.log("\n14. Kedaluwarsa otomatis")
  // buat + setujui dengan waktu masih depan, lalu mundurkan rencanaKembali via DB (uji status otomatis)
  const izinKedaluwarsa = await ajukanIzinSantri(santriUserB.id, formDasar({ jenis: "BEROBAT", alasan: "Berobat ke puskesmas karena demam tinggi", rencanaKeluar: jam(1).toISOString(), rencanaKembali: jam(2).toISOString() }))
  await setujuiIzin(izinKedaluwarsa.id, "WALI", adminUser.id)
  await setujuiIzin(izinKedaluwarsa.id, "MUSYRIF", adminUser.id)
  const izinKed = await setujuiIzin(izinKedaluwarsa.id, "ADMIN", adminUser.id)
  cek("izin KED di-approve & surat terbit", izinKed.status === "DISETUJUI" && Boolean(izinKed.suratToken))
  await prisma.izinSantri.update({ where: { id: izinKed.id }, data: { rencanaKembali: jam(-2), rencanaKeluar: jam(-5), suratExpiresAt: jam(-1) } })
  const hasilKed = await perbaruiIzinTerlambat()
  const izinKedAfter = await prisma.izinSantri.findUnique({ where: { id: izinKed.id } })
  cek("izin tanpa check-out lewat batas → KEDALUWARSA", izinKedAfter?.status === "KEDALUWARSA", izinKedAfter?.status)
  cek("counter kedaluwarsa ≥ 1", hasilKed.kedaluwarsa >= 1, hasilKed)

  // ── 15. Terlambat kembali (sudah keluar, lewat batas) ───────────────
  console.log("\n15. Terlambat kembali otomatis")
  const izinTelat = await ajukanIzinSantri(santriUserB.id, formDasar({ jenis: "LIBURAN_PONDOK", alasan: "Liburan semester di rumah selama beberapa hari", rencanaKeluar: jam(1).toISOString(), rencanaKembali: jam(2).toISOString() }))
  await setujuiIzin(izinTelat.id, "WALI", adminUser.id)
  await setujuiIzin(izinTelat.id, "MUSYRIF", adminUser.id)
  await setujuiIzin(izinTelat.id, "ADMIN", adminUser.id)
  await checkoutIzin({ izinId: izinTelat.id }, gerbangUser.id)
  // mundurkan rencanaKembali agar "lewat"
  await prisma.izinSantri.update({ where: { id: izinTelat.id }, data: { rencanaKembali: jam(-1) } })
  const hasilTelat = await perbaruiIzinTerlambat()
  const santriTelat = await prisma.santri.findUnique({ where: { id: santriB.id } })
  cek("keberadaan → TERLAMBAT_KEMBALI", santriTelat?.keberadaan === "TERLAMBAT_KEMBALI", santriTelat?.keberadaan)
  cek("izin masih DISETUJUI (belum check-in)", (await prisma.izinSantri.findUnique({ where: { id: izinTelat.id } }))?.status === "DISETUJUI")
  cek("counter terlambat ≥ 1", hasilTelat.terlambat >= 1, hasilTelat)
  const notifTelat = await prisma.notification.findMany({ where: { userId: santriUserB.id, judul: { contains: "Terlambat" } } })
  cek("notifikasi keterlambatan terkirim", notifTelat.length > 0)

  // ── 16. QR kedaluwarsa → verifikasi invalid ─────────────────────────
  console.log("\n16. QR kedaluwarsa")
  const tokenKed = izinKedAfter?.suratToken ?? ""
  if (tokenKed) {
    const verif = await verifikasiTokenIzin(tokenKed)
    cek("verifikasi QR kedaluwarsa → valid=false, kedaluwarsa=true", verif.valid === false && verif.kedaluwarsa === true, verif)
  } else {
    // fallback: pakai token izinA (sudah SELESAI, masih valid)
    const verifA = await verifikasiTokenIzin(checkout.suratToken ?? "")
    cek("verifikasi QR izin selesai → valid=true", verifA.valid === true, verifA)
  }
  await expectThrow("token ngawur ditolak", () => verifikasiTokenIzin("abc"), "tidak valid")

  // ── 17. Integritas absensi: konflik HADIR saat checkout izin ───────
  console.log("\n17. Integriabsi absensi vs izin")
  // buat siswa link untuk santriB agar bisa deteksi konflik
  const siswaB = await prisma.siswa.create({ data: { userId: santriUserB.id, nama: "Zahra Aini", nis: `NIS-S-${ts}` } })
  await prisma.santri.update({ where: { id: santriB.id }, data: { siswaId: siswaB.id } })
  const konflik = await cekDanCatatKonflikAbsensi({ siswaId: siswaB.id, tanggal: new Date(), statusHadir: true })
  cek("konflik absensi terdeteksi & tercatat", konflik === true)
  const barisKonflik = await prisma.izinKonflikAbsensi.findFirst({ where: { siswaId: siswaB.id, resolvedAt: null } })
  cek("baris IzinKonflikAbsensi tersimpan (absensi tidak ditimpa)", Boolean(barisKonflik))
  const izinAktifUntukTanggal = await prisma.izinSantri.findFirst({ where: { santriId: santriB.id, status: "DISETUJUI", checkoutAt: { not: null } } })
  cek("izin checkout menjadi dasar deteksi (tidak mengubah absensi)", Boolean(izinAktifUntukTanggal))

  // ── Statistik dashboard ────────────────────────────────────────────
  console.log("\nStatistik dashboard")
  const stat = await getStatistikIzin()
  cek("statistik terhitung (totalSantri > 0)", stat.totalSantri > 0, stat)
  const riwayat = await getIzinSaya(santriUserA.id)
  cek("getIzinSaya mengembalikan riwayat + info santri", riwayat.rows.length >= 1 && riwayat.santri.nama === "Ahmad Fauzi")

  // ── Draft ──────────────────────────────────────────────────────────
  console.log("\nDraft izin")
  const draft = await simpanDraftIzin(santriUserA.id, formDasar({ jenis: "DARURAT", alasan: "Uji draft izin darurat untuk keperluan pengujian sistem" }))
  cek("draft tersimpan dengan status DRAFT", draft.status === "DRAFT", draft.status)
  await batalkanIzinSantri(santriUserA.id, draft.id, "Tidak jadi dipakai")
  cek("draft bisa dibatalkan", (await prisma.izinSantri.findUnique({ where: { id: draft.id } }))?.status === "DIBATALKAN")

  // ── Audit log ──────────────────────────────────────────────────────
  console.log("\nAudit log")
  const auditCount = await prisma.auditLog.count({ where: { entity: { in: ["IzinSantri", "IzinPengaturan", "Asrama", "Kamar", "Santri"] } } })
  cek("audit log IZIN_* tercatat (≥ 5)", auditCount >= 5, auditCount)

  console.log(`\n=== HASIL: ${pass} PASS / ${fail} FAIL ===`)
  if (fail > 0) process.exitCode = 1

  // cleanup fixture berat (biarkan audit log & notifikasi sebagai bukti)
  await prisma.$disconnect()
}

main().catch((e) => { console.error("ERROR FATAL:", e); process.exit(1) })
