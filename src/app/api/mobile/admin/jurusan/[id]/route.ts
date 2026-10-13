import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, options } from "../../_lib";

export { options };

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await ctx.params;
    const siswa = await prisma.siswa.findMany({
      where: { jurusanId: id, deletedAt: null },
      select: { id: true, nama: true, nis: true },
      orderBy: { nama: "asc" },
    });
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
      await prisma.jurusan.update({ where: { id }, data: { deletedAt: new Date() } });
      return ok({ success: true });
    }
    if (op === "assignSiswa") {
      const { siswaIds } = body;
      await prisma.$transaction(async (tx) => {
        await tx.siswa.updateMany({ where: { jurusanId: id }, data: { jurusanId: null } });
        if (siswaIds && siswaIds.length > 0) {
          await tx.siswa.updateMany({ where: { id: { in: siswaIds } }, data: { jurusanId: id } });
        }
      });
      return ok({ success: true });
    }
    const { kode, nama, deskripsi } = body;
    const jurusan = await prisma.jurusan.update({ where: { id }, data: { kode, nama, deskripsi } });
    return ok(jurusan);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
