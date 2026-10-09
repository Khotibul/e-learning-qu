"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { StatusGelombang } from "@prisma/client"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role !== "ADMIN") throw new Error("Forbidden")
  return session.user.id
}

export async function getTahunAjaranOpts() {
  await requireAdmin()
  return prisma.tahunAjaran.findMany({
    where: { deletedAt: null },
    select: { id: true, nama: true },
    orderBy: { tahunMulai: "desc" },
    take: 20,
  })
}

// urutan transisi status gelombang yang sah
const URUTAN_STATUS: StatusGelombang[] = ["DRAFT", "DIJADWALKAN", "DIBUKA", "DITUTUP", "SELEKSI", "PENGUMUMAN", "DAFTAR_ULANG", "SELESAI"]

function bolehTransisi(dari: StatusGelombang, ke: StatusGelombang) {
  if (dari === ke) return false
  const iDari = URUTAN_STATUS.indexOf(dari)
  const iKe = URUTAN_STATUS.indexOf(ke)
  // maju mundur satu langkah atau ke DRAFT (reset) dari status awal saja
  if (Math.abs(iKe - iDari) === 1) return true
  if (ke === "DRAFT" && dari === "DIJADWALKAN") return true
  return false
}

export async function getGelombangs(params: { search?: string; page?: number; limit?: number; status?: string; tahunAjaranId?: string }) {
  await requireAdmin()
  const { search, page = 1, limit = 10, status, tahunAjaranId } = params
  const where: Record<string, unknown> = { deletedAt: null }
  if (status) where.status = status
  if (tahunAjaranId) where.tahunAjaranId = tahunAjaranId
  if (search) {
    where.OR = [
      { nama: { contains: search, mode: "insensitive" } },
      { unit: { contains: search, mode: "insensitive" } },
      { jenjang: { contains: search, mode: "insensitive" } },
      { program: { contains: search, mode: "insensitive" } },
      { tahunAjaran: { nama: { contains: search, mode: "insensitive" } } },
    ]
  }
  const [data, total] = await Promise.all([
    prisma.gelombangPpdb.findMany({
      where: where as any,
      include: { tahunAjaran: { select: { id: true, nama: true } }, jalur: { orderBy: { nama: "asc" } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.gelombangPpdb.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getGelombangById(id: string) {
  await requireAdmin()
  return prisma.gelombangPpdb.findUnique({
    where: { id },
    include: { tahunAjaran: { select: { id: true, nama: true } }, jalur: { orderBy: { nama: "asc" } } },
  })
}

export async function createGelombang(data: {
  tahunAjaranId: string
  nama: string
  unit?: string
  jenjang?: string
  program?: string
  tanggalBuka: string
  tanggalTutup: string
  kuota?: number | null
  biayaDaftar?: number | null
  jadwalSeleksi?: string | null
  jadwalPengumuman?: string | null
  jadwalDaftarUlang?: string | null
  deskripsi?: string
}) {
  await requireAdmin()
  if (!data.nama || !data.tahunAjaranId) throw new Error("Nama gelombang dan tahun ajaran wajib diisi")
  if (!data.tanggalBuka || !data.tanggalTutup) throw new Error("Tanggal buka dan tutup wajib diisi")
  const buka = new Date(data.tanggalBuka)
  const tutup = new Date(data.tanggalTutup)
  if (tutup <= buka) throw new Error("Tanggal tutup harus setelah tanggal buka")
  const ta = await prisma.tahunAjaran.findFirst({ where: { id: data.tahunAjaranId, deletedAt: null } })
  if (!ta) throw new Error("Tahun ajaran tidak ditemukan")
  const gelombang = await prisma.gelombangPpdb.create({
    data: {
      tahunAjaranId: data.tahunAjaranId,
      nama: data.nama,
      unit: data.unit || null,
      jenjang: data.jenjang || null,
      program: data.program || null,
      tanggalBuka: buka,
      tanggalTutup: tutup,
      kuota: data.kuota ?? null,
      biayaDaftar: data.biayaDaftar ?? null,
      jadwalSeleksi: data.jadwalSeleksi ? new Date(data.jadwalSeleksi) : null,
      jadwalPengumuman: data.jadwalPengumuman ? new Date(data.jadwalPengumuman) : null,
      jadwalDaftarUlang: data.jadwalDaftarUlang ? new Date(data.jadwalDaftarUlang) : null,
      deskripsi: data.deskripsi || null,
    },
  })
  revalidatePath("/admin/ppdb")
  return gelombang
}

export async function updateGelombang(
  id: string,
  data: {
    nama?: string
    unit?: string | null
    jenjang?: string | null
    program?: string | null
    tanggalBuka?: string
    tanggalTutup?: string
    kuota?: number | null
    biayaDaftar?: number | null
    jadwalSeleksi?: string | null
    jadwalPengumuman?: string | null
    jadwalDaftarUlang?: string | null
    deskripsi?: string | null
    persyaratanDokumen?: unknown
    templateSurat?: string | null
  }
) {
  await requireAdmin()
  const gelombang = await prisma.gelombangPpdb.findUnique({ where: { id } })
  if (!gelombang || gelombang.deletedAt) throw new Error("Gelombang tidak ditemukan")
  const buka = data.tanggalBuka ? new Date(data.tanggalBuka) : gelombang.tanggalBuka
  const tutup = data.tanggalTutup ? new Date(data.tanggalTutup) : gelombang.tanggalTutup
  if (tutup <= buka) throw new Error("Tanggal tutup harus setelah tanggal buka")
  const updated = await prisma.gelombangPpdb.update({
    where: { id },
    data: {
      ...(data.nama !== undefined && { nama: data.nama }),
      ...(data.unit !== undefined && { unit: data.unit || null }),
      ...(data.jenjang !== undefined && { jenjang: data.jenjang || null }),
      ...(data.program !== undefined && { program: data.program || null }),
      ...(data.tanggalBuka !== undefined && { tanggalBuka: buka }),
      ...(data.tanggalTutup !== undefined && { tanggalTutup: tutup }),
      ...(data.kuota !== undefined && { kuota: data.kuota }),
      ...(data.biayaDaftar !== undefined && { biayaDaftar: data.biayaDaftar }),
      ...(data.jadwalSeleksi !== undefined && { jadwalSeleksi: data.jadwalSeleksi ? new Date(data.jadwalSeleksi) : null }),
      ...(data.jadwalPengumuman !== undefined && { jadwalPengumuman: data.jadwalPengumuman ? new Date(data.jadwalPengumuman) : null }),
      ...(data.jadwalDaftarUlang !== undefined && { jadwalDaftarUlang: data.jadwalDaftarUlang ? new Date(data.jadwalDaftarUlang) : null }),
      ...(data.deskripsi !== undefined && { deskripsi: data.deskripsi || null }),
      ...(data.persyaratanDokumen !== undefined && { persyaratanDokumen: data.persyaratanDokumen as any }),
      ...(data.templateSurat !== undefined && { templateSurat: data.templateSurat || null }),
    },
  })
  revalidatePath("/admin/ppdb")
  return updated
}

/** Transisi status gelombang — hanya satu langkah maju/mundur (atau reset ke DRAFT). */
export async function updateStatusGelombang(id: string, status: StatusGelombang) {
  await requireAdmin()
  const gelombang = await prisma.gelombangPpdb.findUnique({ where: { id } })
  if (!gelombang || gelombang.deletedAt) throw new Error("Gelombang tidak ditemukan")
  if (!bolehTransisi(gelombang.status, status)) {
    throw new Error(`Transisi status ${gelombang.status} → ${status} tidak diizinkan`)
  }
  if (status === "DIBUKA" && gelombang.tanggalTutup < new Date()) {
    throw new Error("Tanggal tutup sudah lewat — perbarui jadwal terlebih dahulu")
  }
  const updated = await prisma.gelombangPpdb.update({ where: { id }, data: { status } })
  revalidatePath("/admin/ppdb")
  return updated
}

/** Soft-delete — pendaftaran lama (saat sudah ada) tidak ikut terhapus. */
export async function deleteGelombang(id: string) {
  await requireAdmin()
  const gelombang = await prisma.gelombangPpdb.findUnique({ where: { id } })
  if (!gelombang || gelombang.deletedAt) throw new Error("Gelombang tidak ditemukan")
  if (gelombang.status !== "DRAFT" && gelombang.status !== "DIJADWALKAN") {
    throw new Error("Hanya gelombang DRAFT/DIJADWALKAN yang boleh dihapus")
  }
  await prisma.gelombangPpdb.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/admin/ppdb")
}

// ─── JALUR PENDAFTARAN ─────────────────────────────────────────────────

export async function createJalur(gelombangId: string, data: { nama: string; deskripsi?: string; kuota?: number | null }) {
  await requireAdmin()
  if (!data.nama) throw new Error("Nama jalur wajib diisi")
  const gelombang = await prisma.gelombangPpdb.findUnique({ where: { id: gelombangId } })
  if (!gelombang || gelombang.deletedAt) throw new Error("Gelombang tidak ditemukan")
  const dup = await prisma.jalurPpdb.findFirst({ where: { gelombangId, nama: data.nama } })
  if (dup) throw new Error("Jalur dengan nama tersebut sudah ada di gelombang ini")
  const jalur = await prisma.jalurPpdb.create({
    data: { gelombangId, nama: data.nama, deskripsi: data.deskripsi || null, kuota: data.kuota ?? null },
  })
  revalidatePath("/admin/ppdb")
  return jalur
}

export async function updateJalur(id: string, data: { nama?: string; deskripsi?: string | null; kuota?: number | null; isActive?: boolean }) {
  await requireAdmin()
  const jalur = await prisma.jalurPpdb.findUnique({ where: { id } })
  if (!jalur) throw new Error("Jalur tidak ditemukan")
  const updated = await prisma.jalurPpdb.update({
    where: { id },
    data: {
      ...(data.nama !== undefined && { nama: data.nama }),
      ...(data.deskripsi !== undefined && { deskripsi: data.deskripsi || null }),
      ...(data.kuota !== undefined && { kuota: data.kuota }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  })
  revalidatePath("/admin/ppdb")
  return updated
}

export async function deleteJalur(id: string) {
  await requireAdmin()
  const jalur = await prisma.jalurPpdb.findUnique({ where: { id } })
  if (!jalur) throw new Error("Jalur tidak ditemukan")
  await prisma.jalurPpdb.delete({ where: { id } })
  revalidatePath("/admin/ppdb")
}
