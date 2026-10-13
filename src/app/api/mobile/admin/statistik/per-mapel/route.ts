import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, options } from "../../_lib";

export { options };

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const mapels = await prisma.mataPelajaran.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { soals: true, nilai: true } } },
      orderBy: { nama: "asc" },
    });
    return ok(mapels.map((m) => ({ label: m.nama, nilai: m._count.nilai, soalCount: m._count.soals })));
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
