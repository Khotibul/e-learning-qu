import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../../_lib"

export { options }

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const wali = await prisma.waliSantri.findUnique({ where: { id } })
    if (!wali || wali.deletedAt) return fail("Wali tidak ditemukan", 404)
    const row = await prisma.waliSantri.update({
      where: { id },
      data: {
        ...(body.nama !== undefined && { nama: body.nama }),
        ...(body.hubungan !== undefined && { hubungan: body.hubungan }),
        ...(body.noTelp !== undefined && { noTelp: body.noTelp || null }),
        ...(body.alamat !== undefined && { alamat: body.alamat || null }),
      },
      select: { id: true, nama: true, hubungan: true, noTelp: true, alamat: true },
    })
    return ok(row)
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
