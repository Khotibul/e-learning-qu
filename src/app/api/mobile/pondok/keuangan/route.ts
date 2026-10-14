import { prisma } from "@/lib/prisma"
import { requireKuanganPondok, ok, fail, options } from "../_lib"

export { options }

const TUNGGAKAN_STATUS = ["JATUH_TEMPO", "BELUM_DIBAYAR", "SEBAGIAN"] as const

export async function GET(req: Request) {
  const auth = await requireKuanganPondok(req)
  if (auth.error) return auth.error

  try {
    const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("limit") || "30") || 30))

    const [rekap, tunggakan, topup, kantin] = await Promise.all([
      prisma.invoiceTagihan.groupBy({
        by: ["status"],
        where: { jenis: { unit: "PONDOK" } },
        _count: true,
        _sum: { total: true, terbayar: true, sisa: true },
      }),
      prisma.invoiceTagihan.findMany({
        where: {
          jenis: { unit: "PONDOK" },
          status: { in: [...TUNGGAKAN_STATUS] },
          sisa: { gt: 0 },
        },
        orderBy: { jatuhTempo: "asc" },
        take: limit,
        select: {
          id: true,
          kode: true,
          periode: true,
          total: true,
          terbayar: true,
          sisa: true,
          status: true,
          jatuhTempo: true,
          jenis: { select: { kode: true, nama: true } },
          user: {
            select: {
              name: true,
              santri: { select: { nama: true, nisNo: true } },
              siswa: { select: { nama: true, nis: true } },
            },
          },
        },
      }),
      prisma.topupRequest.aggregate({ where: { status: "BERHASIL" }, _sum: { jumlah: true }, _count: true }),
      prisma.kantinTransaksi.aggregate({ where: { status: "SELESAI" }, _sum: { total: true }, _count: true }),
    ])

    return ok({
      rekapTagihanPondok: rekap.map((r) => ({
        status: r.status,
        jumlah: r._count,
        total: r._sum?.total ?? 0,
        terbayar: r._sum?.terbayar ?? 0,
        sisa: r._sum?.sisa ?? 0,
      })),
      tunggakan: tunggakan.map((t) => ({
        id: t.id,
        kode: t.kode,
        periode: t.periode,
        total: t.total,
        terbayar: t.terbayar,
        sisa: t.sisa,
        status: t.status,
        jatuhTempo: t.jatuhTempo,
        jenis: t.jenis.nama,
        kodeJenis: t.jenis.kode,
        nama: t.user.santri?.nama ?? t.user.siswa?.nama ?? t.user.name ?? "-",
        identitas: t.user.santri?.nisNo ?? t.user.siswa?.nis ?? null,
      })),
      topupBerhasil: { jumlah: topup._sum.jumlah ?? 0, count: topup._count },
      transaksiKantin: { jumlah: kantin._sum.total ?? 0, count: kantin._count },
    })
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
