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
    if (search) where.OR = [{ nama: { contains: search, mode: "insensitive" } }];
    const [data, total] = await Promise.all([
      prisma.kelas.findMany({
        where: where as never,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { guru: { select: { nama: true } }, _count: { select: { siswas: true } } },
      }),
      prisma.kelas.count({ where: where as never }),
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
    const { nama, tingkat, guruId } = body;
    if (!nama || tingkat == null) return fail("Nama dan tingkat wajib", 400);
    const kelas = await prisma.kelas.create({ data: { nama, tingkat, guruId: guruId || null } });
    return ok(kelas, 201);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
