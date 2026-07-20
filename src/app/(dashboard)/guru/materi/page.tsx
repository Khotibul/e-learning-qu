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
import { Separator } from "@/components/ui/separator"
import { BookOpen, Upload, Trash2, FileText, Loader2, Plus, Download, Link as LinkIcon } from "lucide-react"
import { getGuruMateris, getGuruMapelsWithMateri, createMateri, deleteMateri } from "../actions"

interface MateriItem {
  id: string
  judul: string
  deskripsi: string | null
  fileUrl: string
  fileType: string | null
  fileSize: number | null
  mataPelajaranId: string
  createdAt: string
  mataPelajaran: { id: string; nama: string; kelas: { nama: string } }
}

interface MapelOption {
  id: string
  nama: string
  kode: string
  kelas: { id: string; nama: string }
}

function getFileIcon(fileType: string | null) {
  const type = fileType?.toLowerCase() || ""
  if (["pdf"].includes(type)) return "📄"
  if (["doc", "docx"].includes(type)) return "📝"
  if (["xls", "xlsx", "csv"].includes(type)) return "📊"
  if (["ppt", "pptx"].includes(type)) return "📑"
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(type)) return "🖼️"
  if (["mp4", "avi", "mov", "mkv"].includes(type)) return "🎥"
  return "📁"
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function GuruMateriPage() {
  const [materis, setMateris] = useState<MateriItem[]>([])
  const [mapels, setMapels] = useState<MapelOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [selectedMapel, setSelectedMapel] = useState("")
  const [judul, setJudul] = useState("")
  const [deskripsi, setDeskripsi] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = () => {
    Promise.all([getGuruMateris(), getGuruMapelsWithMateri()])
      .then(([m, map]) => {
        setMateris(m as unknown as MateriItem[])
        setMapels(map as unknown as MapelOption[])
      })
      .catch(() => toast.error("Gagal memuat data"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const resetForm = () => {
    setSelectedMapel("")
    setJudul("")
    setDeskripsi("")
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleUpload = async () => {
    if (!selectedMapel || !judul || !file) {
      toast.error("Mapel, judul, dan file harus diisi")
      return
    }
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      if (!uploadRes.ok) throw new Error("Upload file gagal")
      const { url } = await uploadRes.json()

      const ext = file.name.split(".").pop() || ""
      await createMateri({
        judul,
        deskripsi: deskripsi || undefined,
        fileUrl: url,
        fileType: ext,
        fileSize: file.size,
        mataPelajaranId: selectedMapel,
      })
      toast.success("Materi berhasil diupload")
      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (e: any) {
      toast.error(e?.message || "Gagal upload materi")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus materi ini?")) return
    try {
      await deleteMateri(id)
      toast.success("Materi dihapus")
      fetchData()
    } catch {
      toast.error("Gagal menghapus")
    }
  }

  const groupedByMapel: Record<string, { mapel: MapelOption; items: MateriItem[] }> = {}
  for (const m of mapels) {
    groupedByMapel[m.id] = { mapel: m, items: [] }
  }
  for (const mat of materis) {
    if (groupedByMapel[mat.mataPelajaranId]) {
      groupedByMapel[mat.mataPelajaranId].items.push(mat)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 p-4 sm:p-6"
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            Materi Pembelajaran
          </h1>
          <p className="text-muted-foreground mt-1">Upload dan kelola materi pembelajaran untuk siswa</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Upload Materi
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Materi Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Mata Pelajaran</Label>
                <Select value={selectedMapel} onValueChange={setSelectedMapel}>
                  <SelectTrigger><SelectValue placeholder="Pilih Mapel" /></SelectTrigger>
                  <SelectContent>
                    {mapels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nama} ({m.kelas.nama})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="judul">Judul Materi</Label>
                <Input id="judul" value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Contoh: Bab 1 - Pengertian" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deskripsi">Deskripsi (opsional)</Label>
                <Textarea id="deskripsi" value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file && (
                  <p className="text-xs text-muted-foreground">{file.name} ({formatFileSize(file.size)})</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>Batal</Button>
                <Button onClick={handleUpload} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {Object.keys(groupedByMapel).length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Belum ada materi</p>
            <p className="text-muted-foreground mt-1">Upload materi pembelajaran pertama Anda.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedByMapel).map(([mapelId, group]) => (
          <Card key={mapelId}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {group.mapel.nama}
                <Badge variant="secondary" className="text-xs">{group.mapel.kelas.nama}</Badge>
                <Badge variant="outline" className="text-xs">{group.items.length} materi</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada materi untuk mapel ini</p>
              ) : (
                group.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="text-xl shrink-0 mt-0.5">{getFileIcon(item.fileType)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base truncate">{item.judul}</p>
                        {item.deskripsi && (
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">{item.deskripsi}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <Badge variant="secondary" className="text-[10px]">{item.fileType?.toUpperCase() || "FILE"}</Badge>
                          {item.fileSize && <span className="text-[10px] text-muted-foreground">{formatFileSize(item.fileSize)}</span>}
                          <span className="text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("id-ID")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={item.fileUrl} download target="_blank">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))
      )}
    </motion.div>
  )
}
