"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { JenisPendaftaran } from "@prisma/client"

/**
 * Aksi pendaftaran PPDB (calon pendaftar).
 * Route publik /ppdb/* tidak kena proxy matcher — setiap aksi wajib cek sesi sendiri.
 */
async function requirePendaftar() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isActive: true } })
  if (!user?.isActive) throw new Error("Akun tidak aktif")
  // pendaftar = akun SISWA (role default) — ADMIN/GURU tidak mendaftar via PPDB
  if (user.role === "ADMIN" || user.role === "GURU") throw new Error("Akun ini tidak dapat mendaftar PPDB")
  return session.user.id
}

/** Gelombang yang sedang DIBUKA untuk publik (landing + form). */
export async function getGelombangPublik() {
  return prisma.gelombangPpdb.findMany({
    where: { deletedAt: null, status: { in: ["DIBUKA", "DITUTUP", "SELEKSI", "PENGUMUMAN", "DAFTAR_ULANG", "SELESAI"] } },
    include: {
      tahunAjaran: { select: { nama: true } },
      jalur: { where: { isActive: true }, orderBy: { nama: "asc" } },
    },
    orderBy: { tanggalBuka: "desc" },
    take: 20,
  })
}

/**
 * Buat pendaftaran (draft) untuk sebuah gelombang.
 * - Satu orang max 1 pendaftaran per gelombang (unique [userId, gelombangId]).
 * - Jenis: SISWA_REGULER / SISWA_SANTRI / SANTRI_PONDOK.
 * - Pilihan program/jalur berurutan (1 = utama).
 */
export async function createPendaftaran(
  gelombangId: string,
  jenis: JenisPendaftaran,
  jalurIds: string[] = []
) {
  const userId = await requirePendaftar()

  const gelombang = await prisma.gelombangPpdb.findFirst({
    where: { id: gelombangId, deletedAt: null },
    include: { jalur: { where: { isActive: true } } },
  })
  if (!gelombang) throw new Error("Gelombang pendaftaran tidak ditemukan")
  if (gelombang.status !== "DIBUKA") throw new Error("Pendaftaran pada gelombang ini sedang tidak dibuka")
  if (new Date() > gelombang.tanggalTutup) throw new Error("Pendaftaran sudah ditutup")

  const existing = await prisma.pendaftaranPpdb.findUnique({
    where: { userId_gelombangId: { userId, gelombangId } },
  })
  if (existing) throw new Error("Anda sudah terdaftar pada gelombang ini")

  // validasi jalur: harus aktif & milik gelombang ini; tanpa duplikat
  const jalurValid = new Set(gelombang.jalur.map((j) => j.id))
  if (jalurIds.length > 0) {
    for (const jid of jalurIds) {
      if (!jalurValid.has(jid)) throw new Error("Jalur tidak valid untuk gelombang ini")
    }
    if (new Set(jalurIds).size !== jalurIds.length) throw new Error("Pilihan jalur tidak boleh duplikat")
  }

  const pendaftaran = await prisma.$transaction(async (tx) => {
    const p = await tx.pendaftaranPpdb.create({
      data: {
        userId,
        gelombangId,
        jenis,
        jalurId: jalurIds[0] || gelombang.jalur[0]?.id || null,
        status: "DRAFT",
      },
    })
    await tx.pilihanPpdb.createMany({
      data: jalurIds.map((jid, i) => ({ pendaftaranId: p.id, jalurId: jid, urutan: i + 1 })),
    })
    return p
  })
  revalidatePath("/ppdb")
  return pendaftaran
}

/** Daftar pendaftaran milik pendaftar yang login. */
export async function getMyPendaftaran() {
  const userId = await requirePendaftar()
  return prisma.pendaftaranPpdb.findMany({
    where: { userId, deletedAt: null },
    include: {
      gelombang: { select: { id: true, nama: true, status: true, unit: true, jenjang: true, program: true } },
      jalur: { select: { nama: true } },
      pilihan: { orderBy: { urutan: "asc" }, include: { jalur: { select: { nama: true } } } },
      keputusan: true,
    },
    orderBy: { createdAt: "desc" },
  })
}
