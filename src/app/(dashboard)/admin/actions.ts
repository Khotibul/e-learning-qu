"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

// ─── DASHBOARD ───────────────────────────────────────────

export async function getDashboardStats() {
  const [totalGuru, totalSiswa, totalSoal, totalUjian, totalKelas, totalMapel, totalNilai] =
    await Promise.all([
      prisma.guru.count({ where: { deletedAt: null } }),
      prisma.siswa.count({ where: { deletedAt: null } }),
      prisma.soal.count({ where: { deletedAt: null } }),
      prisma.ujian.count({ where: { deletedAt: null } }),
      prisma.kelas.count({ where: { deletedAt: null } }),
      prisma.mataPelajaran.count({ where: { deletedAt: null } }),
      prisma.nilai.count({ where: { deletedAt: null } }),
    ])
  return { totalGuru, totalSiswa, totalSoal, totalUjian, totalKelas, totalMapel, totalNilai }
}

// ─── GURU ────────────────────────────────────────────────

export async function getGurus(params: {
  search?: string
  page?: number
  limit?: number
  includeDeleted?: boolean
}) {
  const { search, page = 1, limit = 10, includeDeleted = false } = params
  const where: Record<string, unknown> = {}
  if (!includeDeleted) where.deletedAt = null
  if (search) {
    where.OR = [
      { nama: { contains: search, mode: "insensitive" } },
      { nip: { contains: search, mode: "insensitive" } },
      { nuptk: { contains: search, mode: "insensitive" } },
      { noTelp: { contains: search, mode: "insensitive" } },
    ]
  }
  const [data, total] = await Promise.all([
    prisma.guru.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true, isActive: true } } },
    }),
    prisma.guru.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getGuru(id: string) {
  return prisma.guru.findUnique({ where: { id }, include: { user: true } })
}

export async function createGuru(data: {
  nama: string
  jabatan?: string
  nip?: string
  nuptk?: string
  alamat?: string
  noTelp?: string
  email: string
  password?: string
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } })
  if (existing) throw new Error("Email sudah terdaftar")
  const hashedPassword = data.password ? await bcrypt.hash(data.password, 12) : null
  const guru = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: data.email, name: data.nama, role: "GURU", password: hashedPassword },
    })
    return tx.guru.create({
      data: {
        nama: data.nama,
        jabatan: data.jabatan || null,
        nip: data.nip || null,
        nuptk: data.nuptk || null,
        alamat: data.alamat || null,
        noTelp: data.noTelp || null,
        userId: user.id,
      },
      include: { user: true },
    })
  })
  revalidatePath("/(dashboard)/admin/guru")
  return guru
}

export async function updateGuru(
  id: string,
  data: { nama?: string; jabatan?: string; nip?: string; nuptk?: string; alamat?: string; noTelp?: string }
) {
  const guru = await prisma.$transaction(async (tx) => {
    const updated = await tx.guru.update({
      where: { id },
      data: {
        nama: data.nama,
        jabatan: data.jabatan || null,
        nip: data.nip,
        nuptk: data.nuptk,
        alamat: data.alamat,
        noTelp: data.noTelp,
      },
      include: { user: true },
    })
    if (data.nama) {
      await tx.user.update({
        where: { id: updated.userId },
        data: { name: data.nama },
      })
    }
    return updated
  })
  revalidatePath("/(dashboard)/admin/guru")
  return guru
}

export async function deleteGuru(id: string) {
  await prisma.guru.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/admin/guru")
}

export async function restoreGuru(id: string) {
  await prisma.guru.update({ where: { id }, data: { deletedAt: null } })
  revalidatePath("/(dashboard)/admin/guru")
}

// ─── MURID ───────────────────────────────────────────────

export async function getMurids(params: {
  search?: string
  page?: number
  limit?: number
  includeDeleted?: boolean
  kelasId?: string
}) {
  const { search, page = 1, limit = 10, includeDeleted = false, kelasId } = params
  const where: Record<string, unknown> = {}
  if (!includeDeleted) where.deletedAt = null
  if (kelasId) where.kelasId = kelasId
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
        kelas: { select: { nama: true } },
      },
    }),
    prisma.siswa.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function createMurid(data: {
  nama: string
  nis?: string
  nisn?: string
  alamat?: string
  noTelp?: string
  kelasId?: string
  jabatan?: string
  email: string
  password?: string
}) {
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
        kelasId: data.kelasId || null,
        jabatan: data.jabatan || null,
        userId: user.id,
      },
      include: { user: true },
    })
  })
  revalidatePath("/(dashboard)/admin/murid")
  return siswa
}

export async function updateMurid(
  id: string,
  data: { nama?: string; nis?: string; nisn?: string; alamat?: string; noTelp?: string; kelasId?: string; jabatan?: string }
) {
  const siswa = await prisma.$transaction(async (tx) => {
    const updated = await tx.siswa.update({ where: { id }, data, include: { user: true } })
    if (data.nama) {
      await tx.user.update({
        where: { id: updated.userId },
        data: { name: data.nama },
      })
    }
    return updated
  })
  revalidatePath("/(dashboard)/admin/murid")
  return siswa
}

export async function deleteMurid(id: string) {
  await prisma.siswa.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/admin/murid")
}

export async function restoreMurid(id: string) {
  await prisma.siswa.update({ where: { id }, data: { deletedAt: null } })
  revalidatePath("/(dashboard)/admin/murid")
}

// ─── KELAS ───────────────────────────────────────────────

export async function getKelass(params: { search?: string; page?: number; limit?: number }) {
  const { search, page = 1, limit = 10 } = params
  const where: Record<string, unknown> = { deletedAt: null }
  if (search) where.OR = [{ nama: { contains: search, mode: "insensitive" } }]
  const [data, total] = await Promise.all([
    prisma.kelas.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { guru: { select: { nama: true } }, _count: { select: { siswas: true } } },
    }),
    prisma.kelas.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function createKelas(data: { nama: string; tingkat: number; guruId?: string }) {
  const kelas = await prisma.kelas.create({ data: { ...data, guruId: data.guruId || null } })
  revalidatePath("/(dashboard)/admin/kelas")
  return kelas
}

export async function updateKelas(id: string, data: { nama?: string; tingkat?: number; guruId?: string }) {
  const kelas = await prisma.kelas.update({ where: { id }, data })
  revalidatePath("/(dashboard)/admin/kelas")
  return kelas
}

export async function deleteKelas(id: string) {
  await prisma.kelas.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/admin/kelas")
}

// ─── MAPEL ───────────────────────────────────────────────

export async function getMapels(params: { search?: string; page?: number; limit?: number }) {
  const { search, page = 1, limit = 10 } = params
  const where: Record<string, unknown> = { deletedAt: null }
  if (search) {
    where.OR = [
      { nama: { contains: search, mode: "insensitive" } },
      { kode: { contains: search, mode: "insensitive" } },
    ]
  }
  const [data, total] = await Promise.all([
    prisma.mataPelajaran.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        semester: { select: { nama: true, tahunAjaran: { select: { nama: true } } } },
        pengajaran: {
          where: { deletedAt: null },
          include: {
            guru: { select: { nama: true } },
            kelas: { select: { nama: true } },
          },
        },
        _count: { select: { pengajaran: true } },
      },
    }),
    prisma.mataPelajaran.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function createMapel(data: {
  kode: string
  nama: string
  deskripsi?: string
  guruId: string
  kelasIds: string[]
  semesterId: string
}) {
  const mapel = await prisma.mataPelajaran.create({
    data: {
      kode: data.kode,
      nama: data.nama,
      deskripsi: data.deskripsi || null,
      semesterId: data.semesterId,
      pengajaran: {
        create: data.kelasIds.map((kelasId) => ({
          guruId: data.guruId,
          kelasId,
        })),
      },
    },
  })
  revalidatePath("/(dashboard)/admin/mapel")
  return mapel
}

export async function updateMapel(
  id: string,
  data: { kode?: string; nama?: string; deskripsi?: string; semesterId?: string }
) {
  const mapel = await prisma.mataPelajaran.update({ where: { id }, data })
  revalidatePath("/(dashboard)/admin/mapel")
  return mapel
}

export async function addPengajaran(mataPelajaranId: string, guruId: string, kelasId: string) {
  await prisma.pengajaran.upsert({
    where: { mataPelajaranId_guruId_kelasId: { mataPelajaranId, guruId, kelasId } },
    update: { deletedAt: null },
    create: { mataPelajaranId, guruId, kelasId },
  })
  revalidatePath("/(dashboard)/admin/mapel")
}

export async function removePengajaran(id: string) {
  await prisma.pengajaran.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/admin/mapel")
}

export async function deleteMapel(id: string) {
  await prisma.mataPelajaran.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/admin/mapel")
}

// ─── TAHUN AJARAN ────────────────────────────────────────

export async function getTahunAjarans(params: { search?: string; page?: number; limit?: number }) {
  const { search, page = 1, limit = 10 } = params
  const where: Record<string, unknown> = { deletedAt: null }
  if (search) where.nama = { contains: search, mode: "insensitive" }
  const [data, total] = await Promise.all([
    prisma.tahunAjaran.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.tahunAjaran.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function createTahunAjaran(data: {
  nama: string
  tahunMulai: number
  tahunSelesai: number
  isAktif?: boolean
}) {
  if (data.isAktif) {
    await prisma.tahunAjaran.updateMany({ where: { isAktif: true }, data: { isAktif: false } })
  }
  const ta = await prisma.tahunAjaran.create({ data: { ...data, isAktif: data.isAktif ?? false } })
  revalidatePath("/(dashboard)/admin/tahun-ajaran")
  return ta
}

export async function updateTahunAjaran(
  id: string,
  data: { nama?: string; tahunMulai?: number; tahunSelesai?: number; isAktif?: boolean }
) {
  if (data.isAktif) {
    await prisma.tahunAjaran.updateMany({
      where: { isAktif: true, id: { not: id } },
      data: { isAktif: false },
    })
  }
  const ta = await prisma.tahunAjaran.update({ where: { id }, data })
  revalidatePath("/(dashboard)/admin/tahun-ajaran")
  return ta
}

export async function deleteTahunAjaran(id: string) {
  await prisma.tahunAjaran.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/admin/tahun-ajaran")
}

export async function setActiveTahunAjaran(id: string) {
  await prisma.tahunAjaran.updateMany({ where: { isAktif: true }, data: { isAktif: false } })
  await prisma.tahunAjaran.update({ where: { id }, data: { isAktif: true } })
  revalidatePath("/(dashboard)/admin/tahun-ajaran")
}

// ─── SEMESTER ────────────────────────────────────────────

export async function getSemesters(params: {
  search?: string
  page?: number
  limit?: number
  tahunAjaranId?: string
}) {
  const { search, page = 1, limit = 10, tahunAjaranId } = params
  const where: Record<string, unknown> = { deletedAt: null }
  if (tahunAjaranId) where.tahunAjaranId = tahunAjaranId
  if (search) where.nama = { contains: search, mode: "insensitive" }
  const [data, total] = await Promise.all([
    prisma.semester.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { tahunAjaran: { select: { nama: true } } },
    }),
    prisma.semester.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function createSemester(data: {
  nama: string
  tahunAjaranId: string
  isAktif?: boolean
}) {
  if (data.isAktif) {
    await prisma.semester.updateMany({ where: { isAktif: true }, data: { isAktif: false } })
  }
  const semester = await prisma.semester.create({
    data: { ...data, isAktif: data.isAktif ?? false },
  })
  revalidatePath("/(dashboard)/admin/semester")
  return semester
}

export async function updateSemester(
  id: string,
  data: { nama?: string; tahunAjaranId?: string; isAktif?: boolean }
) {
  if (data.isAktif) {
    await prisma.semester.updateMany({
      where: { isAktif: true, id: { not: id } },
      data: { isAktif: false },
    })
  }
  const semester = await prisma.semester.update({ where: { id }, data })
  revalidatePath("/(dashboard)/admin/semester")
  return semester
}

export async function deleteSemester(id: string) {
  await prisma.semester.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/admin/semester")
}

export async function setActiveSemester(id: string) {
  await prisma.semester.updateMany({ where: { isAktif: true }, data: { isAktif: false } })
  await prisma.semester.update({ where: { id }, data: { isAktif: true } })
  revalidatePath("/(dashboard)/admin/semester")
}

// ─── PENGUMUMAN ──────────────────────────────────────────

export async function getPengumumen(params: { page?: number; limit?: number }) {
  const { page = 1, limit = 10 } = params
  const where = { deletedAt: null }
  const [data, total] = await Promise.all([
    prisma.pengumuman.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true } },
        kelas: { select: { nama: true } },
      },
    }),
    prisma.pengumuman.count({ where }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function createPengumuman(data: {
  judul: string
  isi: string
  gambar?: string
  lampiran?: string
  tipe?: string
  userId: string
  kelasId?: string
}) {
  const pengumuman = await prisma.pengumuman.create({
    data: {
      judul: data.judul,
      isi: data.isi,
      gambar: data.gambar || null,
      lampiran: data.lampiran || null,
      tipe: data.tipe || "UMUM",
      userId: data.userId,
      kelasId: data.kelasId || null,
    },
  })
  revalidatePath("/(dashboard)/admin/pengumuman")
  return pengumuman
}

export async function deletePengumuman(id: string) {
  await prisma.pengumuman.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/admin/pengumuman")
}

// ─── NILAI ───────────────────────────────────────────────

export async function getNilais(params: {
  kelasId?: string
  mapelId?: string
  semesterId?: string
  page?: number
  limit?: number
}) {
  const { kelasId, mapelId, semesterId, page = 1, limit = 20 } = params
  const where: Record<string, unknown> = { deletedAt: null }
  if (kelasId) where.kelasId = kelasId
  if (mapelId) where.mataPelajaranId = mapelId
  if (semesterId) where.semesterId = semesterId
  if (kelasId && !mapelId) {
    where.siswa = { kelasId }
  }
  const [data, total] = await Promise.all([
    prisma.nilai.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        siswa: { select: { nama: true, nis: true, kelas: { select: { nama: true } } } },
        mataPelajaran: { select: { nama: true, kode: true } },
        semester: { select: { nama: true } },
      },
    }),
    prisma.nilai.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

// ─── STATISTIK ───────────────────────────────────────────

export async function getStatistikGuruMurid() {
  const [guru, murid] = await Promise.all([
    prisma.guru.count({ where: { deletedAt: null } }),
    prisma.siswa.count({ where: { deletedAt: null } }),
  ])
  return { guru, murid }
}

export async function getStatistikPerKelas() {
  const kelas = await prisma.kelas.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { siswas: true } } },
    orderBy: { tingkat: "asc" },
  })
  return kelas.map((k) => ({ label: k.nama, nilai: k._count.siswas, tingkat: k.tingkat }))
}

export async function getStatistikPerMapel() {
  const mapels = await prisma.mataPelajaran.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { soals: true, nilai: true } } },
    orderBy: { nama: "asc" },
  })
  return mapels.map((m) => ({ label: m.nama, nilai: m._count.nilai, soalCount: m._count.soals }))
}

// ─── REFS ────────────────────────────────────────────────

export async function getGuruRefs() {
  return prisma.guru.findMany({
    where: { deletedAt: null },
    select: { id: true, nama: true },
    orderBy: { nama: "asc" },
  })
}

export async function getKelasRefs() {
  return prisma.kelas.findMany({
    where: { deletedAt: null },
    select: { id: true, nama: true, tingkat: true },
    orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
  })
}

export async function getSemesterRefs() {
  return prisma.semester.findMany({
    where: { deletedAt: null },
    select: { id: true, nama: true, tahunAjaran: { select: { nama: true } } },
    orderBy: { createdAt: "desc" },
  })
}

export async function getTahunAjaranRefs() {
  return prisma.tahunAjaran.findMany({
    where: { deletedAt: null },
    select: { id: true, nama: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function getMapelRefs() {
  return prisma.mataPelajaran.findMany({
    where: { deletedAt: null },
    select: { id: true, nama: true, kode: true },
    orderBy: { nama: "asc" },
  })
}
