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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, ClipboardList, Wallet, Trash2, Plus, Loader2, ShieldCheck } from "lucide-react"
import {
  getWaliKelasInfo, updateSiswaJabatan,
  getJadwalPiket, createJadwalPiket, deleteJadwalPiket,
  getIuran, createIuran, deleteIuran, recordPembayaranIuran,
} from "../actions"

const jabatanLabels: Record<string, string> = {
  KETUA: "Ketua Kelas", WAKIL: "Wakil Ketua",
  BENDAHARA: "Bendahara", SEKRETARIS: "Sekretaris",
}
const jabatanColors: Record<string, string> = {
  KETUA: "bg-blue-100 text-blue-700", WAKIL: "bg-indigo-100 text-indigo-700",
  BENDAHARA: "bg-emerald-100 text-emerald-700", SEKRETARIS: "bg-amber-100 text-amber-700",
}
const hariList = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

export default function WaliKelasPage() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKelas, setSelectedKelas] = useState<any>(null)
  const [jadwalPiket, setJadwalPiket] = useState<any[]>([])
  const [iuranList, setIuranList] = useState<any[]>([])
  const [piketDialog, setPiketDialog] = useState(false)
  const [iuranDialog, setIuranDialog] = useState(false)
  const [bayarDialog, setBayarDialog] = useState<{ iuranId: string; siswaId: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [piketSiswaId, setPiketSiswaId] = useState("")
  const [piketHari, setPiketHari] = useState("")
  const [iuranNama, setIuranNama] = useState("")
  const [iuranNominal, setIuranNominal] = useState("")
  const [iuranTenggat, setIuranTenggat] = useState("")
  const [iuranDeskripsi, setIuranDeskripsi] = useState("")

  const fetchData = async () => {
    try {
      const k = await getWaliKelasInfo()
      setKelasList(k as any[])
    } catch { toast.error("Gagal memuat data") }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const loadKelas = async (k: any) => {
    setSelectedKelas(k)
    try {
      const [piket, iuran] = await Promise.all([
        getJadwalPiket(k.id),
        getIuran(k.id),
      ])
      setJadwalPiket(piket as any[])
      setIuranList(iuran as any[])
    } catch { toast.error("Gagal memuat detail kelas") }
  }

  const handleJabatan = async (siswaId: string, jabatan: string) => {
    try {
      await updateSiswaJabatan(siswaId, jabatan || null)
      toast.success("Jabatan diperbarui")
      fetchData().then(() => selectedKelas && loadKelas(selectedKelas))
    } catch { toast.error("Gagal update jabatan") }
  }

  const handleAddPiket = async () => {
    if (!piketSiswaId || !piketHari) { toast.error("Pilih siswa dan hari"); return }
    setSaving(true)
    try {
      await createJadwalPiket(selectedKelas.id, piketSiswaId, piketHari)
      toast.success("Piket ditambahkan")
      setPiketDialog(false); setPiketSiswaId(""); setPiketHari("")
      loadKelas(selectedKelas)
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeletePiket = async (id: string) => {
    try { await deleteJadwalPiket(id); loadKelas(selectedKelas) }
    catch { toast.error("Gagal hapus piket") }
  }

  const handleAddIuran = async () => {
    if (!iuranNama || !iuranNominal) { toast.error("Nama dan nominal harus diisi"); return }
    setSaving(true)
    try {
      await createIuran({ kelasId: selectedKelas.id, nama: iuranNama, nominal: Number(iuranNominal), tenggat: iuranTenggat || undefined, deskripsi: iuranDeskripsi || undefined })
      toast.success("Iuran ditambahkan")
      setIuranDialog(false); setIuranNama(""); setIuranNominal(""); setIuranTenggat(""); setIuranDeskripsi("")
      loadKelas(selectedKelas)
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeleteIuran = async (id: string) => {
    try { await deleteIuran(id); loadKelas(selectedKelas) }
    catch { toast.error("Gagal hapus iuran") }
  }

  const handleBayar = async (iuranId: string, siswaId: string) => {
    try {
      const iuran = iuranList.find((i) => i.id === iuranId)
      await recordPembayaranIuran(iuranId, siswaId, iuran?.nominal || 0)
      toast.success("Pembayaran dicatat")
      setBayarDialog(null)
      loadKelas(selectedKelas)
    } catch { toast.error("Gagal") }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  if (kelasList.length === 0) return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card><CardContent className="p-12 text-center"><ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Anda belum menjadi wali kelas</p>
        <p className="text-muted-foreground mt-1">Admin harus menetapkan Anda sebagai wali kelas di menu Kelas.</p>
      </CardContent></Card>
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 p-4 sm:p-6">
      <div><h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"><ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />Wali Kelas</h1>
        <p className="text-muted-foreground mt-1">Kelola kelas yang Anda ampu sebagai wali kelas</p>
      </div>

      {!selectedKelas ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kelasList.map((k) => (
            <Card key={k.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => loadKelas(k)}>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />{k.nama}</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{k._count.siswas} siswa</p></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedKelas(null)}>&larr; Kembali</Button>
            <h2 className="text-xl font-bold">{selectedKelas.nama}</h2>
            <Badge variant="secondary">{selectedKelas._count?.siswas || selectedKelas.siswas?.length || 0} siswa</Badge>
          </div>

          <Tabs defaultValue="struktur">
            <TabsList>
              <TabsTrigger value="struktur"><Users className="h-4 w-4 mr-1" /> Struktur</TabsTrigger>
              <TabsTrigger value="piket"><ClipboardList className="h-4 w-4 mr-1" /> Jadwal Piket</TabsTrigger>
              <TabsTrigger value="iuran"><Wallet className="h-4 w-4 mr-1" /> Iuran</TabsTrigger>
            </TabsList>

            <TabsContent value="struktur" className="space-y-4 mt-4">
              <Card>
                <CardHeader><CardTitle className="text-lg">Struktur Kelas</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {["KETUA", "WAKIL", "SEKRETARIS", "BENDAHARA"].map((pos) => {
                      const siswa = selectedKelas.siswas?.find((s: any) => s.jabatan === pos)
                      return (
                        <Card key={pos} className="border-primary/20">
                          <CardContent className="p-4 text-center">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{jabatanLabels[pos]}</p>
                            <p className="font-semibold mt-1">{siswa?.nama || <span className="text-muted-foreground italic">Kosong</span>}</p>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Atur Jabatan Siswa</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedKelas.siswas?.filter((s: any) => !s.deletedAt).map((siswa: any) => (
                      <div key={siswa.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
                        <span className="text-sm font-medium">{siswa.nama}</span>
                        <Select value={siswa.jabatan || "none"} onValueChange={(v) => handleJabatan(siswa.id, v === "none" ? "" : v)}>
                          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Tidak ada" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Tidak ada</SelectItem>
                            <SelectItem value="KETUA">Ketua Kelas</SelectItem>
                            <SelectItem value="WAKIL">Wakil Ketua</SelectItem>
                            <SelectItem value="BENDAHARA">Bendahara</SelectItem>
                            <SelectItem value="SEKRETARIS">Sekretaris</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="piket" className="space-y-4 mt-4">
              <div className="flex justify-end">
                <Dialog open={piketDialog} onOpenChange={setPiketDialog}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Tambah Piket</Button></DialogTrigger>
                  <DialogContent><DialogHeader><DialogTitle>Tambah Jadwal Piket</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Siswa</Label>
                        <Select value={piketSiswaId} onValueChange={setPiketSiswaId}>
                          <SelectTrigger><SelectValue placeholder="Pilih siswa" /></SelectTrigger>
                          <SelectContent>
                            {selectedKelas.siswas?.filter((s: any) => !s.deletedAt).map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Hari</Label>
                        <Select value={piketHari} onValueChange={setPiketHari}>
                          <SelectTrigger><SelectValue placeholder="Pilih hari" /></SelectTrigger>
                          <SelectContent>{hariList.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleAddPiket} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Hari</th>
                      <th className="text-left p-3 font-medium">Siswa</th>
                      <th className="text-right p-3 font-medium w-16">Aksi</th>
                    </tr></thead>
                    <tbody>
                      {jadwalPiket.length === 0 ? (
                        <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Belum ada jadwal piket</td></tr>
                      ) : (
                        hariList.map((hari) => {
                          const items = jadwalPiket.filter((p) => p.hari === hari)
                          return items.length > 0 ? items.map((p, i) => (
                            <tr key={p.id} className={i === 0 ? "border-t" : ""}>
                              {i === 0 && <td className="p-3 font-medium align-top" rowSpan={items.length}>{hari}</td>}
                              <td className="p-3">{p.siswa.nama}</td>
                              <td className="p-3 text-right">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeletePiket(p.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </td>
                            </tr>
                          )) : null
                        })
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="iuran" className="space-y-4 mt-4">
              <div className="flex justify-end">
                <Dialog open={iuranDialog} onOpenChange={setIuranDialog}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Tambah Iuran</Button></DialogTrigger>
                  <DialogContent><DialogHeader><DialogTitle>Tambah Iuran Kelas</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Nama Iuran</Label>
                        <Input value={iuranNama} onChange={(e) => setIuranNama(e.target.value)} placeholder="Contoh: Iuran Seragam" /></div>
                      <div className="space-y-2"><Label>Nominal (Rp)</Label>
                        <Input type="number" value={iuranNominal} onChange={(e) => setIuranNominal(e.target.value)} /></div>
                      <div className="space-y-2"><Label>Tenggat (opsional)</Label>
                        <Input type="date" value={iuranTenggat} onChange={(e) => setIuranTenggat(e.target.value)} /></div>
                      <div className="space-y-2"><Label>Deskripsi (opsional)</Label>
                        <Textarea value={iuranDeskripsi} onChange={(e) => setIuranDeskripsi(e.target.value)} rows={2} /></div>
                      <Button onClick={handleAddIuran} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {iuranList.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada iuran</CardContent></Card>
              ) : iuranList.map((iuran) => {
                const totalSiswa = selectedKelas.siswas?.filter((s: any) => !s.deletedAt).length || 0
                const sudahBayar = iuran._count?.pembayaran || 0
                return (
                  <Card key={iuran.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div><CardTitle className="text-base">{iuran.nama}</CardTitle>
                          <p className="text-xs text-muted-foreground">Rp {iuran.nominal.toLocaleString("id-ID")} per siswa
                            {iuran.tenggat && ` · Tenggat: ${new Date(iuran.tenggat).toLocaleDateString("id-ID")}`}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteIuran(iuran.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-2">{sudahBayar}/{totalSiswa} sudah bayar</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {iuran.pembayaran?.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5">
                            <span>{p.siswa.nama}</span>
                            <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                          </div>
                        ))}
                        {selectedKelas.siswas?.filter((s: any) => !s.deletedAt && !iuran.pembayaran?.find((p: any) => p.siswaId === s.id)).map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-1.5 border">
                            <span>{s.nama}</span>
                            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleBayar(iuran.id, s.id)}>
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
          </Tabs>
        </>
      )}
    </motion.div>
  )
}
