"use client"

import { useEffect, useState, useRef } from "react"
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
import {
  Gavel, Plus, Trash2, Loader2, Pencil, Camera, ImagePlus, BarChart3, X,
} from "lucide-react"
import {
  getPelanggaranBK, createPelanggaranBK, updatePelanggaranBK, deletePelanggaranBK,
} from "../actions"
import { compressImage } from "@/lib/compress-image"

export default function PelanggaranBKPage() {
  const [data, setData] = useState<any>({ kelas: [], pelanggaran: [] })
  const [loading, setLoading] = useState(true)
  const [filterKelasId, setFilterKelasId] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [formKelasId, setFormKelasId] = useState("")
  const [siswaId, setSiswaId] = useState("")
  const [jenis, setJenis] = useState("")
  const [deskripsi, setDeskripsi] = useState("")
  const [poin, setPoin] = useState("")
  const [tindakan, setTindakan] = useState("")
  const [tanggal, setTanggal] = useState("")
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoUploading, setFotoUploading] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getPelanggaranBK()
      setData(res as any)
      setFilterKelasId("")
    } catch {
      toast.error("Gagal memuat data pelanggaran")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleFoto = (file: File | null) => {
    setFoto(file)
    if (file) {
      const reader = new FileReader()
      reader.onload = () => setFotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setFotoPreview(null)
    }
  }

  const resetForm = () => {
    setEditing(null)
    setFormKelasId("")
    setSiswaId("")
    setJenis("")
    setDeskripsi("")
    setPoin("")
    setTindakan("")
    setTanggal("")
    handleFoto(null)
    if (fotoInputRef.current) fotoInputRef.current.value = ""
    if (cameraInputRef.current) cameraInputRef.current.value = ""
  }

  const openEdit = (p: any) => {
    setEditing(p)
    setFormKelasId(p.kelasId)
    setSiswaId(p.siswaId)
    setJenis(p.jenis)
    setDeskripsi(p.deskripsi || "")
    setPoin(p.poin != null ? String(p.poin) : "")
    setTindakan(p.tindakan || "")
    setTanggal(p.tanggal ? new Date(p.tanggal).toISOString().slice(0, 10) : "")
    handleFoto(null)
    setFotoPreview(p.fotoUrl || null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formKelasId || !siswaId || !jenis) { toast.error("Pilih kelas, siswa, dan jenis pelanggaran"); return }
    setSaving(true)
    try {
      let fotoUrl: string | null = null
      if (foto) {
        setFotoUploading(true)
        const file = await compressImage(foto)
        const formData = new FormData()
        formData.append("file", file)
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
        if (!uploadRes.ok) throw new Error("Gagal upload foto")
        const { url } = await uploadRes.json()
        fotoUrl = url
      } else if (editing) {
        fotoUrl = fotoPreview || null
      }
      const payload = {
        kelasId: formKelasId,
        siswaId,
        jenis,
        deskripsi: deskripsi || undefined,
        poin: poin ? Number(poin) : undefined,
        tindakan: tindakan || undefined,
        tanggal: tanggal || undefined,
        fotoUrl: fotoUrl || undefined,
      }
      if (editing) {
        await updatePelanggaranBK(editing.id, { ...payload, fotoUrl })
        toast.success("Pelanggaran diperbarui")
      } else {
        await createPelanggaranBK(payload)
        toast.success("Pelanggaran dicatat")
      }
      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (e: any) { toast.error(e?.message || "Gagal") }
    finally { setFotoUploading(false); setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try { await deletePelanggaranBK(id); toast.success("Pelanggaran dihapus"); fetchData() }
    catch { toast.error("Gagal hapus pelanggaran") }
  }

  const filtered = filterKelasId
    ? data.pelanggaran.filter((p: any) => p.kelasId === filterKelasId)
    : data.pelanggaran

  const dialogSiswa = data.kelas.find((k: any) => k.id === formKelasId)?.siswas || []

  const stats = (() => {
    const perSiswa: Record<string, { nama: string; jumlah: number; poin: number }> = {}
    for (const p of data.pelanggaran) {
      if (!perSiswa[p.siswaId]) perSiswa[p.siswaId] = { nama: p.siswa?.nama || "?", jumlah: 0, poin: 0 }
      perSiswa[p.siswaId].jumlah++
      perSiswa[p.siswaId].poin += p.poin || 0
    }
    const ranked = Object.values(perSiswa).sort((a: any, b: any) => b.jumlah - a.jumlah || b.poin - a.poin)
    const maxCount = ranked[0]?.jumlah || 1
    const totalPoin = data.pelanggaran.reduce((s: number, p: any) => s + (p.poin || 0), 0)
    return { ranked, maxCount, totalPoin }
  })()

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Gavel className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />Pelanggaran
        </h1>
        <p className="text-muted-foreground mt-1">Bimbingan Konseling (BK/BP) — akses pelanggaran seluruh murid dari semua kelas</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="w-full sm:w-56">
          <Select value={filterKelasId} onValueChange={setFilterKelasId}>
            <SelectTrigger><SelectValue placeholder="Semua kelas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua kelas</SelectItem>
              {data.kelas.map((k: any) => (
                <SelectItem key={k.id} value={k.id}>{k.nama} ({k.siswas.length})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button size="sm" className="p-2 sm:px-3 sm:py-1" onClick={resetForm}>
              <Plus className="h-4 w-4 mr-1" /> Catat Pelanggaran
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Edit Pelanggaran" : "Catat Pelanggaran"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Kelas</Label>
                  <Select value={formKelasId} onValueChange={(v) => { setFormKelasId(v); setSiswaId("") }}>
                    <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                    <SelectContent>
                      {data.kelas.map((k: any) => (
                        <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Siswa</Label>
                  <Select value={siswaId} onValueChange={setSiswaId}>
                    <SelectTrigger><SelectValue placeholder="Pilih siswa" /></SelectTrigger>
                    <SelectContent>
                      {dialogSiswa.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Jenis Pelanggaran</Label>
                <Input value={jenis} onChange={(e) => setJenis(e.target.value)} placeholder="Contoh: Terlambat, Membuang Sampah Sembarangan" /></div>
              <div className="space-y-2"><Label>Deskripsi (opsional)</Label>
                <Textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Poin (opsional)</Label>
                  <Input type="number" value={poin} onChange={(e) => setPoin(e.target.value)} /></div>
                <div className="space-y-2"><Label>Tanggal</Label>
                  <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Tindakan (opsional)</Label>
                <Textarea value={tindakan} onChange={(e) => setTindakan(e.target.value)} rows={2} placeholder="Contoh: Teguran lisan, panggilan orang tua" /></div>
              <div className="space-y-2">
                <Label>Dokumen Foto (opsional)</Label>
                <input
                  id="bk-foto-input"
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleFoto(e.target.files?.[0] || null)}
                />
                <input
                  id="bk-foto-camera"
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => handleFoto(e.target.files?.[0] || null)}
                />
                {fotoPreview ? (
                  <div className="relative w-fit">
                    <img src={fotoPreview} alt="Dokumen pelanggaran" className="h-32 w-44 rounded-lg border object-cover" />
                    <Button
                      variant="destructive" size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={() => {
                        handleFoto(null)
                        if (fotoInputRef.current) fotoInputRef.current.value = ""
                        if (cameraInputRef.current) cameraInputRef.current.value = ""
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <label
                      htmlFor="bk-foto-input"
                      className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    >
                      <ImagePlus className="h-4 w-4 mr-1.5" /> Pilih Foto
                    </label>
                    <label
                      htmlFor="bk-foto-camera"
                      className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    >
                      <Camera className="h-4 w-4 mr-1.5" /> Ambil Foto
                    </label>
                  </div>
                )}
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {fotoUploading ? "Mengunggah foto..." : "Simpan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {data.pelanggaran.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Statistika Pelanggaran
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-lg font-bold">{data.pelanggaran.length}</p>
                <p className="text-[10px] text-muted-foreground">Total Pelanggaran</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-lg font-bold">{stats.ranked.length}</p>
                <p className="text-[10px] text-muted-foreground">Siswa Melanggar</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-lg font-bold">{stats.totalPoin}</p>
                <p className="text-[10px] text-muted-foreground">Total Poin</p>
              </div>
            </div>
            {stats.ranked.length > 0 && (
              <div className="space-y-2">
                {stats.ranked.map((s: any, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate">{i + 1}. {s.nama}</span>
                      <span className="text-muted-foreground shrink-0">{s.jumlah}x {s.poin > 0 ? `· ${s.poin} poin` : ""}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${i === 0 ? "bg-red-500" : "bg-primary/60"}`}
                        style={{ width: `${(s.jumlah / stats.maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {filterKelasId ? "Belum ada pelanggaran di kelas ini" : "Belum ada pelanggaran"}
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p: any) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-sm">{p.siswa?.nama}</CardTitle>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">{p.kelas?.nama}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{p.jenis}</Badge>
                      {p.poin != null && (
                        <Badge className="text-[10px] bg-orange-100 text-orange-700 hover:bg-orange-100">{p.poin} poin</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {p.fotoUrl && (
                  <a href={p.fotoUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={p.fotoUrl}
                      alt="Dokumen pelanggaran"
                      className="h-28 w-full rounded-md border object-cover transition hover:opacity-80"
                    />
                  </a>
                )}
                {p.deskripsi && <p className="text-muted-foreground">{p.deskripsi}</p>}
                {p.tindakan && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Tindakan: </span>
                    <span className="text-xs">{p.tindakan}</span>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">{new Date(p.tanggal).toLocaleDateString("id-ID")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  )
}
