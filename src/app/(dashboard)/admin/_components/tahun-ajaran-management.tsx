"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react"
import {
  getTahunAjarans,
  createTahunAjaran,
  updateTahunAjaran,
  deleteTahunAjaran,
  setActiveTahunAjaran,
} from "../actions"

interface TA {
  id: string
  nama: string
  tahunMulai: number
  tahunSelesai: number
  isAktif: boolean
  deletedAt: Date | null
}

interface Props {
  initialData: TA[]
  initialTotal: number
  initialTotalPages: number
  initialPage: number
  initialSearch: string
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t) }, [value, delay])
  return debounced
}

export function TahunAjaranManagement(props: Props) {
  const router = useRouter()

  const [data, setData] = useState<TA[]>(props.initialData)
  const [total, setTotal] = useState(props.initialTotal)
  const [totalPages, setTotalPages] = useState(props.initialTotalPages)
  const [page, setPage] = useState(props.initialPage)
  const [search, setSearch] = useState(props.initialSearch)
  const [loading, setLoading] = useState(false)

  const debouncedSearch = useDebounce(search, 500)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<TA | null>(null)
  const [formData, setFormData] = useState({ nama: "", tahunMulai: "", tahunSelesai: "", isAktif: false })
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getTahunAjarans({ search: debouncedSearch, page, limit: 10 })
      setData(result.data as TA[])
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch { toast.error("Gagal memuat data") } finally { setLoading(false) }
  }, [debouncedSearch, page])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const p = new URLSearchParams()
    if (debouncedSearch) p.set("search", debouncedSearch)
    if (page > 1) p.set("page", String(page))
    router.replace(`/admin/tahun-ajaran?${p.toString()}`, { scroll: false })
  }, [debouncedSearch, page, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.nama || !formData.tahunMulai || !formData.tahunSelesai) {
      toast.error("Semua field harus diisi"); return
    }
    setSubmitting(true)
    try {
      if (editing) {
        await updateTahunAjaran(editing.id, {
          nama: formData.nama,
          tahunMulai: parseInt(formData.tahunMulai),
          tahunSelesai: parseInt(formData.tahunSelesai),
          isAktif: formData.isAktif,
        })
        toast.success("Tahun ajaran berhasil diperbarui")
      } else {
        await createTahunAjaran({
          nama: formData.nama,
          tahunMulai: parseInt(formData.tahunMulai),
          tahunSelesai: parseInt(formData.tahunSelesai),
          isAktif: formData.isAktif,
        })
        toast.success("Tahun ajaran berhasil ditambahkan")
      }
      setDialogOpen(false); resetForm(); fetchData()
    } catch { toast.error("Terjadi kesalahan") } finally { setSubmitting(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try { await deleteTahunAjaran(deleteId); toast.success("Tahun ajaran berhasil dinonaktifkan"); setDeleteId(null); fetchData() }
    catch { toast.error("Terjadi kesalahan") }
  }

  async function handleToggleActive(id: string, active: boolean) {
    try {
      if (active) {
        await setActiveTahunAjaran(id)
        toast.success("Tahun ajaran aktif telah diubah")
      }
      fetchData()
    } catch { toast.error("Gagal mengubah status") }
  }

  const tahunSekarang = new Date().getFullYear()

  function resetForm() {
    setEditing(null)
    setFormData({ nama: "", tahunMulai: String(tahunSekarang), tahunSelesai: String(tahunSekarang + 1), isAktif: false })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tahun Ajaran</h1>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Tambah Tahun Ajaran</span>
        </Button>
      </div>

      <div className="w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari tahun ajaran..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">No</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Tahun Mulai</TableHead>
              <TableHead>Tahun Selesai</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-48">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, ci) => <TableCell key={ci}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Belum ada data tahun ajaran
              </TableCell></TableRow>
            ) : (
              data.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{(page - 1) * 10 + idx + 1}</TableCell>
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell>{item.tahunMulai}</TableCell>
                  <TableCell>{item.tahunSelesai}</TableCell>
                  <TableCell>
                    {item.isAktif ? <Badge variant="success">Aktif</Badge> : <Badge variant="secondary">Tidak Aktif</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
                        <span>Aktif</span>
                        <Switch
                          checked={item.isAktif}
                          onCheckedChange={(c) => handleToggleActive(item.id, c)}
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditing(item)
                        setFormData({
                          nama: item.nama,
                          tahunMulai: String(item.tahunMulai),
                          tahunSelesai: String(item.tahunSelesai),
                          isAktif: item.isAktif,
                        })
                        setDialogOpen(true)
                      }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Tahun Ajaran" : "Tambah Tahun Ajaran"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama *</label>
              <Input value={formData.nama} onChange={(e) => setFormData((f) => ({ ...f, nama: e.target.value }))} placeholder="2024/2025" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tahun Mulai *</label>
                <Input type="number" value={formData.tahunMulai} onChange={(e) => setFormData((f) => ({ ...f, tahunMulai: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tahun Selesai *</label>
                <Input type="number" value={formData.tahunSelesai} onChange={(e) => setFormData((f) => ({ ...f, tahunSelesai: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isAktif}
                onCheckedChange={(c) => setFormData((f) => ({ ...f, isAktif: c }))}
              />
              <label className="text-sm">Aktifkan sebagai tahun ajaran berjalan</label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>Batal</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nonaktifkan Tahun Ajaran</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tahun ajaran yang dinonaktifkan tidak akan muncul di daftar aktif.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Nonaktifkan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

