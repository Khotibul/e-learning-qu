import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../../_lib"

export { options }

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { id } = await ctx.params
    const g = await prisma.gelombangPpdb.findUnique({
      where: { id },
      include: {
        tahunAjaran: { select: { id: true, nama: true } },
        jalur: { orderBy: { nama: "asc" } },
      },
    })
    if (!g || g.deletedAt) return fail("Tidak ditemukan", 404)
    return ok(g)
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
    const { op } = body

    if (op === "updateJalur") {
      const jalur = await prisma.jalurPpdb.findUnique({ where: { id: body.jalurId } })
      if (!jalur) return fail("Jalur tidak ditemukan", 404)
      const row = await prisma.jalurPpdb.update({
        where: { id: body.jalurId },
        data: {
          ...(body.nama !== undefined && { nama: body.nama }),
          ...(body.deskripsi !== undefined && { deskripsi: body.deskripsi || null }),
          ...(body.kuota !== undefined && { kuota: body.kuota ?? null }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: { id: true, nama: true },
      })
      return ok(row)
    }

    const g = await prisma.gelombangPpdb.findFirst({ where: { id, deletedAt: null } })
    if (!g) return fail("Gelombang tidak ditemukan", 404)

    const data: Record<string, unknown> = {}
    if (body.nama !== undefined) data.nama = body.nama
    if (body.unit !== undefined) data.unit = body.unit || null
    if (body.jenjang !== undefined) data.jenjang = body.jenjang || null
    if (body.program !== undefined) data.program = body.program || null
    if (body.tanggalBuka !== undefined) data.tanggalBuka = new Date(body.tanggalBuka)
    if (body.tanggalTutup !== undefined) data.tanggalTutup = new Date(body.tanggalTutup)
    if (body.kuota !== undefined) data.kuota = body.kuota ?? null
    if (body.biayaDaftar !== undefined) data.biayaDaftar = body.biayaDaftar ?? null
    if (body.jadwalSeleksi !== undefined) data.jadwalSeleksi = body.jadwalSeleksi ? new Date(body.jadwalSeleksi) : null
    if (body.jadwalPengumuman !== undefined) data.jadwalPengumuman = body.jadwalPengumuman ? new Date(body.jadwalPengumuman) : null
    if (body.jadwalDaftarUlang !== undefined) data.jadwalDaftarUlang = body.jadwalDaftarUlang ? new Date(body.jadwalDaftarUlang) : null
    if (body.deskripsi !== undefined) data.deskripsi = body.deskripsi || null

    const row = await prisma.gelombangPpdb.update({ where: { id }, data, select: { id: true, nama: true } })
    return ok(row)
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
