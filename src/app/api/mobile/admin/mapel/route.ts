import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, options } from "../_lib";

export { options };

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const sp = req.nextUrl.searchParams;
    const search = sp.get("search") || undefined;
    const page = Number(sp.get("page") || 1);
    const limit = Number(sp.get("limit") || 10);
    const where: Record<string, unknown> = { deletedAt: null };
    if (search) {
      where.OR = [
        { nama: { contains: search, mode: "insensitive" } },
        { kode: { contains: search, mode: "insensitive" } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.mataPelajaran.findMany({
        where: where as never,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          semester: { select: { nama: true, tahunAjaran: { select: { nama: true } } } },
          pengajaran: {
            where: { deletedAt: null },
            include: { guru: { select: { nama: true } }, kelas: { select: { nama: true } } },
          },
          _count: { select: { pengajaran: true } },
        },
      }),
      prisma.mataPelajaran.count({ where: where as never }),
    ]);
    return ok({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const { kode, nama, deskripsi, guruId, kelasIds, semesterId } = body;
    if (!kode || !nama || !guruId || !semesterId) return fail("Data wajib tidak lengkap", 400);
    const mapel = await prisma.mataPelajaran.create({
      data: {
        kode,
        nama,
        deskripsi: deskripsi || null,
        semesterId,
        pengajaran: {
          create: (kelasIds || []).map((kelasId: string) => ({ guruId, kelasId })),
        },
      },
    });
    return ok(mapel, 201);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
