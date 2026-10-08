"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import {
  dayStart,
  dayEnd,
  finalisasiSesiTanggal,
  getKebijakanAbsensi,
  hitungRekap,
  jamKeMenit,
  jalanRetensiFoto,
  nowMenit,
  resolveHari,
} from "@/lib/absensi-guru"
import type { StatusAbsensiGuruSesi } from "@prisma/client"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  if (session.user.role !== "ADMIN") throw new Error("Akses hanya untuk Admin")
  const admin = await prisma.guru.findFirst({ where: { user: { email: session.user.email }, deletedAt: null }, select: { id: true } })
  return { email: session.user.email, guruId: admin?.id ?? null }
}

export type BarisMonitoring = {
  sesiId: string | null
  guruId: string
  guruNama: string
  jadwalId: string
  kelasId: string
  kelasNama: string
  mataPelajaranId: string
  mataPelajaranNama: string
  jamMulai: string
  jamSelesai: string
  status: StatusAbsensiGuruSesi
  fase: "SEBELUM" | "AKTIF" | "SELESAI"
  jamMasuk: string | null
  jamKeluar: string | null
  durasiMenit: number | null
  terlambatMenit: number | null
  keterangan: string | null
  koreksiAlasan: string | null
  penggantiNama: string | null
  // ── Bukti verifikasi ──
  metode: string | null
  fotoUrl: string | null
  gps: { lat: number; lng: number; akurasiMeter: number | null; jarakMeter: number | null; valid: boolean | null; mock: boolean | null } | null
  sidikJariVerified: boolean
  sidikJariProvider: string | null
  verifikasiCatatan: string | null
}

// ─── MONITORING REAL-TIME KEHADIRAN GURU ───────────────────────────
export async function getMonitoringKehadiran(params: {
  tanggal?: string
  guruId?: string
  kelasId?: string
  mataPelajaranId?: string
  status?: string
  search?: string
}) {
  await requireAdmin()
  const tanggal = params.tanggal || new Date().toISOString().slice(0, 10)
  const hari = resolveHari(tanggal)
  const date = dayStart(new Date(tanggal))

  await finalisasiSesiTanggal(null, tanggal)
  const nm = nowMenit()

  const [jadwal, pengajaran, pengganti, sesiRows] = await Promise.all([
    prisma.jadwalPelajaran.findMany({
      where: { hari, deletedAt: null },
      include: {
        kelas: { select: { id: true, nama: true } },
        mataPelajaran: { select: { id: true, nama: true } },
      },
    }),
    prisma.pengajaran.findMany({
      where: { deletedAt: null },
      select: { kelasId: true, mataPelajaranId: true, guruId: true, guru: { select: { id: true, nama: true } } },
    }),
    prisma.penggantiGuru.findMany({
      where: { tanggal: date, status: "DISETUJUI" },
      include: {
        asliGuru: { select: { nama: true } },
        pengganti: { select: { id: true, nama: true } },
        jadwal: { select: { kelasId: true, mataPelajaranId: true } },
      },
    }),
    prisma.absensiGuruSesi.findMany({
      where: { tanggal: date },
      include: { guru: { select: { nama: true } } },
    }),
  ])

  const sesiMap = new Map(sesiRows.map((s) => [`${s.guruId}|${s.jadwalPelajaranId}`, s]))
  const jadwalById = new Map(jadwal.map((j) => [j.id, j]))

  const baris: BarisMonitoring[] = []
  const sudah = new Set<string>()

  const push = (
    guruId: string,
    guruNama: string,
    j: (typeof jadwal)[number],
    penggantiNama: string | null
  ) => {
    const key = `${guruId}|${j.id}`
    if (sudah.has(key)) return
    sudah.add(key)
    const rec = sesiMap.get(key)
    const mulai = jamKeMenit(j.jamMulai)
    const selesai = jamKeMenit(j.jamSelesai)
    const fase: BarisMonitoring["fase"] = nm < mulai ? "SEBELUM" : nm <= selesai ? "AKTIF" : "SELESAI"
    baris.push({
      sesiId: rec?.id ?? null,
      guruId,
      guruNama,
      jadwalId: j.id,
      kelasId: j.kelas.id,
      kelasNama: j.kelas.nama,
      mataPelajaranId: j.mataPelajaran.id,
      mataPelajaranNama: j.mataPelajaran.nama,
      jamMulai: j.jamMulai,
      jamSelesai: j.jamSelesai,
      status: (rec?.status ?? "BELUM_ABSEN") as StatusAbsensiGuruSesi,
      fase,
      jamMasuk: rec?.jamMasuk ?? null,
      jamKeluar: rec?.jamSelesai ?? null,
      durasiMenit: rec?.durasiMenit ?? null,
      terlambatMenit: rec?.terlambatMenit ?? null,
      keterangan: rec?.keterangan ?? null,
      koreksiAlasan: rec?.koreksiAlasan ?? null,
      penggantiNama,
      metode: rec?.metodeDigunakan ?? null,
      fotoUrl: rec?.fotoUrl ?? null,
      gps:
        rec?.gpsLat != null && rec?.gpsLng != null
          ? {
              lat: rec.gpsLat,
              lng: rec.gpsLng,
              akurasiMeter: rec.gpsAkurasiMeter ?? null,
              jarakMeter: rec.gpsJarakMeter ?? null,
              valid: rec.gpsValid ?? null,
              mock: rec.mockLocation ?? null,
            }
          : null,
      sidikJariVerified: rec?.sidikJariVerified ?? false,
      sidikJariProvider: rec?.sidikJariProvider ?? null,
      verifikasiCatatan: rec?.verifikasiCatatan ?? null,
    })
  }

  // Pasangan (guru, jadwal) dari pengajaran
  for (const j of jadwal) {
    for (const p of pengajaran) {
      if (p.kelasId === j.kelasId && p.mataPelajaranId === j.mataPelajaranId) {
        push(p.guruId, p.guru.nama, j, null)
      }
    }
  }
  // Guru pengganti resmi (di luar pengajaran)
  for (const pg of pengganti) {
    const j = jadwalById.get(pg.jadwalPelajaranId)
    if (!j) continue
    push(pg.pengganti.id, pg.pengganti.nama, j, `menggantikan ${pg.asliGuru.nama}`)
  }

  // Filter
  let hasil = baris
  if (params.guruId) hasil = hasil.filter((b) => b.guruId === params.guruId)
  if (params.kelasId) hasil = hasil.filter((b) => b.kelasId === params.kelasId)
  if (params.mataPelajaranId) hasil = hasil.filter((b) => b.mataPelajaranId === params.mataPelajaranId)
  if (params.status) hasil = hasil.filter((b) => b.status === params.status)
  if (params.search) {
    const q = params.search.toLowerCase()
    hasil = hasil.filter(
      (b) => b.guruNama.toLowerCase().includes(q) || b.kelasNama.toLowerCase().includes(q) || b.mataPelajaranNama.toLowerCase().includes(q)
    )
  }

  hasil.sort((a, b) => a.jamMulai.localeCompare(b.jamMulai) || a.kelasNama.localeCompare(b.kelasNama))

  const summary = {
    total: hasil.length,
    hadir: hasil.filter((b) => b.status === "HADIR").length,
    terlambat: hasil.filter((b) => b.status === "TERLAMBAT").length,
    izin: hasil.filter((b) => b.status === "IZIN").length,
    sakit: hasil.filter((b) => b.status === "SAKIT").length,
    tidakHadir: hasil.filter((b) => b.status === "TIDAK_HADIR").length,
    belumAbsen: hasil.filter((b) => b.status === "BELUM_ABSEN").length,
    aktif: hasil.filter((b) => b.fase === "AKTIF").length,
  }

  const kebijakan = await getKebijakanAbsensi()
  await jalanRetensiFoto() // bersihkan foto bukti yang melewati retensi Admin
  return { tanggal, hari, rows: hasil, summary, kebijakan }
}

// ─── REKAP (filter guru/kelas/mapel/rentang tanggal/semester) ──────
export async function getRekapKehadiran(params: {
  start: string
  end: string
  guruId?: string
  kelasId?: string
  mataPelajaranId?: string
  semesterId?: string
}) {
  await requireAdmin()
  const where: Record<string, unknown> = {
    tanggal: { gte: dayStart(new Date(params.start)), lte: dayEnd(new Date(params.end)) },
  }
  if (params.guruId) where.guruId = params.guruId

  const jadwalWhere: Record<string, unknown> = {}
  const mapelWhere: Record<string, unknown> = {}
  if (params.kelasId) jadwalWhere.kelasId = params.kelasId
  if (params.mataPelajaranId) mapelWhere.id = params.mataPelajaranId
  if (params.semesterId) mapelWhere.semesterId = params.semesterId
  if (Object.keys(mapelWhere).length > 0) jadwalWhere.mataPelajaran = mapelWhere
  if (Object.keys(jadwalWhere).length > 0) where.jadwal = jadwalWhere

  const rows = await prisma.absensiGuruSesi.findMany({
    where: where as never,
    include: {
      guru: { select: { id: true, nama: true, nip: true } },
      jadwal: {
        select: {
          jamMulai: true,
          jamSelesai: true,
          kelas: { select: { id: true, nama: true } },
          mataPelajaran: { select: { id: true, nama: true } },
        },
      },
    },
    orderBy: [{ tanggal: "desc" }, { jadwal: { jamMulai: "asc" } }],
    take: 2000,
  })

  // Rekap per guru
  const perGuru = new Map<string, { guruId: string; guruNama: string; rows: { status: StatusAbsensiGuruSesi; terlambatMenit: number | null }[] }>()
  for (const r of rows) {
    if (!perGuru.has(r.guruId)) perGuru.set(r.guruId, { guruId: r.guruId, guruNama: r.guru.nama, rows: [] })
    perGuru.get(r.guruId)!.rows.push({ status: r.status, terlambatMenit: r.terlambatMenit })
  }
  const rekapPerGuru = Array.from(perGuru.values()).map((x) => ({
    guruId: x.guruId,
    guruNama: x.guruNama,
    ...hitungRekap(x.rows),
  }))
  rekapPerGuru.sort((a, b) => b.rataKehadiranPersen - a.rataKehadiranPersen)

  return { rows, rekapPerGuru, total: hitungRekap(rows) }
}

// ─── KOREKSI ABSENSI (dengan alasan + audit log) ───────────────────
export async function koreksiAbsensiSesi(params: {
  sesiId?: string | null
  guruId?: string
  jadwalPelajaranId?: string
  tanggal?: string
  status: StatusAbsensiGuruSesi
  alasan: string
  jamMasuk?: string | null
  jamSelesai?: string | null
  keterangan?: string | null
}) {
  const admin = await requireAdmin()
  if (!params.alasan || params.alasan.trim().length < 3) throw new Error("Alasan koreksi wajib diisi (min. 3 huruf)")

  const existing = params.sesiId
    ? await prisma.absensiGuruSesi.findUnique({ where: { id: params.sesiId } })
    : null

  // Guru belum pernah absen pada sesi ini → buat record baru milik guru tersebut
  if (!existing) {
    if (!params.guruId || !params.jadwalPelajaranId || !params.tanggal) {
      throw new Error("Data absensi tidak ditemukan")
    }
    const created = await prisma.absensiGuruSesi.create({
      data: {
        guruId: params.guruId,
        jadwalPelajaranId: params.jadwalPelajaranId,
        tanggal: dayStart(new Date(params.tanggal)),
        status: params.status,
        jamMasuk: params.jamMasuk ?? null,
        jamSelesai: params.jamSelesai ?? null,
        keterangan: params.keterangan ?? null,
        koreksiAlasan: params.alasan,
        koreksiBy: admin.guruId,
      },
    })
    await prisma.absensiGuruLog.create({
      data: {
        absensiGuruSesiId: created.id,
        actorGuruId: admin.guruId ?? created.guruId,
        aksi: admin.guruId ? "KOREKSI_BARU" : `KOREKSI_ADMIN (${admin.email})`,
        alasan: params.alasan,
        dataLama: undefined,
        dataBaru: { status: params.status, jamMasuk: params.jamMasuk, jamSelesai: params.jamSelesai } as never,
      },
    })
    revalidatePath("/admin/absensi-guru")
    return { success: true, created: true }
  }

  const dataLama = {
    status: existing.status,
    jamMasuk: existing.jamMasuk,
    jamSelesai: existing.jamSelesai,
    keterangan: existing.keterangan,
  }
  const dataBaru = {
    status: params.status,
    jamMasuk: params.jamMasuk ?? existing.jamMasuk,
    jamSelesai: params.jamSelesai ?? existing.jamSelesai,
    keterangan: params.keterangan ?? existing.keterangan,
  }

  await prisma.absensiGuruSesi.update({
    where: { id: existing.id },
    data: {
      status: params.status,
      jamMasuk: params.jamMasuk ?? existing.jamMasuk,
      jamSelesai: params.jamSelesai ?? existing.jamSelesai,
      keterangan: params.keterangan ?? existing.keterangan,
      koreksiAlasan: params.alasan,
      koreksiBy: admin.guruId,
    },
  })

  await prisma.absensiGuruLog.create({
    data: {
      absensiGuruSesiId: existing.id,
      actorGuruId: admin.guruId ?? existing.guruId,
      aksi: admin.guruId ? "KOREKSI" : `KOREKSI_ADMIN (${admin.email})`,
      alasan: params.alasan,
      dataLama: dataLama as never,
      dataBaru: dataBaru as never,
    },
  })

  revalidatePath("/admin/absensi-guru")
  return { success: true }
}

export async function getLogAbsensi(sesiId: string) {
  await requireAdmin()
  return prisma.absensiGuruLog.findMany({
    where: { absensiGuruSesiId: sesiId },
    include: { actor: { select: { nama: true } } },
    orderBy: { createdAt: "desc" },
  })
}

// ─── KEBIJAKAN (toleransi & auto tidak hadir) ──────────────────────
export async function getKebijakanAdmin() {
  await requireAdmin()
  return getKebijakanAbsensi()
}

export async function simpanKebijakanAbsensi(data: {
  toleransiTerlambatMenit: number
  autoTidakHadirSetelahMenit: number
  absensiMetode?: string
  gpsWajib?: boolean
  gpsLokasiNama?: string | null
  gpsLat?: number | null
  gpsLng?: number | null
  gpsRadiusMeter?: number
  gpsAkurasiMaksMeter?: number
  fotoRetensiHari?: number
}) {
  await requireAdmin()
  const toleransi = Math.max(0, Math.min(120, Math.round(data.toleransiTerlambatMenit)))
  const auto = Math.max(0, Math.min(480, Math.round(data.autoTidakHadirSetelahMenit)))
  const METODE_VALID = ["TANPA", "FOTO", "SIDIK_JARI", "FOTO_SIDIK_JARI", "GPS_FOTO", "GPS_SIDIK_JARI", "GPS_FOTO_SIDIK_JARI"]
  const metode = METODE_VALID.includes(String(data.absensiMetode)) ? String(data.absensiMetode) : undefined
  const radius = data.gpsRadiusMeter != null ? Math.max(10, Math.min(2000, Math.round(data.gpsRadiusMeter))) : undefined
  const akurasi = data.gpsAkurasiMaksMeter != null ? Math.max(1, Math.min(500, Math.round(data.gpsAkurasiMaksMeter))) : undefined
  const retensi = data.fotoRetensiHari != null ? Math.max(1, Math.min(3650, Math.round(data.fotoRetensiHari))) : undefined
  const lat = data.gpsLat != null && Number.isFinite(data.gpsLat) ? Number(data.gpsLat) : undefined
  const lng = data.gpsLng != null && Number.isFinite(data.gpsLng) ? Number(data.gpsLng) : undefined

  // GPS wajib → titik lokasi & radius harus terisi
  const gpsAktif = data.gpsWajib ?? false
  if (gpsAktif && (lat == null || lng == null)) throw new Error("Titik lokasi (latitude/longitude) wajib diisi bila GPS diaktifkan")

  const payload = {
    toleransiTerlambatMenit: toleransi,
    autoTidakHadirSetelahMenit: auto,
    ...(metode ? { absensiMetode: metode } : {}),
    ...(data.gpsWajib !== undefined ? { gpsWajib: gpsAktif } : {}),
    ...(data.gpsLokasiNama !== undefined ? { gpsLokasiNama: data.gpsLokasiNama || null } : {}),
    ...(lat !== undefined ? { gpsLat: lat } : {}),
    ...(lng !== undefined ? { gpsLng: lng } : {}),
    ...(radius !== undefined ? { gpsRadiusMeter: radius } : {}),
    ...(akurasi !== undefined ? { gpsAkurasiMaksMeter: akurasi } : {}),
    ...(retensi !== undefined ? { fotoRetensiHari: retensi } : {}),
  }

  const existing = await prisma.siteConfig.findFirst({ select: { id: true } })
  if (existing) {
    await prisma.siteConfig.update({ where: { id: existing.id }, data: payload })
  } else {
    await prisma.siteConfig.create({ data: payload })
  }
  revalidatePath("/admin/absensi-guru")
  return getKebijakanAbsensi()
}

// ─── PENGGANTI GURU ────────────────────────────────────────────────
export async function getPenggantiList(tanggal?: string) {
  await requireAdmin()
  const date = tanggal ? dayStart(new Date(tanggal)) : undefined
  return prisma.penggantiGuru.findMany({
    where: date ? { tanggal: date } : {},
    include: {
      asliGuru: { select: { id: true, nama: true } },
      pengganti: { select: { id: true, nama: true } },
      jadwal: {
        select: {
          jamMulai: true,
          jamSelesai: true,
          hari: true,
          kelas: { select: { nama: true } },
          mataPelajaran: { select: { nama: true } },
        },
      },
    },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
    take: 200,
  })
}

export async function buatPengganti(data: {
  jadwalPelajaranId: string
  tanggal: string
  asliGuruId: string
  penggantiGuruId: string
  alasan: string
}) {
  await requireAdmin()
  if (data.asliGuruId === data.penggantiGuruId) throw new Error("Guru pengganti harus berbeda dari guru asli")
  if (!data.alasan?.trim()) throw new Error("Alasan wajib diisi")

  const jadwal = await prisma.jadwalPelajaran.findUnique({ where: { id: data.jadwalPelajaranId }, select: { id: true } })
  if (!jadwal) throw new Error("Jadwal tidak ditemukan")

  const tanggal = dayStart(new Date(data.tanggal))
  const dup = await prisma.penggantiGuru.findUnique({
    where: { jadwalPelajaranId_tanggal: { jadwalPelajaranId: data.jadwalPelajaranId, tanggal } },
  })
  if (dup) throw new Error("Sudah ada pengganti untuk sesi ini")

  const result = await prisma.penggantiGuru.create({
    data: { ...data, tanggal, status: "DISETUJUI" },
  })
  revalidatePath("/admin/absensi-guru")
  return result
}

export async function setPenggantiStatus(id: string, status: "DISETUJUI" | "DITOLAK") {
  await requireAdmin()
  await prisma.penggantiGuru.update({ where: { id }, data: { status } })
  revalidatePath("/admin/absensi-guru")
  return { success: true }
}

export async function hapusPengganti(id: string) {
  await requireAdmin()
  await prisma.penggantiGuru.delete({ where: { id } })
  revalidatePath("/admin/absensi-guru")
  return { success: true }
}

// ─── DATA PENDUKUNG (dropdown) ─────────────────────────────────────
export async function getDataPendukung() {
  await requireAdmin()
  const [guru, kelas, mapel, jadwalHariIni] = await Promise.all([
    prisma.guru.findMany({ where: { deletedAt: null }, select: { id: true, nama: true, absensiMetode: true }, orderBy: { nama: "asc" } }),
    prisma.kelas.findMany({ where: { deletedAt: null }, select: { id: true, nama: true }, orderBy: { nama: "asc" } }),
    prisma.mataPelajaran.findMany({ where: { deletedAt: null }, select: { id: true, nama: true }, orderBy: { nama: "asc" } }),
    prisma.jadwalPelajaran.findMany({
      where: { deletedAt: null, hari: resolveHari(new Date().toISOString().slice(0, 10)) },
      select: {
        id: true,
        jamMulai: true,
        jamSelesai: true,
        kelas: { select: { id: true, nama: true } },
        mataPelajaran: { select: { id: true, nama: true } },
      },
      orderBy: { jamMulai: "asc" },
    }),
  ])
  return { guru, kelas, mapel, jadwalHariIni }
}

// ─── MONITORING ABSENSI SISWA PER MATA PELAJARAN ──────────────────
export async function getMonitoringSiswa(params: {
  tanggal?: string
  kelasId?: string
  mataPelajaranId?: string
  guruId?: string
  search?: string
}) {
  await requireAdmin()
  const tanggal = params.tanggal || new Date().toISOString().slice(0, 10)
  const date = dayStart(new Date(tanggal))
  const hari = resolveHari(tanggal)

  const where: Record<string, unknown> = { tanggal: date }
  if (params.kelasId) where.kelasId = params.kelasId
  if (params.mataPelajaranId) where.mataPelajaranId = params.mataPelajaranId
  if (params.guruId) where.guruPencatatId = params.guruId

  const [absensiRows, jadwalHari, pengganti] = await Promise.all([
    prisma.absensi.findMany({
      where: where as never,
      include: {
        kelas: { select: { id: true, nama: true } },
        mataPelajaran: { select: { id: true, nama: true } },
        jadwal: { select: { jamMulai: true, jamSelesai: true } },
        guruPencatat: { select: { nama: true } },
        siswa: {
          include: { siswa: { select: { id: true, nama: true, nis: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
    prisma.jadwalPelajaran.findMany({
      where: { hari, deletedAt: null, ...(params.kelasId ? { kelasId: params.kelasId } : {}), ...(params.mataPelajaranId ? { mataPelajaranId: params.mataPelajaranId } : {}) },
      select: {
        id: true,
        jamMulai: true,
        jamSelesai: true,
        kelasId: true,
        kelas: { select: { nama: true } },
        mataPelajaranId: true,
        mataPelajaran: { select: { nama: true } },
      },
      orderBy: { jamMulai: "asc" },
    }),
    prisma.penggantiGuru.findMany({
      where: { tanggal: date, status: "DISETUJUI", ...(params.guruId ? { penggantiGuruId: params.guruId } : {}) },
      select: { jadwalPelajaranId: true, penggantiGuruId: true },
    }),
  ])

  const absensiMap = new Map(absensiRows.map((a) => [`${a.kelasId}|${a.mataPelajaranId}|${a.jadwalPelajaranId ?? ""}`, a]))

  // Sesi hari ini + status guru (sumber kehadiran)
  const sesiGuru = await prisma.absensiGuruSesi.findMany({
    where: { tanggal: date, ...(params.guruId ? { guruId: params.guruId } : {}) },
    select: { guruId: true, jadwalPelajaranId: true, status: true, jamMasuk: true, guru: { select: { nama: true } } },
  })
  const sesiKey = new Map(sesiGuru.map((s) => [`${s.guruId}|${s.jadwalPelajaranId}`, s]))

  const pengampu = await prisma.pengajaran.findMany({
    where: { deletedAt: null, ...(params.guruId ? { guruId: params.guruId } : {}) },
    select: { kelasId: true, mataPelajaranId: true, guruId: true, guru: { select: { nama: true } } },
  })
  const pengampuMap = new Map(pengampu.map((p) => [`${p.kelasId}|${p.mataPelajaranId}`, p]))

  const sesiList = jadwalHari
    .map((j) => {
      const p = pengampuMap.get(`${j.kelasId}|${j.mataPelajaranId}`)
      const guruId = p?.guruId ?? pengganti.find((x) => x.jadwalPelajaranId === j.id)?.penggantiGuruId ?? null
      const abs = absensiMap.get(`${j.kelasId}|${j.mataPelajaranId}|${j.id}`) ?? absensiMap.get(`${j.kelasId}|${j.mataPelajaranId}|`)
      const guruSesi = guruId ? sesiKey.get(`${guruId}|${j.id}`) : undefined
      return {
        jadwalId: j.id,
        kelasId: j.kelasId,
        kelasNama: j.kelas.nama,
        mataPelajaranId: j.mataPelajaranId,
        mataPelajaranNama: j.mataPelajaran.nama,
        jamMulai: j.jamMulai,
        jamSelesai: j.jamSelesai,
        guruNama: p?.guru?.nama ?? null,
        guruSesiStatus: guruSesi?.status ?? null,
        guruSesiAbsen: !!guruSesi?.jamMasuk,
        absensiId: abs?.id ?? null,
        pencatat: abs?.guruPencatat?.nama ?? null,
        totalSiswa: abs?.siswa.length ?? 0,
        tercatat: abs?.siswa.filter((s) => s.status !== null).length ?? 0,
        hadir: abs?.siswa.filter((s) => s.status === "HADIR").length ?? 0,
        terlambat: abs?.siswa.filter((s) => s.status === "TERLAMBAT").length ?? 0,
        izin: abs?.siswa.filter((s) => s.status === "IZIN").length ?? 0,
        sakit: abs?.siswa.filter((s) => s.status === "SAKIT").length ?? 0,
        alpa: abs?.siswa.filter((s) => s.status === "ALPA").length ?? 0,
        detail: abs?.siswa ?? [],
      }
    })
    .filter((s) => {
      if (!params.guruId) return true
      const p = pengampuMap.get(`${s.kelasId}|${s.mataPelajaranId}`)
      if (p?.guruId === params.guruId) return true
      return pengganti.some((x) => x.jadwalPelajaranId === s.jadwalId && x.penggantiGuruId === params.guruId)
    })

  let hasil = sesiList
  if (params.search) {
    const q = params.search.toLowerCase()
    hasil = hasil.filter((s) => s.kelasNama.toLowerCase().includes(q) || s.mataPelajaranNama.toLowerCase().includes(q) || (s.guruNama ?? "").toLowerCase().includes(q))
  }

  const belumAbsen = hasil.filter((s) => !s.guruSesiAbsen && s.guruNama).length
  return { tanggal, sesi: hasil, belumAbsenGuru: belumAbsen, jadwalTotal: jadwalHari.length }
}

// ─── SISWA SERING TIDAK HADIR (rentang tanggal) ───────────────────
export async function getSiswaSeringTidakHadir(params: { start: string; end: string; kelasId?: string; limit?: number }) {
  await requireAdmin()
  const where: Record<string, unknown> = {
    status: { in: ["ALPA", "TIDAK_HADIR"] },
    absensi: {
      tanggal: { gte: dayStart(new Date(params.start)), lte: dayEnd(new Date(params.end)) },
      ...(params.kelasId ? { kelasId: params.kelasId } : {}),
    },
  }
  const rows = await prisma.absensiSiswa.findMany({
    where: where as never,
    select: { siswaId: true, siswa: { select: { nama: true, nis: true, kelas: { select: { nama: true } } } } },
    take: 5000,
  })
  const map = new Map<string, { siswaId: string; nama: string; nis: string | null; kelas: string | null; alpa: number }>()
  for (const r of rows) {
    const cur = map.get(r.siswaId) ?? { siswaId: r.siswaId, nama: r.siswa.nama, nis: r.siswa.nis, kelas: r.siswa.kelas?.nama ?? null, alpa: 0 }
    cur.alpa++
    map.set(r.siswaId, cur)
  }
  const hasil = Array.from(map.values()).sort((a, b) => b.alpa - a.alpa)
  return hasil.slice(0, params.limit ?? 20)
}

// ─── KOREKSI ABSENSI SISWA OLEH ADMIN (audit log) ─────────────────
export async function koreksiAbsensiSiswaAdmin(params: {
  absensiId: string
  alasan: string
  siswaStatus: { siswaId: string; status: string; keterangan?: string }[]
}) {
  const admin = await requireAdmin()
  if (!params.alasan || params.alasan.trim().length < 3) throw new Error("Alasan koreksi wajib diisi (min. 3 karakter)")

  const absensi = await prisma.absensi.findUnique({ where: { id: params.absensiId }, select: { id: true } })
  if (!absensi) throw new Error("Data absensi tidak ditemukan")

  const lama = await prisma.absensiSiswa.findMany({
    where: { absensiId: params.absensiId },
    select: { siswaId: true, status: true, keterangan: true },
  })
  await prisma.absensiSiswa.deleteMany({ where: { absensiId: params.absensiId } })
  if (params.siswaStatus.length > 0) {
    await prisma.absensiSiswa.createMany({
      data: params.siswaStatus.map((ss) => ({
        absensiId: params.absensiId,
        siswaId: ss.siswaId,
        status: ss.status as never,
        keterangan: ss.keterangan || null,
      })),
      skipDuplicates: true,
    })
  }

  await prisma.absensiSiswaLog.create({
    data: {
      absensiId: params.absensiId,
      actorGuruId: admin.guruId,
      aksi: admin.guruId ? "KOREKSI_ADMIN" : `KOREKSI_ADMIN (${admin.email})`,
      alasan: params.alasan.trim(),
      dataLama: lama as never,
      dataBaru: params.siswaStatus as never,
    },
  })

  revalidatePath("/admin/absensi-guru")
  return { success: true }
}

export async function getLogKoreksiSiswa(absensiId: string) {
  await requireAdmin()
  return prisma.absensiSiswaLog.findMany({
    where: { absensiId },
    include: { actor: { select: { nama: true } } },
    orderBy: { createdAt: "desc" },
  })
}

// ─── PENGECAULIAN VERIFIKASI (persetujuan Admin) ───────────────────
export async function getPengecualianList(status?: string) {
  await requireAdmin()
  return prisma.pengecualianAbsensi.findMany({
    where: status ? { status } : {},
    include: {
      guru: { select: { id: true, nama: true, nip: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  })
}

export async function setPengecualianStatus(id: string, status: "DISETUJUI" | "DITOLAK", catatan?: string) {
  const admin = await requireAdmin()
  const row = await prisma.pengecualianAbsensi.findUnique({ where: { id } })
  if (!row) throw new Error("Pengecualian tidak ditemukan")
  await prisma.pengecualianAbsensi.update({
    where: { id },
    data: { status, catatanAdmin: catatan || null, reviewedBy: null },
  })
  revalidatePath("/admin/absensi-guru")
  revalidatePath("/guru/absensi")
  return { success: true, email: admin.email }
}

// ─── OVERRIDE METODE PER GURU ──────────────────────────────────────
export async function setMetodeGuru(guruId: string, metode: string | null) {
  await requireAdmin()
  const METODE_VALID = ["TANPA", "FOTO", "SIDIK_JARI", "FOTO_SIDIK_JARI", "GPS_FOTO", "GPS_SIDIK_JARI", "GPS_FOTO_SIDIK_JARI"]
  if (metode && !METODE_VALID.includes(metode)) throw new Error("Metode tidak valid")
  await prisma.guru.update({ where: { id: guruId }, data: { absensiMetode: metode || null } })
  revalidatePath("/admin/absensi-guru")
  return { success: true }
}
