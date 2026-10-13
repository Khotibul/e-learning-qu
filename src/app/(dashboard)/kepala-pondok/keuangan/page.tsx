import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireMonitoringKeuanganPondok } from "@/lib/keuangan/guard"
import { KeuanganPondokUI } from "./_components/keuangan-pondok-ui"

export default async function KeuanganPondokPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  try {
    await requireMonitoringKeuanganPondok()
  } catch {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Hanya Kepala Pondok/Admin yang dapat mengakses monitoring keuangan pondok.
        </div>
      </div>
    )
  }

  // Read-only: monitoring tanpa koreksi saldo
  const [rekapTagihanPondok, tunggakan, topupBerhasil, transaksiKantin] = await Promise.all([
    prisma.invoiceTagihan.groupBy({
      by: ["status"],
      where: { jenis: { unit: "PONDOK" } },
      _count: true,
      _sum: { total: true, terbayar: true, sisa: true },
    }),
    prisma.invoiceTagihan.findMany({
      where: { jenis: { unit: "PONDOK" }, status: { in: ["JATUH_TEMPO", "BELUM_DIBAYAR", "SEBAGIAN"] }, sisa: { gt: 0 } },
      include: { jenis: { select: { nama: true } }, user: { select: { name: true, santri: { select: { nama: true } } } } },
      orderBy: { jatuhTempo: "asc" },
      take: 30,
    }),
    prisma.topupRequest.aggregate({ where: { status: "BERHASIL" }, _sum: { jumlah: true }, _count: true }),
    prisma.kantinTransaksi.aggregate({ where: { status: "SELESAI" }, _sum: { total: true }, _count: true }),
  ])

  return (
    <KeuanganPondokUI
      rekapTagihanPondok={rekapTagihanPondok}
      tunggakan={tunggakan.map((t) => ({
        id: t.id, kode: t.kode, periode: t.periode, total: t.total, sisa: t.sisa, status: t.status,
        jatuhTempo: t.jatuhTempo?.toISOString() ?? null,
        nama: t.user.santri?.nama ?? t.user.name ?? "-",
        jenis: t.jenis.nama,
      }))}
      topupBerhasil={{ jumlah: topupBerhasil._sum.jumlah ?? 0, count: topupBerhasil._count }}
      transaksiKantin={{ jumlah: transaksiKantin._sum.total ?? 0, count: transaksiKantin._count }}
    />
  )
}
