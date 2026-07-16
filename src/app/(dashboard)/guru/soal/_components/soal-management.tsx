"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, Edit, Trash2, Upload, Download, FileSpreadsheet, Eye, Copy, FileText, Loader2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { getSoals, deleteSoal, duplicateSoal, getGuruMapelRefs } from "../../actions"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

const jenisSoalLabels: Record<string, string> = {
  PILIHAN_GANDA: "Pilihan Ganda",
  ESSAY: "Essay",
  TRUE_FALSE: "Benar/Salah",
  MATCHING: "Menjodohkan",
  ISIAN_SINGKAT: "Isian Singkat",
}

const tingkatLabels: Record<string, string> = {
  MUDAH: "Mudah",
  SEDANG: "Sedang",
  SULIT: "Sulit",
}

const tingkatColors: Record<string, string> = {
  MUDAH: "success",
  SEDANG: "warning",
  SULIT: "destructive",
}

interface SoalData {
  id: string
  pertanyaan: string
  jenisSoal: string
  tingkatKesulitan: string
  poin: number
  bab: string | null
  createdAt: Date
  mataPelajaran: { nama: string; kode: string }
}

interface MapelRef {
  id: string
  nama: string
  kode: string
  kelas: { id: string; nama: string }
}

interface OcrSoal {
  nomor: number
  jenis?: string
  pertanyaan: string
  options?: { label: string; value: string }[]
  jawaban?: string
}

export function SoalManagementClient() {
  const router = useRouter()
  const [data, setData] = useState<SoalData[]>([])
  const [mapels, setMapels] = useState<MapelRef[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [jenisSoal, setJenisSoal] = useState("")
  const [tingkatKesulitan, setTingkatKesulitan] = useState("")
  const [mataPelajaranId, setMataPelajaranId] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [previewSoal, setPreviewSoal] = useState<SoalData | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResults, setOcrResults] = useState<OcrSoal[] | null>(null)
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importResults, setImportResults] = useState<{ pertanyaan: string; jawaban?: string }[] | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  const ocrInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const limit = 10

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [result, mapelData] = await Promise.all([
        getSoals({ search, jenisSoal, tingkatKesulitan, mataPelajaranId, page, limit }),
        getGuruMapelRefs(),
      ])
      setData(result.data as any)
      setTotal(result.total)
      setTotalPages(result.totalPages)
      setMapels(mapelData as any)
    } catch {
      toast.error("Gagal memuat data soal")
    } finally {
      setLoading(false)
    }
  }, [search, jenisSoal, tingkatKesulitan, mataPelajaranId, page])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus soal ini?")) return
    try {
      await deleteSoal(id)
      toast.success("Soal berhasil dihapus")
      fetchData()
    } catch {
      toast.error("Gagal menghapus soal")
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateSoal(id)
      toast.success("Soal berhasil diduplikasi")
      fetchData()
    } catch {
      toast.error("Gagal menduplikasi soal")
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch("/api/export?type=soal")
      if (!res.ok) throw new Error("Gagal mengekspor data")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `soal_${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Ekspor berhasil")
    } catch {
      toast.error("Gagal mengekspor data")
    }
  }

  const handleImportClick = () => {
    importInputRef.current?.click()
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true)
    try {
      const text = await file.text()
      const lines = text.split("\n").filter(Boolean)
      if (lines.length < 2) { toast.error("File CSV tidak valid"); return }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
      const pertanyaanIdx = headers.findIndex((h) => h.includes("pertanyaan") || h.includes("soal"))
      const jawabanIdx = headers.findIndex((h) => h.includes("jawaban"))
      if (pertanyaanIdx === -1) { toast.error("Format CSV tidak sesuai. Kolom 'pertanyaan' diperlukan"); return }
      const parsed = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim())
        return {
          pertanyaan: cols[pertanyaanIdx] || "",
          jawaban: jawabanIdx >= 0 ? cols[jawabanIdx] || undefined : undefined,
        }
      }).filter((p) => p.pertanyaan)
      if (parsed.length === 0) { toast.error("Tidak ada data yang bisa diimpor"); return }
      setImportResults(parsed)
      setImportDialogOpen(true)
      toast.success(`${parsed.length} soal berhasil dibaca dari file`)
    } catch {
      toast.error("Gagal membaca file. Pastikan format CSV.")
    } finally {
      setImportLoading(false)
      if (e.target) e.target.value = ""
    }
  }

  const handleOcrClick = () => {
    ocrInputRef.current?.click()
  }

  const handleOcrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/ocr", { method: "POST", body: formData })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error || "OCR gagal"); return }
      if (!result.soal || result.soal.length === 0) { toast.error("Tidak ada soal terdeteksi dari gambar"); return }
      setOcrResults(result.soal)
      setOcrDialogOpen(true)
      toast.success(`${result.soal.length} soal berhasil dideteksi`)
    } catch {
      toast.error("Gagal memproses OCR")
    } finally {
      setOcrLoading(false)
      if (e.target) e.target.value = ""
    }
  }

  return (
    <div className="space-y-6">
      <input type="file" ref={ocrInputRef} accept="image/*" className="hidden" onChange={handleOcrFile} />
      <input type="file" ref={importInputRef} accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Kelola Soal
          </h1>
          <p className="text-muted-foreground mt-1">Total {total} soal</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleOcrClick} disabled={ocrLoading} size="sm" className="sm:hidden p-2" title="OCR Kamera">
            {ocrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={handleOcrClick} disabled={ocrLoading} className="hidden sm:inline-flex">
            {ocrLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            OCR
          </Button>
          <Button variant="outline" onClick={handleImportClick} disabled={importLoading} size="sm" className="sm:hidden p-2" title="Import Excel">
            {importLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={handleImportClick} disabled={importLoading} className="hidden sm:inline-flex">
            {importLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            Import Excel
          </Button>
          <Button variant="outline" onClick={handleExport} size="sm" className="sm:hidden p-2" title="Export">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleExport} className="hidden sm:inline-flex">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button asChild size="sm" className="sm:hidden p-2" title="Tambah Soal">
            <Link href="/guru/soal/new">
              <Plus className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/guru/soal/new">
              <Plus className="h-4 w-4 mr-2" /> Tambah Soal
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filter Pencarian</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari soal..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={jenisSoal} onValueChange={(v) => { setJenisSoal(v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Jenis Soal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua Jenis</SelectItem>
                {Object.entries(jenisSoalLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tingkatKesulitan} onValueChange={(v) => { setTingkatKesulitan(v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Tingkat Kesulitan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua Tingkat</SelectItem>
                {Object.entries(tingkatLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mataPelajaranId} onValueChange={(v) => { setMataPelajaranId(v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Mata Pelajaran" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua Mapel</SelectItem>
                {mapels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Belum ada soal</p>
              <p className="text-muted-foreground mt-1">Buat soal baru untuk memulai.</p>
              <Button asChild className="mt-4">
                <Link href="/guru/soal/new">
                  <Plus className="h-4 w-4 mr-2" /> Tambah Soal
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">No</TableHead>
                  <TableHead>Pertanyaan</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Tingkat</TableHead>
                  <TableHead>Mapel</TableHead>
                  <TableHead className="text-center">Poin</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((soal, idx) => (
                  <TableRow key={soal.id}>
                    <TableCell>{(page - 1) * limit + idx + 1}</TableCell>
                    <TableCell className="max-w-xs truncate">{soal.pertanyaan}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{jenisSoalLabels[soal.jenisSoal] || soal.jenisSoal}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tingkatColors[soal.tingkatKesulitan] as any}>
                        {tingkatLabels[soal.tingkatKesulitan] || soal.tingkatKesulitan}
                      </Badge>
                    </TableCell>
                    <TableCell>{soal.mataPelajaran.nama}</TableCell>
                    <TableCell className="text-center font-medium">{soal.poin}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setPreviewSoal(soal)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDuplicate(soal.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/guru/soal/${soal.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(soal.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Halaman {page} dari {totalPages} (total {total} soal)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Selanjutnya
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!previewSoal} onOpenChange={(open) => !open && setPreviewSoal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Soal</DialogTitle>
          </DialogHeader>
          {previewSoal && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Pertanyaan</p>
                <p className="mt-1 whitespace-pre-wrap">{previewSoal.pertanyaan}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Jenis</p>
                  <Badge variant="secondary" className="mt-1">{jenisSoalLabels[previewSoal.jenisSoal]}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tingkat</p>
                  <Badge variant={tingkatColors[previewSoal.tingkatKesulitan] as any} className="mt-1">
                    {tingkatLabels[previewSoal.tingkatKesulitan]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mata Pelajaran</p>
                  <p className="mt-1 font-medium">{previewSoal.mataPelajaran.nama}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Poin</p>
                  <p className="mt-1 font-medium">{previewSoal.poin}</p>
                </div>
              </div>
              {previewSoal.bab && (
                <div>
                  <p className="text-sm text-muted-foreground">Bab</p>
                  <p className="mt-1">{previewSoal.bab}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={ocrDialogOpen} onOpenChange={setOcrDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hasil OCR ({ocrResults?.length || 0} soal terdeteksi)</DialogTitle>
          </DialogHeader>
          {ocrResults && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Soal berikut terdeteksi dari gambar. Silakan review dan buat soal secara manual.
              </p>
              {ocrResults.map((soal, i) => (
                <div key={i} className="rounded-xl border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Soal {soal.nomor}</Badge>
                    {soal.jenis && <Badge variant="outline">{soal.jenis}</Badge>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{soal.pertanyaan}</p>
                  {soal.options && soal.options.length > 0 && (
                    <div className="space-y-1 pl-4">
                      {soal.options.map((opt, oi) => (
                        <p key={oi} className="text-sm text-muted-foreground">
                          {opt.label}. {opt.value}
                        </p>
                      ))}
                    </div>
                  )}
                  {soal.jawaban && (
                    <p className="text-sm font-medium text-green-600">Kunci: {soal.jawaban}</p>
                  )}
                </div>
              ))}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setOcrDialogOpen(false)}>Tutup</Button>
                <Button onClick={() => { setOcrDialogOpen(false); router.push("/guru/soal/new") }}>
                  <Plus className="h-4 w-4 mr-1" /> Buat Soal Baru
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hasil Import ({importResults?.length || 0} soal)</DialogTitle>
          </DialogHeader>
          {importResults && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Soal berikut berhasil dibaca dari file CSV. Silakan review dan buat soal secara manual.
              </p>
              <div className="space-y-2">
                {importResults.map((item, i) => (
                  <div key={i} className="rounded-xl border p-3">
                    <p className="text-sm font-medium">Soal {i + 1}</p>
                    <p className="text-sm mt-1">{item.pertanyaan}</p>
                    {item.jawaban && (
                      <p className="text-sm text-green-600 mt-1">Kunci: {item.jawaban}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Tutup</Button>
                <Button onClick={() => { setImportDialogOpen(false); router.push("/guru/soal/new") }}>
                  <Plus className="h-4 w-4 mr-1" /> Buat Soal Baru
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
