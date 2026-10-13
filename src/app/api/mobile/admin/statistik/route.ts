import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, options } from "../_lib";

export { options };

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  try {
    const [guru, murid] = await Promise.all([
      prisma.guru.count({ where: { deletedAt: null } }),
      prisma.siswa.count({ where: { deletedAt: null } }),
    ]);
    return ok({ guru, murid });
  } catch (e) {
    console.error(e);
    return fail("Gagal");
  }
}
