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
      await prisma.mataPelajaran.update({ where: { id }, data: { deletedAt: new Date() } });
      return ok({ success: true });
    }
    if (op === "addPengajaran") {
      const { guruId, kelasId } = body;
      await prisma.pengajaran.upsert({
        where: { mataPelajaranId_guruId_kelasId: { mataPelajaranId: id, guruId, kelasId } },
        update: { deletedAt: null },
        create: { mataPelajaranId: id, guruId, kelasId },
      });
      return ok({ success: true });
    }
    if (op === "removePengajaran") {
      const { pengajaranId } = body;
      await prisma.pengajaran.update({ where: { id: pengajaranId }, data: { deletedAt: new Date() } });
      return ok({ success: true });
    }
    const { kode, nama, deskripsi, semesterId } = body;
    const mapel = await prisma.mataPelajaran.update({
      where: { id },
      data: { kode, nama, deskripsi, semesterId },
    });
    return ok(mapel);
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
