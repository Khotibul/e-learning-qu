import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../_lib"

export { options }

const URUTAN_STATUS = ["DRAFT", "DIJADWALKAN", "DIBUKA", "DITUTUP", "SELEKSI", "PENGUMUMAN", "DAFTAR_ULANG", "SELESAI"]

function transisiValid(dari: string, ke: string): boolean {
  if (dari === ke) return false
  const iDari = URUTAN_STATUS.indexOf(dari)
  const iKe = URUTAN_STATUS.indexOf(ke)
  if (Math.abs(iKe - iDari) === 1) return true
  if (ke === "DRAFT" && dari === "DIJADWALKAN") return true
  return false
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get("q")?.trim()
    const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || "10") || 10))
    const status = url.searchParams.get("status") || undefined
    const tahunAjaranId = url.searchParams.get("tahunAjaranId") || undefined

    const where = {
      deletedAt: null,
      ...(status ? { status: status as never } : {}),
      ...(tahunAjaranId ? { tahunAjaranId } : {}),
      ...(q ? {
        OR: [
          { nama: { contains: q, mode: "insensitive" as const } },
          { unit: { contains: q, mode: "insensitive" as const } },
          { jenjang: { contains: q, mode: "insensitive" as const } },
          { program: { contains: q, mode: "insensitive" as const } },
        ],
      } : {}),
    }
    const [data, total, tahunAjaran] = await Promise.all([
      prisma.gelombangPpdb.findMany({
        where,
        include: {
          tahunAjaran: { select: { id: true, nama: true } },
          jalur: { orderBy: { nama: "asc" }, select: { id: true, nama: true, deskripsi: true, kuota: true, isActive: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.gelombangPpdb.count({ where }),
      prisma.tahunAjaran.findMany({ where: { deletedAt: null }, select: { id: true, nama: true, isAktif: true }, orderBy: { createdAt: "desc" } }),
    ])
    return ok({ data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), tahunAjaran })
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

    if (op === "createGelombang") {
      const { tahunAjaranId, nama, tanggalBuka, tanggalTutup } = body
      if (!nama || !tahunAjaranId) return fail("Nama gelombang dan tahun ajaran wajib diisi", 400)
      if (!tanggalBuka || !tanggalTutup) return fail("Tanggal buka dan tutup wajib diisi", 400)
      const buka = new Date(tanggalBuka)
      const tutup = new Date(tanggalTutup)
      if (tutup <= buka) return fail("Tanggal tutup harus setelah tanggal buka", 400)
      const ta = await prisma.tahunAjaran.findFirst({ where: { id: tahunAjaranId, deletedAt: null } })
      if (!ta) return fail("Tahun ajaran tidak ditemukan", 404)
      const row = await prisma.gelombangPpdb.create({
        data: {
          tahunAjaranId,
          nama,
          unit: body.unit || null,
          jenjang: body.jenjang || null,
          program: body.program || null,
          tanggalBuka: buka,
          tanggalTutup: tutup,
          kuota: body.kuota ?? null,
          biayaDaftar: body.biayaDaftar ?? null,
          jadwalSeleksi: body.jadwalSeleksi ? new Date(body.jadwalSeleksi) : null,
          jadwalPengumuman: body.jadwalPengumuman ? new Date(body.jadwalPengumuman) : null,
          jadwalDaftarUlang: body.jadwalDaftarUlang ? new Date(body.jadwalDaftarUlang) : null,
          deskripsi: body.deskripsi || null,
        },
        select: { id: true, nama: true },
      })
      return ok(row, 201)
    }

    if (op === "deleteGelombang") {
      if (!body.id) return fail("id wajib", 400)
      await prisma.gelombangPpdb.update({ where: { id: body.id }, data: { deletedAt: new Date() } })
      return ok({ success: true })
    }

    if (op === "updateStatus") {
      const { id, status } = body
      if (!id || !status) return fail("id dan status wajib", 400)
      const g = await prisma.gelombangPpdb.findFirst({ where: { id, deletedAt: null } })
      if (!g) return fail("Gelombang tidak ditemukan", 404)
      if (!transisiValid(g.status, status)) return fail(`Transisi status ${g.status} → ${status} tidak valid`, 400)
      await prisma.gelombangPpdb.update({ where: { id }, data: { status } })
      return ok({ success: true })
    }

    if (op === "createJalur") {
      const { gelombangId, nama } = body
      if (!gelombangId || !nama) return fail("gelombangId dan nama wajib", 400)
      const g = await prisma.gelombangPpdb.findFirst({ where: { id: gelombangId, deletedAt: null } })
      if (!g) return fail("Gelombang tidak ditemukan", 404)
      const row = await prisma.jalurPpdb.create({
        data: { gelombangId, nama, deskripsi: body.deskripsi || null, kuota: body.kuota ?? null },
        select: { id: true, nama: true },
      })
      return ok(row, 201)
    }

    if (op === "deleteJalur") {
      if (!body.id) return fail("id wajib", 400)
      await prisma.jalurPpdb.delete({ where: { id: body.id } })
      return ok({ success: true })
    }

    return fail("op tidak dikenal", 400)
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
