import { prisma } from "@/lib/prisma"
import type { StatusAbsensiGuruSesi } from "@prisma/client"
import {
  getKebijakanLokasi,
  getMetodeGuru,
  validasiVerifikasi,
  type KebijakanLokasi,
  type TitikAbsensi,
} from "@/lib/absensi-lokasi"

// ─── WAKTU (server sebagai acuan absolut) ──────────────────────────
export function resolveHari(tanggal: string): string {
  const dayName = new Date(tanggal + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long" })
  return dayName.charAt(0).toUpperCase() + dayName.slice(1)
}

export function dayStart(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function dayEnd(d: Date): Date {
  const x = dayStart(d)
  x.setDate(x.getDate() + 1)
  return x
}

export function jamKeMenit(jam: string | null | undefined): number {
  if (!jam) return -1
  const [h, m] = jam.split(":").map((v) => parseInt(v, 10))
  if (Number.isNaN(h)) return -1
  return h * 60 + (Number.isNaN(m) ? 0 : m)
}

export function menitKeJam(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function nowMenit(): number {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

export function jamServer(): string {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`
}

export function tanggalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ─── KEBIJAKAN ADMIN (SiteConfig) ──────────────────────────────────
export type KebijakanAbsensi = {
  toleransiTerlambatMenit: number
  autoTidakHadirSetelahMenit: number
  metode: string
  fotoRetensiHari: number
  lokasi: KebijakanLokasi
}

const KEBIJAKAN_DEFAULT: KebijakanAbsensi = {
  toleransiTerlambatMenit: 15,
  autoTidakHadirSetelahMenit: 60,
  metode: "TANPA",
  fotoRetensiHari: 90,
  lokasi: { metode: "TANPA", gpsWajib: false, lokasiNama: null, lat: null, lng: null, radiusMeter: 100, akurasiMaksMeter: 50 },
}

export async function getKebijakanAbsensi(): Promise<KebijakanAbsensi> {
  try {
    const [cfg, lokasi] = await Promise.all([
      prisma.siteConfig.findFirst({ select: { toleransiTerlambatMenit: true, autoTidakHadirSetelahMenit: true, absensiMetode: true, fotoRetensiHari: true } }),
      getKebijakanLokasi(),
    ])
    return {
      toleransiTerlambatMenit: cfg?.toleransiTerlambatMenit ?? KEBIJAKAN_DEFAULT.toleransiTerlambatMenit,
      autoTidakHadirSetelahMenit: cfg?.autoTidakHadirSetelahMenit ?? KEBIJAKAN_DEFAULT.autoTidakHadirSetelahMenit,
      metode: cfg?.absensiMetode || "TANPA",
      fotoRetensiHari: cfg?.fotoRetensiHari ?? KEBIJAKAN_DEFAULT.fotoRetensiHari,
      lokasi,
    }
  } catch {
    return KEBIJAKAN_DEFAULT
  }
}

/** Retensi foto bukti: hapus file Upload yang melewati batas retensi Admin. */
export async function jalanRetensiFoto(): Promise<number> {
  try {
    const cfg = await prisma.siteConfig.findFirst({ select: { fotoRetensiHari: true } })
    const hari = Math.max(1, cfg?.fotoRetensiHari ?? 90)
    const batas = new Date(Date.now() - hari * 24 * 60 * 60 * 1000)
    const rows = await prisma.absensiGuruSesi.findMany({
      where: { fotoUrl: { not: null }, updatedAt: { lt: batas } },
      select: { id: true, fotoUrl: true },
      take: 200,
    })
    let n = 0
    for (const r of rows) {
      const m = /\/api\/upload\/([0-9a-fA-F-]{36})/.exec(r.fotoUrl || "")
      if (m) {
        await prisma.upload.delete({ where: { id: m[1] } }).catch(() => {})
      }
      await prisma.absensiGuruSesi.update({ where: { id: r.id }, data: { fotoUrl: null } })
      n++
    }
    return n
  } catch {
    return 0
  }
}

// ─── TIPE ──────────────────────────────────────────────────────────
export type SesiAbsensi = {
  jadwalId: string
  kelasId: string
  kelasNama: string
  mataPelajaranId: string
  mataPelajaranNama: string
  hari: string
  jamMulai: string
  jamSelesai: string
  status: StatusAbsensiGuruSesi // status efektif (termasuk hasil finalisasi otomatis)
  fase: "SEBELUM" | "AKTIF" | "SELESAI" // posisi sesi terhadap waktu server
  absensiId: string | null
  jamMasuk: string | null
  jamKeluar: string | null
  durasiMenit: number | null
  terlambatMenit: number | null
  keterangan: string | null
  koreksiAlasan: string | null
  koreksiBy: string | null
  penggantiNama: string | null
  penggantiStatus: string | null
  // ── Bukti verifikasi ──
  metode: string
  fotoUrl: string | null
  gps: { lat: number; lng: number; akurasiMeter: number | null; jarakMeter: number | null; valid: boolean; mock: boolean } | null
  sidikJariVerified: boolean
  sidikJariProvider: string | null
  verifikasiCatatan: string | null
}

export type VerifikasiPayload = {
  fotoUrl?: string | null
  gps?: TitikAbsensi | null
  sidikJari?: { verified: boolean; provider?: string | null } | null
}

async function getPasanganPengajaran(guruId: string) {
  const pengajaran = await prisma.pengajaran.findMany({
    where: { guruId, deletedAt: null },
    select: { kelasId: true, mataPelajaranId: true },
  })
  return pengajaran
}

// ─── FINALISASI OTOMATIS: sesi lewat batas & belum absen → TIDAK_HADIR ──
export async function finalisasiSesiTanggal(guruId: string | null, tanggal: string): Promise<number> {
  const kebijakan = await getKebijakanAbsensi()
  const date = dayStart(new Date(tanggal))
  const hari = resolveHari(tanggal)
  const nm = nowMenit()

  const [jadwal, pengajaran, pengganti] = await Promise.all([
    prisma.jadwalPelajaran.findMany({
      where: { hari, deletedAt: null },
      select: { id: true, kelasId: true, mataPelajaranId: true, jamSelesai: true },
    }),
    prisma.pengajaran.findMany({
      where: { deletedAt: null },
      select: { kelasId: true, mataPelajaranId: true, guruId: true },
    }),
    prisma.penggantiGuru.findMany({
      where: { tanggal: date, status: "DISETUJUI" },
      select: { jadwalPelajaranId: true, penggantiGuruId: true },
    }),
  ])

  // pasangan (guru, jadwal) yang dijadwalkan pada tanggal ini
  const pasangan = new Set<string>()
  const keyPengajaran = new Map<string, string[]>()
  for (const p of pengajaran) {
    const k = `${p.kelasId}|${p.mataPelajaranId}`
    if (!keyPengajaran.has(k)) keyPengajaran.set(k, [])
    keyPengajaran.get(k)!.push(p.guruId)
  }
  for (const j of jadwal) {
    const guruIds = keyPengajaran.get(`${j.kelasId}|${j.mataPelajaranId}`) ?? []
    for (const gid of guruIds) pasangan.add(`${gid}|${j.id}`)
  }
  for (const pg of pengganti) pasangan.add(`${pg.penggantiGuruId}|${pg.jadwalPelajaranId}`)

  if (guruId) {
    for (const k of Array.from(pasangan)) {
      if (!k.startsWith(`${guruId}|`)) pasangan.delete(k)
    }
  }
  if (pasangan.size === 0) return 0

  const existing = await prisma.absensiGuruSesi.findMany({
    where: { tanggal: date, ...(guruId ? { guruId } : {}) },
    select: { id: true, guruId: true, jadwalPelajaranId: true, status: true },
  })
  const existingMap = new Map(existing.map((e) => [`${e.guruId}|${e.jadwalPelajaranId}`, e]))
  const jadwalById = new Map(jadwal.map((j) => [j.id, j]))

  const createRows: { guruId: string; jadwalPelajaranId: string; tanggal: Date; status: StatusAbsensiGuruSesi }[] = []
  const updateIds: string[] = []

  for (const key of pasangan) {
    const [gid, jid] = key.split("|")
    const j = jadwalById.get(jid)
    if (!j) continue
    const batas = jamKeMenit(j.jamSelesai) + kebijakan.autoTidakHadirSetelahMenit
    if (batas < 0 || nm <= batas) continue

    const rec = existingMap.get(key)
    if (!rec) {
      createRows.push({ guruId: gid, jadwalPelajaranId: jid, tanggal: date, status: "TIDAK_HADIR" })
    } else if (rec.status === "BELUM_ABSEN") {
      updateIds.push(rec.id)
    }
  }

  if (updateIds.length > 0) {
    await prisma.absensiGuruSesi.updateMany({
      where: { id: { in: updateIds } },
      data: { status: "TIDAK_HADIR" },
    })
  }
  if (createRows.length > 0) {
    await prisma.absensiGuruSesi.createMany({ data: createRows as never, skipDuplicates: true })
  }
  return updateIds.length + createRows.length
}

// ─── JADWAL + STATUS ABSENSI SESEI (dipakai web & mobile) ──────────
export async function getJadwalGuruDenganStatus(guruId: string, tanggal: string): Promise<SesiAbsensi[]> {
  await finalisasiSesiTanggal(guruId, tanggal)
  const hari = resolveHari(tanggal)
  const date = dayStart(new Date(tanggal))
  const kebijakan = await getKebijakanAbsensi()
  const metode = await getMetodeGuru(guruId)
  const nm = nowMenit()

  const pengajaran = await getPasanganPengajaran(guruId)
  const penggantiRows = await prisma.penggantiGuru.findMany({
    where: { tanggal: date, status: "DISETUJUI", OR: [{ asliGuruId: guruId }, { penggantiGuruId: guruId }] },
    select: {
      jadwalPelajaranId: true,
      status: true,
      asliGuruId: true,
      penggantiGuruId: true,
      asliGuru: { select: { nama: true } },
      pengganti: { select: { nama: true } },
    },
  })

  const orConditions: { kelasId: string; mataPelajaranId: string }[] = pengajaran.map((p) => ({
    kelasId: p.kelasId,
    mataPelajaranId: p.mataPelajaranId,
  }))
  const jadwalIdTambahan = penggantiRows.map((p) => p.jadwalPelajaranId)

  if (orConditions.length === 0 && jadwalIdTambahan.length === 0) return []

  const jadwal = await prisma.jadwalPelajaran.findMany({
    where: {
      hari,
      deletedAt: null,
      OR: [
        ...orConditions,
        ...(jadwalIdTambahan.length > 0 ? [{ id: { in: jadwalIdTambahan } }] : []),
      ],
    },
    include: {
      kelas: { select: { id: true, nama: true } },
      mataPelajaran: { select: { id: true, nama: true, kode: true } },
    },
    orderBy: [{ jamMulai: "asc" }, { kelas: { nama: "asc" } }],
  })

  if (jadwal.length === 0) return []

  const sesiRows = await prisma.absensiGuruSesi.findMany({ where: { guruId, tanggal: date } })
  const sesiMap = new Map(sesiRows.map((s) => [s.jadwalPelajaranId, s]))

  const penggantiMap = new Map<string, { nama: string; status: string; role: "ASLI" | "PENGGANTI" }>()
  for (const p of penggantiRows) {
    const sebagai = p.penggantiGuruId === guruId ? "PENGGANTI" : "ASLI"
    penggantiMap.set(p.jadwalPelajaranId, {
      nama: sebagai === "PENGGANTI" ? (p.asliGuru?.nama ?? "-") : (p.pengganti?.nama ?? "-"),
      status: p.status,
      role: sebagai,
    })
  }

  return jadwal.map((j) => {
    const rec = sesiMap.get(j.id)
    const mulai = jamKeMenit(j.jamMulai)
    const selesai = jamKeMenit(j.jamSelesai)
    const fase: SesiAbsensi["fase"] = nm < mulai ? "SEBELUM" : nm <= selesai ? "AKTIF" : "SELESAI"
    const pg = penggantiMap.get(j.id)
    return {
      jadwalId: j.id,
      kelasId: j.kelas.id,
      kelasNama: j.kelas.nama,
      mataPelajaranId: j.mataPelajaran.id,
      mataPelajaranNama: j.mataPelajaran.nama,
      hari: j.hari,
      jamMulai: j.jamMulai,
      jamSelesai: j.jamSelesai,
      status: (rec?.status ?? "BELUM_ABSEN") as StatusAbsensiGuruSesi,
      fase,
      absensiId: rec?.id ?? null,
      jamMasuk: rec?.jamMasuk ?? null,
      jamKeluar: rec?.jamSelesai ?? null,
      durasiMenit: rec?.durasiMenit ?? null,
      terlambatMenit: rec?.terlambatMenit ?? null,
      keterangan: rec?.keterangan ?? null,
      koreksiAlasan: rec?.koreksiAlasan ?? null,
      koreksiBy: rec?.koreksiBy ?? null,
      penggantiNama: pg?.nama ?? null,
      penggantiStatus: pg?.status ?? null,
      metode,
      fotoUrl: rec?.fotoUrl ?? null,
      gps:
        rec?.gpsLat != null && rec?.gpsLng != null
          ? {
              lat: rec.gpsLat,
              lng: rec.gpsLng,
              akurasiMeter: rec.gpsAkurasiMeter ?? null,
              jarakMeter: rec.gpsJarakMeter ?? null,
              valid: rec.gpsValid ?? false,
              mock: rec.mockLocation ?? false,
            }
          : null,
      sidikJariVerified: rec?.sidikJariVerified ?? false,
      sidikJariProvider: rec?.sidikJariProvider ?? null,
      verifikasiCatatan: rec?.verifikasiCatatan ?? null,
    }
  })
}

// ─── VALIDASI KEPEMILIKAN (pengampu ATAU pengganti resmi) ──────────
export async function validasiKepemilikanSesi(guruId: string, jadwalPelajaranId: string, tanggal: string) {
  const jadwal = await prisma.jadwalPelajaran.findFirst({
    where: { id: jadwalPelajaranId, deletedAt: null },
    select: { id: true, kelasId: true, mataPelajaranId: true, hari: true, jamMulai: true, jamSelesai: true },
  })
  if (!jadwal) throw new Error("Jadwal tidak ditemukan")

  const date = dayStart(new Date(tanggal))
  const pengampu = await prisma.pengajaran.findFirst({
    where: { guruId, kelasId: jadwal.kelasId, mataPelajaranId: jadwal.mataPelajaranId, deletedAt: null },
    select: { id: true },
  })
  const pengganti = await prisma.penggantiGuru.findFirst({
    where: { jadwalPelajaranId, tanggal: date, penggantiGuruId: guruId, status: "DISETUJUI" },
    select: { id: true },
  })
  if (!pengampu && !pengganti) throw new Error("Anda tidak mengampu mapel ini di kelas tersebut")

  return jadwal
}

// ─── ABSEN MASUK (waktu server, cegah ganda, validasi metode Admin) ──
export async function absenMasukSesi(params: {
  guruId: string
  jadwalPelajaranId: string
  tanggal: string
  keterangan?: string | null
  verifikasi?: VerifikasiPayload
}): Promise<SesiAbsensi> {
  const { guruId, jadwalPelajaranId, tanggal, keterangan, verifikasi } = params
  const jadwal = await validasiKepemilikanSesi(guruId, jadwalPelajaranId, tanggal)
  const kebijakan = await getKebijakanAbsensi()
  const date = dayStart(new Date(tanggal))
  const nm = nowMenit()
  const mulai = jamKeMenit(jadwal.jamMulai)
  const selesai = jamKeMenit(jadwal.jamSelesai)

  if (nm < mulai - 30) throw new Error(`Jadwal belum aktif (mulai ${jadwal.jamMulai})`)
  if (nm > selesai) throw new Error("Sesi sudah berakhir, hubungi Admin untuk koreksi")

  const existing = await prisma.absensiGuruSesi.findUnique({
    where: { guruId_jadwalPelajaranId_tanggal: { guruId, jadwalPelajaranId, tanggal: date } },
  })
  if (existing?.jamMasuk) throw new Error("Anda sudah absen masuk pada sesi ini")

  // ── Validasi foto / sidik jari / GPS sesuai metode Admin ──
  const metode = await getMetodeGuru(guruId)
  const { catatan, hasilLokasi } = await validasiVerifikasi({
    guruId,
    tanggal: date,
    metode,
    fotoUrl: verifikasi?.fotoUrl ?? null,
    gps: verifikasi?.gps ?? null,
    sidikJari: verifikasi?.sidikJari ?? null,
    tahap: "MASUK",
  })

  const terlambatMenit = mulai >= 0 && nm > mulai + kebijakan.toleransiTerlambatMenit ? nm - mulai : 0
  const status: StatusAbsensiGuruSesi = terlambatMenit > 0 ? "TERLAMBAT" : "HADIR"
  const jamMasuk = jamServer()

  const bukti = {
    metodeDigunakan: metode,
    fotoUrl: verifikasi?.fotoUrl ?? null,
    gpsLat: verifikasi?.gps?.lat ?? null,
    gpsLng: verifikasi?.gps?.lng ?? null,
    gpsAkurasiMeter: verifikasi?.gps?.akurasiMeter ?? null,
    gpsJarakMeter: hasilLokasi?.jarakMeter ?? null,
    gpsValid: hasilLokasi?.valid ?? null,
    gpsDiLuarRadius: hasilLokasi ? !hasilLokasi.valid : null,
    mockLocation: verifikasi?.gps?.mock ?? null,
    sidikJariVerified: !!verifikasi?.sidikJari?.verified,
    sidikJariProvider: verifikasi?.sidikJari?.provider ?? null,
    verifikasiCatatan: catatan,
  }

  if (existing) {
    await prisma.absensiGuruSesi.update({
      where: { id: existing.id },
      data: { status, jamMasuk, terlambatMenit, keterangan: keterangan ?? existing.keterangan, ...bukti },
    })
  } else {
    await prisma.absensiGuruSesi.create({
      data: { guruId, jadwalPelajaranId, tanggal: date, status, jamMasuk, terlambatMenit, keterangan: keterangan ?? null, ...bukti },
    })
  }

  const list = await getJadwalGuruDenganStatus(guruId, tanggal)
  const hasil = list.find((s) => s.jadwalId === jadwalPelajaranId)
  if (!hasil) throw new Error("Gagal menyimpan absensi")
  return hasil
}

// ─── ABSEN SELESAI MENGAJAR (validasi metode: GPS + sidik jari ulang) ──
export async function absenSelesaiSesi(params: {
  guruId: string
  jadwalPelajaranId: string
  tanggal: string
  verifikasi?: VerifikasiPayload
}): Promise<SesiAbsensi> {
  const { guruId, jadwalPelajaranId, tanggal, verifikasi } = params
  await validasiKepemilikanSesi(guruId, jadwalPelajaranId, tanggal)
  const date = dayStart(new Date(tanggal))

  const existing = await prisma.absensiGuruSesi.findUnique({
    where: { guruId_jadwalPelajaranId_tanggal: { guruId, jadwalPelajaranId, tanggal: date } },
  })
  if (!existing) throw new Error("Anda belum absen masuk pada sesi ini")
  if (existing.jamSelesai) throw new Error("Sesi ini sudah ditutup")

  // ── Validasi ulang sesuai metode (foto cukup saat masuk) ──
  const metode = await getMetodeGuru(guruId)
  const { catatan, hasilLokasi } = await validasiVerifikasi({
    guruId,
    tanggal: date,
    metode,
    fotoUrl: existing.fotoUrl,
    gps: verifikasi?.gps ?? null,
    sidikJari: verifikasi?.sidikJari ?? null,
    tahap: "SELESAI",
  })

  const jamKeluar = jamServer()
  const masukMenit = jamKeMenit(existing.jamMasuk)
  const keluarMenit = nowMenit()
  const durasiMenit = masukMenit >= 0 ? Math.max(0, keluarMenit - masukMenit) : null

  await prisma.absensiGuruSesi.update({
    where: { id: existing.id },
    data: {
      jamSelesai: jamKeluar,
      durasiMenit,
      ...(verifikasi?.gps
        ? {
            gpsLat: verifikasi.gps.lat,
            gpsLng: verifikasi.gps.lng,
            gpsAkurasiMeter: verifikasi.gps.akurasiMeter ?? null,
            gpsJarakMeter: hasilLokasi?.jarakMeter ?? existing.gpsJarakMeter,
            gpsValid: hasilLokasi?.valid ?? existing.gpsValid,
            gpsDiLuarRadius: hasilLokasi ? !hasilLokasi.valid : existing.gpsDiLuarRadius,
            mockLocation: verifikasi.gps.mock ?? existing.mockLocation,
          }
        : {}),
      ...(verifikasi?.sidikJari
        ? { sidikJariVerified: !!verifikasi.sidikJari.verified, sidikJariProvider: verifikasi.sidikJari.provider ?? existing.sidikJariProvider }
        : {}),
      ...(catatan ? { verifikasiCatatan: catatan } : {}),
    },
  })

  const list = await getJadwalGuruDenganStatus(guruId, tanggal)
  const hasil = list.find((s) => s.jadwalId === jadwalPelajaranId)
  if (!hasil) throw new Error("Gagal menyimpan absensi")
  return hasil
}

// ─── STATUS MANUAL GURU (Izin / Sakit) ─────────────────────────────
export async function setStatusSesiGuru(params: {
  guruId: string
  jadwalPelajaranId: string
  tanggal: string
  status: "IZIN" | "SAKIT"
  keterangan?: string
}): Promise<SesiAbsensi> {
  const { guruId, jadwalPelajaranId, tanggal, status, keterangan } = params
  await validasiKepemilikanSesi(guruId, jadwalPelajaranId, tanggal)
  const date = dayStart(new Date(tanggal))

  const existing = await prisma.absensiGuruSesi.findUnique({
    where: { guruId_jadwalPelajaranId_tanggal: { guruId, jadwalPelajaranId, tanggal: date } },
  })
  if (existing?.jamSelesai) throw new Error("Sesi sudah ditutup, hubungi Admin untuk koreksi")

  if (existing) {
    await prisma.absensiGuruSesi.update({ where: { id: existing.id }, data: { status, keterangan: keterangan ?? null } })
  } else {
    await prisma.absensiGuruSesi.create({
      data: { guruId, jadwalPelajaranId, tanggal: date, status, keterangan: keterangan ?? null },
    })
  }

  const list = await getJadwalGuruDenganStatus(guruId, tanggal)
  const hasil = list.find((s) => s.jadwalId === jadwalPelajaranId)
  if (!hasil) throw new Error("Gagal menyimpan absensi")
  return hasil
}

// ─── RIWAYAT + REKAP BULANAN ───────────────────────────────────────
export async function getRiwayatSesiGuru(guruId: string, start: string, end: string) {
  return prisma.absensiGuruSesi.findMany({
    where: { guruId, tanggal: { gte: dayStart(new Date(start)), lte: dayStart(new Date(end)) } },
    include: {
      jadwal: {
        select: {
          jamMulai: true,
          jamSelesai: true,
          kelas: { select: { nama: true } },
          mataPelajaran: { select: { nama: true } },
        },
      },
    },
    orderBy: [{ tanggal: "desc" }, { jadwal: { jamMulai: "asc" } }],
  })
}

export type RekapBulanan = {
  totalSesi: number
  hadir: number
  terlambat: number
  izin: number
  sakit: number
  tidakHadir: number
  belumAbsen: number
  rataKehadiranPersen: number
  totalTerlambatMenit: number
}

export function hitungRekap(rows: { status: StatusAbsensiGuruSesi; terlambatMenit?: number | null }[]): RekapBulanan {
  const r: RekapBulanan = {
    totalSesi: rows.length,
    hadir: 0,
    terlambat: 0,
    izin: 0,
    sakit: 0,
    tidakHadir: 0,
    belumAbsen: 0,
    rataKehadiranPersen: 0,
    totalTerlambatMenit: 0,
  }
  for (const row of rows) {
    if (row.status === "HADIR") r.hadir++
    else if (row.status === "TERLAMBAT") r.terlambat++
    else if (row.status === "IZIN") r.izin++
    else if (row.status === "SAKIT") r.sakit++
    else if (row.status === "TIDAK_HADIR") r.tidakHadir++
    else r.belumAbsen++
    r.totalTerlambatMenit += row.terlambatMenit ?? 0
  }
  const sah = r.hadir + r.terlambat
  r.rataKehadiranPersen = r.totalSesi > 0 ? Math.round((sah / r.totalSesi) * 100) : 0
  return r
}

export async function getRekapBulananGuru(guruId: string, bulan: string): Promise<RekapBulanan> {
  const [y, m] = bulan.split("-").map((v) => parseInt(v, 10))
  const start = new Date(y, (m || 1) - 1, 1)
  const end = new Date(y, m || 1, 0)
  const rows = await prisma.absensiGuruSesi.findMany({
    where: { guruId, tanggal: { gte: start, lte: end } },
    select: { status: true, terlambatMenit: true },
  })
  return hitungRekap(rows)
}

// ─── VALIDASI JADWAL BENTROK (kelas & guru) ────────────────────────
export function rentangBentrok(a: { mulai: string; selesai: string }, b: { mulai: string; selesai: string }): boolean {
  const a1 = jamKeMenit(a.mulai)
  const a2 = jamKeMenit(a.selesai)
  const b1 = jamKeMenit(b.mulai)
  const b2 = jamKeMenit(b.selesai)
  if ([a1, a2, b1, b2].some((v) => v < 0)) return false
  return a1 < b2 && b1 < a2
}

export async function deteksiBentrokJadwal(params: {
  kelasId: string
  hari: string
  jamMulai: string
  jamSelesai: string
  mataPelajaranId?: string
  excludeId?: string
}): Promise<string[]> {
  const { kelasId, hari, jamMulai, jamSelesai, mataPelajaranId, excludeId } = params
  const masalah: string[] = []

  if (jamKeMenit(jamSelesai) <= jamKeMenit(jamMulai)) {
    masalah.push("Jam selesai harus setelah jam mulai")
    return masalah
  }

  const kandidat = await prisma.jadwalPelajaran.findMany({
    where: { hari, deletedAt: null, kelasId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, jamMulai: true, jamSelesai: true, mataPelajaranId: true, mataPelajaran: { select: { nama: true } } },
  })
  for (const k of kandidat) {
    if (rentangBentrok({ mulai: jamMulai, selesai: jamSelesai }, { mulai: k.jamMulai, selesai: k.jamSelesai })) {
      masalah.push(`Bentrok dengan ${k.mataPelajaran?.nama ?? "mapel lain"} (${k.jamMulai}-${k.jamSelesai}) di kelas yang sama`)
    }
  }

  // Bentrok guru: semua kelas yang mengampu mapel ini pada jam yang sama
  if (mataPelajaranId) {
    const pengampu = await prisma.pengajaran.findMany({
      where: { kelasId, mataPelajaranId, deletedAt: null },
      select: { guruId: true, guru: { select: { nama: true } } },
    })
    for (const p of pengampu) {
      const kelasLain = await prisma.pengajaran.findMany({
        where: { guruId: p.guruId, deletedAt: null, kelasId: { not: kelasId } },
        select: { kelasId: true },
      })
      if (kelasLain.length === 0) continue
      const jadwalGuru = await prisma.jadwalPelajaran.findMany({
        where: { hari, deletedAt: null, kelasId: { in: kelasLain.map((k) => k.kelasId) } },
        select: { jamMulai: true, jamSelesai: true, kelas: { select: { nama: true } } },
      })
      for (const jg of jadwalGuru) {
        if (rentangBentrok({ mulai: jamMulai, selesai: jamSelesai }, { mulai: jg.jamMulai, selesai: jg.jamSelesai })) {
          masalah.push(`Bentrok jadwal ${p.guru?.nama ?? "guru"} di kelas ${jg.kelas?.nama} (${jg.jamMulai}-${jg.jamSelesai})`)
        }
      }
    }
  }

  return masalah
}
