import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, options } from "../../_lib";

export { options };

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const kelas = await prisma.kelas.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { siswas: true } } },
      orderBy: { tingkat: "asc" },
    });
    return ok(kelas.map((k) => ({ label: k.nama, nilai: k._count.siswas, tingkat: k.tingkat })));
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
