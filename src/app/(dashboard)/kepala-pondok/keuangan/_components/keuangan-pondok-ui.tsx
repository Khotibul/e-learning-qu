"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type Rekap = { status: string; _count: number; _sum: { total: number | null; terbayar: number | null; sisa: number | null } }
type Tunggakan = { id: string; kode: string; periode: string; total: number; sisa: number; status: string; jatuhTempo: string | null; nama: string; jenis: string }

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`

export function KeuanganPondokUI(props: {
  rekapTagihanPondok: Rekap[]
  tunggakan: Tunggakan[]
  topupBerhasil: { jumlah: number; count: number }
  transaksiKantin: { jumlah: number; count: number }
}) {
  const totalTagihan = props.rekapTagihanPondok.reduce((s, r) => s + (r._sum.total ?? 0), 0)
  const totalTerbayar = props.rekapTagihanPondok.reduce((s, r) => s + (r._sum.terbayar ?? 0), 0)
  const totalSisa = props.rekapTagihanPondok.reduce((s, r) => s + (r._sum.sisa ?? 0), 0)

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold">Monitoring Keuangan Pondok</h1>
      <p className="text-xs text-muted-foreground">Read-only. Koreksi saldo hanya oleh bendahara/admin.</p>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Total Tagihan Pondok</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">{rupiah(totalTagihan)}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Terbayar</CardTitle></CardHeader><CardContent><div className="text-lg font-bold text-green-600">{rupiah(totalTerbayar)}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Sisa / Tunggakan</CardTitle></CardHeader><CardContent><div className="text-lg font-bold text-red-600">{rupiah(totalSisa)}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Top-up Berhasil</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">{rupiah(props.topupBerhasil.jumlah)}</div><div className="text-xs text-muted-foreground">{props.topupBerhasil.count} transaksi</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Tunggakan Tagihan Pondok</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Kode</th><th className="p-3">Santri</th><th className="p-3">Jenis</th><th className="p-3">Periode</th><th className="p-3 text-right">Sisa</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {props.tunggakan.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Tidak ada tunggakan</td></tr>}
              {props.tunggakan.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="p-3 font-mono text-xs">{t.kode}</td>
                  <td className="p-3">{t.nama}</td>
                  <td className="p-3">{t.jenis}</td>
                  <td className="p-3">{t.periode}</td>
                  <td className="p-3 text-right font-medium">{rupiah(t.sisa)}</td>
                  <td className="p-3"><Badge variant={t.status === "JATUH_TEMPO" ? "destructive" : "secondary"}>{t.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Statistik Kantin</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm">Total transaksi: <b>{props.transaksiKantin.count}</b> · Nilai: <b>{rupiah(props.transaksiKantin.jumlah)}</b></p>
        </CardContent>
      </Card>
    </div>
  )
}
