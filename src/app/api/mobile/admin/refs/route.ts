import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, options } from "../_lib";

export { options };

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const [guru, kelas, semester, tahunAjaran, mapel, jurusan] = await Promise.all([
      prisma.guru.findMany({ where: { deletedAt: null }, select: { id: true, nama: true }, orderBy: { nama: "asc" } }),
      prisma.kelas.findMany({ where: { deletedAt: null }, select: { id: true, nama: true, tingkat: true }, orderBy: [{ tingkat: "asc" }, { nama: "asc" }] }),
      prisma.semester.findMany({ where: { deletedAt: null }, select: { id: true, nama: true, tahunAjaran: { select: { nama: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.tahunAjaran.findMany({ where: { deletedAt: null }, select: { id: true, nama: true }, orderBy: { createdAt: "desc" } }),
      prisma.mataPelajaran.findMany({ where: { deletedAt: null }, select: { id: true, nama: true, kode: true }, orderBy: { nama: "asc" } }),
      prisma.jurusan.findMany({ where: { deletedAt: null }, select: { id: true, nama: true, kode: true }, orderBy: { nama: "asc" } }),
    ]);
    return ok({ guru, kelas, semester, tahunAjaran, mapel, jurusan });
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
