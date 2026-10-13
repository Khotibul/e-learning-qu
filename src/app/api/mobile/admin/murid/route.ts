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
    const kelasId = sp.get("kelasId") || undefined;
    const where: Record<string, unknown> = {};
    if (!includeDeleted) where.deletedAt = null;
    if (kelasId) where.kelasId = kelasId;
    if (search) {
      where.OR = [
        { nama: { contains: search, mode: "insensitive" } },
        { nis: { contains: search, mode: "insensitive" } },
        { nisn: { contains: search, mode: "insensitive" } },
        { noTelp: { contains: search, mode: "insensitive" } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.siswa.findMany({
        where: where as never,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { email: true, isActive: true } },
          kelas: { select: { nama: true } },
        },
      }),
      prisma.siswa.count({ where: where as never }),
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
    const { nama, nis, nisn, alamat, noTelp, kelasId, jabatan, email, password } = body;
    if (!nama || !email) return fail("Nama dan email wajib", 400);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("Email sudah terdaftar", 400);
    const hashedPassword = password ? await bcrypt.hash(password, 12) : null;
    const siswa = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: nama, role: "SISWA", password: hashedPassword },
      });
      return tx.siswa.create({
        data: {
          nama,
          nis: nis || null,
          nisn: nisn || null,
          alamat: alamat || null,
          noTelp: noTelp || null,
          kelasId: kelasId || null,
          jabatan: jabatan || null,
          userId: user.id,
        },
        include: { user: true },
      });
    });
    return ok(siswa, 201);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
