"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, Edit, Trash2, Upload, Download, FileSpreadsheet, Eye, Copy, FileText } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

  const handleImport = () => {
    toast.success("Fitur impor Excel akan segera hadir")
  }

  const handleExport = () => {
    toast.success("Fitur ekspor akan segera hadir")
  }

  const handleOCR = () => {
    toast.success("Fitur OCR akan segera hadir")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Kelola Soal
          </h1>
          <p className="text-muted-foreground mt-1">Total {total} soal</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleOCR}>
            <Upload className="h-4 w-4 mr-2" /> OCR
          </Button>
          <Button variant="outline" onClick={handleImport}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Import Excel
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button asChild>
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
          <div className="grid gap-4 md:grid-cols-4">
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
                <SelectItem value=" ">Semua Jenis</SelectItem>
                {Object.entries(jenisSoalLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tingkatKesulitan} onValueChange={(v) => { setTingkatKesulitan(v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Tingkat Kesulitan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Semua Tingkat</SelectItem>
                {Object.entries(tingkatLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mataPelajaranId} onValueChange={(v) => { setMataPelajaranId(v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Mata Pelajaran" /></SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Semua Mapel</SelectItem>
                {mapels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
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
    </div>
  )
}
