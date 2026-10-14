import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../../../_lib"

export { options }

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { id } = await ctx.params
    const url = new URL(req.url)
    const jenis = url.searchParams.get("jenis") || undefined
    const rows = await prisma.santriStatusLog.findMany({
      where: { santriId: id, ...(jenis ? { jenis: jenis as never } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, jenis: true, dari: true, ke: true, alasan: true, verifiedBy: true, createdAt: true },
    })
    return ok({ rows })
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
