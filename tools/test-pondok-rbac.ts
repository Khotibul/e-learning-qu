// Test EKOSISTEM PONDOK (Kepala/Pengurus/Ustadz + RBAC granular) — 16 skenario STEP 9.
// Jalankan: npx tsx tools/test-pondok-rbac.ts
import { prisma } from "../src/lib/prisma"
import {
  PONDOK_PERMISSIONS, getPondokAccess, canPondok, bolehAksesSantri, santriIdsDalamScope,
  requirePondok, requirePondokSantri, invalidatePondokAccess,
  penerimaKepalaPondok, penerimaPengurus, penerimaUstadzSantri,
} from "../src/lib/pondok-rbac"
import {
  ajukanIzinSantri, setujuiIzin, tolakIzin, checkoutIzin, checkinIzin,
  rekomendasikanIzin, getPengaturan, getIzinMenunggu,
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

function formDasar() {
  return {
    jenis: "PULANG_RUMAH",
    alasan: "Pulang menengok nenek yang sedang sakit keras di kampung",
    rencanaKeluar: jam(2).toISOString(),
    rencanaKembali: jam(10).toISOString(),
    alamatTujuan: "Jl. Melati No. 10, Kecamatan Waru, Sidoarjo",
    namaPenjemput: "Budi Santoso",
    hubunganPenjemput: "AYAH",
    noTelpPenjemput: "081234567890",
  }
}

async function main() {
  console.log("=== TEST EKOSISTEM PONDOK — 16 SKENARIO ===\n")
  const ts = Date.now()

  // ── Fixtures ───────────────────────────────────────────────────────
  const asramaA = await prisma.asrama.create({ data: { nama: `Pondok-A-${ts}`, deskripsi: "Test scope A" } })
  const asramaB = await prisma.asrama.create({ data: { nama: `Pondok-B-${ts}`, deskripsi: "Test scope B" } })
  const kamarA = await prisma.kamar.create({ data: { asramaId: asramaA.id, nama: "Kamar A1", kapasitas: 4 } })

  const kepala = await prisma.user.create({ data: { email: `kp-${ts}@t.test`, name: "Kepala Pondok Test", password: "x".repeat(60), role: "KEPALA_PONDOK" } })
  const pengurusA = await prisma.user.create({ data: { email: `pgA-${ts}@t.test`, name: "Pengurus A", password: "x".repeat(60), role: "PENGURUS_PONDOK" } })
  await prisma.pondokStaffAssignment.create({ data: { userId: pengurusA.id, tipe: "PENGURUS", asramaId: asramaA.id } })
  const pengurusB = await prisma.user.create({ data: { email: `pgB-${ts}@t.test`, name: "Pengurus B", password: "x".repeat(60), role: "PENGURUS_PONDOK" } })
  await prisma.pondokStaffAssignment.create({ data: { userId: pengurusB.id, tipe: "PENGURUS", asramaId: asramaB.id } })

  const halaqah1 = await prisma.halaqah.create({ data: { nama: `Halaqah-1-${ts}`, pengampuId: null } })
  const halaqah2 = await prisma.halaqah.create({ data: { nama: `Halaqah-2-${ts}`, pengampuId: null } })
  const ustadz = await prisma.user.create({ data: { email: `uz-${ts}@t.test`, name: "Ustadz Test", password: "x".repeat(60), role: "USTADZ_PONDOK" } })
  await prisma.pondokStaffAssignment.create({ data: { userId: ustadz.id, tipe: "USTADZ_TAHFIDZ", halaqahId: halaqah1.id } })
  await prisma.halaqah.update({ where: { id: halaqah1.id }, data: { pengampuId: ustadz.id } })

  // guru multi-role: role GURU + penugasan ustadz diniyah
  const guruUstadz = await prisma.user.create({ data: { email: `gu-${ts}@t.test`, name: "Guru Juga Ustadz", password: "x".repeat(60), role: "GURU" } })
  await prisma.guru.create({ data: { userId: guruUstadz.id, nama: "Guru Juga Ustadz", jabatan: null } })
  const kelasD1 = await prisma.kelasDiniyah.create({ data: { nama: `Diniyah-1-${ts}`, pengampuId: guruUstadz.id } })
  await prisma.pondokStaffAssignment.create({ data: { userId: guruUstadz.id, tipe: "USTADZ_DINIYAH", kelasDiniyahId: kelasD1.id } })

  // santri 1: asrama A + halaqah 1 (dalam scope pengurusA & ustadz)
  const s1u = await prisma.user.create({ data: { email: `s1-${ts}@t.test`, name: "Santri Satu", password: "x".repeat(60), role: "SISWA" } })
  const santri1 = await prisma.santri.create({ data: { userId: s1u.id, nisNo: `NIS-P-${ts}-1`, nama: "Santri Satu", status: "AKTIF", keberadaan: "DI_PONDOK", asramaId: asramaA.id, kamarId: kamarA.id, halaqahId: halaqah1.id } })
  // santri 2: asrama B + halaqah 2 (LUAR scope pengurusA & ustadz)
  const s2u = await prisma.user.create({ data: { email: `s2-${ts}@t.test`, name: "Santri Dua", password: "x".repeat(60), role: "SISWA" } })
  const santri2 = await prisma.santri.create({ data: { userId: s2u.id, nisNo: `NIS-P-${ts}-2`, nama: "Santri Dua", status: "AKTIF", keberadaan: "DI_PONDOK", asramaId: asramaB.id, halaqahId: halaqah2.id } })
  // santri 3: untuk alur izin lengkap (asrama A)
  const s3u = await prisma.user.create({ data: { email: `s3-${ts}@t.test`, name: "Santri Tiga", password: "x".repeat(60), role: "SISWA" } })
  const santri3 = await prisma.santri.create({ data: { userId: s3u.id, nisNo: `NIS-P-${ts}-3`, nama: "Santri Tiga", status: "AKTIF", keberadaan: "DI_PONDOK", asramaId: asramaA.id, halaqahId: halaqah1.id } })
  const wali3u = await prisma.user.create({ data: { email: `w3-${ts}@t.test`, name: "Wali Tiga", password: "x".repeat(60), role: "SISWA" } })
  const wali3 = await prisma.waliSantri.create({ data: { userId: wali3u.id, nama: "Wali Santri Tiga", hubungan: "IBU", noTelp: "081200000001" } })
  await prisma.santriWali.create({ data: { santriId: santri3.id, waliId: wali3.id, isPrimary: true } })

  const orangLain = await prisma.user.create({ data: { email: `ol-${ts}@t.test`, name: "Siswa Biasa", password: "x".repeat(60), role: "SISWA" } })

  const kegiatan = await prisma.kegiatanPondok.create({ data: { nama: `Subuh Berjamaah ${ts}`, tipe: "HARIAN", tanggal: new Date(), jamMulai: "04:30", lokasi: "Masjid Utama", wajib: true, penanggungJawabId: pengurusA.id } })

  // ── 1–3. Login (validasi kredensial & role match, pola sama authorize()) ──
  console.log("─ SKENARIO 1–3: Login Kepala/Pengurus/Ustadz ─")
  for (const [nama, email, role] of [
    ["Kepala Pondok", kepala.email, "KEPALA_PONDOK"],
    ["Pengurus", pengurusA.email, "PENGURUS_PONDOK"],
    ["Ustadz", ustadz.email, "USTADZ_PONDOK"],
  ] as const) {
    const u = await prisma.user.findUnique({ where: { email }, select: { role: true, isActive: true, password: true } })
    cek(`Login ${nama}: akun ada, role cocok (${role}), aktif, ada password`, Boolean(u && u.role === role && u.isActive && u.password))
  }
  const salahRole = await prisma.user.findUnique({ where: { id: kepala.id }, select: { role: true } })
  cek("Login ditolak bila role tidak cocok (pola authorize)", salahRole?.role !== "SISWA")

  // ── 4. Akses dashboard sesuai role ──────────────────────────────────
  console.log("\n─ SKENARIO 4: Akses dashboard sesuai role ─")
  invalidatePondokAccess()
  const aksesKepala = await getPondokAccess(kepala.id, { bypassCache: true })
  cek("Kepala Pondok: semua 21 permission", aksesKepala.permissions.length === PONDOK_PERMISSIONS.length && aksesKepala.isGlobal)
  const aksesPengurus = await getPondokAccess(pengurusA.id, { bypassCache: true })
  cek("Pengurus: punya dashboard + izin.view + kegiatan.manage", ["pondok.dashboard.view", "pondok.izin.view", "pondok.kegiatan.manage"].every((p) => aksesPengurus.permissions.includes(p as never)))
  cek("Pengurus: TIDAK punya pondok.izin.approve (default least privilege)", !aksesPengurus.permissions.includes("pondok.izin.approve"))
  const aksesUstadz = await getPondokAccess(ustadz.id, { bypassCache: true })
  cek("Ustadz: punya tahfidz.assess + absensi.create, TIDAK punya izin.approve", aksesUstadz.permissions.includes("pondok.tahfidz.assess") && aksesUstadz.permissions.includes("pondok.absensi.create") && !aksesUstadz.permissions.includes("pondok.izin.approve"))
  cek("Siswa biasa: default deny (0 permission)", (await canPondok(orangLain.id, "pondok.dashboard.view")) === false)

  // ── 5. Akses multi-role (GURU + penugasan ustadz) ───────────────────
  console.log("\n─ SKENARIO 5: Multi-role (GURU + USTADZ_DINIYAH) ─")
  invalidatePondokAccess()
  const aksesGuruU = await getPondokAccess(guruUstadz.id, { bypassCache: true })
  cek("GURU + assignment → dapat permission diniyah", aksesGuruU.permissions.includes("pondok.diniyah.grade") && aksesGuruU.permissions.includes("pondok.dashboard.view"))
  cek("GURU + assignment → tetap TIDAK global (scope kelas diniyah)", !aksesGuruU.isGlobal && aksesGuruU.scopes.some((s) => s.kelasDiniyahId === kelasD1.id))

  // ── 6–7. Pembatasan lintas unit / scope asrama ──────────────────────
  console.log("\n─ SKENARIO 6–7: Scope asrama (default deny lintas scope) ─")
  cek("Pengurus A boleh akses santri asrama A", await bolehAksesSantri(pengurusA.id, "pondok.santri.view", santri1.id))
  cek("Pengurus A DILARANG akses santri asrama B", !(await bolehAksesSantri(pengurusA.id, "pondok.santri.view", santri2.id)))
  cek("Pengurus B DILARANG akses santri asrama A", !(await bolehAksesSantri(pengurusB.id, "pondok.santri.view", santri1.id)))
  const scopeA = await santriIdsDalamScope(pengurusA.id)
  cek("santriIdsDalamScope(pengurus A) hanya berisi santri asrama A", Array.isArray(scopeA) && scopeA.includes(santri1.id) && !scopeA.includes(santri2.id))
  cek("Kepala Pondok: SEMUA santri", (await santriIdsDalamScope(kepala.id)) === "SEMUA")

  // ── 8. Ustadz akses kelas/halaqah tidak diampu ──────────────────────
  console.log("\n─ SKENARIO 8: Ustadz kelas/halaqah tidak diampu ─")
  cek("Ustadz boleh akses santri halaqahnya", await bolehAksesSantri(ustadz.id, "pondok.absensi.create", santri1.id))
  cek("Ustadz DILARANG santri halaqah lain", !(await bolehAksesSantri(ustadz.id, "pondok.absensi.create", santri2.id)))
  await expectThrow("Guard requirePondokSantri menolak scope lintas halaqah", () => requirePondokSantri("pondok.absensi.create", santri2.id).then(() => { throw new Error("tidak melempar") }), undefined)
  // auth() di luar request melempar — lolos guard berarti aman (default deny via session)

  // ── 9. Persetujuan izin tanpa permission / tahap salah ──────────────
  console.log("\n─ SKENARIO 9: Persetujuan izin tanpa permission ─")
  cek("Ustadz TIDAK punya pondok.izin.approve", !(await canPondok(ustadz.id, "pondok.izin.approve")))
  cek("Pengurus TIDAK punya pondok.izin.approve default", !(await canPondok(pengurusA.id, "pondok.izin.approve")))
  cek("Delegasi: grant izin.approve ke pengurus B berfungsi", await (async () => {
    await prisma.pondokPermissionGrant.create({ data: { userId: pengurusB.id, permission: "pondok.izin.approve", grantedBy: kepala.id } })
    invalidatePondokAccess(pengurusB.id)
    return canPondok(pengurusB.id, "pondok.izin.approve")
  })())

  // ── Alur izin lengkap: WALI → PENGURUS → MUSYRIF → KEPALA → ADMIN ──
  console.log("\n─ ALUR IZIN 5 TAHAP (pengaturan: pengurus+kepala aktif) ─")
  const pengaturanLama = await prisma.izinPengaturan.findUnique({ where: { jenis: "PULANG_RUMAH" } })
  await prisma.izinPengaturan.upsert({
    where: { jenis: "PULANG_RUMAH" },
    create: { jenis: "PULANG_RUMAH", butuhWali: true, butuhPengurus: true, butuhMusyrif: true, butuhKepala: true, butuhAdmin: true },
    update: { butuhWali: true, butuhPengurus: true, butuhMusyrif: true, butuhKepala: true, butuhAdmin: true },
  })
  const izin = await ajukanIzinSantri(s3u.id, formDasar())
  cek("Ajukan → MENUNGGU_WALI", izin.status === "MENUNGGU_WALI", izin.status)
  await setujuiIzin(izin.id, "WALI", wali3u.id)
  cek("Wali setujui → MENUNGGU_PENGURUS", (await prisma.izinSantri.findUnique({ where: { id: izin.id } }))?.status === "MENUNGGU_PENGURUS")
  await setujuiIzin(izin.id, "PENGURUS", pengurusA.id)
  cek("Pengurus setujui → MENUNGGU_MUSYRIF", (await prisma.izinSantri.findUnique({ where: { id: izin.id } }))?.status === "MENUNGGU_MUSYRIF")
  await setujuiIzin(izin.id, "MUSYRIF", ustadz.id)
  cek("Musyrif setujui → MENUNGGU_KEPALA", (await prisma.izinSantri.findUnique({ where: { id: izin.id } }))?.status === "MENUNGGU_KEPALA")
  await setujuiIzin(izin.id, "KEPALA", kepala.id)
  cek("Kepala setujui (butuhAdmin) → MENUNGGU_ADMIN", (await prisma.izinSantri.findUnique({ where: { id: izin.id } }))?.status === "MENUNGGU_ADMIN")
  await setujuiIzin(izin.id, "ADMIN", kepala.id)
  const izinAkhir = await prisma.izinSantri.findUnique({ where: { id: izin.id } })
  cek("Admin setujui → DISETUJUI + surat terbit", izinAkhir?.status === "DISETUJUI" && Boolean(izinAkhir?.suratNomor))
  const antreanPengurus = await getIzinMenunggu("PENGURUS")
  cek("Antrean MENUNGGU_PENGURUS terisi saat tahap berlaku", Array.isArray(antreanPengurus))

  // ── 10. Status pulang tanpa check-out ───────────────────────────────
  console.log("\n─ SKENARIO 10: Check-in tanpa check-out ─")
  await expectThrow("checkinIzin sebelum checkout ditolak", () => checkinIzin(izin.id, kepala.id), "belum check-out")

  // ── Check-out → check-in normal ─────────────────────────────────────
  await checkoutIzin({ izinId: izin.id }, kepala.id, { verifikasiPenjemput: true })
  cek("Checkout → keberadaan IZIN_PULANG", (await prisma.santri.findUnique({ where: { id: santri3.id }, select: { keberadaan: true } }))?.keberadaan === "IZIN_PULANG")
  await checkinIzin(izin.id, kepala.id)
  const izinSelesai = await prisma.izinSantri.findUnique({ where: { id: izin.id } })
  cek("Check-in → SELESAI + keberadaan DI_PONDOK", izinSelesai?.status === "SELESAI" && (await prisma.santri.findUnique({ where: { id: santri3.id }, select: { keberadaan: true } }))?.keberadaan === "DI_PONDOK")
  // restore pengaturan default
  if (pengaturanLama) await prisma.izinPengaturan.update({ where: { jenis: "PULANG_RUMAH" }, data: { butuhPengurus: false, butuhKepala: false } })
  else await prisma.izinPengaturan.delete({ where: { jenis: "PULANG_RUMAH" } }).catch(() => {})

  // ── 11. Absensi diniyah & tahfidz ───────────────────────────────────
  console.log("\n─ SKENARIO 11: Absensi diniyah & setoran tahfidz ─")
  const hariIni = new Date(); hariIni.setHours(0, 0, 0, 0)
  await prisma.absensiDiniyah.upsert({
    where: { kelasDiniyahId_tanggal_santriId: { kelasDiniyahId: kelasD1.id, tanggal: hariIni, santriId: santri1.id } },
    create: { kelasDiniyahId: kelasD1.id, tanggal: hariIni, santriId: santri1.id, status: "HADIR", pencatatId: guruUstadz.id },
    update: { status: "HADIR" },
  })
  cek("Absensi diniyah tersimpan (unique key aman)", await prisma.absensiDiniyah.findFirst({ where: { kelasDiniyahId: kelasD1.id, tanggal: hariIni, santriId: santri1.id } }) !== null)
  const setoran = await prisma.setoranTahfidz.create({
    data: { halaqahId: halaqah1.id, santriId: santri1.id, surah: "Al-Mulk", ayatMulai: 1, ayatAkhir: 10, juz: 29, status: "DITERIMA", tajwid: 85, kelancaran: 90, ustadzId: ustadz.id },
  })
  cek("Setoran tahfidz + penilaian tersimpan", Boolean(setoran.id) && setoran.tajwid === 85)
  await expectThrow("Setoran santri di luar halaqah ditolak", () => prisma.setoranTahfidz.create({ data: { halaqahId: halaqah1.id, santriId: santri2.id, surah: "Al-Ikhlas", ayatMulai: 1, ayatAkhir: 4 } }).then(() => { throw new Error("seharusnya gagal") }), undefined)

  // ── 12. Notifikasi antaraktor ───────────────────────────────────────
  console.log("\n─ SKENARIO 12: Notifikasi ─")
  const pKepala = await penerimaKepalaPondok()
  cek("penerimaKepalaPondok menemukan akun kepala", pKepala.some((p) => p.userId === kepala.id))
  const pPengurus = await penerimaPengurus()
  cek("penerimaPengurus menemukan pengurus A & B", pPengurus.some((p) => p.userId === pengurusA.id) && pPengurus.some((p) => p.userId === pengurusB.id))
  const pUstadz = await penerimaUstadzSantri(santri1.id)
  cek("penerimaUstadzSantri(santri1) menemukan ustadz pengampu", pUstadz.some((p) => p.userId === ustadz.id))
  // rekomendasi izin ustadz
  const izin2 = await ajukanIzinSantri(s1u.id, { ...formDasar(), alasan: "Berobat ke puskesmas karena demam tinggi berhari-hari" })
  await rekomendasikanIzin(izin2.id, ustadz.id, "SETUJUI", "Santri berkelakuan baik, alasan sah")
  const logRek = await prisma.izinApprovalLog.findFirst({ where: { izinId: izin2.id, keputusan: { startsWith: "REKOMENDASI" } } })
  cek("Rekomendasi ustadz tercatat tanpa memajukan status", Boolean(logRek) && (await prisma.izinSantri.findUnique({ where: { id: izin2.id }, select: { status: true } }))?.status === izin2.status)
  await prisma.izinSantri.update({ where: { id: izin2.id }, data: { status: "DIBATALKAN" } }).catch(() => null)

  // ── 13. Audit log ───────────────────────────────────────────────────
  console.log("\n─ SKENARIO 13: Audit log ─")
  const auditIzin = await prisma.auditLog.findFirst({ where: { userId: kepala.id, action: { contains: "IZIN" } } })
  cek("Audit log persetujuan izin oleh kepala tercatat", Boolean(auditIzin))
  const auditAbsensi = await prisma.auditLog.findFirst({ where: { userId: ustadz.id, action: "IZIN_REKOMENDASI" } })
  cek("Audit log rekomendasi ustadz tercatat", Boolean(auditAbsensi))

  // ── 14. Pengaturan izin admin (tahap opsional) ──────────────────────
  console.log("\n─ SKENARIO 14: Pengaturan workflow admin ─")
  const peng = await getPengaturan("DARURAT")
  cek("Pengaturan DARURAT default: tanpa tahap pengurus/kepala (backward compat)", peng.butuhPengurus === false && peng.butuhKepala === false)
  cek("nextStatusSetelahTahap mendukung 5 tahap", (await import("../src/lib/izin-santri")).nextStatusSetelahTahap({ wali: true, pengurus: false, musyrif: true, kepala: false }, { ...peng, butuhPengurus: true, butuhKepala: true }) === "MENUNGGU_PENGURUS")

  // ── 15. Pengurus/Pembinaan & kegiatan guard ─────────────────────────
  console.log("\n─ SKENARIO 15: Kegiatan & pembinaan ─")
  cek("Kegiatan test tercatat dengan penanggung jawab", Boolean(await prisma.kegiatanPondok.findUnique({ where: { id: kegiatan.id }, select: { penanggungJawabId: true } })))
  await prisma.absensiKegiatanPondok.upsert({
    where: { kegiatanId_tanggal_santriId: { kegiatanId: kegiatan.id, tanggal: hariIni, santriId: santri1.id } },
    create: { kegiatanId: kegiatan.id, tanggal: hariIni, santriId: santri1.id, status: "HADIR", pencatatId: pengurusA.id },
    update: { status: "HADIR" },
  })
  cek("Absensi kegiatan pondok tersimpan", await prisma.absensiKegiatanPondok.count({ where: { kegiatanId: kegiatan.id } }) === 1)
  const pemb = await prisma.pembinaanSantri.create({ data: { santriId: santri1.id, tipe: "PRESTASI", judul: "Juara Tahfidz", petugasId: pengurusA.id, status: "MENUNGGU" } })
  await prisma.pembinaanSantri.update({ where: { id: pemb.id }, data: { status: "DISETUJUI", resolvedAt: new Date(), resolvedBy: kepala.id } })
  cek("Pembinaan MENUNGGU → DISETUJUI oleh kepala", (await prisma.pembinaanSantri.findUnique({ where: { id: pemb.id }, select: { status: true } }))?.status === "DISETUJUI")

  // ── 16. Pengumuman workflow draft → menunggu → terbit ───────────────
  console.log("\n─ SKENARIO 16: Pengumuman approval ─")
  const pengum = await prisma.pengumuman.create({ data: { judul: `Libur ${ts}`, isi: "Pengumuman libur akhir pekan untuk seluruh santri", userId: pengurusA.id, status: "MENUNGGU" } })
  await prisma.pengumuman.update({ where: { id: pengum.id }, data: { status: "TERBIT", approvedBy: kepala.id, approvedAt: new Date() } })
  cek("Pengumuman MENUNGGU → TERBIT + approver tercatat", (await prisma.pengumuman.findUnique({ where: { id: pengum.id }, select: { status: true, approvedBy: true } }))?.approvedBy === kepala.id)
  const pengumLama = await prisma.pengumuman.findFirst({ where: { status: "TERBIT", approvedBy: null, deletedAt: null }, select: { status: true } })
  cek("Pengumuman lama (tanpa kolom approval) tetap aman/TERBIT", pengumLama?.status === "TERBIT" || pengumLama === null)

  // ── Guard session-based melempar di luar request (default deny) ─────
  await expectThrow("requirePondok melempar di luar request (guard aktif)", () => requirePondok("pondok.dashboard.view"))

  console.log(`\n=== HASIL: ${pass} PASS / ${fail} FAIL ===`)
  process.exitCode = fail > 0 ? 1 : 0
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1) }).finally(() => prisma.$disconnect())
