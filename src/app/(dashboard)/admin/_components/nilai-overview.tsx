"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  GraduationCap,
  Search,
} from "lucide-react"
import { getRekapNilaiAdmin } from "@/app/(dashboard)/raport/actions"

interface RekapNilaiRow {
  id: string
  siswa: { id: string; nama: string; nis: string | null; nisn: string | null }
  kelas: { id: string; nama: string }
  mapel: { id: string; nama: string; kode: string }
  nilai: number | null
  predikat: string | null
  sumber: "KOMPONEN" | "UJIAN" | null
}

interface Summary {
  terisi: number
  kosong: number
  rataRata: number | null
}

interface Props {
  initialData: RekapNilaiRow[]
  initialTotal: number
  initialTotalPages: number
  initialPage: number
  initialSearch: string
  initialKelasId: string
  initialMapelId: string
  initialSemesterId: string
  initialSummary: Summary
  kelasRefs: { id: string; nama: string; tingkat: number }[]
  mapelRefs: { id: string; nama: string; kode: string; semesterId: string }[]
  semesterRefs: { id: string; nama: string; tahunAjaran: { nama: string } }[]
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t) }, [value, delay])
  return debounced
}

export function NilaiOverview(props: Props) {
  const router = useRouter()

  const [data, setData] = useState<RekapNilaiRow[]>(props.initialData)
  const [total, setTotal] = useState(props.initialTotal)
  const [totalPages, setTotalPages] = useState(props.initialTotalPages)
  const [summary, setSummary] = useState<Summary>(props.initialSummary)
  const [page, setPage] = useState(props.initialPage)
  const [kelasId, setKelasId] = useState(props.initialKelasId)
  const [mapelId, setMapelId] = useState(props.initialMapelId)
  const [semesterId, setSemesterId] = useState(props.initialSemesterId)
  const [search, setSearch] = useState(props.initialSearch)
  const debouncedSearch = useDebounce(search, 400)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getRekapNilaiAdmin({
        kelasId: kelasId || undefined,
        mapelId: mapelId || undefined,
        semesterId: semesterId || undefined,
        search: debouncedSearch || undefined,
        page,
        limit: 20,
      })
      setData(result.data)
      setTotal(result.total)
      setTotalPages(result.totalPages)
      setSummary(result.summary)
      if (result.semesterId && result.semesterId !== semesterId) setSemesterId(result.semesterId)
    } catch { toast.error("Gagal memuat data nilai") } finally { setLoading(false) }
  }, [kelasId, mapelId, semesterId, debouncedSearch, page])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const p = new URLSearchParams()
    if (kelasId) p.set("kelas", kelasId)
    if (mapelId) p.set("mapel", mapelId)
    if (semesterId) p.set("semester", semesterId)
    if (search) p.set("search", search)
    if (page > 1) p.set("page", String(page))
    router.replace(`/admin/nilai?${p.toString()}`, { scroll: false })
  }, [kelasId, mapelId, semesterId, search, page, router])

  const semesterLabel = props.semesterRefs.find((s) => s.id === semesterId)

  function eksporRekap() {
    if (!kelasId) {
      toast.error("Pilih satu kelas terlebih dahulu untuk mengekspor rekap")
      return
    }
    const p = new URLSearchParams({ kelasId })
    if (semesterId) p.set("semesterId", semesterId)
    window.open(`/api/admin/nilai/export?${p.toString()}`, "_blank")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Data Nilai</h1>
            <p className="text-sm text-muted-foreground">
              Nilai akhir yang sama dengan perhitungan raport{semesterLabel ? ` — ${semesterLabel.nama} (${semesterLabel.tahunAjaran.nama})` : ""}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={eksporRekap} disabled={loading}>
          <Download className="h-4 w-4" /> Ekspor Rekap Kelas
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Baris</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Rata-rata Nilai</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.rataRata ?? "-"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Belum Ada Nilai</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.kosong}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select value={semesterId || "all"} onValueChange={(v) => { setSemesterId(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Semester" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semester Aktif</SelectItem>
            {props.semesterRefs.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.nama} ({s.tahunAjaran.nama})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kelasId || "all"} onValueChange={(v) => { setKelasId(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {props.kelasRefs.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mapelId || "all"} onValueChange={(v) => { setMapelId(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Semua Mapel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Mapel</SelectItem>
            {props.mapelRefs.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama} ({m.kode})</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari siswa / mapel..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">No</TableHead>
              <TableHead>Nama Siswa</TableHead>
              <TableHead>NIS</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>Mapel</TableHead>
              <TableHead className="text-center">Nilai Akhir</TableHead>
              <TableHead>Predikat</TableHead>
              <TableHead>Sumber</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 8 }).map((_, ci) => <TableCell key={ci}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Belum ada nilai pada semester ini.
              </TableCell></TableRow>
            ) : (
              data.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{(page - 1) * 20 + idx + 1}</TableCell>
                  <TableCell className="font-medium">{item.siswa.nama}</TableCell>
                  <TableCell>{item.siswa.nis || "-"}</TableCell>
                  <TableCell>{item.kelas.nama}</TableCell>
                  <TableCell>{item.mapel.nama}</TableCell>
                  <TableCell className="text-center font-bold text-lg">{item.nilai ?? "-"}</TableCell>
                  <TableCell>
                    {item.predikat ? (
                      <Badge variant={
                        item.predikat === "A" ? "success" : item.predikat === "B" ? "secondary" : item.predikat === "C" ? "warning" : "destructive"
                      }>
                        {item.predikat}
                      </Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {item.sumber === "KOMPONEN" ? (
                      <Badge variant="outline">Komponen</Badge>
                    ) : item.sumber === "UJIAN" ? (
                      <Badge variant="secondary">Ujian</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Belum ada nilai</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total: {total} data</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
