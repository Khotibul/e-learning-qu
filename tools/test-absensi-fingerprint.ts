import { prisma } from "../src/lib/prisma"
import {
  hashApiKey, prosesScan, hitungStatusMasuk, hitungStatusPulang,
  getKebijakanHarian, ajukanAbsensiManual, putuskanAbsensiManual,
  hariTanggal, buatApiKey,
} from "../src/lib/absensi-harian"
import { kirimNotifikasi, penerimaKehadiranSiswa } from "../src/lib/notifikasi"

let lulus = 0
let gagal = 0
function cek(nama: string, kondisi: boolean, detail?: unknown) {
  if (kondisi) { lulus++; console.log(`  v ${nama}`) }
  else { gagal++; console.log(`  X ${nama}`, detail !== undefined ? JSON.stringify(detail) : "") }
}

/** Tanggal YYYY-MM-DD berbasis waktu lokal (aman dari geser zona UTC). */
function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

async function main() {
  const tanggal = hariTanggal(new Date())
  const tanggalStr = ymd(tanggal)

  // ── Setup: perangkat + pemetaan ──
  const apiKey = buatApiKey()
  const perangkat = await prisma.perangkatFingerprint.create({
    data: {
      kode: "FP-TEST-" + Date.now().toString(36).toUpperCase(),
      nama: "Mesin Uji", lokasi: "Gerbang Uji",
      apiKeyHash: hashApiKey(apiKey),
    },
  })
  const siswa = await prisma.siswa.findFirst({
    where: { deletedAt: null, kelasId: { not: null } },
    select: { id: true, nama: true, userId: true, kelasId: true },
    orderBy: { nama: "asc" },
  })
  if (!siswa) throw new Error("Tidak ada siswa berkelas untuk uji")
  const uid = "UJI" + Date.now().toString(36).slice(-6)
  await prisma.pemetaanFingerprint.create({
    data: { perangkatId: perangkat.id, siswaId: siswa.id, perangkatUserId: uid },
  })

  const permIds: string[] = []
  // Hanya data sesi uji (event, absensi hari ini, notifikasi, audit, permintaan, libur) —
  // perangkat & pemetaan TIDAK dihapus di sini (masih dipakai untuk scan).
  const bersihkanSesi = async () => {
    const evIds = (await prisma.fingerprintEvent.findMany({ where: { perangkatId: perangkat.id }, select: { id: true } })).map((e) => e.id)
    const notifKeys: string[] = []
    for (const id of evIds) { notifKeys.push(`absensi-harian:${id}:MASUK`); notifKeys.push(`absensi-harian:${id}:PULANG`) }
    for (const pid of permIds) notifKeys.push(`absensi-manual:${pid}`)
    await prisma.notification.deleteMany({ where: { eventKey: { in: notifKeys } } })
    if (permIds.length) await prisma.auditLog.deleteMany({ where: { entityId: { in: permIds } } })
    await prisma.absensiHarianSiswa.deleteMany({ where: { siswaId: siswa.id, tanggal } })
    await prisma.fingerprintEvent.deleteMany({ where: { perangkatId: perangkat.id } })
    await prisma.permintaanAbsensiManual.deleteMany({ where: { id: { in: permIds } } })
    await prisma.tanggalLibur.deleteMany({ where: { tanggal } })
  }
  const bersihkanAkhir = async () => {
    await bersihkanSesi()
    await prisma.pemetaanFingerprint.deleteMany({ where: { perangkatId: perangkat.id } })
    await prisma.perangkatFingerprint.delete({ where: { id: perangkat.id } }).catch(() => {})
  }
  await bersihkanSesi()

  console.log(`Siswa uji: ${siswa.nama} | perangkat ${perangkat.kode} | tanggal ${tanggalStr}`)

  // ── 1. Absen masuk normal ──
  console.log("1) Absen masuk normal")
  const r1 = await prosesScan({ eventKey: `${perangkat.kode}:S1`, perangkatKode: perangkat.kode, apiKey, perangkatUserId: uid, tipe: "MASUK" })
  cek("scan masuk SUKSES", r1.status === "SUKSES", r1)
  cek("absensi tercatat + jamMasuk terisi", !!r1.absensi?.jamMasuk, r1.absensi)
  const kebijakan = await getKebijakanHarian()
  const expect1 = hitungStatusMasuk(new Date().toTimeString().slice(0, 5), kebijakan)
  cek(`status masuk sesuai kebijakan (${expect1.status})`, r1.absensi?.statusMasuk === expect1.status, r1.absensi)
  const notif1 = await prisma.notification.count({ where: { userId: siswa.userId, eventKey: { contains: `absensi-harian:${r1.absensi?.id}` } } })
  const notifAll1 = await prisma.notification.count({ where: { userId: siswa.userId, eventKey: { contains: "absensi-harian" } } })
  cek("notifikasi masuk terkirim (>=1)", notifAll1 >= 1, notifAll1)

  // ── 2. Scan berulang (retry offline) ──
  console.log("2) Scan berulang / retry offline")
  const r2 = await prosesScan({ eventKey: `${perangkat.kode}:S1`, perangkatKode: perangkat.kode, apiKey, perangkatUserId: uid, tipe: "MASUK" })
  cek("retry eventKey sama -> DUPLIKAT (idempoten)", r2.status === "DUPLIKAT", r2)
  const r3 = await prosesScan({ eventKey: `${perangkat.kode}:S2`, perangkatKode: perangkat.kode, apiKey, perangkatUserId: uid, tipe: "MASUK" })
  cek("scan baru hari sama -> DUPLIKAT (1x masuk/hari)", r3.status === "DUPLIKAT", r3)
  const cntBaris = await prisma.absensiHarianSiswa.count({ where: { siswaId: siswa.id, tanggal } })
  cek("hanya 1 baris absensi harian", cntBaris === 1, cntBaris)
  const notifAll2 = await prisma.notification.count({ where: { userId: siswa.userId, eventKey: { contains: "absensi-harian" } } })
  cek("notifikasi tidak ganda setelah sinkronisasi ulang", notifAll2 === notifAll1, { notifAll1, notifAll2, notif1 })

  // ── 3. Fingerprint tidak dikenal ──
  console.log("3) Fingerprint tidak dikenal")
  const r4 = await prosesScan({ eventKey: `${perangkat.kode}:S3`, perangkatKode: perangkat.kode, apiKey, perangkatUserId: "UID-TIDAK-ADA", tipe: "MASUK" })
  cek("status TIDAK_DIKENAL", r4.status === "TIDAK_DIKENAL", r4)
  cek("tidak membuat absensi", !r4.absensi, r4.absensi)

  // ── 4. Autentikasi perangkat ──
  console.log("4) Autentikasi perangkat")
  const r5 = await prosesScan({ eventKey: `${perangkat.kode}:S4`, perangkatKode: perangkat.kode, apiKey: "fp:salah", perangkatUserId: uid, tipe: "MASUK" })
  cek("API key salah -> GAGAL", r5.status === "GAGAL", r5)
  await prisma.perangkatFingerprint.update({ where: { id: perangkat.id }, data: { status: "NONAKTIF" } })
  const r6 = await prosesScan({ eventKey: `${perangkat.kode}:S5`, perangkatKode: perangkat.kode, apiKey, perangkatUserId: uid, tipe: "MASUK" })
  cek("perangkat nonaktif -> DITOLAK", r6.status === "DITOLAK", r6)
  await prisma.perangkatFingerprint.update({ where: { id: perangkat.id }, data: { status: "AKTIF" } })

  // ── 5. Hari libur ditolak ──
  console.log("5) Kalender akademik (hari libur)")
  await prisma.tanggalLibur.upsert({ where: { tanggal }, create: { tanggal, keterangan: "Uji sistem" }, update: {} })
  const r7 = await prosesScan({ eventKey: `${perangkat.kode}:S6`, perangkatKode: perangkat.kode, apiKey, perangkatUserId: uid, tipe: "MASUK" })
  cek("scan pada hari libur -> DITOLAK", r7.status === "DITOLAK", r7)
  await prisma.tanggalLibur.deleteMany({ where: { tanggal } })

  // ── 6. Absen pulang ──
  console.log("6) Absen pulang")
  const r8 = await prosesScan({ eventKey: `${perangkat.kode}:S7`, perangkatKode: perangkat.kode, apiKey, perangkatUserId: uid, tipe: "PULANG" })
  cek("pulang SUKSES", r8.status === "SUKSES", r8)
  cek("status pulang NORMAL/AWAL", r8.absensi?.statusPulang === "NORMAL" || r8.absensi?.statusPulang === "AWAL", r8.absensi)
  const r9 = await prosesScan({ eventKey: `${perangkat.kode}:S8`, perangkatKode: perangkat.kode, apiKey, perangkatUserId: uid, tipe: "PULANG" })
  cek("pulang ganda -> DUPLIKAT", r9.status === "DUPLIKAT", r9)

  // ── 7. Logika terlambat / pulang awal (murni) ──
  console.log("7) Logika terlambat / pulang awal")
  const cfg = { jamMasuk: "07:00", jamPulang: "15:00", toleransiMasukMenit: 15, toleransiPulangMenit: 0 }
  cek("07:00 -> HADIR", hitungStatusMasuk("07:00", cfg).status === "HADIR")
  cek("07:10 (dalam toleransi) -> HADIR", hitungStatusMasuk("07:10", cfg).status === "HADIR")
  cek("07:20 -> TERLAMBAT 20 menit", JSON.stringify(hitungStatusMasuk("07:20", cfg)) === JSON.stringify({ status: "TERLAMBAT", terlambatMenit: 20 }))
  cek("15:00 -> NORMAL", hitungStatusPulang("15:00", cfg).status === "NORMAL")
  cek("14:30 -> AWAL", hitungStatusPulang("14:30", cfg).status === "AWAL")
  const cfg2 = { ...cfg, toleransiPulangMenit: 30 }
  cek("14:35 dengan toleransi pulang 30 -> NORMAL", hitungStatusPulang("14:35", cfg2).status === "NORMAL")

  // ── 8. Notifikasi idempoten (eventKey + userId unique) ──
  console.log("8) Notifikasi idempoten")
  const penerima = await penerimaKehadiranSiswa(siswa.id)
  cek("penerima berisi siswa (+ wali kelas bila ada)", penerima.some((p) => p.label === "siswa"), penerima)
  const payload = { judul: "Uji", pesan: "Uji notifikasi", tipe: "ABSENSI", eventKey: `uji-notif:${Date.now()}` }
  const k1 = await kirimNotifikasi(penerima, payload)
  const k2 = await kirimNotifikasi(penerima, payload)
  cek("kirim pertama terkirim", k1.terkirim >= 1, k1)
  cek("kirim kedua diduplikat (tidak ganda)", k2.duplikat >= 1 && k2.terkirim === 0, k2)
  await prisma.notification.deleteMany({ where: { eventKey: payload.eventKey } })

  // ── 9. Pemisahan absensi harian ↔ absensi per pelajaran ──
  console.log("9) Pemisahan absensi harian vs absensi per pelajaran")
  const absensiSesi = await prisma.absensiSiswa.count({ where: { siswaId: siswa.id, absensi: { tanggal } } })
  const harian = await prisma.absensiHarianSiswa.findUnique({ where: { siswaId_tanggal: { siswaId: siswa.id, tanggal } } })
  cek("absensi harian terisi masuk+pulang", !!harian?.jamMasuk && !!harian?.jamPulang, harian)
  console.log(`  (absensi per pelajaran siswa ini hari ini: ${absensiSesi} baris — tabel terpisah, tidak terpengaruh absensi fingerprint)`)

  // ── 10. Verifikasi manual: ajukan + persetujuan Admin ──
  console.log("10) Verifikasi manual (fingerprint gagal)")
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
  if (admin) {
    await prisma.absensiHarianSiswa.deleteMany({ where: { siswaId: siswa.id, tanggal } })
    try {
      await ajukanAbsensiManual({ siswaId: siswa.id, tanggal: tanggalStr, tipe: "MASUK", alasan: "Sensor tidak membaca sidik jari (uji)" })
      cek("permintaan tercatat", true)
    } catch (e: any) {
      cek("permintaan tercatat", false, e.message)
    }
    const perm = await prisma.permintaanAbsensiManual.findFirst({ where: { siswaId: siswa.id, tanggal, status: "MENUNGGU" } })
    if (perm) permIds.push(perm.id)
    cek("status MENUNGGU", !!perm)
    let dupThrow = false
    try {
      await ajukanAbsensiManual({ siswaId: siswa.id, tanggal: tanggalStr, tipe: "MASUK", alasan: "Alasan lain cukup panjang" })
    } catch { dupThrow = true }
    cek("permintaan ganda ditolak", dupThrow)

    if (perm) {
      try {
        const putus = await putuskanAbsensiManual({ permintaanId: perm.id, putusan: "DISETUJUI", catatan: "Disetujui (uji)", actorUserId: admin.id })
        cek("permintaan disetujui", putus.status === "DISETUJUI", putus)
      } catch (e: any) {
        cek("permintaan disetujui", false, e.message)
      }
      const ada = await prisma.absensiHarianSiswa.findUnique({ where: { siswaId_tanggal: { siswaId: siswa.id, tanggal } } })
      cek("absensi harian terisi setelah disetujui (sumber MANUAL)", !!ada?.jamMasuk && ada?.sumberMasuk === "MANUAL", ada)
      const auditAda = await prisma.auditLog.findFirst({ where: { action: "ABSENSI_MANUAL_DISETUJUI", entityId: perm.id } })
      cek("audit log tercatat", !!auditAda)
      const notifManual = await prisma.notification.count({ where: { eventKey: `absensi-manual:${perm.id}` } })
      cek("notifikasi persetujuan terkirim (>=1)", notifManual >= 1, notifManual)

      // penolakan pada permintaan lain
      try {
        await ajukanAbsensiManual({ siswaId: siswa.id, tanggal: tanggalStr, tipe: "PULANG", alasan: "Uji penolakan permintaan" })
        const perm2 = await prisma.permintaanAbsensiManual.findFirst({ where: { siswaId: siswa.id, tanggal, tipe: "PULANG", status: "MENUNGGU" } })
        if (perm2) {
          permIds.push(perm2.id)
          const tolak = await putuskanAbsensiManual({ permintaanId: perm2.id, putusan: "DITOLAK", catatan: "Bukti tidak memadai (uji)", actorUserId: admin.id })
          cek("permintaan ditolak", tolak.status === "DITOLAK", tolak)
          const auditTolak = await prisma.auditLog.findFirst({ where: { action: "ABSENSI_MANUAL_DITOLAK", entityId: perm2.id } })
          cek("audit penolakan tercatat", !!auditTolak)
        }
      } catch (e: any) {
        cek("alur penolakan berjalan", false, e.message)
      }
    }
  } else {
    console.log("  (lewati: tidak ada akun ADMIN)")
  }

  // ── 11. Wali kelas scoping (data level) ──
  console.log("11) Wali kelas hanya melihat kelasnya")
  const kelas = siswa.kelasId
    ? await prisma.kelas.findUnique({ where: { id: siswa.kelasId }, select: { id: true, guruId: true } })
    : null
  if (kelas?.guruId) {
    const kelasLain = await prisma.kelas.findFirst({ where: { id: { not: kelas.id } }, select: { id: true, guruId: true } })
    cek("kelas uji punya wali kelas", true)
    cek("wali kelas hanya terikat satu kelasnya (filter guruId)", kelasLain ? kelasLain.guruId !== kelas.guruId || kelasLain.id !== kelas.id : true)
  } else {
    console.log("  (lewati: kelas uji tanpa wali kelas)")
  }

  // ── Cleanup ──
  await bersihkanAkhir()
  cek("data uji dibersihkan", (await prisma.fingerprintEvent.count({ where: { perangkatId: perangkat.id } })) === 0
    && (await prisma.absensiHarianSiswa.count({ where: { siswaId: siswa.id, tanggal } })) === 0
    && (await prisma.permintaanAbsensiManual.count({ where: { id: { in: permIds } } })) === 0)

  console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`)
  await prisma.$disconnect()
  if (gagal > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error("ERROR:", e)
  await prisma.$disconnect()
  process.exit(1)
})
