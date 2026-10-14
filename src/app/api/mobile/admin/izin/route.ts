import { prisma } from "@/lib/prisma"
import {
  setujuiIzin, tolakIzin, getIzinMenunggu, getStatistikIzin, getRiwayatIzin,
  JENIS_IZIN_LABEL, STATUS_IZIN_LABEL,
} from "@/lib/izin-santri"
import { requireAdmin, ok, fail, options } from "../_lib"

export { options }

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const url = new URL(req.url)
    const view = url.searchParams.get("view") || "antrean"

    if (view === "antrean") {
      const r = await getIzinMenunggu("ADMIN")
      return ok({ rows: r, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL })
    }

    if (view === "statistik") {
      const s = await getStatistikIzin()
      return ok({ ...s, statusLabel: STATUS_IZIN_LABEL })
    }

    if (view === "riwayat") {
      const santriId = url.searchParams.get("santriId") || undefined
      const asramaId = url.searchParams.get("asramaId") || undefined
      const status = url.searchParams.get("status") || undefined
      const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1)
      const r = await getRiwayatIzin({ santriId, asramaId, page, limit: 20 })
      const data = status ? r.data.filter((x: { status: string }) => x.status === status) : r.data
      return ok({ data, total: r.total, page: r.page, limit: r.limit, totalPages: r.totalPages, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL })
    }

    if (view === "pengaturan") {
      const rows = await prisma.izinPengaturan.findMany({ orderBy: { jenis: "asc" } })
      const byJenis = new Map(rows.map((r) => [r.jenis, r]))
      const data = Object.keys(JENIS_IZIN_LABEL).map((j) => {
        const r = byJenis.get(j as never)
        return r ?? { jenis: j, butuhWali: true, butuhPengurus: false, butuhMusyrif: true, butuhKepala: false, butuhAdmin: true, aktif: true }
      })
      return ok({ data, jenisLabel: JENIS_IZIN_LABEL })
    }

    if (view === "asrama") {
      const rows = await prisma.asrama.findMany({
        where: { aktif: true },
        include: { musyrif: { select: { id: true, nama: true } }, kamars: { select: { id: true, nama: true, kapasitas: true } } },
        orderBy: { nama: "asc" },
      })
      return ok({ rows })
    }

    if (view === "konflik") {
      const rows = await prisma.izinKonflikAbsensi.findMany({
        where: { resolvedAt: null },
        include: { izin: { select: { suratNomor: true, jenis: true, rencanaKembali: true } }, siswa: { select: { id: true, nama: true, nis: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
      return ok({ rows, jenisLabel: JENIS_IZIN_LABEL })
    }

    return fail("view tidak dikenal", 400)
  } catch (e) {
    console.error(e)
    return fail(e instanceof Error ? e.message : "Gagal")
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const body = await req.json()
    const { op } = body
    const userId = auth.user.id

    if (op === "setujui") {
      if (!body.izinId) return fail("izinId wajib", 400)
      const hasil = await setujuiIzin(body.izinId, "ADMIN", userId, body.catatan)
      return ok({ success: true, status: hasil.status, suratNomor: hasil.suratNomor })
    }

    if (op === "tolak") {
      if (!body.izinId) return fail("izinId wajib", 400)
      const hasil = await tolakIzin(body.izinId, "ADMIN", userId, body.alasan)
      return ok({ success: true, status: hasil.status })
    }

    if (op === "simpanPengaturan") {
      const { jenis, butuhWali, butuhPengurus, butuhMusyrif, butuhKepala, butuhAdmin, aktif } = body
      if (!(jenis in JENIS_IZIN_LABEL)) return fail("Jenis izin tidak dikenal", 400)
      const row = await prisma.izinPengaturan.upsert({
        where: { jenis },
        create: { jenis, butuhWali, butuhPengurus, butuhMusyrif, butuhKepala, butuhAdmin, aktif },
        update: { butuhWali, butuhPengurus, butuhMusyrif, butuhKepala, butuhAdmin, aktif },
      })
      return ok({ success: true, id: row.id })
    }

    if (op === "createAsrama") {
      const nama = String(body.nama || "").trim()
      if (nama.length < 2) return fail("Nama asrama minimal 2 karakter", 400)
      const row = await prisma.asrama.create({ data: { nama, deskripsi: body.deskripsi || null, musyrifId: body.musyrifId || null }, select: { id: true, nama: true } })
      return ok(row, 201)
    }

    if (op === "createKamar") {
      const nama = String(body.nama || "").trim()
      if (!nama) return fail("Nama kamar wajib diisi", 400)
      if (!body.asramaId) return fail("asramaId wajib", 400)
      const row = await prisma.kamar.create({ data: { asramaId: body.asramaId, nama, kapasitas: body.kapasitas || null }, select: { id: true, nama: true } })
      return ok(row, 201)
    }

    if (op === "assignTempat") {
      const { santriId, asramaId, kamarId } = body
      if (!santriId) return fail("santriId wajib", 400)
      if (asramaId) {
        const a = await prisma.asrama.findUnique({ where: { id: asramaId }, select: { id: true } })
        if (!a) return fail("Asrama tidak ditemukan", 404)
      }
      if (kamarId) {
        const k = await prisma.kamar.findUnique({ where: { id: kamarId }, select: { id: true, asramaId: true } })
        if (!k) return fail("Kamar tidak ditemukan", 404)
        if (asramaId && k.asramaId !== asramaId) return fail("Kamar bukan milik asrama tersebut", 400)
      }
      await prisma.santri.update({ where: { id: santriId }, data: { asramaId: asramaId || null, kamarId: kamarId || null } })
      return ok({ success: true })
    }

    if (op === "resolveKonflik") {
      if (!body.konflikId) return fail("konflikId wajib", 400)
      const upd = await prisma.izinKonflikAbsensi.updateMany({
        where: { id: body.konflikId, resolvedAt: null },
        data: { resolvedAt: new Date(), resolvedBy: userId },
      })
      if (upd.count === 0) return fail("Konflik sudah pernah diselesaikan", 400)
      return ok({ success: true })
    }

    return fail("op tidak dikenal", 400)
  } catch (e) {
    console.error(e)
    return fail(e instanceof Error ? e.message : "Gagal")
  }
}
