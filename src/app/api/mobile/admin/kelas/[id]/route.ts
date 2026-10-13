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
      await prisma.kelas.update({ where: { id }, data: { deletedAt: new Date() } });
      return ok({ success: true });
    }
    const { nama, tingkat, guruId } = body;
    const kelas = await prisma.kelas.update({
      where: { id },
      data: { nama, tingkat, guruId: guruId || undefined },
    });
    return ok(kelas);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
