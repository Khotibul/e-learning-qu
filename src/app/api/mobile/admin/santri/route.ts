import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../_lib"

export { options }

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get("q")?.trim()
    const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || "20") || 20))
    const keberadaan = url.searchParams.get("keberadaan") || undefined
    const status = url.searchParams.get("status") || undefined

    const where = {
      deletedAt: null,
      ...(q ? { OR: [{ nama: { contains: q, mode: "insensitive" as const } }, { nisNo: { contains: q, mode: "insensitive" as const } }] } : {}),
      ...(keberadaan ? { keberadaan: keberadaan as never } : {}),
      ...(status ? { status: status as never } : {}),
    }
    const [data, total, statistik] = await Promise.all([
      prisma.santri.findMany({
        where,
        orderBy: { nama: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, nisNo: true, nama: true, keberadaan: true, status: true, tanggalMasuk: true, catatan: true,
          user: { select: { email: true } },
          siswa: { select: { kelas: { select: { nama: true } } } },
          walis: { select: { isPrimary: true, wali: { select: { id: true, nama: true, hubungan: true } } } },
        },
      }),
      prisma.santri.count({ where }),
      prisma.santri.groupBy({ by: ["keberadaan"], where: { deletedAt: null }, _count: true }),
    ])
    return ok({
      data: data.map((s) => ({
        id: s.id,
        nisNo: s.nisNo,
        nama: s.nama,
        keberadaan: s.keberadaan,
        status: s.status,
        tanggalMasuk: s.tanggalMasuk,
        catatan: s.catatan,
        email: s.user?.email ?? null,
        kelas: s.siswa?.kelas?.nama ?? null,
        wali: s.walis.filter((x) => x.isPrimary)[0]?.wali ?? s.walis[0]?.wali ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      statistik: statistik.map((s) => ({ keberadaan: s.keberadaan, count: s._count })),
    })
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

    if (op === "createDariSiswa") {
      if (!body.siswaId) return fail("siswaId wajib", 400)
      const siswa = await prisma.siswa.findUnique({ where: { id: body.siswaId }, include: { santri: { select: { id: true } } } })
      if (!siswa || siswa.deletedAt) return fail("Siswa tidak ditemukan", 404)
      if (siswa.santri) return fail("Siswa ini sudah terdaftar sebagai santri", 400)
      if (body.nisNo) {
        const dup = await prisma.santri.findFirst({ where: { nisNo: body.nisNo, deletedAt: null } })
        if (dup) return fail("Nomor Induk Santri sudah dipakai", 400)
      }
      const row = await prisma.santri.create({
        data: {
          userId: siswa.userId,
          siswaId: siswa.id,
          nisNo: body.nisNo || null,
          nama: siswa.nama,
          tanggalMasuk: body.tanggalMasuk ? new Date(body.tanggalMasuk) : null,
          catatan: body.catatan || null,
        },
        select: { id: true, nisNo: true, nama: true },
      })
      return ok(row, 201)
    }

    if (op === "createNonformal") {
      const { nama, email, password } = body
      if (!nama || !email || !password) return fail("nama, email, password wajib", 400)
      if (password.length < 6) return fail("Password minimal 6 karakter", 400)
      const exists = await prisma.user.findUnique({ where: { email } })
      if (exists) return fail("Email sudah terdaftar", 400)
      if (body.nisNo) {
        const dup = await prisma.santri.findFirst({ where: { nisNo: body.nisNo, deletedAt: null } })
        if (dup) return fail("Nomor Induk Santri sudah dipakai", 400)
      }
      const row = await prisma.$transaction(async (tx) => {
        const hash = await bcrypt.hash(password, 12)
        const user = await tx.user.create({ data: { email, name: nama, password: hash, role: "SISWA" } })
        return tx.santri.create({
          data: {
            userId: user.id,
            nisNo: body.nisNo || null,
            nama,
            tanggalMasuk: body.tanggalMasuk ? new Date(body.tanggalMasuk) : null,
            catatan: body.catatan || null,
          },
          select: { id: true, nisNo: true, nama: true },
        })
      })
      return ok(row, 201)
    }

    if (op === "delete") {
      if (!body.id) return fail("id wajib", 400)
      await prisma.santri.update({ where: { id: body.id }, data: { deletedAt: new Date() } })
      return ok({ success: true })
    }

    return fail("op tidak dikenal", 400)
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
