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
      await prisma.kompetensi.update({ where: { id }, data: { deletedAt: new Date() } });
      return ok({ success: true });
    }
    const { kode, nama, deskripsi, jurusanId, mataPelajaranId, tingkat, urutan } = body;
    const kompetensi = await prisma.kompetensi.update({
      where: { id },
      data: { kode, nama, deskripsi, jurusanId, mataPelajaranId, tingkat, urutan },
    });
    return ok(kompetensi);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
