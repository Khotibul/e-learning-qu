import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdmin, ok, fail, options } from "../../_lib";

export { options };

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await ctx.params;
    const guru = await prisma.guru.findUnique({ where: { id }, include: { user: true } });
    if (!guru) return fail("Tidak ditemukan", 404);
    return ok(guru);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { op } = body;
    if (op === "delete") {
      await prisma.guru.update({ where: { id }, data: { deletedAt: new Date() } });
      return ok({ success: true });
    }
    if (op === "restore") {
      await prisma.guru.update({ where: { id }, data: { deletedAt: null } });
      return ok({ success: true });
    }
    if (op === "resetPassword") {
      const guru = await prisma.guru.findUnique({ where: { id }, select: { userId: true } });
      if (!guru) return fail("Guru tidak ditemukan", 404);
      const hashed = await bcrypt.hash("guru123!", 12);
      await prisma.user.update({ where: { id: guru.userId }, data: { password: hashed } });
      return ok({ success: true });
    }
    // default update
    const { nama, jabatan, nip, nuptk, alamat, noTelp } = body;
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.guru.update({
        where: { id },
        data: {
          nama,
          jabatan: jabatan || null,
          nip,
          nuptk,
          alamat,
          noTelp,
        },
        include: { user: true },
      });
      if (nama) {
        await tx.user.update({ where: { id: u.userId }, data: { name: nama } });
      }
      return u;
    });
    return ok(updated);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
