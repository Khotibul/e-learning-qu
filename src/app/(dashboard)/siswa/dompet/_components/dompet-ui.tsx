"use client"

import { useState } from "react"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

type Ledger = { id: string; tipe: string; jumlah: number; saldoSesudah: number; deskripsi: string | null; createdAt: Date | string; refType: string | null }
type Transaksi = { id: string; nomorStruk: string; total: number; metode: string; createdAt: Date | string; outlet: { nama: string }; item: { namaSnapshot: string; qty: number; subtotal: number }[] }
type Tagihan = { id: string; kode: string; periode: string; total: number; terbayar: number; sisa: number; status: string; jatuhTempo: Date | string | null; jenis: { nama: string; unit: string | null } }

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`
const TIPE_LABEL: Record<string, string> = { TOPUP: "Top-up", PEMBAYARAN_KANTIN: "Beli Kantin", REFUND_KANTIN: "Refund", KOREKSI: "Koreksi", BAYAR_TAGIHAN: "Bayar Tagihan", PENARIKAN: "Penarikan" }

export function DompetUI(props: {
  dompet: { dompet: { id: string; nomor: string; saldo: number; status: string; nama: string }; limitHarian: { sisa: number | null; ok: boolean }; konsistensiSaldo: boolean; riwayat: Ledger[] }
  transaksi: Transaksi[]
  tagihan: Tagihan[]
}) {
  const [tab, setTab] = useState("saldo")
  const { dompet, limitHarian, konsistensiSaldo, riwayat } = props.dompet

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dompet Uang Saku</h1>
        <Badge variant={dompet.status === "AKTIF" ? "default" : "destructive"}>{dompet.status}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo Tersedia</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{rupiah(dompet.saldo)}</div><div className="text-xs text-muted-foreground mt-1">No. {dompet.nomor}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sisa Limit Harian</CardTitle></CardHeader>
          <CardContent>
            {limitHarian.sisa === null ? <div className="text-2xl font-bold">∞</div> : <div className={`text-2xl font-bold ${limitHarian.ok ? "" : "text-red-600"}`}>{rupiah(limitHarian.sisa)}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Konsistensi Saldo</CardTitle></CardHeader>
          <CardContent><Badge variant={konsistensiSaldo ? "default" : "destructive"}>{konsistensiSaldo ? "Konsisten" : "Tidak konsisten"}</Badge></CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="saldo">Riwayat Saldo</TabsTrigger>
          <TabsTrigger value="kantin">Pembelian Kantin</TabsTrigger>
          <TabsTrigger value="tagihan">Tagihan</TabsTrigger>
        </TabsList>

        <TabsContent value="saldo" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Tanggal</th><th className="p-3">Tipe</th><th className="p-3">Deskripsi</th><th className="p-3 text-right">Jumlah</th><th className="p-3 text-right">Saldo</th></tr></thead>
                <tbody>
                  {riwayat.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada transaksi</td></tr>}
                  {riwayat.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="p-3 whitespace-nowrap">{new Date(l.createdAt).toLocaleString("id-ID")}</td>
                      <td className="p-3">{TIPE_LABEL[l.tipe] ?? l.tipe}</td>
                      <td className="p-3">{l.deskripsi ?? "-"}</td>
                      <td className={`p-3 text-right font-medium ${l.jumlah >= 0 ? "text-green-600" : "text-red-600"}`}>{l.jumlah >= 0 ? "+" : ""}{rupiah(l.jumlah)}</td>
                      <td className="p-3 text-right">{rupiah(l.saldoSesudah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kantin" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Struk</th><th className="p-3">Outlet</th><th className="p-3">Item</th><th className="p-3">Metode</th><th className="p-3 text-right">Total</th></tr></thead>
                <tbody>
                  {props.transaksi.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada pembelian</td></tr>}
                  {props.transaksi.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="p-3 font-mono text-xs">{t.nomorStruk}</td>
                      <td className="p-3">{t.outlet.nama}</td>
                      <td className="p-3">{t.item.map((i) => `${i.namaSnapshot}×${i.qty}`).join(", ")}</td>
                      <td className="p-3"><Badge variant="outline">{t.metode}</Badge></td>
                      <td className="p-3 text-right font-medium">{rupiah(t.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tagihan" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Kode</th><th className="p-3">Jenis</th><th className="p-3">Periode</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Sisa</th><th className="p-3">Status</th></tr></thead>
                <tbody>
                  {props.tagihan.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Tidak ada tagihan</td></tr>}
                  {props.tagihan.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="p-3 font-mono text-xs">{t.kode}</td>
                      <td className="p-3">{t.jenis.nama}</td>
                      <td className="p-3">{t.periode}</td>
                      <td className="p-3 text-right">{rupiah(t.total)}</td>
                      <td className="p-3 text-right font-medium">{rupiah(t.sisa)}</td>
                      <td className="p-3"><Badge variant={t.status === "LUNAS" ? "default" : t.status === "JATUH_TEMPO" ? "destructive" : "secondary"}>{t.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Catatan: saldo hanya dapat ditambah melalui top-up yang diverifikasi pengurus. Siswa tidak dapat menambah saldo sendiri.
      </p>
    </div>
  )
}
