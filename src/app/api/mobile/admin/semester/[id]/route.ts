import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, options } from "../../_lib";

export { options };

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { op } = body;
    if (op === "delete") {
      await prisma.semester.update({ where: { id }, data: { deletedAt: new Date() } });
      return ok({ success: true });
    }
    if (op === "setActive") {
      await prisma.semester.updateMany({ where: { isAktif: true }, data: { isAktif: false } });
      await prisma.semester.update({ where: { id }, data: { isAktif: true } });
      return ok({ success: true });
    }
    const { nama, tahunAjaranId, isAktif } = body;
    if (isAktif) {
      await prisma.semester.updateMany({ where: { isAktif: true, id: { not: id } }, data: { isAktif: false } });
    }
    const semester = await prisma.semester.update({ where: { id }, data: { nama, tahunAjaranId, isAktif } });
    return ok(semester);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
