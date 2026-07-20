"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, Edit, Trash2, Copy, ClipboardList, Play, Square } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getUjians, deleteUjian, duplicateUjian, startUjian, stopUjian } from "../../actions"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  AKTIF: "Aktif",
  SELESAI: "Selesai",
}

const statusColors: Record<string, string> = {
  DRAFT: "secondary",
  AKTIF: "success",
  SELESAI: "info",
}

interface UjianItem {
  id: string
  nama: string
  status: string
  mode: string
  durasi: number
  tanggal: Date
  jamMulai: Date
  jamSelesai: Date
  createdAt: Date
  mataPelajaran: { nama: string }
  kelas: { nama: string }
  _count: { ujianSoal: number }
}

const modeLabels: Record<string, string> = {
  manual: "Manual",
  otomatis: "Otomatis",
}

export function UjianManagementClient() {
  const router = useRouter()
  const [data, setData] = useState<UjianItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const limit = 10

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getUjians({ search, status, page, limit })
      setData(result.data as any)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch {
      toast.error("Gagal memuat data ujian")
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus ujian ini?")) return
    try {
      await deleteUjian(id)
      toast.success("Ujian berhasil dihapus")
      fetchData()
    } catch {
      toast.error("Gagal menghapus ujian")
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateUjian(id)
      toast.success("Ujian berhasil diduplikasi")
      fetchData()
    } catch {
      toast.error("Gagal menduplikasi ujian")
    }
  }

  const handleStart = async (id: string, nama: string) => {
    if (!confirm(`Mulai ujian "${nama}"? Siswa akan bisa mengakses ujian ini.`)) return
    try {
      await startUjian(id)
      toast.success("Ujian berhasil dimulai")
      fetchData()
    } catch {
      toast.error("Gagal memulai ujian")
    }
  }

  const handleStop = async (id: string, nama: string) => {
    if (!confirm(`Hentikan ujian "${nama}"? Siswa tidak akan bisa mengakses ujian ini lagi.`)) return
    try {
      await stopUjian(id)
      toast.success("Ujian berhasil dihentikan")
      fetchData()
    } catch {
      toast.error("Gagal menghentikan ujian")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            Kelola Ujian
          </h1>
          <p className="text-muted-foreground mt-1">Total {total} ujian</p>
        </div>
        <Button asChild>
          <Link href="/guru/ujian/new">
            <Plus className="h-4 w-4 mr-2" /> Buat Ujian
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari ujian..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua Status</SelectItem>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
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
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Belum ada ujian</p>
              <p className="text-muted-foreground mt-1">Buat ujian baru untuk memulai.</p>
              <Button asChild className="mt-4">
                <Link href="/guru/ujian/new">
                  <Plus className="h-4 w-4 mr-2" /> Buat Ujian
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">No</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Mapel</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Durasi</TableHead>
                  <TableHead>Soal</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((ujian, idx) => (
                  <TableRow key={ujian.id}>
                    <TableCell>{(page - 1) * limit + idx + 1}</TableCell>
                    <TableCell className="font-medium">{ujian.nama}</TableCell>
                    <TableCell>{ujian.mataPelajaran.nama}</TableCell>
                    <TableCell>{ujian.kelas.nama}</TableCell>
                    <TableCell>{formatDate(ujian.tanggal)}</TableCell>
                    <TableCell>{ujian.durasi} menit</TableCell>
                    <TableCell>{ujian._count.ujianSoal}</TableCell>
                    <TableCell>
                      <Badge variant={ujian.mode === "manual" ? "default" : "outline"}>
                        {modeLabels[ujian.mode] || ujian.mode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[ujian.status] as any}>
                        {statusLabels[ujian.status] || ujian.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {ujian.mode === "manual" && ujian.status === "DRAFT" && (
                          <Button variant="ghost" size="icon" onClick={() => handleStart(ujian.id, ujian.nama)} className="text-green-600" title="Mulai Ujian">
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {ujian.mode === "manual" && ujian.status === "AKTIF" && (
                          <Button variant="ghost" size="icon" onClick={() => handleStop(ujian.id, ujian.nama)} className="text-destructive" title="Hentikan Ujian">
                            <Square className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDuplicate(ujian.id)} title="Duplikat">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild title="Edit">
                          <Link href={`/guru/ujian/${ujian.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(ujian.id)} title="Hapus">
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
            Halaman {page} dari {totalPages} (total {total} ujian)
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
    </div>
  )
}
