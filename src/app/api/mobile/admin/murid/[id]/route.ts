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
    const siswa = await prisma.siswa.findUnique({ where: { id }, include: { user: true } });
    if (!siswa) return fail("Tidak ditemukan", 404);
    return ok(siswa);
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
      await prisma.siswa.update({ where: { id }, data: { deletedAt: new Date() } });
      return ok({ success: true });
    }
    if (op === "restore") {
      await prisma.siswa.update({ where: { id }, data: { deletedAt: null } });
      return ok({ success: true });
    }
    if (op === "resetPassword") {
      const siswa = await prisma.siswa.findUnique({ where: { id }, include: { user: true } });
      if (!siswa) return fail("Siswa tidak ditemukan", 404);
      const hashedPassword = await bcrypt.hash("siswa123", 12);
      await prisma.user.update({ where: { id: siswa.userId }, data: { password: hashedPassword } });
      return ok(siswa.nama);
    }
    const { nama, nis, nisn, alamat, noTelp, kelasId, jabatan } = body;
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.siswa.update({
        where: { id },
        data: { nama, nis, nisn, alamat, noTelp, kelasId, jabatan },
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
