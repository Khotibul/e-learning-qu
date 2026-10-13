"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ajukanTopupWali, setLimitDompetAnak, bayarTagihanAnak } from "../../../siswa/dompet/actions"

type Anak = { santriId: string; nama: string; status: string; userId: string; dompet: { id: string; nomor: string; saldo: number; status: string } | null }
type Topup = { id: string; jumlah: number; metode: string; status: string; createdAt: Date | string; account: { nomor: string; user: { santri: { nama: string } | null } } }
type TagihanAnak = { id: string; kode: string; periode: string; total: number; sisa: number; status: string; jenis: { nama: string } }

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`

const NOMINAL = [10000, 25000, 50000, 100000, 200000, 500000]

export function WaliDompetUI(props: { anak: Anak[]; riwayat: Topup[] }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ mode: "topup" | "limit" | "bayar"; anak: Anak; jumlah?: number; tagihan?: TagihanAnak } | null>(null)
  const [nominal, setNominal] = useState(50000)
  const [limitHarian, setLimitHarian] = useState<number | "">("")
  const [loading, setLoading] = useState(false)
  const [tagihanAnak, setTagihanAnak] = useState<Record<string, TagihanAnak[]>>({})

  async function submitTopup() {
    if (!dialog) return
    setLoading(true)
    try {
      const key = `topup-${dialog.anak.santriId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const hasil = await ajukanTopupWali({ santriId: dialog.anak.santriId, jumlah: nominal, metode: "TRANSFER_BANK", idempotencyKey: key })
      toast.success(`Pengajuan top-up ${rupiah(nominal)} dikirim — menunggu verifikasi`)
      setDialog(null)
      router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  async function submitLimit() {
    if (!dialog) return
    setLoading(true)
    try {
      await setLimitDompetAnak({ santriId: dialog.anak.santriId, limitHarian: limitHarian === "" ? null : Number(limitHarian) })
      toast.success("Limit harian diperbarui")
      setDialog(null)
      router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  async function submitBayar() {
    if (!dialog?.tagihan) return
    setLoading(true)
    try {
      const key = `bayar-${dialog.tagihan.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      await bayarTagihanAnak({ invoiceId: dialog.tagihan.id, jumlah: dialog.tagihan.sisa, metode: "EWALLET", idempotencyKey: key, santriId: dialog.anak.santriId })
      toast.success("Pembayaran tagihan berhasil")
      setDialog(null)
      router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold">Uang Saku Anak</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {props.anak.length === 0 && <p className="text-muted-foreground col-span-full">Tidak ada anak terdaftar.</p>}
        {props.anak.map((a) => (
          <Card key={a.santriId}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{a.nama}</CardTitle>
                <Badge variant={a.status === "AKTIF" ? "default" : "secondary"}>{a.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {a.dompet ? (
                <>
                  <div className="text-2xl font-bold">{rupiah(a.dompet.saldo)}</div>
                  <div className="text-xs text-muted-foreground">No. {a.dompet.nomor}</div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setDialog({ mode: "topup", anak: a }); setNominal(50000) }}>Isi Saldo</Button>
                    <Button size="sm" variant="outline" onClick={() => { setDialog({ mode: "limit", anak: a }); setLimitHarian("") }}>Atur Limit</Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Belum memiliki dompet.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Riwayat Top-up</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Tanggal</th><th className="p-3">Anak</th><th className="p-3">Metode</th><th className="p-3 text-right">Jumlah</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {props.riwayat.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada riwayat</td></tr>}
              {props.riwayat.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="p-3 whitespace-nowrap">{new Date(t.createdAt).toLocaleString("id-ID")}</td>
                  <td className="p-3">{t.account.user.santri?.nama ?? t.account.nomor}</td>
                  <td className="p-3">{t.metode}</td>
                  <td className="p-3 text-right font-medium">{rupiah(t.jumlah)}</td>
                  <td className="p-3"><Badge variant={t.status === "BERHASIL" ? "default" : t.status === "MENUNGGU" ? "secondary" : "destructive"}>{t.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {dialog?.mode === "topup" && (
        <Dialog open onOpenChange={() => setDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Isi Saldo — {dialog.anak.nama}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {NOMINAL.map((n) => (
                  <Button key={n} variant={nominal === n ? "default" : "outline"} size="sm" onClick={() => setNominal(n)}>{rupiah(n)}</Button>
                ))}
              </div>
              <input type="number" value={nominal} onChange={(e) => setNominal(Number(e.target.value))} min={1000} className="w-full rounded-md border border-gray-200 p-2 text-sm" />
              <p className="text-xs text-muted-foreground">Pengajuan akan diverifikasi bendahara. Minimal Rp10.000.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
                <Button disabled={loading || nominal < 1000} onClick={submitTopup}>{loading ? "Mengirim..." : "Ajukan Top-up"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {dialog?.mode === "limit" && (
        <Dialog open onOpenChange={() => setDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Atur Limit Harian — {dialog.anak.nama}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <input type="number" value={limitHarian === "" ? "" : limitHarian} onChange={(e) => setLimitHarian(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Kosongkan = tanpa batas" className="w-full rounded-md border border-gray-200 p-2 text-sm" />
              <p className="text-xs text-muted-foreground">Wali hanya dapat menetapkan limit (tidak menambah saldo).</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
                <Button disabled={loading} onClick={submitLimit}>{loading ? "Menyimpan..." : "Simpan"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
