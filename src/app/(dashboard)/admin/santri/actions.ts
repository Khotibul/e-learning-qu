"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import type { StatusSantri, HubunganWali } from "@prisma/client"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role !== "ADMIN") throw new Error("Forbidden")
  return session.user.id
}

// ─── SANTRI ────────────────────────────────────────────────────────────

export async function getSantris(params: { search?: string; page?: number; limit?: number; status?: string }) {
  await requireAdmin()
  const { search, page = 1, limit = 10, status } = params
  const where: Record<string, unknown> = { deletedAt: null }
  if (status) where.status = status
  if (search) {
    where.OR = [
      { nama: { contains: search, mode: "insensitive" } },
      { nisNo: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { siswa: { nis: { contains: search, mode: "insensitive" } } },
      { siswa: { nama: { contains: search, mode: "insensitive" } } },
    ]
  }
  const [data, total] = await Promise.all([
    prisma.santri.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true, isActive: true } },
        siswa: { select: { id: true, nis: true, nama: true, kelas: { select: { nama: true } } } },
        walis: { include: { wali: { select: { id: true, nama: true, hubungan: true, noTelp: true } } } },
      },
    }),
    prisma.santri.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

/** Daftar siswa aktif yang BELUM terdaftar sebagai santri (untuk pendaftaran dari sekolah). */
export async function getSiswaOpts(search?: string) {
  await requireAdmin()
  const where: Record<string, unknown> = { deletedAt: null, santri: null }
  if (search) {
    where.OR = [
      { nama: { contains: search, mode: "insensitive" } },
      { nis: { contains: search, mode: "insensitive" } },
    ]
  }
  return prisma.siswa.findMany({
    where: where as any,
    select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } }, user: { select: { email: true } } },
    orderBy: { nama: "asc" },
    take: 50,
  })
}

export async function createSantriDariSiswa(data: { siswaId: string; nisNo?: string; tanggalMasuk?: string; catatan?: string }) {
  await requireAdmin()
  const siswa = await prisma.siswa.findUnique({ where: { id: data.siswaId }, include: { santri: { select: { id: true } } } })
  if (!siswa || siswa.deletedAt) throw new Error("Siswa tidak ditemukan")
  if (siswa.santri) throw new Error("Siswa ini sudah terdaftar sebagai santri")
  if (data.nisNo) {
    const dup = await prisma.santri.findFirst({ where: { nisNo: data.nisNo, deletedAt: null } })
    if (dup) throw new Error("Nomor Induk Santri sudah dipakai")
  }
  const santri = await prisma.santri.create({
    data: {
      userId: siswa.userId,
      siswaId: siswa.id,
      nisNo: data.nisNo || null,
      nama: siswa.nama,
      tanggalMasuk: data.tanggalMasuk ? new Date(data.tanggalMasuk) : null,
      catatan: data.catatan || null,
    },
  })
  revalidatePath("/admin/santri")
  return santri
}

export async function createSantriNonformal(data: {
  nama: string
  email: string
  password: string
  nisNo?: string
  noTelp?: string
  tanggalMasuk?: string
  catatan?: string
}) {
  await requireAdmin()
  if (!data.nama || !data.email || !data.password) throw new Error("Nama, email, dan password wajib diisi")
  if (data.password.length < 6) throw new Error("Password minimal 6 karakter")
  const existing = await prisma.user.findUnique({ where: { email: data.email } })
  if (existing) throw new Error("Email sudah terdaftar")
  if (data.nisNo) {
    const dup = await prisma.santri.findFirst({ where: { nisNo: data.nisNo, deletedAt: null } })
    if (dup) throw new Error("Nomor Induk Santri sudah dipakai")
  }
  const hash = await bcrypt.hash(data.password, 12)
  const santri = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: data.email, name: data.nama, password: hash, role: "SISWA" },
    })
    return tx.santri.create({
      data: {
        userId: user.id,
        nisNo: data.nisNo || null,
        nama: data.nama,
        tanggalMasuk: data.tanggalMasuk ? new Date(data.tanggalMasuk) : null,
        catatan: data.catatan || null,
      },
    })
  })
  revalidatePath("/admin/santri")
  return santri
}

export async function updateSantri(
  id: string,
  data: { nisNo?: string | null; tanggalMasuk?: string | null; catatan?: string | null; status?: StatusSantri }
) {
  await requireAdmin()
  const santri = await prisma.santri.findUnique({ where: { id } })
  if (!santri || santri.deletedAt) throw new Error("Santri tidak ditemukan")
  if (data.nisNo) {
    const dup = await prisma.santri.findFirst({ where: { nisNo: data.nisNo, NOT: { id }, deletedAt: null } })
    if (dup) throw new Error("Nomor Induk Santri sudah dipakai")
  }
  const updated = await prisma.santri.update({
    where: { id },
    data: {
      ...(data.nisNo !== undefined && { nisNo: data.nisNo || null }),
      ...(data.tanggalMasuk !== undefined && { tanggalMasuk: data.tanggalMasuk ? new Date(data.tanggalMasuk) : null }),
      ...(data.catatan !== undefined && { catatan: data.catatan || null }),
      ...(data.status !== undefined && { status: data.status }),
    },
  })
  revalidatePath("/admin/santri")
  return updated
}

/** Soft-delete — akun User & data siswa TIDAK dihapus (identitas utama dipertahankan). */
export async function deleteSantri(id: string) {
  await requireAdmin()
  const santri = await prisma.santri.findUnique({ where: { id } })
  if (!santri || santri.deletedAt) throw new Error("Santri tidak ditemukan")
  await prisma.santri.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/admin/santri")
}

// ─── WALI SANTRI ───────────────────────────────────────────────────────

export async function getWaliOpts(search?: string) {
  await requireAdmin()
  const where: Record<string, unknown> = { deletedAt: null }
  if (search) {
    where.OR = [
      { nama: { contains: search, mode: "insensitive" } },
      { noTelp: { contains: search, mode: "insensitive" } },
    ]
  }
  return prisma.waliSantri.findMany({
    where: where as any,
    select: { id: true, nama: true, hubungan: true, noTelp: true, _count: { select: { anak: true } } },
    orderBy: { nama: "asc" },
    take: 50,
  })
}

export async function createWali(data: { nama: string; hubungan: HubunganWali; noTelp?: string; alamat?: string }) {
  await requireAdmin()
  if (!data.nama) throw new Error("Nama wali wajib diisi")
  const wali = await prisma.waliSantri.create({
    data: { nama: data.nama, hubungan: data.hubungan, noTelp: data.noTelp || null, alamat: data.alamat || null },
  })
  revalidatePath("/admin/santri")
  return wali
}

export async function updateWali(id: string, data: { nama?: string; hubungan?: HubunganWali; noTelp?: string | null; alamat?: string | null }) {
  await requireAdmin()
  const wali = await prisma.waliSantri.findUnique({ where: { id } })
  if (!wali || wali.deletedAt) throw new Error("Wali tidak ditemukan")
  const updated = await prisma.waliSantri.update({
    where: { id },
    data: {
      ...(data.nama !== undefined && { nama: data.nama }),
      ...(data.hubungan !== undefined && { hubungan: data.hubungan }),
      ...(data.noTelp !== undefined && { noTelp: data.noTelp || null }),
      ...(data.alamat !== undefined && { alamat: data.alamat || null }),
    },
  })
  revalidatePath("/admin/santri")
  return updated
}

export async function deleteWali(id: string) {
  await requireAdmin()
  const wali = await prisma.waliSantri.findUnique({ where: { id } })
  if (!wali || wali.deletedAt) throw new Error("Wali tidak ditemukan")
  await prisma.waliSantri.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/admin/santri")
}

export async function assignWaliToSantri(santriId: string, waliId: string, isPrimary = false) {
  await requireAdmin()
  const [santri, wali] = await Promise.all([
    prisma.santri.findUnique({ where: { id: santriId } }),
    prisma.waliSantri.findUnique({ where: { id: waliId } }),
  ])
  if (!santri || santri.deletedAt) throw new Error("Santri tidak ditemukan")
  if (!wali || wali.deletedAt) throw new Error("Wali tidak ditemukan")
  const existing = await prisma.santriWali.findUnique({ where: { santriId_waliId: { santriId, waliId } } })
  if (existing) throw new Error("Wali ini sudah terhubung ke santri")
  await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.santriWali.updateMany({ where: { santriId }, data: { isPrimary: false } })
    }
    await tx.santriWali.create({ data: { santriId, waliId, isPrimary } })
  })
  revalidatePath("/admin/santri")
}

export async function unassignWaliFromSantri(santriId: string, waliId: string) {
  await requireAdmin()
  await prisma.santriWali.deleteMany({ where: { santriId, waliId } })
  revalidatePath("/admin/santri")
}
