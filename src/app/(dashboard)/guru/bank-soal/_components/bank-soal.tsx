"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Search, FileText, Eye, Copy, Edit, Shuffle, Filter,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { duplicateSoal, getBankSoal } from "../../actions"
import Link from "next/link"

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

interface SoalItem {
  id: string
  pertanyaan: string
  subSoal: any
  jenisSoal: string
  tingkatKesulitan: string
  poin: number
  bab: string | null
  tags: string | null
  createdAt: Date
  mataPelajaran: { nama: string }
  kategori: { nama: string } | null
}

const subCount = (s: SoalItem) => {
  if (!s.subSoal) return 0
  const arr = Array.isArray(s.subSoal) ? s.subSoal : []
  return arr.filter((a: any) => a.pertanyaan?.trim()).length
}

interface KategoriRef {
  id: string
  nama: string
}

interface MapelRef {
  id: string
  nama: string
  kode: string
  kelas: { id: string; nama: string }
}

interface PageData {
  data: SoalItem[]
  total: number
  page: number
  totalPages: number
}

export function BankSoalClient({
  data: initialData,
  kategories,
  mapels,
  searchParams,
}: {
  data: PageData
  kategories: KategoriRef[]
  mapels: MapelRef[]
  searchParams: { search: string; page: number; mataPelajaranId: string; kategoriId: string }
}) {
  const router = useRouter()
  const sp = useSearchParams()

  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState(searchParams.search)
  const [mataPelajaranId, setMataPelajaranId] = useState(searchParams.mataPelajaranId)
  const [kategoriId, setKategoriId] = useState(searchParams.kategoriId)
  const [page, setPage] = useState(searchParams.page)
  const [previewSoal, setPreviewSoal] = useState<SoalItem | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getBankSoal({ search, mataPelajaranId, kategoriId, page, limit: 20 })
      setData(result as any)
    } catch {
      toast.error("Gagal memuat bank soal")
    } finally {
      setLoading(false)
    }
  }, [search, mataPelajaranId, kategoriId, page])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateSoal(id)
      toast.success("Soal berhasil diduplikasi")
      fetchData()
    } catch {
      toast.error("Gagal menduplikasi soal")
    }
  }

  const handleRandom = () => {
    toast.success("Fitur generate soal random akan segera hadir")
  }

  const groupedByBab: Record<string, SoalItem[]> = {}
  data.data.forEach((soal) => {
    const key = soal.bab || "Tanpa Bab"
    if (!groupedByBab[key]) groupedByBab[key] = []
    groupedByBab[key].push(soal)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Bank Soal
          </h1>
          <p className="text-muted-foreground mt-1">Total {data.total} soal</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRandom}>
            <Shuffle className="h-4 w-4 mr-2" /> Random Generator
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><Filter className="h-4 w-4" /> Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari soal..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={mataPelajaranId} onValueChange={(v) => { setMataPelajaranId(v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Mata Pelajaran" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua Mapel</SelectItem>
                {mapels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kategoriId} onValueChange={(v) => { setKategoriId(v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua Kategori</SelectItem>
                {kategories.map((k) => (
                  <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : data.data.length === 0 ? (
        <div className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Bank soal kosong</p>
          <p className="text-muted-foreground mt-1">Belum ada soal yang tersimpan.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByBab).map(([bab, soals]) => (
            <div key={bab}>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {bab}
                <span className="text-sm font-normal text-muted-foreground">({soals.length} soal)</span>
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {soals.map((soal) => (
                  <Card key={soal.id} className="group hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <p className="text-sm line-clamp-3 mb-3">{soal.pertanyaan}</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        <Badge variant="secondary" className="text-[10px]">{jenisSoalLabels[soal.jenisSoal]}</Badge>
                        <Badge variant={tingkatColors[soal.tingkatKesulitan] as any} className="text-[10px]">
                          {tingkatLabels[soal.tingkatKesulitan]}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">{soal.poin} poin</Badge>
                        {subCount(soal) > 0 && (
                          <Badge variant="outline" className="text-[10px]">{subCount(soal)} sub</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{soal.mataPelajaran.nama}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewSoal(soal)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <Link href={`/guru/soal/${soal.id}`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDuplicate(soal.id)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Halaman {data.page} dari {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
              Selanjutnya
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!previewSoal} onOpenChange={(open) => !open && setPreviewSoal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Preview Soal</DialogTitle></DialogHeader>
          {previewSoal && (
            <div className="space-y-4">
              <p className="whitespace-pre-wrap">{previewSoal.pertanyaan}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Jenis</p>
                  <Badge variant="secondary">{jenisSoalLabels[previewSoal.jenisSoal]}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tingkat</p>
                  <Badge variant={tingkatColors[previewSoal.tingkatKesulitan] as any}>
                    {tingkatLabels[previewSoal.tingkatKesulitan]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mapel</p>
                  <p className="font-medium">{previewSoal.mataPelajaran.nama}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Poin</p>
                  <p className="font-medium">{previewSoal.poin}</p>
                </div>
              </div>
              {previewSoal.bab && (
                <div>
                  <p className="text-sm text-muted-foreground">Bab</p>
                  <p>{previewSoal.bab}</p>
                </div>
              )}
              {previewSoal.tags && (
                <div>
                  <p className="text-sm text-muted-foreground">Tags</p>
                  <div className="flex gap-1 mt-1">
                    {previewSoal.tags.split(",").map((tag, i) => (
                      <Badge key={i} variant="secondary">{tag.trim()}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
