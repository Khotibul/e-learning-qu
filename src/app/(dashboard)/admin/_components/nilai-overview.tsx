"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { calculateGrade, formatDate } from "@/lib/utils"

import { Button } from "@/components/ui/button"
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
  GraduationCap,
} from "lucide-react"
import { getNilais } from "../actions"

interface Nilai {
  id: string
  siswaId: string
  ujianId: string | null
  mataPelajaranId: string
  semesterId: string
  nilai: number
  jenis: string
  keterangan: string | null
  createdAt: Date
  siswa: { nama: string; nis: string | null; kelas: { nama: string } | null }
  mataPelajaran: { nama: string; kode: string }
  semester: { nama: string }
}

interface Props {
  initialData: Nilai[]
  initialTotal: number
  initialTotalPages: number
  initialPage: number
  initialKelasId: string
  initialMapelId: string
  initialSemesterId: string
  kelasRefs: { id: string; nama: string; tingkat: number }[]
  mapelRefs: { id: string; nama: string; kode: string; kelas: { nama: string } }[]
  semesterRefs: { id: string; nama: string; tahunAjaran: { nama: string } }[]
}

export function NilaiOverview(props: Props) {
  const router = useRouter()

  const [data, setData] = useState<Nilai[]>(props.initialData)
  const [total, setTotal] = useState(props.initialTotal)
  const [totalPages, setTotalPages] = useState(props.initialTotalPages)
  const [page, setPage] = useState(props.initialPage)
  const [kelasId, setKelasId] = useState(props.initialKelasId)
  const [mapelId, setMapelId] = useState(props.initialMapelId)
  const [semesterId, setSemesterId] = useState(props.initialSemesterId)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getNilais({
        kelasId: kelasId || undefined,
        mapelId: mapelId || undefined,
        semesterId: semesterId || undefined,
        page,
        limit: 20,
      })
      setData(result.data as Nilai[])
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch { toast.error("Gagal memuat data nilai") } finally { setLoading(false) }
  }, [kelasId, mapelId, semesterId, page])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const p = new URLSearchParams()
    if (kelasId) p.set("kelas", kelasId)
    if (mapelId) p.set("mapel", mapelId)
    if (semesterId) p.set("semester", semesterId)
    if (page > 1) p.set("page", String(page))
    router.replace(`/admin/nilai?${p.toString()}`, { scroll: false })
  }, [kelasId, mapelId, semesterId, page, router])

  const rataRata = data.length > 0
    ? (data.reduce((sum, d) => sum + d.nilai, 0) / data.length).toFixed(1)
    : "0"

  const filteredMapelRefs = kelasId
    ? props.mapelRefs.filter((m) => m.kelas.nama === props.kelasRefs.find((k) => k.id === kelasId)?.nama)
    : props.mapelRefs

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Data Nilai</h1>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Nilai</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Rata-rata</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{rataRata}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Data Ditampilkan</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data.length}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select value={kelasId || "all"} onValueChange={(v) => { setKelasId(v === "all" ? "" : v); setPage(1); setMapelId("") }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {props.kelasRefs.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mapelId || "all"} onValueChange={(v) => { setMapelId(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Semua Mapel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Mapel</SelectItem>
            {filteredMapelRefs.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama} ({m.kode})</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={semesterId || "all"} onValueChange={(v) => { setSemesterId(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Semua Semester" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Semester</SelectItem>
            {props.semesterRefs.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.nama} ({s.tahunAjaran.nama})</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <TableHead>Semester</TableHead>
              <TableHead>Nilai</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Tanggal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 9 }).map((_, ci) => <TableCell key={ci}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                Belum ada data nilai. Pilih filter untuk menampilkan nilai.
              </TableCell></TableRow>
            ) : (
              data.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{(page - 1) * 20 + idx + 1}</TableCell>
                  <TableCell className="font-medium">{item.siswa.nama}</TableCell>
                  <TableCell>{item.siswa.nis || "-"}</TableCell>
                  <TableCell>{item.siswa.kelas?.nama || "-"}</TableCell>
                  <TableCell>{item.mataPelajaran.nama}</TableCell>
                  <TableCell>{item.semester.nama}</TableCell>
                  <TableCell className="font-bold text-lg">{item.nilai}</TableCell>
                  <TableCell>
                    <Badge variant={
                      item.nilai >= 90 ? "success" : item.nilai >= 75 ? "secondary" : item.nilai >= 60 ? "warning" : "destructive"
                    }>
                      {calculateGrade(item.nilai)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{formatDate(item.createdAt)}</TableCell>
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

