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

export async function getGuruKelasWithSiswa() {
  const guru = await getCurrentGuru()
  const kelasList = await prisma.kelas.findMany({
    where: { guruId: guru.id, deletedAt: null },
    include: {
      siswas: { where: { deletedAt: null }, orderBy: { nama: "asc" } },
    },
    orderBy: { nama: "asc" },
  })
  return kelasList
}

export async function getGuruMapel() {
  const guru = await getCurrentGuru()
  return prisma.mataPelajaran.findMany({
    where: { guruId: guru.id, deletedAt: null },
    include: { kelas: { select: { nama: true } } },
    orderBy: { nama: "asc" },
  })
}

export async function getAbsensiList(kelasId: string, mataPelajaranId: string) {
  const guru = await getCurrentGuru()
  return prisma.absensi.findMany({
    where: {
      kelasId,
      mataPelajaranId,
      kelas: { guruId: guru.id },
    },
    include: {
      siswa: {
        include: { siswa: { select: { id: true, nama: true, nis: true } } },
      },
    },
    orderBy: { tanggal: "desc" },
  })
}

export async function saveAbsensi(
  kelasId: string,
  mataPelajaranId: string,
  tanggal: string,
  siswaStatus: { siswaId: string; status: string; keterangan?: string }[]
) {
  const guru = await getCurrentGuru()

  const existing = await prisma.absensi.findFirst({
    where: { kelasId, mataPelajaranId, tanggal: new Date(tanggal) },
  })

  let absensiId: string
  if (existing) {
    absensiId = existing.id
    await prisma.absensiSiswa.deleteMany({ where: { absensiId: existing.id } })
  } else {
    const absensi = await prisma.absensi.create({
      data: { kelasId, mataPelajaranId, tanggal: new Date(tanggal) },
    })
    absensiId = absensi.id
  }

  for (const ss of siswaStatus) {
    await prisma.absensiSiswa.create({
      data: {
        absensiId,
        siswaId: ss.siswaId,
        status: ss.status as any,
        keterangan: ss.keterangan || null,
      },
    })
  }

  revalidatePath("/guru/absensi")
  return { success: true }
}


