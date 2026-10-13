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
    const tahunAjaranId = sp.get("tahunAjaranId") || undefined;
    const where: Record<string, unknown> = { deletedAt: null };
    if (tahunAjaranId) where.tahunAjaranId = tahunAjaranId;
    if (search) where.nama = { contains: search, mode: "insensitive" };
    const [data, total] = await Promise.all([
      prisma.semester.findMany({
        where: where as never,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { tahunAjaran: { select: { nama: true } } },
      }),
      prisma.semester.count({ where: where as never }),
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
    const { nama, tahunAjaranId, isAktif } = body;
    if (!nama || !tahunAjaranId) return fail("Data wajib tidak lengkap", 400);
    if (isAktif) {
      await prisma.semester.updateMany({ where: { isAktif: true }, data: { isAktif: false } });
    }
    const semester = await prisma.semester.create({ data: { nama, tahunAjaranId, isAktif: isAktif ?? false } });
    return ok(semester, 201);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
