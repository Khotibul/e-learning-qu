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
    const jurusanId = sp.get("jurusanId") || undefined;
    const mapelId = sp.get("mapelId") || undefined;
    const where: Record<string, unknown> = { deletedAt: null };
    if (jurusanId) where.jurusanId = jurusanId;
    if (mapelId) where.mataPelajaranId = mapelId;
    if (search) {
      where.OR = [
        { nama: { contains: search, mode: "insensitive" } },
        { kode: { contains: search, mode: "insensitive" } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.kompetensi.findMany({
        where: where as never,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ urutan: "asc" }, { createdAt: "desc" }],
        include: {
          jurusan: { select: { nama: true } },
          mataPelajaran: { select: { nama: true } },
          _count: { select: { soals: true } },
        },
      }),
      prisma.kompetensi.count({ where: where as never }),
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
    const { kode, nama, deskripsi, jurusanId, mataPelajaranId, tingkat, urutan } = body;
    if (!kode || !nama || !jurusanId) return fail("Data wajib tidak lengkap", 400);
    const kompetensi = await prisma.kompetensi.create({
      data: {
        kode,
        nama,
        deskripsi: deskripsi || null,
        jurusanId,
        mataPelajaranId: mataPelajaranId || null,
        tingkat: tingkat ?? 1,
        urutan: urutan ?? 0,
      },
    });
    return ok(kompetensi, 201);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
