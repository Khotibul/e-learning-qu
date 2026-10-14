import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../_lib"

export { options }

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get("q")?.trim()
    const rows = await prisma.waliSantri.findMany({
      where: {
        deletedAt: null,
        ...(q ? { OR: [{ nama: { contains: q, mode: "insensitive" as const } }, { noTelp: { contains: q, mode: "insensitive" as const } }] } : {}),
      },
      orderBy: { nama: "asc" },
      take: 100,
      select: { id: true, nama: true, hubungan: true, noTelp: true, alamat: true, _count: { select: { anak: true } } },
    })
    return ok({ rows: rows.map((r) => ({ ...r, jumlahAnak: r._count.anak, _count: undefined })) })
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const body = await req.json()
    const { op } = body

    if (op === "create") {
      if (!body.nama) return fail("Nama wali wajib diisi", 400)
      const row = await prisma.waliSantri.create({
        data: { nama: body.nama, hubungan: body.hubungan, noTelp: body.noTelp || null, alamat: body.alamat || null },
        select: { id: true, nama: true, hubungan: true, noTelp: true, alamat: true },
      })
      return ok(row, 201)
    }

    if (op === "delete") {
      if (!body.id) return fail("id wajib", 400)
      await prisma.waliSantri.update({ where: { id: body.id }, data: { deletedAt: new Date() } })
      return ok({ success: true })
    }

    if (op === "assignToSantri") {
      const { santriId, waliId } = body
      if (!santriId || !waliId) return fail("santriId dan waliId wajib", 400)
      const [santri, wali] = await Promise.all([
        prisma.santri.findUnique({ where: { id: santriId } }),
        prisma.waliSantri.findUnique({ where: { id: waliId } }),
      ])
      if (!santri || santri.deletedAt) return fail("Santri tidak ditemukan", 404)
      if (!wali || wali.deletedAt) return fail("Wali tidak ditemukan", 404)
      const existing = await prisma.santriWali.findUnique({ where: { santriId_waliId: { santriId, waliId } } })
      if (existing) return fail("Wali sudah terhubung ke santri ini", 400)
      const isPrimary = body.isPrimary === true
      if (isPrimary) {
        await prisma.santriWali.updateMany({ where: { santriId, isPrimary: true }, data: { isPrimary: false } })
      }
      const row = await prisma.santriWali.create({ data: { santriId, waliId, isPrimary } })
      return ok(row, 201)
    }

    if (op === "unassignFromSantri") {
      const { santriId, waliId } = body
      if (!santriId || !waliId) return fail("santriId dan waliId wajib", 400)
      await prisma.santriWali.delete({ where: { santriId_waliId: { santriId, waliId } } })
      return ok({ success: true })
    }

    return fail("op tidak dikenal", 400)
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
