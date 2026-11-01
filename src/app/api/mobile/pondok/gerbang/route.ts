import { prisma } from "@/lib/prisma"
import {
  JENIS_IZIN_LABEL,
  STATUS_IZIN_LABEL,
  KEBERADAAN_LABEL,
  checkoutIzin,
  checkinIzin,
  perbaruiIzinTerlambat,
} from "@/lib/izin-santri"
import { requireGerbang, ok, fail, options } from "../_lib"

export { options }

export async function GET(req: Request) {
  const auth = await requireGerbang(req)
  if (auth.error) return auth.error

  try {
    await perbaruiIzinTerlambat()
    const url = new URL(req.url)
    const q = url.searchParams.get("q")?.trim()
    const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || "20") || 20))
    const riwayat = url.searchParams.get("riwayat")

    if (riwayat) {
      const dari = url.searchParams.get("dari")
      const sampai = url.searchParams.get("sampai")
      const rows = await prisma.izinSantri.findMany({
        where: {
          status: "DISETUJUI",
          ...(dari || sampai
            ? {
                createdAt: {
                  ...(dari ? { gte: new Date(dari) } : {}),
                  ...(sampai ? { lte: new Date(sampai) } : {}),
                },
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          suratNomor: true,
          jenis: true,
          rencanaKeluar: true,
          rencanaKembali: true,
          checkoutAt: true,
          checkinAt: true,
          status: true,
          namaPenjemput: true,
          hubunganPenjemput: true,
          santri: { select: { id: true, nama: true, nisNo: true, asrama: { select: { nama: true } }, kamar: { select: { nama: true } } } },
        },
      })
      return ok({
        riwayat: true,
        riwayatRows: rows.map((r) => ({
          id: r.id,
          suratNomor: r.suratNomor,
          jenis: r.jenis,
          jenisLabel: JENIS_IZIN_LABEL[r.jenis],
          rencanaKeluar: r.rencanaKeluar,
          rencanaKembali: r.rencanaKembali,
          checkoutAt: r.checkoutAt,
          checkinAt: r.checkinAt,
          penjemputNama: r.namaPenjemput,
          penjemputHubungan: r.hubunganPenjemput,
          santri: {
            id: r.santri.id,
            nama: r.santri.nama,
            nisNo: r.santri.nisNo,
            asrama: r.santri.asrama?.nama ?? null,
            kamar: r.santri.kamar?.nama ?? null,
          },
        })),
        statusLabel: STATUS_IZIN_LABEL,
        jenisLabel: JENIS_IZIN_LABEL,
      })
    }

    if (q) {
      // Sama dengan cariIzinAktifAction() website: token QR, nomor surat, NIS, atau nama.
      const rows = await prisma.izinSantri.findMany({
        where: {
          status: { in: ["DISETUJUI", "SELESAI"] },
          OR: [
            { suratToken: q },
            { suratNomor: q },
            { santri: { OR: [{ nisNo: { contains: q, mode: "insensitive" } }, { nama: { contains: q, mode: "insensitive" } }] } },
          ],
        },
        include: {
          santri: { select: { id: true, nama: true, nisNo: true, keberadaan: true, asrama: { select: { nama: true } }, kamar: { select: { nama: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
      return ok({
        mode: "cari",
        rows,
        keberadaanLabel: KEBERADAAN_LABEL,
        statusLabel: STATUS_IZIN_LABEL,
        jenisLabel: JENIS_IZIN_LABEL,
      })
    }

    const rows = await prisma.izinSantri.findMany({
      where: { status: "DISETUJUI", checkoutAt: null },
      orderBy: { rencanaKeluar: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        status: true,
        suratNomor: true,
        suratExpiresAt: true,
        jenis: true,
        rencanaKeluar: true,
        rencanaKembali: true,
        checkoutAt: true,
        checkinAt: true,
        namaPenjemput: true,
        hubunganPenjemput: true,
        noTelpPenjemput: true,
        penjemputVerifiedAt: true,
        alamatTujuan: true,
        santri: { select: { id: true, nama: true, nisNo: true, keberadaan: true, asrama: { select: { nama: true } }, kamar: { select: { nama: true } } } },
      },
    })
    const total = await prisma.izinSantri.count({ where: { status: "DISETUJUI", checkoutAt: null } })
    return ok({
      rows: rows.map((r) => ({
        id: r.id,
        status: r.status,
        suratNomor: r.suratNomor,
        suratExpiresAt: r.suratExpiresAt,
        checkoutAt: r.checkoutAt,
        checkinAt: r.checkinAt,
        jenis: r.jenis,
        jenisLabel: JENIS_IZIN_LABEL[r.jenis],
        rencanaKeluar: r.rencanaKeluar,
        rencanaKembali: r.rencanaKembali,
        namaPenjemput: r.namaPenjemput,
        hubunganPenjemput: r.hubunganPenjemput,
        noTelpPenjemput: r.noTelpPenjemput,
        penjemputVerifiedAt: r.penjemputVerifiedAt,
        alamatTujuan: r.alamatTujuan,
        santri: {
          id: r.santri.id,
          nama: r.santri.nama,
          nisNo: r.santri.nisNo,
          keberadaan: r.santri.keberadaan,
          asrama: r.santri.asrama?.nama ?? null,
          kamar: r.santri.kamar?.nama ?? null,
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      jenisLabel: JENIS_IZIN_LABEL,
      statusLabel: STATUS_IZIN_LABEL,
    })
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}

export async function POST(req: Request) {
  const auth = await requireGerbang(req)
  if (auth.error) return auth.error

  try {
    const body = await req.json()
    const { op, izinId, token, verifikasiPenjemput, alasan } = body

    if (op === "checkin") {
      if (!izinId) return fail("izinId wajib", 400)
      await checkinIzin(izinId, auth.user.id)
      return ok({ success: true, op: "checkin" })
    }

    // default: checkout
    await checkoutIzin(
      { izinId, token },
      auth.user.id,
      verifikasiPenjemput ? { verifikasiPenjemput: true } : undefined,
    )
    return ok({ success: true, op: "checkout", ...(alasan ? { catatan: alasan } : {}) })
  } catch (e) {
    if (e instanceof Error && e.message && e.message !== "Gagal") return fail(e.message, 400)
    console.error(e)
    return fail("Gagal")
  }
}
