import { ymd } from "@/lib/utils"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { jamKeMenit } from "@/lib/absensi-guru"
import { kirimNotifikasi, penerimaKehadiranSiswa, pesanAbsensiHarian } from "@/lib/notifikasi"

// ─── ABSENSI HARIAN SISWA (fingerprint masuk/pulang) ───────────────
// Rekaman terpisah dari Absensi per mata pelajaran. Scan diproses
// idempoten (eventKey unik), waktu server sebagai sumber waktu utama,
// dan tidak ada template biometrik mentah yang disimpan.

export type KebijakanHarian = {
  jamMasuk: string
  jamPulang: string
  toleransiMasukMenit: number
  toleransiPulangMenit: number
}

export async function getKebijakanHarian(): Promise<KebijakanHarian> {
  try {
    const cfg = await prisma.siteConfig.findFirst({
      select: { siswaJamMasuk: true, siswaJamPulang: true, siswaToleransiMenit: true, siswaPulangToleransiMenit: true },
    })
    return {
      jamMasuk: cfg?.siswaJamMasuk ?? "07:00",
      jamPulang: cfg?.siswaJamPulang ?? "15:00",
      toleransiMasukMenit: cfg?.siswaToleransiMenit ?? 15,
      toleransiPulangMenit: cfg?.siswaPulangToleransiMenit ?? 0,
    }
  } catch {
    return { jamMasuk: "07:00", jamPulang: "15:00", toleransiMasukMenit: 15, toleransiPulangMenit: 0 }
  }
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex")
}

export function buatApiKey(): string {
  return "fp_" + crypto.randomBytes(24).toString("hex")
}

export function hariTanggal(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Hari libur menurut kalender akademik (tabel tanggal_libur). */
export async function cekHariLibur(tanggal: Date): Promise<string | null> {
  const libur = await prisma.tanggalLibur.findUnique({ where: { tanggal: hariTanggal(tanggal) } })
  return libur ? libur.keterangan || "Hari libur" : null
}

export function hitungStatusMasuk(jamServer: string, cfg: KebijakanHarian): { status: "HADIR" | "TERLAMBAT"; terlambatMenit: number } {
  const menitSekarang = jamKeMenit(jamServer)
  const batas = jamKeMenit(cfg.jamMasuk)
  if (menitSekarang <= batas + cfg.toleransiMasukMenit) return { status: "HADIR", terlambatMenit: 0 }
  return { status: "TERLAMBAT", terlambatMenit: menitSekarang - batas }
}

export function hitungStatusPulang(jamServer: string, cfg: KebijakanHarian): { status: "NORMAL" | "AWAL" } {
  const batas = jamKeMenit(cfg.jamPulang) - cfg.toleransiPulangMenit
  return jamKeMenit(jamServer) < batas ? { status: "AWAL" } : { status: "NORMAL" }
}

export type HasilScan = {
  status: "SUKSES" | "DUPLIKAT" | "TIDAK_DIKENAL" | "DITOLAK" | "GAGAL"
  pesan: string
  eventKey: string
  absensi?: {
    id: string
    jamMasuk: string | null
    jamPulang: string | null
    statusMasuk: string | null
    statusPulang: string | null
    terlambatMenit: number | null
  } | null
}

/**
 * Proses satu scan fingerprint dari perangkat.
 * - Autentikasi perangkat via API key (hash) — komunikasi wajib HTTPS di produksi.
 * - Idempoten: eventKey unik `${kodePerangkat}:${scanId}` → scan ulang tidak
 *   menggandakan absensi maupun notifikasi (aman untuk retry offline).
 * - Waktu server (serverAt) adalah sumber waktu utama; deviceAt hanya informatif.
 */
export async function prosesScan(params: {
  eventKey: string
  perangkatKode: string
  apiKey: string
  perangkatUserId?: string | null
  nis?: string | null
  tipe: "MASUK" | "PULANG"
  deviceAt?: string | Date | null
}): Promise<HasilScan> {
  const { eventKey, perangkatKode, apiKey, perangkatUserId, nis, tipe, deviceAt } = params

  // 1) Autentikasi & identitas perangkat
  const perangkat = await prisma.perangkatFingerprint.findUnique({ where: { kode: perangkatKode } })
  if (!perangkat || perangkat.apiKeyHash !== hashApiKey(apiKey)) {
    return { status: "GAGAL", pesan: "API key perangkat tidak valid", eventKey }
  }
  if (perangkat.status !== "AKTIF") {
    return { status: "DITOLAK", pesan: "Perangkat dinonaktifkan Admin", eventKey }
  }
  await prisma.perangkatFingerprint.update({ where: { id: perangkat.id }, data: { lastSeenAt: new Date() } }).catch(() => {})

  // 2) Idempotensi — scan/retry yang sama tidak diproses ulang
  const existing = await prisma.fingerprintEvent.findUnique({ where: { eventKey } })
  if (existing) {
    const absensi = existing.siswaId
      ? await prisma.absensiHarianSiswa.findUnique({
          where: { siswaId_tanggal: { siswaId: existing.siswaId, tanggal: hariTanggal(new Date()) } },
          select: { id: true, jamMasuk: true, jamPulang: true, statusMasuk: true, statusPulang: true, terlambatMenit: true },
        })
      : null
    return {
      status: (existing.status as HasilScan["status"]) === "SUKSES" ? "DUPLIKAT" : (existing.status as HasilScan["status"]),
      pesan: existing.pesan ?? "Scan sudah pernah diproses",
      eventKey,
      absensi,
    }
  }

  // 3) Catat event (dibuat dulu — race aman oleh unique eventKey)
  let event
  try {
    event = await prisma.fingerprintEvent.create({
      data: {
        eventKey,
        perangkatId: perangkat.id,
        tipe,
        status: "DIPROSES",
        deviceAt: deviceAt ? new Date(deviceAt) : null,
      },
    })
  } catch (e: any) {
    if (e?.code === "P2002") {
      const again = await prisma.fingerprintEvent.findUnique({ where: { eventKey } })
      return { status: "DUPLIKAT", pesan: "Scan sudah pernah diproses", eventKey, absensi: null }
    }
    throw e
  }

  const selesai = async (status: HasilScan["status"], pesan: string, absensi: HasilScan["absensi"] = null) => {
    await prisma.fingerprintEvent.update({ where: { id: event.id }, data: { status, pesan } }).catch(() => {})
    return { status, pesan, eventKey, absensi } as HasilScan
  }

  try {
    // 4) Hari libur / kalender akademik
    const libur = await cekHariLibur(new Date())
    if (libur) return await selesai("DITOLAK", `Absensi ditolak: ${libur}`)

    // 5) Identitas siswa — pemetaan UID perangkat (bukan template biometrik)
    let siswa = null as Awaited<ReturnType<typeof cariSiswa>> | null
    siswa = await cariSiswa(perangkat.id, perangkatUserId, nis)
    if (!siswa) {
      await prisma.fingerprintEvent.update({ where: { id: event.id }, data: { siswaId: null } }).catch(() => {})
      return await selesai("TIDAK_DIKENAL", "Sidik jari tidak dikenal / belum terdaftar pada mesin ini")
    }
    await prisma.fingerprintEvent.update({ where: { id: event.id }, data: { siswaId: siswa.id } }).catch(() => {})

    const cfg = await getKebijakanHarian()
    const jamServer = new Date().toTimeString().slice(0, 5) // HH:MM (waktu server)
    const tanggal = hariTanggal(new Date())

    // 6) Proses masuk / pulang (cek ganda per hari)
    const baris = await prisma.absensiHarianSiswa.upsert({
      where: { siswaId_tanggal: { siswaId: siswa.id, tanggal } },
      create: { siswaId: siswa.id, tanggal },
      update: {},
    })

    if (tipe === "MASUK") {
      if (baris.jamMasuk) {
        return await selesai("DUPLIKAT", `Absen masuk sudah tercatat pukul ${baris.jamMasuk}`, ringkas(baris))
      }
      const h = hitungStatusMasuk(jamServer, cfg)
      // Update bersyarat (jamMasuk masih null) — mencegah scan serentak
      // dari dua mesin mengisi absen masuk dua kali (race condition).
      const res = await prisma.absensiHarianSiswa.updateMany({
        where: { id: baris.id, jamMasuk: null },
        data: { jamMasuk: jamServer, statusMasuk: h.status, terlambatMenit: h.terlambatMenit, sumberMasuk: "FINGERPRINT", eventMasukId: event.id },
      })
      if (res.count === 0) {
        const barisAkhir = await prisma.absensiHarianSiswa.findUnique({ where: { id: baris.id } })
        return await selesai("DUPLIKAT", `Absen masuk sudah tercatat pukul ${barisAkhir?.jamMasuk ?? jamServer}`, barisAkhir ? ringkas(barisAkhir) : null)
      }
      const updated = await prisma.absensiHarianSiswa.findUnique({ where: { id: baris.id } })
      await selesai("SUKSES", `Absen masuk tercatat pukul ${jamServer} (${h.status})`, updated ? ringkas(updated) : null)
      await kabarkan(siswa.id, "MASUK", jamServer, h.status, h.terlambatMenit, event.id)
      return { status: "SUKSES", pesan: `Absen masuk tercatat pukul ${jamServer} (${h.status})`, eventKey, absensi: updated ? ringkas(updated) : null }
    }

    // PULANG
    if (!baris.jamMasuk) {
      return await selesai("DITOLAK", "Belum ada absen masuk hari ini")
    }
    if (baris.jamPulang) {
      return await selesai("DUPLIKAT", `Absen pulang sudah tercatat pukul ${baris.jamPulang}`, ringkas(baris))
    }
    const hp = hitungStatusPulang(jamServer, cfg)
    // Update bersyarat (jamPulang masih null) — cegah pencatatan pulang ganda
    // saat sinkronisasi/retry berjalan bersamaan.
    const resP = await prisma.absensiHarianSiswa.updateMany({
      where: { id: baris.id, jamPulang: null },
      data: { jamPulang: jamServer, statusPulang: hp.status, sumberPulang: "FINGERPRINT", eventPulangId: event.id },
    })
    if (resP.count === 0) {
      const barisAkhir = await prisma.absensiHarianSiswa.findUnique({ where: { id: baris.id } })
      return await selesai("DUPLIKAT", `Absen pulang sudah tercatat pukul ${barisAkhir?.jamPulang ?? jamServer}`, barisAkhir ? ringkas(barisAkhir) : null)
    }
    const updatedP = await prisma.absensiHarianSiswa.findUnique({ where: { id: baris.id } })
    await selesai("SUKSES", `Absen pulang tercatat pukul ${jamServer} (${hp.status})`, updatedP ? ringkas(updatedP) : null)
    await kabarkan(siswa.id, "PULANG", jamServer, hp.status, null, event.id)
    return { status: "SUKSES", pesan: `Absen pulang tercatat pukul ${jamServer} (${hp.status})`, eventKey, absensi: updatedP ? ringkas(updatedP) : null }
  } catch (e: any) {
    console.error("prosesScan error:", e)
    return await selesai("GAGAL", "Gagal memproses scan — coba lagi (retry aman)")
  }
}

async function cariSiswa(perangkatId: string, perangkatUserId?: string | null, nis?: string | null) {
  if (perangkatUserId) {
    const p = await prisma.pemetaanFingerprint.findUnique({
      where: { perangkatId_perangkatUserId: { perangkatId, perangkatUserId } },
      include: { siswa: { select: { id: true, nama: true, userId: true, kelas: { select: { nama: true, guruId: true } } } } },
    })
    if (p?.siswa) return p.siswa
  }
  if (nis) {
    return prisma.siswa.findFirst({
      where: { nis, deletedAt: null },
      select: { id: true, nama: true, userId: true, kelas: { select: { nama: true, guruId: true } } },
    })
  }
  return null
}

function ringkas(b: { id: string; jamMasuk: string | null; jamPulang: string | null; statusMasuk: string | null; statusPulang: string | null; terlambatMenit: number | null }) {
  return { id: b.id, jamMasuk: b.jamMasuk, jamPulang: b.jamPulang, statusMasuk: b.statusMasuk, statusPulang: b.statusPulang, terlambatMenit: b.terlambatMenit }
}

/** Notifikasi hanya dibuat dari absensi yang sudah tervalidasi backend. */
async function kabarkan(
  siswaId: string,
  tipe: "MASUK" | "PULANG",
  jam: string,
  status: string,
  terlambatMenit: number | null,
  eventId: string
) {
  try {
    const penerima = await penerimaKehadiranSiswa(siswaId)
    const siswa = await prisma.siswa.findUnique({
      where: { id: siswaId },
      select: { nama: true, kelas: { select: { nama: true } } },
    })
    if (!siswa) return
    const isi = pesanAbsensiHarian({
      nama: siswa.nama,
      kelasNama: siswa.kelas?.nama ?? null,
      tipe,
      jam,
      status,
      terlambatMenit,
    })
    await kirimNotifikasi(penerima, {
      ...isi,
      tipe: "ABSENSI",
      link: tipe === "MASUK" ? "/siswa/kehadiran" : "/siswa/kehadiran",
      eventKey: `absensi-harian:${eventId}:${tipe}`,
    })
  } catch (e) {
    console.error("Gagal kirim notifikasi absensi:", e)
  }
}

// ─── KOREKSI / MANUAL (perlu persetujuan Admin) ────────────────────

export async function ajukanAbsensiManual(params: {
  siswaId: string
  tanggal: string
  tipe: "MASUK" | "PULANG"
  alasan: string
}): Promise<void> {
  const { siswaId, tanggal, tipe, alasan } = params
  if (alasan.trim().length < 5) throw new Error("Alasan wajib diisi (min. 5 karakter)")
  if (!["MASUK", "PULANG"].includes(tipe)) throw new Error("Tipe absensi tidak valid")
  const tgl = hariTanggal(new Date(tanggal))

  const dup = await prisma.permintaanAbsensiManual.findFirst({
    where: { siswaId, tanggal: tgl, tipe, status: "MENUNGGU" },
    select: { id: true },
  })
  if (dup) throw new Error("Permintaan manual untuk tanggal ini sedang menunggu persetujuan Admin")

  await prisma.permintaanAbsensiManual.create({ data: { siswaId, tanggal: tgl, tipe, alasan: alasan.trim() } })
}

/** Setujui/tolak permintaan manual → menulis AbsensiHarianSiswa + AuditLog + notifikasi. */
export async function putuskanAbsensiManual(params: {
  permintaanId: string
  putusan: "DISETUJUI" | "DITOLAK"
  catatan?: string
  actorUserId: string
}): Promise<{ status: string }> {
  const { permintaanId, putusan, catatan, actorUserId } = params
  const req = await prisma.permintaanAbsensiManual.findUnique({ where: { id: permintaanId }, include: { siswa: { select: { id: true, nama: true, userId: true } } } })
  if (!req) throw new Error("Permintaan tidak ditemukan")
  if (req.status !== "MENUNGGU") throw new Error("Permintaan sudah diputuskan")

  if (putusan === "DITOLAK") {
    await prisma.permintaanAbsensiManual.update({
      where: { id: req.id },
      data: { status: "DITOLAK", catatanAdmin: catatan ?? null, reviewedBy: actorUserId },
    })
    await audit(actorUserId, "ABSENSI_MANUAL_DITOLAK", "PermintaanAbsensiManual", req.id, { alasan: req.alasan, catatan })
    return { status: "DITOLAK" }
  }

  const cfg = await getKebijakanHarian()
  const jamServer = new Date().toTimeString().slice(0, 5)
  const tanggal = hariTanggal(req.tanggal)

  let baris = await prisma.absensiHarianSiswa.findUnique({ where: { siswaId_tanggal: { siswaId: req.siswaId, tanggal } } })
  if (!baris) baris = await prisma.absensiHarianSiswa.create({ data: { siswaId: req.siswaId, tanggal } })

  if (req.tipe === "MASUK") {
    if (baris.jamMasuk) throw new Error(`Absen masuk sudah tercatat pukul ${baris.jamMasuk}`)
    const h = hitungStatusMasuk(jamServer, cfg)
    await prisma.absensiHarianSiswa.update({
      where: { id: baris.id },
      data: { jamMasuk: jamServer, statusMasuk: h.status, terlambatMenit: h.terlambatMenit, sumberMasuk: "MANUAL", koreksiAlasan: req.alasan },
    })
  } else {
    if (baris.jamPulang) throw new Error(`Absen pulang sudah tercatat pukul ${baris.jamPulang}`)
    const hp = hitungStatusPulang(jamServer, cfg)
    await prisma.absensiHarianSiswa.update({
      where: { id: baris.id },
      data: { jamPulang: jamServer, statusPulang: hp.status, sumberPulang: "MANUAL", koreksiAlasan: req.alasan },
    })
  }

  await prisma.permintaanAbsensiManual.update({
    where: { id: req.id },
    data: { status: "DISETUJUI", catatanAdmin: catatan ?? null, reviewedBy: actorUserId },
  })
  await audit(actorUserId, "ABSENSI_MANUAL_DISETUJUI", "PermintaanAbsensiManual", req.id, { tipe: req.tipe, alasan: req.alasan, catatan })

  const penerima = await penerimaKehadiranSiswa(req.siswaId)
  await kirimNotifikasi(penerima, {
    judul: `Absensi ${req.tipe} (manual disetujui)`,
    pesan: `Absensi ${req.tipe} sekolah untuk ${req.siswa.nama} pada ${ymd(tanggal)} telah disetujui Admin dan dicatat pukul ${jamServer} WIB.`,
    tipe: "ABSENSI",
    link: "/siswa/kehadiran",
    eventKey: `absensi-manual:${req.id}`,
  })
  return { status: "DISETUJUI" }
}

/** Koreksi nilai absensi harian oleh Admin (alasan wajib + audit log). */
export async function koreksiAbsensiHarian(params: {
  absensiId: string
  jamMasuk?: string | null
  jamPulang?: string | null
  statusMasuk?: string | null
  statusPulang?: string | null
  alasan: string
  actorUserId: string
}): Promise<void> {
  const { absensiId, jamMasuk, jamPulang, statusMasuk, statusPulang, alasan, actorUserId } = params
  if (!alasan || alasan.trim().length < 5) throw new Error("Alasan koreksi wajib diisi (min. 5 karakter)")
  const lama = await prisma.absensiHarianSiswa.findUnique({ where: { id: absensiId } })
  if (!lama) throw new Error("Data absensi harian tidak ditemukan")

  const data: Record<string, unknown> = { koreksiAlasan: alasan.trim() }
  if (jamMasuk !== undefined) data.jamMasuk = jamMasuk || null
  if (jamPulang !== undefined) data.jamPulang = jamPulang || null
  if (statusMasuk !== undefined) data.statusMasuk = statusMasuk || null
  if (statusPulang !== undefined) data.statusPulang = statusPulang || null
  if (jamMasuk !== undefined || statusMasuk !== undefined) data.sumberMasuk = "KOREKSI"
  if (jamPulang !== undefined || statusPulang !== undefined) data.sumberPulang = "KOREKSI"
  if (jamMasuk === null) data.eventMasukId = null
  if (jamPulang === null) data.eventPulangId = null

  const baru = await prisma.absensiHarianSiswa.update({ where: { id: absensiId }, data })
  await audit(actorUserId, "KOREKSI_ABSENSI_HARIAN", "AbsensiHarianSiswa", absensiId, {
    lama: { jamMasuk: lama.jamMasuk, jamPulang: lama.jamPulang, statusMasuk: lama.statusMasuk, statusPulang: lama.statusPulang },
    baru: { jamMasuk: baru.jamMasuk, jamPulang: baru.jamPulang, statusMasuk: baru.statusMasuk, statusPulang: baru.statusPulang },
    alasan: alasan.trim(),
  })
}

export async function audit(userId: string, action: string, entity: string, entityId?: string, detail?: unknown) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, entity, entityId: entityId ?? null, detail: (detail ?? undefined) as never },
    })
  } catch (e) {
    console.error("Audit log gagal:", e)
  }
}
