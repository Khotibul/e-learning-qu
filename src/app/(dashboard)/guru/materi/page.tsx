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
import { BookOpen, Upload, Trash2, FileText, Loader2, Plus, Download } from "lucide-react"
import { getGuruMateris, getGuruMapelsWithMateri, createMateri, deleteMateri } from "../actions"

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

export default function MateriPage() {
  const [materis, setMateris] = useState<any[]>([])
  const [mapels, setMapels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedMapel, setSelectedMapel] = useState("")
  const [judul, setJudul] = useState("")
  const [deskripsi, setDeskripsi] = useState("")
  const [konten, setKonten] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploaded, setUploaded] = useState<{ url: string; text: string | null } | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = () => {
    Promise.all([getGuruMateris(), getGuruMapelsWithMateri()])
      .then(([m, mp]) => {
        setMateris(m)
        setMapels(mp)
      })
      .catch(() => toast.error("Gagal memuat materi"))
      .finally(() => setLoading(false))
  }

  const mapelOptions = Array.from(new Map(mapels.map((m: any) => [m.id, m])).values())

  useEffect(() => {
    fetchData()
  }, [])

  const resetForm = () => {
    setSelectedMapel("")
    setJudul("")
    setDeskripsi("")
    setKonten("")
    setFile(null)
    setUploaded(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    setUploaded(null)
    if (!f) return
    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append("file", f)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      if (!uploadRes.ok) throw new Error("Upload file gagal")
      const data = await uploadRes.json()
      setUploaded({ url: data.url, text: data.text || null })
      if (data.text) {
        setKonten((prev) => (prev.trim() ? prev : data.text))
      }
    } catch {
      toast.error("Gagal mengupload file")
      setFile(null)
    } finally {
      setUploadingFile(false)
    }
  }

  const handleUpload = async () => {
    if (!selectedMapel || !judul || !uploaded?.url) {
      toast.error("Mapel, judul, dan file harus diisi")
      return
    }
    setSaving(true)
    try {
      const ext = (file?.name.split(".").pop() || uploaded.url.split(".").pop() || "").toLowerCase()
      await createMateri({
        judul,
        deskripsi: deskripsi || undefined,
        konten: konten || uploaded.text || undefined,
        fileUrl: uploaded.url,
        fileType: ext,
        fileSize: file?.size,
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

  const groupedByMapel: Record<string, { mapel: any; items: any[] }> = {}
  for (const m of materis) {
    const id = m.mataPelajaranId || "tanpa"
    if (!groupedByMapel[id]) {
      const mapelInfo = mapels.find((p) => p.id === m.mataPelajaranId) || m.mataPelajaran || { nama: "Tanpa Mapel" }
      groupedByMapel[id] = { mapel: mapelInfo, items: [] }
    }
    groupedByMapel[id].items.push(m)
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
                    {mapelOptions.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nama} ({m.kelas?.nama || "-"})
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
                <Label htmlFor="konten">Konten Teks (untuk AI Tutor)</Label>
                <Textarea
                  id="konten"
                  value={konten}
                  onChange={(e) => setKonten(e.target.value)}
                  rows={5}
                  placeholder="Tempel konten pembelajaran sebagai teks. Semakin lengkap, semakin baik jawaban AI Tutor (RAG) untuk siswa."
                />
                <p className="text-xs text-muted-foreground">
                  Jika file PDF/TXT/MD, teks diekstrak otomatis dan diisi di sini. Anda bisa mengeditnya sebelum menyimpan.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                {uploadingFile && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Mengupload file...
                  </p>
                )}
                {!uploadingFile && uploaded && (
                  <p className="text-xs text-muted-foreground">
                    {file?.name} ({formatFileSize(file?.size || 0)}) diupload.
                    {uploaded.text
                      ? ` Teks untuk AI diekstrak otomatis (${uploaded.text.length} karakter).`
                      : " Tidak ada teks yang bisa diekstrak dari file ini."}
                  </p>
                )}
                {!uploadingFile && file && !uploaded && (
                  <p className="text-xs text-muted-foreground">{file.name} ({formatFileSize(file.size)})</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>Batal</Button>
                <Button onClick={handleUpload} disabled={saving || uploadingFile || !uploaded}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : Object.keys(groupedByMapel).length === 0 ? (
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
                <Badge variant="secondary" className="text-xs">{group.mapel.kelas?.nama}</Badge>
                <Badge variant="outline" className="text-xs">{group.items.length} materi</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="text-2xl shrink-0">{getFileIcon(item.fileType)}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{item.judul}</p>
                      {item.deskripsi && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">{item.deskripsi}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="text-[10px]">{item.fileType?.toUpperCase()}</Badge>
                        {item.fileSize != null && (
                          <span className="text-[10px] text-muted-foreground">{formatFileSize(item.fileSize)}</span>
                        )}
                        <Badge className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                          {(item.konten?.length || 0)} karakter untuk AI
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={item.fileUrl} target="_blank" download><Download className="h-4 w-4" /></a>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </motion.div>
  )
}