"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getProdukOutlet, getShiftAktifKasir, bukaShiftAction, tutupShiftAction, cariSiswaUntukBayar, checkoutAction, getRiwayatShift, kelolaProdukAction, restockProdukAction } from "../actions"

type Outlet = { id: string; nama: string; kode: string; lokasi: string | null }
type Produk = { id: string; nama: string; sku: string | null; hargaJual: number; stok: number; satuan: string; kategori: { nama: string } | null }
type Shift = { id: string; nomorShift: number; saldoAwal: number }
type ItemKeranjang = { produkId: string; nama: string; harga: number; qty: number }
type SiswaDicari = { siswaId: string; nama: string; nis: string | null; userId: string; dompet: { id: string; nomor: string; saldo: number; status: string } | null }
type RiwayatShift = { id: string; nomorStruk: string; total: number; metode: string; status: string; createdAt: Date | string; item: { namaSnapshot: string; qty: number }[] }

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`

export function KantinUI({ outlets }: { outlets: Outlet[] }) {
  const router = useRouter()
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "")
  const [produk, setProduk] = useState<Produk[]>([])
  const [shift, setShift] = useState<Shift | null>(null)
  const [keranjang, setKeranjang] = useState<ItemKeranjang[]>([])
  const [metode, setMetode] = useState<"EWALLET" | "TUNAI">("EWALLET")
  const [siswa, setSiswa] = useState<SiswaDicari | null>(null)
  const [q, setQ] = useState("")
  const [hasilCari, setHasilCari] = useState<SiswaDicari[]>([])
  const [loading, setLoading] = useState(false)
  const [dialog, setDialog] = useState<"shift" | "checkout" | "produk" | "tutup" | null>(null)
  const [saldoAwal, setSaldoAwal] = useState(0)
  const [kasAkhir, setKasAkhir] = useState(0)
  const [riwayat, setRiwayat] = useState<RiwayatShift[]>([])
  const [tab, setTab] = useState("pos")

  const muatProduk = useCallback(async () => {
    if (!outletId) return
    try { setProduk(await getProdukOutlet(outletId)) } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") }
  }, [outletId])

  const muatShift = useCallback(async () => {
    if (!outletId) return
    try { setShift(await getShiftAktifKasir(outletId)) } catch { setShift(null) }
  }, [outletId])

  useEffect(() => { muatProduk(); muatShift() }, [muatProduk, muatShift])

  useEffect(() => {
    if (!q.trim()) { setHasilCari([]); return }
    const t = setTimeout(async () => {
      try { setHasilCari(await cariSiswaUntukBayar(q)) } catch { setHasilCari([]) }
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  function tambah(p: Produk) {
    if (p.stok <= 0) { toast.error("Stok habis"); return }
    setKeranjang((k) => {
      const ada = k.find((i) => i.produkId === p.id)
      if (ada) return k.map((i) => i.produkId === p.id ? { ...i, qty: Math.min(i.qty + 1, p.stok) } : i)
      return [...k, { produkId: p.id, nama: p.nama, harga: p.hargaJual, qty: 1 }]
    })
  }
  function kurang(produkId: string) {
    setKeranjang((k) => k.map((i) => i.produkId === produkId ? { ...i, qty: i.qty - 1 } : i).filter((i) => i.qty > 0))
  }
  const total = keranjang.reduce((s, i) => s + i.harga * i.qty, 0)

  async function submitCheckout() {
    if (!shift) { toast.error("Buka shift dulu"); return }
    if (metode === "EWALLET" && !siswa?.dompet) { toast.error("Pilih siswa dengan dompet"); return }
    setLoading(true)
    try {
      const hasil = await checkoutAction({
        outletId,
        shiftId: shift.id,
        items: keranjang.map((i) => ({ produkId: i.produkId, qty: i.qty })),
        metode,
        accountId: metode === "EWALLET" ? siswa!.dompet!.id : null,
      })
      toast.success(`Struk ${hasil.nomorStruk} — ${rupiah(hasil.total ?? 0)}`)
      setKeranjang([]); setSiswa(null); setDialog(null)
      muatProduk()
      if (shift) setRiwayat(await getRiwayatShift(shift.id))
    } catch (e) { toast.error(e instanceof Error ? e.message : "Checkout gagal") } finally { setLoading(false) }
  }

  async function submitShift() {
    setLoading(true)
    try {
      await bukaShiftAction({ outletId, saldoAwal })
      toast.success("Shift dibuka")
      setDialog(null); muatShift()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  async function submitTutup() {
    if (!shift) return
    setLoading(true)
    try {
      const hasil = await tutupShiftAction({ shiftId: shift.id, kasAkhir })
      toast.success(`Shift ditutup. Selisih kas: ${rupiah(hasil.selisih ?? 0)}`)
      setDialog(null); setShift(null); setRiwayat([])
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  if (!outlets.length) {
    return <div className="p-6"><div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Tidak ada outlet yang ditugaskan.</div></div>
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">POS E-Kantin</h1>
        <div className="flex items-center gap-2">
          <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className="rounded-md border border-gray-200 p-2 text-sm">
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
          </select>
          {shift ? (
            <Button variant="destructive" size="sm" onClick={() => { setKasAkhir(0); setDialog("tutup") }}>Tutup Shift #{shift.nomorShift}</Button>
          ) : (
            <Button size="sm" onClick={() => { setSaldoAwal(0); setDialog("shift") }}>Buka Shift</Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pos">POS</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat Shift</TabsTrigger>
          <TabsTrigger value="produk">Kelola Produk</TabsTrigger>
        </TabsList>

        <TabsContent value="pos" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3">
              {!shift && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Buka shift terlebih dahulu untuk memulai transaksi.</div>}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {produk.map((p) => (
                  <button key={p.id} disabled={!shift || p.stok <= 0} onClick={() => tambah(p)} className="rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50 disabled:opacity-40">
                    <div className="text-sm font-medium">{p.nama}</div>
                    <div className="text-xs text-muted-foreground">{rupiah(p.hargaJual)} · stok {p.stok}</div>
                  </button>
                ))}
              </div>
            </div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Keranjang</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {keranjang.length === 0 && <p className="text-sm text-muted-foreground">Kosong</p>}
                {keranjang.map((i) => (
                  <div key={i.produkId} className="flex items-center justify-between text-sm">
                    <span>{i.nama}</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => kurang(i.produkId)}>-</Button>
                      <span className="w-6 text-center">{i.qty}</span>
                      <Button size="sm" variant="outline" onClick={() => tambah({ id: i.produkId, nama: i.nama, hargaJual: i.harga, stok: 99, satuan: "", sku: null, kategori: null })}>+</Button>
                    </div>
                    <span className="font-medium">{rupiah(i.harga * i.qty)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-bold"><span>Total</span><span>{rupiah(total)}</span></div>

                {metode === "EWALLET" && (
                  <div className="space-y-2">
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari siswa (nama/NIS)..." className="w-full rounded-md border border-gray-200 p-2 text-sm" />
                    {hasilCari.map((s) => (
                      <button key={s.siswaId} onClick={() => { setSiswa(s); setQ(""); setHasilCari([]) }} className="flex w-full items-center justify-between rounded border p-2 text-left text-sm hover:bg-gray-50">
                        <span>{s.nama}</span>
                        {s.dompet ? <span className={s.dompet.status === "AKTIF" ? "text-green-600" : "text-red-600"}>{rupiah(s.dompet.saldo)}</span> : <span className="text-muted-foreground">tanpa dompet</span>}
                      </button>
                    ))}
                    {siswa && <div className="rounded bg-green-50 p-2 text-sm">Dibebankan ke: <b>{siswa.nama}</b> ({rupiah(siswa.dompet?.saldo ?? 0)})</div>}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant={metode === "EWALLET" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setMetode("EWALLET")}>E-Wallet</Button>
                  <Button variant={metode === "TUNAI" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setMetode("TUNAI")}>Tunai</Button>
                </div>
                <Button className="w-full" disabled={!shift || !keranjang.length || loading || (metode === "EWALLET" && !siswa?.dompet)} onClick={submitCheckout}>
                  {loading ? "Memproses..." : `Bayar ${rupiah(total)}`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="riwayat" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Struk</th><th className="p-3">Item</th><th className="p-3">Metode</th><th className="p-3 text-right">Total</th></tr></thead>
                <tbody>
                  {riwayat.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Buka shift untuk melihat riwayat</td></tr>}
                  {riwayat.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="p-3 font-mono text-xs">{t.nomorStruk}</td>
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

        <TabsContent value="produk" className="mt-4">
          <KelolaProduk outletId={outletId} produk={produk} onReload={muatProduk} />
        </TabsContent>
      </Tabs>

      {dialog === "shift" && (
        <Dialog open onOpenChange={() => setDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Buka Shift</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <input type="number" value={saldoAwal} onChange={(e) => setSaldoAwal(Number(e.target.value))} placeholder="Saldo awal kas (Rp)" className="w-full rounded-md border border-gray-200 p-2 text-sm" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
                <Button disabled={loading} onClick={submitShift}>{loading ? "Membuka..." : "Buka Shift"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {dialog === "tutup" && (
        <Dialog open onOpenChange={() => setDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Tutup Shift</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <input type="number" value={kasAkhir} onChange={(e) => setKasAkhir(Number(e.target.value))} placeholder="Kas fisik akhir (Rp)" className="w-full rounded-md border border-gray-200 p-2 text-sm" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
                <Button variant="destructive" disabled={loading} onClick={submitTutup}>{loading ? "Menutup..." : "Tutup Shift"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function KelolaProduk({ outletId, produk, onReload }: { outletId: string; produk: Produk[]; onReload: () => void }) {
  const [dialog, setDialog] = useState<{ mode: "tambah" | "edit" | "restock"; produk?: Produk } | null>(null)
  const [form, setForm] = useState({ nama: "", hargaJual: 0, hargaModal: 0, stok: 0, sku: "" })
  const [delta, setDelta] = useState(0)
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!dialog) return
    setLoading(true)
    try {
      if (dialog.mode === "restock" && dialog.produk) {
        await restockProdukAction({ produkId: dialog.produk.id, delta, alasan: delta > 0 ? "Restock" : "Penyesuaian" })
        toast.success("Stok diperbarui")
      } else {
        await kelolaProdukAction({
          outletId,
          produkId: dialog.produk?.id,
          nama: form.nama,
          hargaJual: form.hargaJual,
          hargaModal: form.hargaModal,
          stok: form.stok,
          sku: form.sku || undefined,
        })
        toast.success("Produk disimpan")
      }
      setDialog(null); onReload()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  return (
    <>
      <div className="mb-3"><Button size="sm" onClick={() => { setForm({ nama: "", hargaJual: 0, hargaModal: 0, stok: 0, sku: "" }); setDialog({ mode: "tambah" }) }}>+ Produk</Button></div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Nama</th><th className="p-3">SKU</th><th className="p-3 text-right">Jual</th><th className="p-3 text-right">Modal</th><th className="p-3 text-right">Stok</th><th className="p-3">Aksi</th></tr></thead>
            <tbody>
              {produk.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3">{p.nama}</td>
                  <td className="p-3 font-mono text-xs">{p.sku ?? "-"}</td>
                  <td className="p-3 text-right">{rupiah(p.hargaJual)}</td>
                  <td className="p-3 text-right text-muted-foreground">-</td>
                  <td className="p-3 text-right">{p.stok}</td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => { setForm({ nama: p.nama, hargaJual: p.hargaJual, hargaModal: 0, stok: p.stok, sku: p.sku ?? "" }); setDialog({ mode: "edit", produk: p }) }}>Edit</Button>{" "}
                    <Button size="sm" variant="outline" onClick={() => { setDelta(0); setDialog({ mode: "restock", produk: p }) }}>Stok</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {dialog && (
        <Dialog open onOpenChange={() => setDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{dialog.mode === "restock" ? `Stok — ${dialog.produk?.nama}` : dialog.mode === "edit" ? "Edit Produk" : "Produk Baru"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {dialog.mode === "restock" ? (
                <>
                  <input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} placeholder="Delta (+ masuk / - keluar)" className="w-full rounded-md border border-gray-200 p-2 text-sm" />
                  <p className="text-xs text-muted-foreground">Stok tidak boleh negatif.</p>
                </>
              ) : (
                <>
                  <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama produk" className="w-full rounded-md border border-gray-200 p-2 text-sm" />
                  <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU / barcode" className="w-full rounded-md border border-gray-200 p-2 text-sm" />
                  <input type="number" value={form.hargaJual || ""} onChange={(e) => setForm({ ...form, hargaJual: Number(e.target.value) })} placeholder="Harga jual" className="w-full rounded-md border border-gray-200 p-2 text-sm" />
                  <input type="number" value={form.hargaModal || ""} onChange={(e) => setForm({ ...form, hargaModal: Number(e.target.value) })} placeholder="Harga modal (HPP)" className="w-full rounded-md border border-gray-200 p-2 text-sm" />
                  <input type="number" value={form.stok || ""} onChange={(e) => setForm({ ...form, stok: Number(e.target.value) })} placeholder="Stok" className="w-full rounded-md border border-gray-200 p-2 text-sm" />
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
                <Button disabled={loading} onClick={submit}>{loading ? "Menyimpan..." : "Simpan"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
