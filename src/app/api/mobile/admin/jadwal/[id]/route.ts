import { prisma } from "@/lib/prisma"
import { deteksiBentrokJadwal } from "@/lib/absensi-guru"
import { requireAdmin, ok, fail, options } from "../../_lib"

export { options }

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { id } = await ctx.params
    await prisma.jadwalPelajaran.update({ where: { id }, data: { deletedAt: new Date() } })
    return ok({ success: true })
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const { kelasId, mataPelajaranId, hari, jamMulai, jamSelesai } = body
    if (!kelasId || !mataPelajaranId || !hari || !jamMulai || !jamSelesai) return fail("Semua field wajib diisi", 400)
    const masalah = await deteksiBentrokJadwal({ kelasId, hari, jamMulai, jamSelesai, mataPelajaranId, excludeId: id })
    if (masalah.length > 0) return fail(masalah.join(" • "), 400)
    const row = await prisma.jadwalPelajaran.update({
      where: { id },
      data: { kelasId, mataPelajaranId, hari, jamMulai, jamSelesai },
      select: { id: true },
    })
    return ok(row)
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
