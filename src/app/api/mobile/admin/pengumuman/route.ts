import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, options } from "../_lib";

export { options };

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const sp = req.nextUrl.searchParams;
    const page = Number(sp.get("page") || 1);
    const limit = Number(sp.get("limit") || 10);
    const where = { deletedAt: null };
    const [data, total] = await Promise.all([
      prisma.pengumuman.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } }, kelas: { select: { nama: true } } },
      }),
      prisma.pengumuman.count({ where }),
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
    const { judul, isi, gambar, lampiran, tipe, userId, kelasId } = body;
    if (!judul || !isi) return fail("Judul dan isi wajib", 400);
    const pengumuman = await prisma.pengumuman.create({
      data: {
        judul,
        isi,
        gambar: gambar || null,
        lampiran: lampiran || null,
        tipe: tipe || "UMUM",
        userId: userId || auth.user.id,
        kelasId: kelasId || null,
      },
    });
    return ok(pengumuman, 201);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
