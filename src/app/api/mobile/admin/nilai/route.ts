import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, options } from "../_lib";

export { options };

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const sp = req.nextUrl.searchParams;
    const kelasId = sp.get("kelasId") || undefined;
    const mapelId = sp.get("mapelId") || undefined;
    const semesterId = sp.get("semesterId") || undefined;
    const page = Number(sp.get("page") || 1);
    const limit = Number(sp.get("limit") || 20);
    const where: Record<string, unknown> = { deletedAt: null };
    if (kelasId) where.kelasId = kelasId;
    if (mapelId) where.mataPelajaranId = mapelId;
    if (semesterId) where.semesterId = semesterId;
    if (kelasId && !mapelId) where.siswa = { kelasId };
    const [data, total] = await Promise.all([
      prisma.nilai.findMany({
        where: where as never,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          siswa: { select: { nama: true, nis: true, kelas: { select: { nama: true } } } },
          mataPelajaran: { select: { nama: true, kode: true } },
          semester: { select: { nama: true } },
        },
      }),
      prisma.nilai.count({ where: where as never }),
    ]);
    return ok({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
