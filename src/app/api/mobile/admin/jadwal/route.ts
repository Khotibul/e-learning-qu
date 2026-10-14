import { prisma } from "@/lib/prisma"
import { deteksiBentrokJadwal } from "@/lib/absensi-guru"
import { requireAdmin, ok, fail, options } from "../_lib"

export { options }

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const url = new URL(req.url)
    const kelasId = url.searchParams.get("kelasId")
    const hari = url.searchParams.get("hari")
    const q = url.searchParams.get("q")?.trim()

    const [rows, kelas, mapel] = await Promise.all([
      prisma.jadwalPelajaran.findMany({
        where: {
          deletedAt: null,
          ...(kelasId ? { kelasId } : {}),
          ...(hari ? { hari } : {}),
          ...(q ? { OR: [{ kelas: { nama: { contains: q, mode: "insensitive" } } }, { mataPelajaran: { nama: { contains: q, mode: "insensitive" } } }] } : {}),
        },
        orderBy: [{ hari: "asc" }, { jamMulai: "asc" }],
        select: {
          id: true,
          hari: true,
          jamMulai: true,
          jamSelesai: true,
          kelas: { select: { id: true, nama: true, guru: { select: { nama: true } } } },
          mataPelajaran: { select: { id: true, nama: true, kode: true } },
        },
      }),
      prisma.kelas.findMany({ where: { deletedAt: null }, select: { id: true, nama: true }, orderBy: { nama: "asc" } }),
      prisma.mataPelajaran.findMany({ select: { id: true, nama: true, kode: true }, orderBy: { nama: "asc" } }),
    ])
    return ok({
      rows: rows.map((r) => ({
        id: r.id,
        hari: r.hari,
        jamMulai: r.jamMulai,
        jamSelesai: r.jamSelesai,
        kelasId: r.kelas?.id,
        kelas: r.kelas?.nama ?? null,
        waliKelas: r.kelas?.guru?.nama ?? null,
        mapelId: r.mataPelajaran?.id,
        mapel: r.mataPelajaran?.nama ?? null,
        kodeMapel: r.mataPelajaran?.kode ?? null,
      })),
      kelas,
      mapel,
      hariList: HARI,
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

    if (op === "cekBentrok") {
      const masalah = await deteksiBentrokJadwal({
        kelasId: body.kelasId,
        hari: body.hari,
        jamMulai: body.jamMulai,
        jamSelesai: body.jamSelesai,
        mataPelajaranId: body.mataPelajaranId,
        excludeId: body.excludeId,
      })
      return ok({ masalah })
    }

    const { kelasId, mataPelajaranId, hari, jamMulai, jamSelesai } = body
    if (!kelasId || !mataPelajaranId || !hari || !jamMulai || !jamSelesai) return fail("Semua field wajib diisi", 400)
    const masalah = await deteksiBentrokJadwal({ kelasId, hari, jamMulai, jamSelesai, mataPelajaranId })
    if (masalah.length > 0) return fail(masalah.join(" • "), 400)

    const row = await prisma.jadwalPelajaran.create({
      data: { kelasId, mataPelajaranId, hari, jamMulai, jamSelesai },
      select: { id: true },
    })
    return ok(row, 201)
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
