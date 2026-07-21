"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Wallet, Banknote, Receipt, Trash2, Plus, Loader2, ShieldCheck, PiggyBank,
  TrendingUp, TrendingDown,
} from "lucide-react"
import {
  getBendaharaIuran, createBendaharaIuran, deleteBendaharaIuran, recordBendaharaPembayaranIuran,
  getBendaharaDenda, createBendaharaDenda, deleteBendaharaDenda, recordBendaharaPembayaranDenda,
  getBendaharaPengeluaran, createBendaharaPengeluaran, deleteBendaharaPengeluaran,
  getBendaharaSummary, getBendaharaSiswa,
} from "../actions"

const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`

export default function BendaharaPage() {
  const [loading, setLoading] = useState(true)
  const [isBendahara, setIsBendahara] = useState(true)
  const [iuranList, setIuranList] = useState<any[]>([])
  const [dendaList, setDendaList] = useState<any[]>([])
  const [pengeluaranList, setPengeluaranList] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [iuranDialog, setIuranDialog] = useState(false)
  const [dendaDialog, setDendaDialog] = useState(false)
  const [pengeluaranDialog, setPengeluaranDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [iuranNama, setIuranNama] = useState("")
  const [iuranNominal, setIuranNominal] = useState("")
  const [iuranTenggat, setIuranTenggat] = useState("")
  const [iuranDeskripsi, setIuranDeskripsi] = useState("")
  const [dendaNama, setDendaNama] = useState("")
  const [dendaNominal, setDendaNominal] = useState("")
  const [dendaDeskripsi, setDendaDeskripsi] = useState("")
  const [pengeluaranJumlah, setPengeluaranJumlah] = useState("")
  const [pengeluaranKeterangan, setPengeluaranKeterangan] = useState("")
  const [pengeluaranTanggal, setPengeluaranTanggal] = useState("")

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [iuran, denda, pengeluaran, summ, siswa] = await Promise.all([
        getBendaharaIuran().catch(() => { setIsBendahara(false); return [] }),
        getBendaharaDenda().catch(() => []),
        getBendaharaPengeluaran().catch(() => []),
        getBendaharaSummary().catch(() => null),
        getBendaharaSiswa().catch(() => []),
      ])
      setIuranList(iuran as any[])
      setDendaList(denda as any[])
      setPengeluaranList(pengeluaran as any[])
      setSummary(summ as any)
      setSiswaList(siswa as any[])
    } catch { toast.error("Gagal memuat data") }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const handleAddIuran = async () => {
    if (!iuranNama || !iuranNominal) { toast.error("Nama dan nominal harus diisi"); return }
    setSaving(true)
    try {
      await createBendaharaIuran({ nama: iuranNama, nominal: Number(iuranNominal), tenggat: iuranTenggat || undefined, deskripsi: iuranDeskripsi || undefined })
      toast.success("Iuran ditambahkan")
      setIuranDialog(false); setIuranNama(""); setIuranNominal(""); setIuranTenggat(""); setIuranDeskripsi("")
      fetchAll()
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeleteIuran = async (id: string) => {
    try { await deleteBendaharaIuran(id); fetchAll() }
    catch { toast.error("Gagal hapus iuran") }
  }

  const handleBayarIuran = async (iuranId: string, siswaId: string) => {
    try {
      const item = iuranList.find((i) => i.id === iuranId)
      await recordBendaharaPembayaranIuran(iuranId, siswaId, item?.nominal || 0)
      toast.success("Pembayaran dicatat"); fetchAll()
    } catch { toast.error("Gagal") }
  }

  const handleAddDenda = async () => {
    if (!dendaNama || !dendaNominal) { toast.error("Nama dan nominal harus diisi"); return }
    setSaving(true)
    try {
      await createBendaharaDenda({ nama: dendaNama, nominal: Number(dendaNominal), deskripsi: dendaDeskripsi || undefined })
      toast.success("Denda ditambahkan")
      setDendaDialog(false); setDendaNama(""); setDendaNominal(""); setDendaDeskripsi("")
      fetchAll()
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeleteDenda = async (id: string) => {
    try { await deleteBendaharaDenda(id); fetchAll() }
    catch { toast.error("Gagal hapus denda") }
  }

  const handleBayarDenda = async (dendaId: string, siswaId: string) => {
    try {
      const item = dendaList.find((d) => d.id === dendaId)
      await recordBendaharaPembayaranDenda(dendaId, siswaId, item?.nominal || 0)
      toast.success("Pembayaran denda dicatat"); fetchAll()
    } catch { toast.error("Gagal") }
  }

  const handleAddPengeluaran = async () => {
    if (!pengeluaranJumlah || !pengeluaranKeterangan) { toast.error("Jumlah dan keterangan harus diisi"); return }
    setSaving(true)
    try {
      await createBendaharaPengeluaran({ jumlah: Number(pengeluaranJumlah), keterangan: pengeluaranKeterangan, tanggal: pengeluaranTanggal || undefined })
      toast.success("Pengeluaran ditambahkan")
      setPengeluaranDialog(false); setPengeluaranJumlah(""); setPengeluaranKeterangan(""); setPengeluaranTanggal("")
      fetchAll()
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeletePengeluaran = async (id: string) => {
    try { await deleteBendaharaPengeluaran(id); fetchAll() }
    catch { toast.error("Gagal hapus pengeluaran") }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (!isBendahara) return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card><CardContent className="p-12 text-center"><ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Akses Terbatas</p>
        <p className="text-muted-foreground mt-1">Halaman ini hanya untuk siswa dengan jabatan Bendahara.</p>
      </CardContent></Card>
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-4 sm:p-6">
      <div><h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"><Wallet className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />Manajemen Kas Kelas</h1>
        <p className="text-muted-foreground mt-1">Kelola iuran, denda, dan pengeluaran kelas sebagai bendahara</p>
      </div>

      <Tabs defaultValue="kas">
        <TabsList className="flex-wrap">
          <TabsTrigger value="kas"><PiggyBank className="h-4 w-4 mr-1" /> Ringkasan Kas</TabsTrigger>
          <TabsTrigger value="iuran"><Wallet className="h-4 w-4 mr-1" /> Iuran</TabsTrigger>
          <TabsTrigger value="denda"><Banknote className="h-4 w-4 mr-1" /> Denda</TabsTrigger>
          <TabsTrigger value="pengeluaran"><Receipt className="h-4 w-4 mr-1" /> Pengeluaran</TabsTrigger>
        </TabsList>

        <TabsContent value="kas" className="space-y-4 mt-4">
          {summary ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card><CardContent className="p-5 text-center"><TrendingUp className="h-6 w-6 mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs text-muted-foreground">Pemasukan Iuran</p><p className="text-lg font-bold text-emerald-600">{formatRp(summary.pemasukanIuran)}</p></CardContent></Card>
                <Card><CardContent className="p-5 text-center"><Banknote className="h-6 w-6 mx-auto text-amber-500 mb-2" />
                  <p className="text-xs text-muted-foreground">Pemasukan Denda</p><p className="text-lg font-bold text-amber-600">{formatRp(summary.pemasukanDenda)}</p></CardContent></Card>
                <Card><CardContent className="p-5 text-center"><TrendingDown className="h-6 w-6 mx-auto text-red-500 mb-2" />
                  <p className="text-xs text-muted-foreground">Pengeluaran</p><p className="text-lg font-bold text-red-600">{formatRp(summary.totalPengeluaran)}</p></CardContent></Card>
                <Card className="border-primary"><CardContent className="p-5 text-center"><PiggyBank className="h-6 w-6 mx-auto text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">Sisa Kas</p><p className={`text-lg font-bold ${summary.sisaKas >= 0 ? "text-primary" : "text-destructive"}`}>{formatRp(summary.sisaKas)}</p></CardContent></Card>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">Detail Kas</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between py-1 border-b"><span>Total Pemasukan</span><span className="font-semibold text-emerald-600">{formatRp(summary.totalPemasukan)}</span></div>
                  <div className="flex justify-between py-1 border-b"><span>Total Pengeluaran</span><span className="font-semibold text-red-600">{formatRp(summary.totalPengeluaran)}</span></div>
                  <div className="flex justify-between py-1 text-base"><span className="font-bold">Sisa Kas</span><span className={`font-bold ${summary.sisaKas >= 0 ? "text-primary" : "text-destructive"}`}>{formatRp(summary.sisaKas)}</span></div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada data kas</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="iuran" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={iuranDialog} onOpenChange={setIuranDialog}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Tambah Iuran</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Tambah Iuran Kelas</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Nama Iuran</Label><Input value={iuranNama} onChange={(e) => setIuranNama(e.target.value)} placeholder="Contoh: Iuran Seragam" /></div>
                  <div className="space-y-2"><Label>Nominal (Rp)</Label><Input type="number" value={iuranNominal} onChange={(e) => setIuranNominal(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Tenggat (opsional)</Label><Input type="date" value={iuranTenggat} onChange={(e) => setIuranTenggat(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Deskripsi (opsional)</Label><Textarea value={iuranDeskripsi} onChange={(e) => setIuranDeskripsi(e.target.value)} rows={2} /></div>
                  <Button onClick={handleAddIuran} disabled={saving} className="w-full">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {iuranList.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada iuran</CardContent></Card>
          ) : iuranList.map((iuran) => {
            const sudahBayar = iuran._count?.pembayaran || 0
            return (
              <Card key={iuran.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div><CardTitle className="text-base">{iuran.nama}</CardTitle>
                      <p className="text-xs text-muted-foreground">{formatRp(iuran.nominal)} per siswa
                        {iuran.tenggat && ` · Tenggat: ${new Date(iuran.tenggat).toLocaleDateString("id-ID")}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteIuran(iuran.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-2">{sudahBayar}/{siswaList.length} sudah bayar</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {iuran.pembayaran?.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5">
                        <span>{p.siswa.nama}</span>
                        <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                      </div>
                    ))}
                    {siswaList.filter((s) => !iuran.pembayaran?.find((p: any) => p.siswaId === s.id)).map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-1.5 border">
                        <span>{s.nama}</span>
                        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleBayarIuran(iuran.id, s.id)}>
                          Catat Bayar
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="denda" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={dendaDialog} onOpenChange={setDendaDialog}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Tambah Denda</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Tambah Denda</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Nama Denda</Label><Input value={dendaNama} onChange={(e) => setDendaNama(e.target.value)} placeholder="Contoh: Denda Terlambat" /></div>
                  <div className="space-y-2"><Label>Nominal (Rp)</Label><Input type="number" value={dendaNominal} onChange={(e) => setDendaNominal(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Deskripsi (opsional)</Label><Textarea value={dendaDeskripsi} onChange={(e) => setDendaDeskripsi(e.target.value)} rows={2} /></div>
                  <Button onClick={handleAddDenda} disabled={saving} className="w-full">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {dendaList.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada denda</CardContent></Card>
          ) : dendaList.map((denda) => (
            <Card key={denda.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div><CardTitle className="text-base">{denda.nama}</CardTitle>
                    <p className="text-xs text-muted-foreground">{formatRp(denda.nominal)} per siswa
                      {denda.deskripsi && ` · ${denda.deskripsi}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteDenda(denda.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">{denda._count?.pembayaran || 0}/{siswaList.length} sudah bayar</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {denda.pembayaran?.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5">
                      <span>{p.siswa.nama}</span>
                      <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                    </div>
                  ))}
                  {siswaList.filter((s) => !denda.pembayaran?.find((p: any) => p.siswaId === s.id)).map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-1.5 border">
                      <span>{s.nama}</span>
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleBayarDenda(denda.id, s.id)}>
                        Catat Bayar
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="pengeluaran" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={pengeluaranDialog} onOpenChange={setPengeluaranDialog}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Tambah Pengeluaran</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Tambah Pengeluaran</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Jumlah (Rp)</Label><Input type="number" value={pengeluaranJumlah} onChange={(e) => setPengeluaranJumlah(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Keterangan</Label><Input value={pengeluaranKeterangan} onChange={(e) => setPengeluaranKeterangan(e.target.value)} placeholder="Contoh: Beli alat kebersihan" /></div>
                  <div className="space-y-2"><Label>Tanggal (opsional)</Label><Input type="date" value={pengeluaranTanggal} onChange={(e) => setPengeluaranTanggal(e.target.value)} /></div>
                  <Button onClick={handleAddPengeluaran} disabled={saving} className="w-full">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {pengeluaranList.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada pengeluaran</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Tanggal</th>
                    <th className="text-left p-3 font-medium">Keterangan</th>
                    <th className="text-right p-3 font-medium">Jumlah</th>
                    <th className="text-right p-3 font-medium w-16">Aksi</th>
                  </tr></thead>
                  <tbody>
                    {pengeluaranList.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-3 text-xs">{new Date(p.tanggal).toLocaleDateString("id-ID")}</td>
                        <td className="p-3">{p.keterangan}</td>
                        <td className="p-3 text-right font-medium text-red-600">{formatRp(p.jumlah)}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeletePengeluaran(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
