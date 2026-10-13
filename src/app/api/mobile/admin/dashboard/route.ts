import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, options } from "../_lib";

export { options };

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const [totalGuru, totalSiswa, totalSoal, totalUjian, totalKelas, totalMapel, totalNilai] =
      await Promise.all([
        prisma.guru.count({ where: { deletedAt: null } }),
        prisma.siswa.count({ where: { deletedAt: null } }),
        prisma.soal.count({ where: { deletedAt: null } }),
        prisma.ujian.count({ where: { deletedAt: null } }),
        prisma.kelas.count({ where: { deletedAt: null } }),
        prisma.mataPelajaran.count({ where: { deletedAt: null } }),
        prisma.nilai.count({ where: { deletedAt: null } }),
      ]);
    return ok({ totalGuru, totalSiswa, totalSoal, totalUjian, totalKelas, totalMapel, totalNilai });
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
