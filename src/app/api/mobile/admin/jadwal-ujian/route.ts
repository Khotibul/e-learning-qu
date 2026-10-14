import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../_lib"

export { options }

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const rows = await prisma.ujian.findMany({
      where: { deletedAt: null },
      orderBy: { tanggal: "desc" },
      select: {
        id: true,
        nama: true,
        tanggal: true,
        durasi: true,
        status: true,
        mataPelajaran: { select: { nama: true } },
        kelas: { select: { nama: true } },
        guru: { select: { nama: true } },
      },
    })
    const stats = {
      total: rows.length,
      aktif: rows.filter((r) => r.status === "AKTIF").length,
      selesai: rows.filter((r) => r.status === "SELESAI").length,
      draft: rows.filter((r) => r.status === "DRAFT").length,
    }
    return ok({
      rows: rows.map((r) => ({
        id: r.id,
        nama: r.nama,
        tanggal: r.tanggal,
        durasi: r.durasi,
        status: r.status,
        mapel: r.mataPelajaran?.nama ?? null,
        kelas: r.kelas?.nama ?? null,
        guru: r.guru?.nama ?? null,
      })),
      stats,
    })
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
