"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function getCurrentGuru() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const guru = await prisma.guru.findFirst({
    where: { user: { email: session.user.email }, deletedAt: null },
  })
  if (!guru) redirect("/login")
  return guru
}

// ─── DASHBOARD ───────────────────────────────────────────────

export async function getGuruDashboardStats() {
  const guru = await getCurrentGuru()

  const [kelasCount, mapelCount, siswaCount, ujianAktif, latihanAktif, totalSoal] =
    await Promise.all([
      prisma.kelas.count({ where: { guruId: guru.id, deletedAt: null } }),
      prisma.mataPelajaran.count({ where: { guruId: guru.id, deletedAt: null } }),
      prisma.siswa.count({
        where: { kelas: { guruId: guru.id, deletedAt: null }, deletedAt: null },
      }),
      prisma.ujian.count({
        where: { guruId: guru.id, status: "AKTIF", deletedAt: null, isLatihan: false },
      }),
      prisma.ujian.count({
        where: { guruId: guru.id, status: "AKTIF", deletedAt: null, isLatihan: true },
      }),
      prisma.soal.count({ where: { guruId: guru.id, deletedAt: null } }),
    ])

  return { kelasCount, mapelCount, siswaCount, ujianAktif, latihanAktif, totalSoal }
}

// ─── SOAL ────────────────────────────────────────────────────

export async function getSoals(params: {
  search?: string
  jenisSoal?: string
  tingkatKesulitan?: string
  mataPelajaranId?: string
  page?: number
  limit?: number
}) {
  const guru = await getCurrentGuru()
  const { search, jenisSoal, tingkatKesulitan, mataPelajaranId, page = 1, limit = 10 } = params
  const where: Record<string, unknown> = { guruId: guru.id, deletedAt: null }
  if (search) where.pertanyaan = { contains: search, mode: "insensitive" }
  if (jenisSoal) where.jenisSoal = jenisSoal
  if (tingkatKesulitan) where.tingkatKesulitan = tingkatKesulitan
  if (mataPelajaranId) where.mataPelajaranId = mataPelajaranId

  const [data, total] = await Promise.all([
    prisma.soal.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { mataPelajaran: { select: { nama: true, kode: true } } },
    }),
    prisma.soal.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getSoal(id: string) {
  const guru = await getCurrentGuru()
  return prisma.soal.findFirst({
    where: { id, guruId: guru.id, deletedAt: null },
    include: { mataPelajaran: { select: { id: true, nama: true } }, kategori: true },
  })
}

export async function createSoal(data: {
  pertanyaan: string
  jenisSoal: string
  tingkatKesulitan: string
  pilihanGanda?: any[]
  trueFalse?: boolean
  jawaban: string
  poin: number
  bab?: string
  tags?: string
  mataPelajaranId: string
}) {
  const guru = await getCurrentGuru()
  const soal = await prisma.soal.create({
    data: {
      pertanyaan: data.pertanyaan,
      jenisSoal: data.jenisSoal as any,
      tingkatKesulitan: data.tingkatKesulitan as any,
      pilihanGanda: data.pilihanGanda || undefined,
      trueFalse: data.trueFalse ?? undefined,
      jawaban: data.jawaban,
      poin: data.poin,
      bab: data.bab || null,
      tags: data.tags || null,
      mataPelajaranId: data.mataPelajaranId,
      guruId: guru.id,
      kategoriId: undefined,
    },
  })
  revalidatePath("/(dashboard)/guru/soal")
  return soal
}

export async function updateSoal(
  id: string,
  data: {
    pertanyaan?: string
    jenisSoal?: string
    tingkatKesulitan?: string
    pilihanGanda?: any[]
    trueFalse?: boolean
    jawaban?: string
    poin?: number
    bab?: string
    tags?: string
    mataPelajaranId?: string
  }
) {
  const guru = await getCurrentGuru()
  const soal = await prisma.soal.updateMany({
    where: { id, guruId: guru.id, deletedAt: null },
    data: {
      ...(data.pertanyaan !== undefined && { pertanyaan: data.pertanyaan }),
      ...(data.jenisSoal !== undefined && { jenisSoal: data.jenisSoal as any }),
      ...(data.tingkatKesulitan !== undefined && { tingkatKesulitan: data.tingkatKesulitan as any }),
      ...(data.pilihanGanda !== undefined && { pilihanGanda: data.pilihanGanda }),
      ...(data.trueFalse !== undefined && { trueFalse: data.trueFalse }),
      ...(data.jawaban !== undefined && { jawaban: data.jawaban }),
      ...(data.poin !== undefined && { poin: data.poin }),
      ...(data.bab !== undefined && { bab: data.bab }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.mataPelajaranId !== undefined && { mataPelajaranId: data.mataPelajaranId }),
    },
  })
  revalidatePath("/(dashboard)/guru/soal")
  return soal
}

export async function deleteSoal(id: string) {
  const guru = await getCurrentGuru()
  await prisma.soal.updateMany({
    where: { id, guruId: guru.id, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  revalidatePath("/(dashboard)/guru/soal")
}

export async function duplicateSoal(id: string) {
  const guru = await getCurrentGuru()
  const original = await prisma.soal.findFirst({
    where: { id, guruId: guru.id, deletedAt: null },
  })
  if (!original) throw new Error("Soal not found")
  const data = {
    pertanyaan: original.pertanyaan + " (Copy)",
    gambar: original.gambar,
    jenisSoal: original.jenisSoal,
    tingkatKesulitan: original.tingkatKesulitan,
    pilihanGanda: original.pilihanGanda as any,
    trueFalse: original.trueFalse as any,
    matching: original.matching as any,
    jawaban: original.jawaban,
    poin: original.poin,
    bab: original.bab,
    tags: original.tags,
    kategoriId: original.kategoriId,
    mataPelajaranId: original.mataPelajaranId,
    guruId: guru.id,
  }
  const soal = await prisma.soal.create({ data })
  revalidatePath("/(dashboard)/guru/soal")
  return soal
}

// ─── BANK SOAL ───────────────────────────────────────────────

export async function getBankSoal(params: {
  search?: string
  mataPelajaranId?: string
  kategoriId?: string
  page?: number
  limit?: number
}) {
  const guru = await getCurrentGuru()
  const { search, mataPelajaranId, kategoriId, page = 1, limit = 20 } = params
  const where: Record<string, unknown> = { guruId: guru.id, deletedAt: null }
  if (search) where.pertanyaan = { contains: search, mode: "insensitive" }
  if (mataPelajaranId) where.mataPelajaranId = mataPelajaranId
  if (kategoriId) where.kategoriId = kategoriId

  const [data, total] = await Promise.all([
    prisma.soal.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ bab: "asc" }, { createdAt: "desc" }],
      include: {
        mataPelajaran: { select: { nama: true } },
        kategori: { select: { nama: true } },
      },
    }),
    prisma.soal.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getKategoriRefs() {
  return prisma.kategoriSoal.findMany({
    where: { deletedAt: null },
    orderBy: { nama: "asc" },
  })
}

// ─── UJIAN ───────────────────────────────────────────────────

export async function getUjians(params: {
  search?: string
  status?: string
  page?: number
  limit?: number
}) {
  const guru = await getCurrentGuru()
  const { search, status, page = 1, limit = 10 } = params
  const where: Record<string, unknown> = { guruId: guru.id, deletedAt: null }
  if (search) where.nama = { contains: search, mode: "insensitive" }
  if (status) where.status = status

  const [data, total] = await Promise.all([
    prisma.ujian.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        mataPelajaran: { select: { nama: true } },
        kelas: { select: { nama: true } },
        _count: { select: { ujianSoal: true } },
      },
    }),
    prisma.ujian.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getUjian(id: string) {
  const guru = await getCurrentGuru()
  return prisma.ujian.findFirst({
    where: { id, guruId: guru.id, deletedAt: null },
    include: {
      mataPelajaran: { select: { id: true, nama: true } },
      kelas: { select: { id: true, nama: true } },
      semester: { select: { id: true, nama: true } },
      tahunAjaran: { select: { id: true, nama: true } },
      ujianSoal: {
        include: { soal: { include: { mataPelajaran: { select: { nama: true } } } } },
        orderBy: { nomor: "asc" },
      },
    },
  })
}

export async function createUjian(data: {
  nama: string
  deskripsi?: string
  mataPelajaranId: string
  kelasId: string
  semesterId: string
  tahunAjaranId: string
  jumlahSoal: number
  nilaiMinimum: number
  durasi: number
  tanggal: string
  jamMulai: string
  jamSelesai: string
  mode: string
  isLatihan: boolean
  randomSoal: boolean
  randomJawaban: boolean
  fullscreen: boolean
  disableCopy: boolean
  disablePaste: boolean
  status?: string
  soalIds?: string[]
}) {
  const guru = await getCurrentGuru()

  const tanggalDate = new Date(data.tanggal)
  const jamMulaiDate = new Date(`${data.tanggal}T${data.jamMulai}`)
  const jamSelesaiDate = new Date(`${data.tanggal}T${data.jamSelesai}`)

  const ujian = await prisma.ujian.create({
    data: {
      nama: data.nama,
      deskripsi: data.deskripsi || null,
      mataPelajaranId: data.mataPelajaranId,
      kelasId: data.kelasId,
      guruId: guru.id,
      tahunAjaranId: data.tahunAjaranId,
      semesterId: data.semesterId,
      jumlahSoal: data.jumlahSoal,
      nilaiMinimum: data.nilaiMinimum,
      durasi: data.durasi,
      tanggal: tanggalDate,
      jamMulai: jamMulaiDate,
      jamSelesai: jamSelesaiDate,
      mode: data.mode,
      isLatihan: data.isLatihan,
      randomSoal: data.randomSoal,
      randomJawaban: data.randomJawaban,
      fullscreen: data.fullscreen,
      disableCopy: data.disableCopy,
      disablePaste: data.disablePaste,
      status: (data.status as any) || "DRAFT",
    },
  })

  if (data.soalIds && data.soalIds.length > 0) {
    await prisma.ujianSoal.createMany({
      data: data.soalIds.map((soalId, idx) => ({
        ujianId: ujian.id,
        soalId,
        nomor: idx + 1,
      })),
    })
  }

  revalidatePath("/(dashboard)/guru/ujian")
  return ujian
}

export async function updateUjian(
  id: string,
  data: {
    nama?: string
    deskripsi?: string
    mataPelajaranId?: string
    kelasId?: string
    semesterId?: string
    tahunAjaranId?: string
    jumlahSoal?: number
    nilaiMinimum?: number
    durasi?: number
    tanggal?: string
    jamMulai?: string
    jamSelesai?: string
    mode?: string
    isLatihan?: boolean
    randomSoal?: boolean
    randomJawaban?: boolean
    fullscreen?: boolean
    disableCopy?: boolean
    disablePaste?: boolean
    status?: string
    soalIds?: string[]
  }
) {
  const guru = await getCurrentGuru()

  const updateData: Record<string, any> = {}
  if (data.nama !== undefined) updateData.nama = data.nama
  if (data.deskripsi !== undefined) updateData.deskripsi = data.deskripsi
  if (data.mataPelajaranId !== undefined) updateData.mataPelajaranId = data.mataPelajaranId
  if (data.kelasId !== undefined) updateData.kelasId = data.kelasId
  if (data.semesterId !== undefined) updateData.semesterId = data.semesterId
  if (data.tahunAjaranId !== undefined) updateData.tahunAjaranId = data.tahunAjaranId
  if (data.jumlahSoal !== undefined) updateData.jumlahSoal = data.jumlahSoal
  if (data.nilaiMinimum !== undefined) updateData.nilaiMinimum = data.nilaiMinimum
  if (data.durasi !== undefined) updateData.durasi = data.durasi
  if (data.tanggal !== undefined) updateData.tanggal = new Date(data.tanggal)
  if (data.jamMulai !== undefined && data.tanggal !== undefined) {
    updateData.jamMulai = new Date(`${data.tanggal}T${data.jamMulai}`)
  }
  if (data.jamSelesai !== undefined && data.tanggal !== undefined) {
    updateData.jamSelesai = new Date(`${data.tanggal}T${data.jamSelesai}`)
  }
  if (data.mode !== undefined) updateData.mode = data.mode
  if (data.isLatihan !== undefined) updateData.isLatihan = data.isLatihan
  if (data.randomSoal !== undefined) updateData.randomSoal = data.randomSoal
  if (data.randomJawaban !== undefined) updateData.randomJawaban = data.randomJawaban
  if (data.fullscreen !== undefined) updateData.fullscreen = data.fullscreen
  if (data.disableCopy !== undefined) updateData.disableCopy = data.disableCopy
  if (data.disablePaste !== undefined) updateData.disablePaste = data.disablePaste
  if (data.status !== undefined) updateData.status = data.status as any

  await prisma.ujian.updateMany({
    where: { id, guruId: guru.id, deletedAt: null },
    data: updateData,
  })

  if (data.soalIds !== undefined) {
    await prisma.ujianSoal.deleteMany({ where: { ujianId: id } })
    if (data.soalIds.length > 0) {
      await prisma.ujianSoal.createMany({
        data: data.soalIds.map((soalId, idx) => ({ ujianId: id, soalId, nomor: idx + 1 })),
      })
    }
  }

  revalidatePath("/(dashboard)/guru/ujian")
}

export async function duplicateUjian(id: string) {
  const guru = await getCurrentGuru()
  const original = await prisma.ujian.findFirst({
    where: { id, guruId: guru.id, deletedAt: null },
    include: { ujianSoal: true },
  })
  if (!original) throw new Error("Ujian not found")

  const ujian = await prisma.ujian.create({
    data: {
      nama: original.nama + " (Copy)",
      deskripsi: original.deskripsi,
      mataPelajaranId: original.mataPelajaranId,
      kelasId: original.kelasId,
      guruId: guru.id,
      tahunAjaranId: original.tahunAjaranId,
      semesterId: original.semesterId,
      jumlahSoal: original.jumlahSoal,
      nilaiMinimum: original.nilaiMinimum,
      durasi: original.durasi,
      tanggal: original.tanggal,
      jamMulai: original.jamMulai,
      jamSelesai: original.jamSelesai,
      mode: original.mode,
      isLatihan: original.isLatihan,
      randomSoal: original.randomSoal,
      randomJawaban: original.randomJawaban,
      fullscreen: original.fullscreen,
      disableCopy: original.disableCopy,
      disablePaste: original.disablePaste,
      status: "DRAFT",
    },
  })

  if (original.ujianSoal.length > 0) {
    await prisma.ujianSoal.createMany({
      data: original.ujianSoal.map((us) => ({
        ujianId: ujian.id,
        soalId: us.soalId,
        nomor: us.nomor,
      })),
    })
  }

  revalidatePath("/(dashboard)/guru/ujian")
  return ujian
}

export async function deleteUjian(id: string) {
  const guru = await getCurrentGuru()
  await prisma.ujian.updateMany({
    where: { id, guruId: guru.id, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  revalidatePath("/(dashboard)/guru/ujian")
}

// ─── NILAI ───────────────────────────────────────────────────

export async function getNilaiUjians() {
  const guru = await getCurrentGuru()
  return prisma.ujian.findMany({
    where: { guruId: guru.id, deletedAt: null, isLatihan: false },
    select: { id: true, nama: true, status: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function getNilaiByUjian(ujianId: string) {
  const guru = await getCurrentGuru()
  const ujian = await prisma.ujian.findFirst({
    where: { id: ujianId, guruId: guru.id, deletedAt: null },
    include: {
      mataPelajaran: { select: { nama: true } },
      kelas: { select: { nama: true } },
    },
  })
  if (!ujian) throw new Error("Ujian not found")

  const jawabans = await prisma.jawabanUjian.findMany({
    where: { ujianId },
    include: {
      siswa: { select: { id: true, nama: true, nis: true } },
      soal: { select: { id: true, jenisSoal: true, pertanyaan: true, poin: true, jawaban: true } },
      penilaianEssay: { select: { nilai: true, komentar: true } },
    },
    orderBy: [{ siswa: { nama: "asc" } }, { soal: { id: "asc" } }],
  })

  return { ujian, jawabans }
}

export async function gradeEssay(
  jawabanUjianId: string,
  data: { nilai: number; komentar?: string }
) {
  const guru = await getCurrentGuru()
  const existing = await prisma.penilaianEssay.findUnique({
    where: { jawabanUjianId },
  })
  if (existing) {
    await prisma.penilaianEssay.update({
      where: { jawabanUjianId },
      data: { nilai: data.nilai, komentar: data.komentar || null },
    })
  } else {
    await prisma.penilaianEssay.create({
      data: {
        jawabanUjianId,
        guruId: guru.id,
        nilai: data.nilai,
        komentar: data.komentar || null,
      },
    })
  }
  revalidatePath("/(dashboard)/guru/nilai")
}

// ─── ANALITIK ────────────────────────────────────────────────

export async function getGuruAnalytics() {
  const guru = await getCurrentGuru()

  const [kelas, mapels, ujians] = await Promise.all([
    prisma.kelas.findMany({
      where: { guruId: guru.id, deletedAt: null },
      select: { id: true, nama: true },
    }),
    prisma.mataPelajaran.findMany({
      where: { guruId: guru.id, deletedAt: null },
      select: { id: true, nama: true },
    }),
    prisma.ujian.findMany({
      where: { guruId: guru.id, deletedAt: null, isLatihan: false },
      select: { id: true, nama: true, nilaiMinimum: true },
    }),
  ])

  const ujianIds = ujians.map((u) => u.id)

  const [allNilai, essayCount, pgCount] = await Promise.all([
    prisma.nilai.findMany({
      where: { ujianId: { in: ujianIds }, deletedAt: null },
      select: { nilai: true, siswa: { select: { kelas: { select: { nama: true } } } }, mataPelajaran: { select: { nama: true } }, ujianId: true },
    }),
    prisma.penilaianEssay.count({
      where: { jawabanUjian: { ujian: { guruId: guru.id } } },
    }),
    prisma.jawabanUjian.count({
      where: { ujian: { guruId: guru.id }, isCorrect: { not: null } },
    }),
  ])

  const nilaiList = allNilai.map((n) => n.nilai)
  const rataRata = nilaiList.length > 0 ? nilaiList.reduce((a, b) => a + b, 0) / nilaiList.length : 0
  const tertinggi = nilaiList.length > 0 ? Math.max(...nilaiList) : 0
  const terendah = nilaiList.length > 0 ? Math.min(...nilaiList) : 0

  const ujianNilaiMinMap = new Map(ujians.map((u) => [u.id, u.nilaiMinimum]))
  const lulus = allNilai.filter((n) => n.nilai >= (ujianNilaiMinMap.get(n.ujianId ?? "") ?? 0)).length
  const tidakLulus = allNilai.length - lulus

  const perKelas: Record<string, number[]> = {}
  allNilai.forEach((n) => {
    const label = n.siswa?.kelas?.nama ?? "Unknown"
    if (!perKelas[label]) perKelas[label] = []
    perKelas[label].push(n.nilai)
  })
  const grafikKelas = Object.entries(perKelas).map(([label, values]) => ({
    label,
    nilai: values.reduce((a, b) => a + b, 0) / values.length,
  }))

  const perMapel: Record<string, number[]> = {}
  allNilai.forEach((n) => {
    const label = n.mataPelajaran?.nama ?? "Unknown"
    if (!perMapel[label]) perMapel[label] = []
    perMapel[label].push(n.nilai)
  })
  const grafikMapel = Object.entries(perMapel).map(([label, values]) => ({
    label,
    nilai: values.reduce((a, b) => a + b, 0) / values.length,
  }))

  return {
    rataRata: Math.round(rataRata * 100) / 100,
    tertinggi,
    terendah,
    lulus,
    tidakLulus,
    totalSiswaDinilai: allNilai.length,
    grafikKelas,
    grafikMapel,
    essayCount,
    pgCount,
  }
}

// ─── REFS ────────────────────────────────────────────────────

export async function getGuruMapelRefs() {
  const guru = await getCurrentGuru()
  return prisma.mataPelajaran.findMany({
    where: { guruId: guru.id, deletedAt: null },
    select: { id: true, nama: true, kode: true, kelas: { select: { id: true, nama: true } } },
    orderBy: { nama: "asc" },
  })
}

export async function getGuruKelasRefs() {
  const guru = await getCurrentGuru()
  const mapels = await prisma.mataPelajaran.findMany({
    where: { guruId: guru.id, deletedAt: null },
    select: { kelasId: true },
    distinct: ["kelasId"],
  })
  const kelasIds = mapels.map((m) => m.kelasId)
  if (kelasIds.length === 0) return []
  return prisma.kelas.findMany({
    where: { id: { in: kelasIds }, deletedAt: null },
    select: { id: true, nama: true, tingkat: true },
    orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
  })
}

export async function getBankSoalRefs() {
  const guru = await getCurrentGuru()
  return prisma.soal.findMany({
    where: { guruId: guru.id, deletedAt: null },
    select: { id: true, pertanyaan: true, jenisSoal: true, bab: true, mataPelajaranId: true },
    orderBy: { createdAt: "desc" },
  })
}
