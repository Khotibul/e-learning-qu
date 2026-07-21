"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClipboardList, Calendar, Plus, Trash2, Loader2, ShieldCheck } from "lucide-react"
import {
  getSekretarisPiket, getSekretarisSiswa,
  createSekretarisPiket, deleteSekretarisPiket,
  getSekretarisJadwalPelajaran, getSekretarisMapel,
  createSekretarisJadwalPelajaran, deleteSekretarisJadwalPelajaran,
} from "../actions"

const hariList = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

export default function SekretarisPage() {
  const [loading, setLoading] = useState(true)
  const [isSekretaris, setIsSekretaris] = useState(true)
  const [piketList, setPiketList] = useState<any[]>([])
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [jpList, setJpList] = useState<any[]>([])
  const [mapelList, setMapelList] = useState<any[]>([])
  const [piketDialog, setPiketDialog] = useState(false)
  const [jpDialog, setJpDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [piketSiswaId, setPiketSiswaId] = useState("")
  const [piketHari, setPiketHari] = useState("")
  const [jpMapelId, setJpMapelId] = useState("")
  const [jpHari, setJpHari] = useState("")
  const [jpJamMulai, setJpJamMulai] = useState("")
  const [jpJamSelesai, setJpJamSelesai] = useState("")

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [piket, siswa, jp, mapel] = await Promise.all([
        getSekretarisPiket().catch(() => { setIsSekretaris(false); return [] }),
        getSekretarisSiswa().catch(() => []),
        getSekretarisJadwalPelajaran().catch(() => []),
        getSekretarisMapel().catch(() => []),
      ])
      setPiketList(piket as any[])
      setSiswaList(siswa as any[])
      setJpList(jp as any[])
      setMapelList(mapel as any[])
    } catch { toast.error("Gagal memuat data") }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const handleAddPiket = async () => {
    if (!piketSiswaId || !piketHari) { toast.error("Pilih siswa dan hari"); return }
    setSaving(true)
    try {
      await createSekretarisPiket(piketSiswaId, piketHari)
      toast.success("Piket ditambahkan")
      setPiketDialog(false); setPiketSiswaId(""); setPiketHari("")
      fetchAll()
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeletePiket = async (id: string) => {
    try { await deleteSekretarisPiket(id); fetchAll() }
    catch { toast.error("Gagal hapus piket") }
  }

  const handleAddJp = async () => {
    if (!jpMapelId || !jpHari || !jpJamMulai || !jpJamSelesai) { toast.error("Semua field harus diisi"); return }
    setSaving(true)
    try {
      await createSekretarisJadwalPelajaran({ mataPelajaranId: jpMapelId, hari: jpHari, jamMulai: jpJamMulai, jamSelesai: jpJamSelesai })
      toast.success("Jadwal pelajaran ditambahkan")
      setJpDialog(false); setJpMapelId(""); setJpHari(""); setJpJamMulai(""); setJpJamSelesai("")
      fetchAll()
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setSaving(false) }
  }

  const handleDeleteJp = async (id: string) => {
    try { await deleteSekretarisJadwalPelajaran(id); fetchAll() }
    catch { toast.error("Gagal hapus jadwal pelajaran") }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (!isSekretaris) return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card><CardContent className="p-12 text-center"><ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Akses Terbatas</p>
        <p className="text-muted-foreground mt-1">Halaman ini hanya untuk siswa dengan jabatan Sekretaris.</p>
      </CardContent></Card>
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          Manajemen Kelas
        </h1>
        <p className="text-muted-foreground mt-1">Kelola jadwal piket dan jadwal pelajaran sebagai sekretaris</p>
      </div>

      <Tabs defaultValue="piket">
        <TabsList>
          <TabsTrigger value="piket"><ClipboardList className="h-4 w-4 mr-1" /> Jadwal Piket</TabsTrigger>
          <TabsTrigger value="jadwal"><Calendar className="h-4 w-4 mr-1" /> Jadwal Pelajaran</TabsTrigger>
        </TabsList>

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
                        {siswaList.map((s) => (
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
            <CardHeader><CardTitle className="text-lg">Jadwal Piket Kelas</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Hari</th>
                  <th className="text-left p-3 font-medium">Siswa</th>
                  <th className="text-right p-3 font-medium w-16">Aksi</th>
                </tr></thead>
                <tbody>
                  {piketList.length === 0 ? (
                    <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Belum ada jadwal piket</td></tr>
                  ) : (
                    hariList.map((hari) => {
                      const items = piketList.filter((p) => p.hari === hari)
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

        <TabsContent value="jadwal" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={jpDialog} onOpenChange={setJpDialog}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Tambah Jadwal</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Tambah Jadwal Pelajaran</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Mata Pelajaran</Label>
                    <Select value={jpMapelId} onValueChange={setJpMapelId}>
                      <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
                      <SelectContent>{mapelList.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Hari</Label>
                    <Select value={jpHari} onValueChange={setJpHari}>
                      <SelectTrigger><SelectValue placeholder="Pilih hari" /></SelectTrigger>
                      <SelectContent>{hariList.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Jam Mulai</Label><Input type="time" value={jpJamMulai} onChange={(e) => setJpJamMulai(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Jam Selesai</Label><Input type="time" value={jpJamSelesai} onChange={(e) => setJpJamSelesai(e.target.value)} /></div>
                  </div>
                  <Button onClick={handleAddJp} disabled={saving} className="w-full">
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {hariList.map((hari) => {
              const items = jpList.filter((j) => j.hari === hari)
              return (
                <Card key={hari} className={items.length === 0 ? "opacity-50" : ""}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-center">{hari}</CardTitle></CardHeader>
                  <CardContent>
                    {items.length === 0 ? (
                      <p className="text-xs text-center text-muted-foreground py-4">Tidak ada</p>
                    ) : (
                      <div className="space-y-2">
                        {items.map((j) => (
                          <div key={j.id} className="rounded-lg border p-2 text-center relative group">
                            <Button variant="ghost" size="icon" className="absolute -top-1.5 -right-1.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteJp(j.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                            <p className="text-xs font-medium">{j.mataPelajaran?.nama}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {j.jamMulai?.slice(0, 5)} - {j.jamSelesai?.slice(0, 5)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
