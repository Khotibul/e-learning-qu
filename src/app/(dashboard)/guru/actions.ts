"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"

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
      prisma.pengajaran.count({ where: { guruId: guru.id, deletedAt: null, mataPelajaran: { deletedAt: null } } }),
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
  subSoal?: { pertanyaan: string; jawaban: string; poin: number }[]
}) {
  const guru = await getCurrentGuru()
  const subSoal = data.subSoal?.filter((s) => s.pertanyaan.trim())
  const totalPoin = subSoal && subSoal.length > 0
    ? subSoal.reduce((sum, s) => sum + (s.poin || 0), 0)
    : data.poin
  const combinedJawaban = subSoal && subSoal.length > 0
    ? JSON.stringify(subSoal.map((s) => s.jawaban))
    : data.jawaban
  const soal = await prisma.soal.create({
    data: {
      pertanyaan: data.pertanyaan,
      subSoal: subSoal && subSoal.length > 0 ? subSoal as any : undefined,
      jenisSoal: data.jenisSoal as any,
      tingkatKesulitan: data.tingkatKesulitan as any,
      pilihanGanda: data.pilihanGanda || undefined,
      trueFalse: data.trueFalse ?? undefined,
      jawaban: combinedJawaban,
      poin: totalPoin,
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
    subSoal?: { pertanyaan: string; jawaban: string; poin: number }[]
  }
) {
  const guru = await getCurrentGuru()
  const updateData: Record<string, any> = {}
  if (data.pertanyaan !== undefined) updateData.pertanyaan = data.pertanyaan
  if (data.jenisSoal !== undefined) updateData.jenisSoal = data.jenisSoal as any
  if (data.tingkatKesulitan !== undefined) updateData.tingkatKesulitan = data.tingkatKesulitan as any
  if (data.pilihanGanda !== undefined) updateData.pilihanGanda = data.pilihanGanda
  if (data.trueFalse !== undefined) updateData.trueFalse = data.trueFalse
  if (data.jawaban !== undefined) updateData.jawaban = data.jawaban
  if (data.poin !== undefined) updateData.poin = data.poin
  if (data.bab !== undefined) updateData.bab = data.bab
  if (data.tags !== undefined) updateData.tags = data.tags
  if (data.mataPelajaranId !== undefined) updateData.mataPelajaranId = data.mataPelajaranId

  if (data.subSoal !== undefined) {
    const subSoal = data.subSoal.filter((s) => s.pertanyaan.trim())
    updateData.subSoal = subSoal.length > 0 ? subSoal : null
    updateData.jawaban = subSoal.length > 0
      ? JSON.stringify(subSoal.map((s) => s.jawaban))
      : data.jawaban ?? ""
    updateData.poin = subSoal.length > 0
      ? subSoal.reduce((sum, s) => sum + (s.poin || 0), 0)
      : data.poin ?? 0
  }

  await prisma.soal.updateMany({
    where: { id, guruId: guru.id, deletedAt: null },
    data: updateData,
  })
  revalidatePath("/(dashboard)/guru/soal")
  return { success: true }
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
    subSoal: original.subSoal as any,
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

  // ── Auto‑transition otomatis exams that have reached their schedule ──
  const now = new Date()
  await prisma.ujian.updateMany({
    where: {
      guruId: guru.id, deletedAt: null,
      mode: "otomatis", status: "DRAFT",
      jamMulai: { lte: now },
    },
    data: { status: "AKTIF" },
  })
  await prisma.ujian.updateMany({
    where: {
      guruId: guru.id, deletedAt: null,
      mode: "otomatis", status: "AKTIF",
      jamSelesai: { lte: now },
    },
    data: { status: "SELESAI" },
  })

  const [data, total] = await Promise.all([
    prisma.ujian.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nama: true,
        status: true,
        mode: true,
        durasi: true,
        tanggal: true,
        jamMulai: true,
        jamSelesai: true,
        createdAt: true,
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
  bisaRetake?: boolean
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
      bisaRetake: data.bisaRetake ?? false,
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
    bisaRetake?: boolean
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
  if (data.bisaRetake !== undefined) updateData.bisaRetake = data.bisaRetake
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

export async function startUjian(id: string) {
  const guru = await getCurrentGuru()
  const ujian = await prisma.ujian.findFirst({
    where: { id, guruId: guru.id, deletedAt: null },
  })
  if (!ujian) throw new Error("Ujian tidak ditemukan")
  if (ujian.status !== "DRAFT" && ujian.status !== "SELESAI") {
    throw new Error("Hanya ujian dengan status Draft atau Selesai yang bisa dimulai ulang")
  }

  await prisma.ujian.updateMany({
    where: { id, guruId: guru.id, deletedAt: null },
    data: { status: "AKTIF" },
  })
  revalidatePath("/(dashboard)/guru/ujian")
}

export async function stopUjian(id: string) {
  const guru = await getCurrentGuru()
  const ujian = await prisma.ujian.findFirst({
    where: { id, guruId: guru.id, deletedAt: null },
  })
  if (!ujian) throw new Error("Ujian tidak ditemukan")
  if (ujian.status !== "AKTIF") throw new Error("Hanya ujian dengan status Aktif yang bisa dihentikan")

  await prisma.ujian.updateMany({
    where: { id, guruId: guru.id, deletedAt: null },
    data: { status: "SELESAI" },
  })
  revalidatePath("/(dashboard)/guru/ujian")
}

export async function resetUjian(id: string) {
  const guru = await getCurrentGuru()
  const ujian = await prisma.ujian.findFirst({
    where: { id, guruId: guru.id, deletedAt: null },
  })
  if (!ujian) throw new Error("Ujian tidak ditemukan")
  if (ujian.status !== "SELESAI") throw new Error("Hanya ujian Selesai yang bisa direset ke Draft")

  await prisma.ujian.updateMany({
    where: { id, guruId: guru.id, deletedAt: null },
    data: { status: "DRAFT" },
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

export async function getNilaiLatihans() {
  const guru = await getCurrentGuru()
  return prisma.ujian.findMany({
    where: { guruId: guru.id, deletedAt: null, isLatihan: true },
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

  const nilaiRecords = await prisma.nilai.findMany({
    where: { ujianId, deletedAt: null },
    select: { siswaId: true, nilai: true },
  })
  const nilaiMap = Object.fromEntries(nilaiRecords.map((n) => [n.siswaId, n.nilai]))

  return { ujian, jawabans, nilaiMap, nilaiMinimum: ujian.nilaiMinimum }
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

  const [kelas, ujians] = await Promise.all([
    prisma.kelas.findMany({
      where: { guruId: guru.id, deletedAt: null },
      select: { id: true, nama: true },
    }),
    prisma.ujian.findMany({
      where: { guruId: guru.id, deletedAt: null, isLatihan: false },
      select: { id: true, nama: true, nilaiMinimum: true },
    }),
  ])
  const pengajarans = await prisma.pengajaran.findMany({
    where: { guruId: guru.id, deletedAt: null, mataPelajaran: { deletedAt: null } },
    include: { mataPelajaran: { select: { id: true, nama: true } } },
  })
  const mapels = pengajarans.map((p) => p.mataPelajaran)

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

// ─── MURID ───────────────────────────────────────────────────

export async function getGuruMurids(params: {
  search?: string
  page?: number
  limit?: number
  kelasId?: string
}) {
  const guru = await getCurrentGuru()
  const { search, page = 1, limit = 10, kelasId } = params

  const mapels = await prisma.pengajaran.findMany({
    where: { guruId: guru.id, deletedAt: null, mataPelajaran: { deletedAt: null } },
    select: { kelas: { select: { id: true, nama: true } } },
    distinct: ["kelasId"],
  })
  let allowedKelasIds = mapels.map((p) => p.kelas.id)
  if (kelasId) {
    allowedKelasIds = allowedKelasIds.filter((id) => id === kelasId)
  }
  if (allowedKelasIds.length === 0) {
    return { data: [], total: 0, page, limit, totalPages: 0 }
  }

  const where: Record<string, unknown> = {
    kelasId: { in: allowedKelasIds },
    deletedAt: null,
  }
  if (search) {
    where.OR = [
      { nama: { contains: search, mode: "insensitive" } },
      { nis: { contains: search, mode: "insensitive" } },
      { nisn: { contains: search, mode: "insensitive" } },
      { noTelp: { contains: search, mode: "insensitive" } },
    ]
  }

  const [data, total] = await Promise.all([
    prisma.siswa.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { nama: "asc" },
      include: {
        user: { select: { email: true, isActive: true } },
        kelas: { select: { nama: true, tingkat: true } },
      },
    }),
    prisma.siswa.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getGuruPendingMurids(params: {
  search?: string
  page?: number
  limit?: number
}) {
  const guru = await getCurrentGuru()
  const { search, page = 1, limit = 10 } = params

  const where: Record<string, unknown> = { deletedAt: null, kelasId: null }
  if (search) {
    where.OR = [
      { nama: { contains: search, mode: "insensitive" } },
      { nis: { contains: search, mode: "insensitive" } },
      { nisn: { contains: search, mode: "insensitive" } },
      { noTelp: { contains: search, mode: "insensitive" } },
    ]
  }

  const [data, total] = await Promise.all([
    prisma.siswa.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true, isActive: true } },
        kelas: { select: { nama: true, tingkat: true } },
      },
    }),
    prisma.siswa.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getGuruKelasForMurid() {
  const guru = await getCurrentGuru()
  const mapels = await prisma.pengajaran.findMany({
    where: { guruId: guru.id, deletedAt: null, mataPelajaran: { deletedAt: null } },
    select: { kelas: { select: { id: true, nama: true } } },
    distinct: ["kelasId"],
  })
  const kelasIds = mapels.map((p) => p.kelas.id)
  if (kelasIds.length === 0) return []
  return prisma.kelas.findMany({
    where: { id: { in: kelasIds }, deletedAt: null },
    select: { id: true, nama: true, tingkat: true },
    orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
  })
}

export async function createGuruMurid(data: {
  nama: string
  nis?: string
  nisn?: string
  alamat?: string
  noTelp?: string
  kelasId: string
  email: string
  password?: string
}) {
  const guru = await getCurrentGuru()

  const pengajarans = await prisma.pengajaran.findMany({
    where: { guruId: guru.id, kelasId: data.kelasId, deletedAt: null, mataPelajaran: { deletedAt: null } },
    include: { mataPelajaran: { select: { id: true } } },
  })
  if (pengajarans.length === 0) throw new Error("Anda tidak mengajar di kelas ini")

  const existing = await prisma.user.findUnique({ where: { email: data.email } })
  if (existing) throw new Error("Email sudah terdaftar")

  const hashedPassword = data.password ? await bcrypt.hash(data.password, 12) : null
  const siswa = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: data.email, name: data.nama, role: "SISWA", password: hashedPassword },
    })
    return tx.siswa.create({
      data: {
        nama: data.nama,
        nis: data.nis || null,
        nisn: data.nisn || null,
        alamat: data.alamat || null,
        noTelp: data.noTelp || null,
        kelasId: data.kelasId,
        userId: user.id,
      },
      include: { user: true },
    })
  })
  revalidatePath("/(dashboard)/guru/murid")
  return siswa
}

export async function updateGuruMurid(
  id: string,
  data: { nama?: string; nis?: string; nisn?: string; alamat?: string; noTelp?: string; kelasId?: string }
) {
  const guru = await getCurrentGuru()

  const siswa = await prisma.siswa.findUnique({ where: { id }, select: { kelasId: true, userId: true } })
  if (!siswa) throw new Error("Murid tidak ditemukan")

  const targetKelasId = data.kelasId || siswa.kelasId
  if (targetKelasId) {
    const pengajarans = await prisma.pengajaran.findMany({
      where: { guruId: guru.id, kelasId: targetKelasId, deletedAt: null, mataPelajaran: { deletedAt: null } },
      include: { mataPelajaran: { select: { id: true } } },
    })
    if (pengajarans.length === 0) throw new Error("Anda tidak mengajar di kelas ini")
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.siswa.update({ where: { id }, data })
    if (data.nama && siswa.userId) {
      await tx.user.update({
        where: { id: siswa.userId },
        data: { name: data.nama },
      })
    }
    return result
  })
  revalidatePath("/(dashboard)/guru/murid")
  return updated
}

export async function deleteGuruMurid(id: string) {
  const guru = await getCurrentGuru()
  const siswa = await prisma.siswa.findUnique({ where: { id }, select: { kelasId: true } })
  if (!siswa) throw new Error("Murid tidak ditemukan")
  if (siswa.kelasId) {
    const pengajarans = await prisma.pengajaran.findMany({
      where: { guruId: guru.id, kelasId: siswa.kelasId, deletedAt: null, mataPelajaran: { deletedAt: null } },
      include: { mataPelajaran: { select: { id: true } } },
    })
    if (pengajarans.length === 0) throw new Error("Anda tidak memiliki akses ke murid ini")
  }
  await prisma.siswa.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/guru/murid")
}

// ─── REFS ────────────────────────────────────────────────────

export async function getGuruMapelRefs() {
  const guru = await getCurrentGuru()
  const pengajarans = await prisma.pengajaran.findMany({
    where: { guruId: guru.id, deletedAt: null, mataPelajaran: { deletedAt: null } },
    include: { mataPelajaran: { select: { id: true, nama: true, kode: true } }, kelas: { select: { id: true, nama: true } } },
  })
  return pengajarans.map((p) => ({ ...p.mataPelajaran, kelas: p.kelas }))
}

export async function getGuruKelasRefs() {
  const guru = await getCurrentGuru()
  const mapels = await prisma.pengajaran.findMany({
    where: { guruId: guru.id, deletedAt: null, mataPelajaran: { deletedAt: null } },
    select: { kelas: { select: { id: true, nama: true } } },
    distinct: ["kelasId"],
  })
  const kelasIds = mapels.map((p) => p.kelas.id)
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
    select: { id: true, pertanyaan: true, jenisSoal: true, bab: true, mataPelajaranId: true, subSoal: true },
    orderBy: { createdAt: "desc" },
  })
}

// ─── PENGATURAN (PROFIL) ─────────────────────────────────────

export async function getGuruProfile() {
  const guru = await getCurrentGuru()
  return prisma.guru.findUnique({
    where: { id: guru.id },
    include: { user: { select: { id: true, email: true, name: true, image: true } } },
  })
}

export async function updateGuruProfile(data: {
  nama?: string
  nip?: string
  nuptk?: string
  alamat?: string
  noTelp?: string
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const result = await prisma.$transaction(async (tx) => {
    const guru = await tx.guru.update({
      where: { userId: session.user.id },
      data: {
        ...(data.nama !== undefined && { nama: data.nama }),
        ...(data.nip !== undefined && { nip: data.nip || null }),
        ...(data.nuptk !== undefined && { nuptk: data.nuptk || null }),
        ...(data.alamat !== undefined && { alamat: data.alamat || null }),
        ...(data.noTelp !== undefined && { noTelp: data.noTelp || null }),
      },
    })
    if (data.nama) {
      await tx.user.update({
        where: { id: session.user.id },
        data: { name: data.nama },
      })
    }
    return guru
  })
  revalidatePath("/(dashboard)/guru/pengaturan")
  return result
}

export async function updateGuruPassword(data: { passwordLama: string; passwordBaru: string }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  })
  if (!user?.password) throw new Error("Akun ini tidak memiliki password (mungkin menggunakan Google SSO)")

  const isValid = await bcrypt.compare(data.passwordLama, user.password)
  if (!isValid) throw new Error("Password lama tidak sesuai")

  const hashed = await bcrypt.hash(data.passwordBaru, 12)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed },
  })
  return { success: true }
}

// ─── MATERI ──────────────────────────────────────────────────

export async function getGuruMateris() {
  const guru = await getCurrentGuru()
  const data = await prisma.materi.findMany({
    where: { guruId: guru.id, deletedAt: null },
    include: { mataPelajaran: { select: { id: true, nama: true } } },
    orderBy: { createdAt: "desc" },
  })
  return data
}

export async function getGuruMapelsWithMateri() {
  const guru = await getCurrentGuru()
  const pengajarans = await prisma.pengajaran.findMany({
    where: { guruId: guru.id, deletedAt: null, mataPelajaran: { deletedAt: null } },
    include: { mataPelajaran: { select: { id: true, nama: true, kode: true } }, kelas: { select: { id: true, nama: true } } },
  })
  return pengajarans.map((p) => ({ ...p.mataPelajaran, kelas: p.kelas }))
}

export async function createMateri(data: {
  judul: string
  deskripsi?: string
  fileUrl: string
  fileType?: string
  fileSize?: number
  mataPelajaranId: string
}) {
  const guru = await getCurrentGuru()
  const materi = await prisma.materi.create({
    data: {
      judul: data.judul,
      deskripsi: data.deskripsi || null,
      fileUrl: data.fileUrl,
      fileType: data.fileType || null,
      fileSize: data.fileSize || null,
      mataPelajaranId: data.mataPelajaranId,
      guruId: guru.id,
    },
  })
  revalidatePath("/(dashboard)/guru/materi")
  return materi
}

export async function deleteMateri(id: string) {
  const guru = await getCurrentGuru()
  await prisma.materi.updateMany({
    where: { id, guruId: guru.id, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  revalidatePath("/(dashboard)/guru/materi")
}

// ─── WALI KELAS ──────────────────────────────────────────────

export async function getWaliKelasInfo() {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findMany({
    where: { guruId: guru.id, deletedAt: null },
    include: {
      _count: { select: { siswas: true } },
      siswas: { where: { deletedAt: null }, orderBy: { nama: "asc" } },
    },
    orderBy: { nama: "asc" },
  })
  return kelas
}

export async function updateSiswaJabatan(siswaId: string, jabatan: string | null) {
  const guru = await getCurrentGuru()
  const siswa = await prisma.siswa.findUnique({
    where: { id: siswaId },
    select: { kelas: { select: { guruId: true } } },
  })
  if (!siswa || siswa.kelas?.guruId !== guru.id) throw new Error("Akses ditolak")
  await prisma.siswa.update({
    where: { id: siswaId },
    data: { jabatan: jabatan || null },
  })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

// ─── JADWAL PIKET ────────────────────────────────────────────

export async function getJadwalPiket(kelasId: string) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Kelas tidak ditemukan")

  return prisma.jadwalPiket.findMany({
    where: { kelasId },
    include: { siswa: { select: { id: true, nama: true } } },
    orderBy: [{ hari: "asc" }, { siswa: { nama: "asc" } }],
  })
}

export async function createJadwalPiket(kelasId: string, siswaId: string, hari: string) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  await prisma.jadwalPiket.create({
    data: { kelasId, siswaId, hari },
  })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

export async function deleteJadwalPiket(id: string) {
  const item = await prisma.jadwalPiket.findUnique({
    where: { id },
    include: { kelas: { select: { guruId: true } } },
  })
  if (!item || item.kelas.guruId !== (await getCurrentGuru()).id) throw new Error("Akses ditolak")
  await prisma.jadwalPiket.delete({ where: { id } })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

// ─── IURAN ────────────────────────────────────────────────────

export async function getIuran(kelasId: string) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  return prisma.iuran.findMany({
    where: { kelasId, deletedAt: null },
    include: {
      _count: { select: { pembayaran: true } },
      pembayaran: {
        include: { siswa: { select: { id: true, nama: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function createIuran(data: { kelasId: string; nama: string; nominal: number; tenggat?: string; deskripsi?: string }) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: data.kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  await prisma.iuran.create({
    data: {
      kelasId: data.kelasId,
      nama: data.nama,
      nominal: data.nominal,
      tenggat: data.tenggat ? new Date(data.tenggat) : null,
      deskripsi: data.deskripsi || null,
    },
  })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

export async function deleteIuran(id: string) {
  const item = await prisma.iuran.findUnique({
    where: { id },
    include: { kelas: { select: { guruId: true } } },
  })
  if (!item || item.kelas.guruId !== (await getCurrentGuru()).id) throw new Error("Akses ditolak")
  await prisma.iuran.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

export async function recordPembayaranIuran(iuranId: string, siswaId: string, jumlah: number) {
  const guru = await getCurrentGuru()
  const iuran = await prisma.iuran.findUnique({
    where: { id: iuranId },
    include: { kelas: { select: { guruId: true } } },
  })
  if (!iuran || iuran.kelas.guruId !== guru.id) throw new Error("Akses ditolak")

  await prisma.pembayaranIuran.upsert({
    where: { iuranId_siswaId: { iuranId, siswaId } },
    update: { jumlah, status: "LUNAS", tanggalBayar: new Date() },
    create: { iuranId, siswaId, jumlah, status: "LUNAS" },
  })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

// ─── DENDA ────────────────────────────────────────────────────

export async function getDenda(kelasId: string) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  return prisma.denda.findMany({
    where: { kelasId, deletedAt: null },
    include: {
      _count: { select: { pembayaran: true } },
      pembayaran: {
        include: { siswa: { select: { id: true, nama: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function createDenda(data: {
  kelasId: string; nama: string; nominal: number; deskripsi?: string
}) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: data.kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  await prisma.denda.create({
    data: {
      kelasId: data.kelasId,
      nama: data.nama,
      nominal: data.nominal,
      deskripsi: data.deskripsi || null,
    },
  })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

export async function deleteDenda(id: string) {
  const item = await prisma.denda.findUnique({
    where: { id },
    include: { kelas: { select: { guruId: true } } },
  })
  if (!item || item.kelas.guruId !== (await getCurrentGuru()).id) throw new Error("Akses ditolak")
  await prisma.denda.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

export async function recordPembayaranDenda(dendaId: string, siswaId: string, jumlah: number) {
  const guru = await getCurrentGuru()
  const denda = await prisma.denda.findUnique({
    where: { id: dendaId },
    include: { kelas: { select: { guruId: true } } },
  })
  if (!denda || denda.kelas.guruId !== guru.id) throw new Error("Akses ditolak")

  await prisma.pembayaranDenda.upsert({
    where: { dendaId_siswaId: { dendaId, siswaId } },
    update: { jumlah, status: "LUNAS", tanggalBayar: new Date() },
    create: { dendaId, siswaId, jumlah, status: "LUNAS" },
  })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

// ─── PENGELUARAN ──────────────────────────────────────────────

export async function getPengeluaran(kelasId: string) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  return prisma.pengeluaranKelas.findMany({
    where: { kelasId, deletedAt: null },
    orderBy: { tanggal: "desc" },
  })
}

export async function createPengeluaran(data: {
  kelasId: string; jumlah: number; keterangan: string; tanggal?: string
}) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: data.kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  await prisma.pengeluaranKelas.create({
    data: {
      kelasId: data.kelasId,
      jumlah: data.jumlah,
      keterangan: data.keterangan,
      tanggal: data.tanggal ? new Date(data.tanggal) : new Date(),
    },
  })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

export async function deletePengeluaran(id: string) {
  const item = await prisma.pengeluaranKelas.findUnique({
    where: { id },
    include: { kelas: { select: { guruId: true } } },
  })
  if (!item || item.kelas.guruId !== (await getCurrentGuru()).id) throw new Error("Akses ditolak")
  await prisma.pengeluaranKelas.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

// ─── SUMMARY KAS ──────────────────────────────────────────────

export async function getSummaryKas(kelasId: string) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  const [totalIuran, totalDenda, totalPengeluaran] = await Promise.all([
    prisma.pembayaranIuran.aggregate({
      where: { iuran: { kelasId, deletedAt: null } },
      _sum: { jumlah: true },
    }),
    prisma.pembayaranDenda.aggregate({
      where: { denda: { kelasId, deletedAt: null } },
      _sum: { jumlah: true },
    }),
    prisma.pengeluaranKelas.aggregate({
      where: { kelasId, deletedAt: null },
      _sum: { jumlah: true },
    }),
  ])

  const pemasukanIuran = totalIuran._sum.jumlah || 0
  const pemasukanDenda = totalDenda._sum.jumlah || 0
  const totalPemasukan = pemasukanIuran + pemasukanDenda
  const totalKeluar = totalPengeluaran._sum.jumlah || 0
  const sisaKas = totalPemasukan - totalKeluar

  return {
    pemasukanIuran,
    pemasukanDenda,
    totalPemasukan,
    totalPengeluaran: totalKeluar,
    sisaKas,
  }
}

// ─── JADWAL PELAJARAN (WALI KELAS) ────────────────────────────

export async function getJadwalPelajaranGuru(kelasId: string) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  return prisma.jadwalPelajaran.findMany({
    where: { kelasId, deletedAt: null },
    include: { mataPelajaran: { select: { id: true, nama: true } } },
    orderBy: [{ hari: "asc" }, { jamMulai: "asc" }],
  })
}

export async function getMapelByKelas(kelasId: string) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  const pengajarans = await prisma.pengajaran.findMany({
    where: { kelasId, deletedAt: null, mataPelajaran: { deletedAt: null } },
    include: { mataPelajaran: { select: { id: true, kode: true, nama: true } } },
  })
  return pengajarans.map((p) => p.mataPelajaran)
}

export async function createJadwalPelajaranGuru(data: {
  kelasId: string; mataPelajaranId: string; hari: string; jamMulai: string; jamSelesai: string
}) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: data.kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  await prisma.jadwalPelajaran.create({ data })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

export async function deleteJadwalPelajaranGuru(id: string) {
  const item = await prisma.jadwalPelajaran.findUnique({
    where: { id },
    include: { kelas: { select: { guruId: true } } },
  })
  if (!item || item.kelas.guruId !== (await getCurrentGuru()).id) throw new Error("Akses ditolak")
  await prisma.jadwalPelajaran.delete({ where: { id } })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

// ─── PELANGGARAN ──────────────────────────────────────────────

export async function getPelanggaran(kelasId: string) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  return prisma.pelanggaran.findMany({
    where: { kelasId, deletedAt: null },
    include: { siswa: { select: { id: true, nama: true } } },
    orderBy: { tanggal: "desc" },
  })
}

export async function createPelanggaran(data: {
  kelasId: string; siswaId: string; jenis: string; deskripsi?: string; poin?: number; tindakan?: string; tanggal?: string
}) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findFirst({
    where: { id: data.kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Akses ditolak")

  await prisma.pelanggaran.create({
    data: {
      kelasId: data.kelasId,
      siswaId: data.siswaId,
      jenis: data.jenis,
      deskripsi: data.deskripsi || null,
      poin: data.poin || null,
      tindakan: data.tindakan || null,
      tanggal: data.tanggal ? new Date(data.tanggal) : new Date(),
    },
  })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

export async function deletePelanggaran(id: string) {
  const item = await prisma.pelanggaran.findUnique({
    where: { id },
    include: { kelas: { select: { guruId: true } } },
  })
  if (!item || item.kelas.guruId !== (await getCurrentGuru()).id) throw new Error("Akses ditolak")
  await prisma.pelanggaran.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/guru/wali-kelas")
  return { success: true }
}

// ─── REKAP ABSENSI ───────────────────────────────────────────

export async function getRekapAbsensi(kelasId: string) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findUnique({
    where: { id: kelasId, guruId: guru.id, deletedAt: null },
    include: {
      siswas: { where: { deletedAt: null }, orderBy: { nama: "asc" } },
    },
  })
  if (!kelas) throw new Error("Kelas tidak ditemukan")

  const absensiList = await prisma.absensi.findMany({
    where: { kelasId },
    include: {
      mataPelajaran: { select: { nama: true } },
      siswa: true,
    },
    orderBy: { tanggal: "desc" },
  })

  const totalPertemuan = absensiList.length

  const rekap = kelas.siswas.map((siswa) => {
    let totalHadir = 0, totalSakit = 0, totalIzin = 0, totalAlpa = 0, totalTidakHadir = 0
    let tercatat = 0

    for (const absensi of absensiList) {
      const entry = absensi.siswa.find((s) => s.siswaId === siswa.id)
      if (!entry) continue
      tercatat++
      switch (entry.status) {
        case "HADIR": totalHadir++; break
        case "SAKIT": totalSakit++; break
        case "IZIN": totalIzin++; break
        case "ALPA": totalAlpa++; break
        case "TIDAK_HADIR": totalTidakHadir++; break
      }
    }

    const persentase = tercatat > 0 ? Math.round((totalHadir / tercatat) * 100) : 0

    return {
      id: siswa.id,
      nama: siswa.nama,
      nis: siswa.nis,
      jabatan: siswa.jabatan,
      totalHadir,
      totalSakit,
      totalIzin,
      totalAlpa,
      totalTidakHadir,
      tercatat,
      persentase,
    }
  })

  return {
    totalPertemuan,
    siswa: rekap,
  }
}

export async function getDetailAbsensiSiswa(kelasId: string, siswaId: string) {
  const guru = await getCurrentGuru()
  const kelas = await prisma.kelas.findUnique({
    where: { id: kelasId, guruId: guru.id, deletedAt: null },
  })
  if (!kelas) throw new Error("Kelas tidak ditemukan")

  const absensiList = await prisma.absensi.findMany({
    where: { kelasId },
    include: {
      mataPelajaran: { select: { nama: true } },
      siswa: {
        where: { siswaId },
      },
    },
    orderBy: { tanggal: "desc" },
  })

  const siswa = await prisma.siswa.findUnique({
    where: { id: siswaId },
    select: { id: true, nama: true, nis: true, jabatan: true },
  })
  if (!siswa) throw new Error("Siswa tidak ditemukan")

  const detail = absensiList
    .filter((a) => a.siswa.length > 0)
    .map((a) => ({
      tanggal: a.tanggal,
      mataPelajaran: a.mataPelajaran.nama,
      status: a.siswa[0].status,
      keterangan: a.siswa[0].keterangan,
    }))

  return { siswa, detail }
}
