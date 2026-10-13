"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { verifikasiTopupBendahara, verifikasiPembayaranBendahara, seedAkunAction } from "../actions"

type Dash = {
  topupMenunggu: number; tagihanPending: number; totalSaldoDompet: number; jumlahDompet: number
  kewajibanDompet: number; pendapatanKantin: number; hpp: number; transaksiHariIni: number; invoiceBelumLunas: number
}
type Antrean = {
  topups: { id: string; jumlah: number; metode: string; status: string; createdAt: Date | string; account: { nomor: string; user: { santri: { nama: string } | null; siswa: { nama: string } | null } }; wali: { nama: string } | null }[]
  pembayaran: { id: string; jumlah: number; metode: string; status: string; createdAt: Date | string; invoice: { kode: string; periode: string; jenis: { nama: string } } }[]
}
type Akun = { id: string; kode: string; nama: string; tipe: string; saldo: number }
type Jurnal = { id: string; nomor: string; tanggal: Date | string; keterangan: string; refType: string; status: string; item: { debit: number; kredit: number; akun: { kode: string; nama: string } }[] }

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`

export function BendaharaUI(props: { dash: Dash; antrean: Antrean; akun: Akun[]; jurnal: Jurnal[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState("dashboard")

  async function verifTopup(topupId: string, setujui: boolean) {
    setLoading(true)
    try {
      await verifikasiTopupBendahara({ topupId, setujui })
      toast.success(setujui ? "Top-up disetujui & saldo dikredit" : "Top-up ditolak")
      router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  async function verifBayar(pembayaranId: string, setujui: boolean) {
    setLoading(true)
    try {
      await verifikasiPembayaranBendahara({ pembayaranId, setujui })
      toast.success(setujui ? "Pembayaran diverifikasi" : "Pembayaran ditolak")
      router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  async function seedAkun() {
    setLoading(true)
    try { const r = await seedAkunAction(); toast.success(`Akun standar: ${r.dibuat} dibuat`) } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const d = props.dash
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard Bendahara</h1>
        <Button size="sm" variant="outline" disabled={loading} onClick={seedAkun}>Seed Akun Standar</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Saldo Dompet (Kewajiban)</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">{rupiah(d.totalSaldoDompet)}</div><div className="text-xs text-muted-foreground">{d.jumlahDompet} dompet</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Top-up Menunggu</CardTitle></CardHeader><CardContent><div className={`text-lg font-bold ${d.topupMenunggu > 0 ? "text-amber-600" : ""}`}>{d.topupMenunggu}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Pendapatan Kantin</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">{rupiah(d.pendapatanKantin)}</div><div className="text-xs text-muted-foreground">HPP {rupiah(d.hpp)}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Invoice Belum Lunas</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">{d.invoiceBelumLunas}</div><div className="text-xs text-muted-foreground">Pending bayar: {d.tagihanPending}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="verifikasi">Verifikasi</TabsTrigger>
          <TabsTrigger value="akun">Akun Laporan</TabsTrigger>
          <TabsTrigger value="jurnal">Jurnal</TabsTrigger>
        </TabsList>

        <TabsContent value="verifikasi" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Antrean Top-up ({props.antrean.topups.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Tanggal</th><th className="p-3">Pemilik</th><th className="p-3">Wali</th><th className="p-3">Metode</th><th className="p-3 text-right">Jumlah</th><th className="p-3">Aksi</th></tr></thead>
                <tbody>
                  {props.antrean.topups.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Tidak ada antrean</td></tr>}
                  {props.antrean.topups.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="p-3 whitespace-nowrap">{new Date(t.createdAt).toLocaleString("id-ID")}</td>
                      <td className="p-3">{t.account.user.santri?.nama ?? t.account.user.siswa?.nama ?? t.account.nomor}</td>
                      <td className="p-3">{t.wali?.nama ?? "-"}</td>
                      <td className="p-3">{t.metode}</td>
                      <td className="p-3 text-right font-medium">{rupiah(t.jumlah)}</td>
                      <td className="p-3 flex gap-1">
                        <Button size="sm" disabled={loading} onClick={() => verifTopup(t.id, true)}>Setujui</Button>
                        <Button size="sm" variant="destructive" disabled={loading} onClick={() => verifTopup(t.id, false)}>Tolak</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Pembayaran Tagihan Pending ({props.antrean.pembayaran.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Invoice</th><th className="p-3">Jenis</th><th className="p-3">Metode</th><th className="p-3 text-right">Jumlah</th><th className="p-3">Aksi</th></tr></thead>
                <tbody>
                  {props.antrean.pembayaran.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Tidak ada antrean</td></tr>}
                  {props.antrean.pembayaran.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="p-3 font-mono text-xs">{b.invoice.kode}</td>
                      <td className="p-3">{b.invoice.jenis.nama}</td>
                      <td className="p-3">{b.metode}</td>
                      <td className="p-3 text-right font-medium">{rupiah(b.jumlah)}</td>
                      <td className="p-3 flex gap-1">
                        <Button size="sm" disabled={loading} onClick={() => verifBayar(b.id, true)}>Setujui</Button>
                        <Button size="sm" variant="destructive" disabled={loading} onClick={() => verifBayar(b.id, false)}>Tolak</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="akun" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Kode</th><th className="p-3">Nama</th><th className="p-3">Tipe</th><th className="p-3 text-right">Saldo</th></tr></thead>
                <tbody>
                  {props.akun.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="p-3 font-mono">{a.kode}</td>
                      <td className="p-3">{a.nama}</td>
                      <td className="p-3"><Badge variant="outline">{a.tipe}</Badge></td>
                      <td className="p-3 text-right font-medium">{rupiah(a.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jurnal" className="mt-4">
          <Card>
            <CardContent className="p-0 divide-y">
              {props.jurnal.length === 0 && <p className="p-6 text-center text-muted-foreground">Belum ada jurnal</p>}
              {props.jurnal.map((j) => (
                <div key={j.id} className="p-3 text-sm">
                  <div className="flex justify-between font-medium"><span>{j.nomor} — {j.keterangan}</span><Badge variant="outline">{j.refType}</Badge></div>
                  <table className="mt-1 w-full text-xs">
                    <tbody>
                      {j.item.map((it, idx) => (
                        <tr key={idx} className="text-muted-foreground">
                          <td className="py-0.5">{it.akun.kode} {it.akun.nama}</td>
                          <td className="py-0.5 text-right">{it.debit ? rupiah(it.debit) : ""}</td>
                          <td className="py-0.5 text-right">{it.kredit ? rupiah(it.kredit) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
