import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
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
    const includeDeleted = sp.get("includeDeleted") === "true";
    const where: Record<string, unknown> = {};
    if (!includeDeleted) where.deletedAt = null;
    if (search) {
      where.OR = [
        { nama: { contains: search, mode: "insensitive" } },
        { nip: { contains: search, mode: "insensitive" } },
        { nuptk: { contains: search, mode: "insensitive" } },
        { noTelp: { contains: search, mode: "insensitive" } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.guru.findMany({
        where: where as never,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true, isActive: true } } },
      }),
      prisma.guru.count({ where: where as never }),
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
    const { nama, jabatan, nip, nuptk, alamat, noTelp, email, password } = body;
    if (!nama || !email) return fail("Nama dan email wajib", 400);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("Email sudah terdaftar", 400);
    const hashedPassword = password ? await bcrypt.hash(password, 12) : null;
    const guru = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: nama, role: "GURU", password: hashedPassword },
      });
      return tx.guru.create({
        data: {
          nama,
          jabatan: jabatan || null,
          nip: nip || null,
          nuptk: nuptk || null,
          alamat: alamat || null,
          noTelp: noTelp || null,
          userId: user.id,
        },
        include: { user: true },
      });
    });
    return ok(guru, 201);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
