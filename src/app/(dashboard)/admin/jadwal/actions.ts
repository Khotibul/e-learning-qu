"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { deteksiBentrokJadwal } from "@/lib/absensi-guru"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  if (session.user.role !== "ADMIN") throw new Error("Akses hanya untuk Admin")
}

export async function getHariList(): Promise<string[]> {
  await requireAdmin()
  return ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
}

export async function getJadwalAdmin(params: { kelasId?: string; hari?: string; search?: string }) {
  await requireAdmin()
  const where: Record<string, unknown> = { deletedAt: null }
  if (params.kelasId) where.kelasId = params.kelasId
  if (params.hari) where.hari = params.hari
  if (params.search) {
    where.OR = [
      { kelas: { nama: { contains: params.search, mode: "insensitive" } } },
      { mataPelajaran: { nama: { contains: params.search, mode: "insensitive" } } },
    ]
  }

  const [jadwal, kelas, mapel] = await Promise.all([
    prisma.jadwalPelajaran.findMany({
      where: where as never,
      include: {
        kelas: { select: { id: true, nama: true, guru: { select: { nama: true } } } },
        mataPelajaran: { select: { id: true, nama: true, kode: true } },
      },
      orderBy: [{ hari: "asc" }, { jamMulai: "asc" }],
    }),
    prisma.kelas.findMany({ where: { deletedAt: null }, select: { id: true, nama: true }, orderBy: { nama: "asc" } }),
    prisma.mataPelajaran.findMany({ where: { deletedAt: null }, select: { id: true, nama: true, kode: true }, orderBy: { nama: "asc" } }),
  ])

  // Guru pengampu tiap (kelas, mapel) untuk info pengampu
  const pengajaran = await prisma.pengajaran.findMany({
    where: { deletedAt: null },
    select: { kelasId: true, mataPelajaranId: true, guru: { select: { id: true, nama: true } } },
  })
  const pengampuMap = new Map<string, { id: string; nama: string }[]>()
  for (const p of pengajaran) {
    const key = `${p.kelasId}|${p.mataPelajaranId}`
    if (!pengampuMap.has(key)) pengampuMap.set(key, [])
    pengampuMap.get(key)!.push(p.guru)
  }

  const rows = jadwal.map((j) => ({
    ...j,
    pengampu: pengampuMap.get(`${j.kelasId}|${j.mataPelajaranId}`) ?? [],
  }))

  return { rows, kelas, mapel }
}

export async function createJadwalAdmin(data: {
  kelasId: string
  mataPelajaranId: string
  hari: string
  jamMulai: string
  jamSelesai: string
}) {
  await requireAdmin()
  if (!data.kelasId || !data.mataPelajaranId || !data.hari || !data.jamMulai || !data.jamSelesai) {
    throw new Error("Semua field wajib diisi")
  }
  const bentrok = await deteksiBentrokJadwal({ ...data })
  if (bentrok.length > 0) throw new Error(bentrok.join(" • "))

  const result = await prisma.jadwalPelajaran.create({ data })
  revalidatePath("/admin/jadwal")
  return result
}

export async function updateJadwalAdmin(
  id: string,
  data: { kelasId: string; mataPelajaranId: string; hari: string; jamMulai: string; jamSelesai: string }
) {
  await requireAdmin()
  const existing = await prisma.jadwalPelajaran.findUnique({ where: { id } })
  if (!existing) throw new Error("Jadwal tidak ditemukan")

  const bentrok = await deteksiBentrokJadwal({ ...data, excludeId: id })
  if (bentrok.length > 0) throw new Error(bentrok.join(" • "))

  const result = await prisma.jadwalPelajaran.update({ where: { id }, data })
  revalidatePath("/admin/jadwal")
  return result
}

export async function deleteJadwalAdmin(id: string) {
  await requireAdmin()
  await prisma.jadwalPelajaran.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/admin/jadwal")
  return { success: true }
}

// Cek bentrok real-time saat user memilih jam (tanpa simpan)
export async function cekBentrokJadwal(data: {
  kelasId: string
  mataPelajaranId: string
  hari: string
  jamMulai: string
  jamSelesai: string
  excludeId?: string
}): Promise<string[]> {
  await requireAdmin()
  if (!data.kelasId || !data.hari || !data.jamMulai || !data.jamSelesai) return []
  return deteksiBentrokJadwal(data)
}
