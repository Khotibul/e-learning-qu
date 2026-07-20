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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  getKelass,
  createKelas,
  updateKelas,
  deleteKelas,
  getGuruRefs,
} from "../actions"

interface Kelas {
  id: string
  nama: string
  tingkat: number
  guruId: string | null
  deletedAt: Date | null
  guru: { nama: string } | null
  _count: { siswas: number }
}

interface Props {
  initialData: Kelas[]
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

const tingkatList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export function KelasManagement(props: Props) {
  const router = useRouter()

  const [data, setData] = useState<Kelas[]>(props.initialData)
  const [total, setTotal] = useState(props.initialTotal)
  const [totalPages, setTotalPages] = useState(props.initialTotalPages)
  const [page, setPage] = useState(props.initialPage)
  const [search, setSearch] = useState(props.initialSearch)
  const [guruRefs, setGuruRefs] = useState<{ id: string; nama: string }[]>([])
  const [loading, setLoading] = useState(false)

  const debouncedSearch = useDebounce(search, 500)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Kelas | null>(null)
  const [formData, setFormData] = useState({ nama: "", tingkat: "1", guruId: "" })
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getKelass({ search: debouncedSearch, page, limit: 10 })
      setData(result.data as Kelas[])
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch { toast.error("Gagal memuat data") } finally { setLoading(false) }
  }, [debouncedSearch, page])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { getGuruRefs().then(setGuruRefs).catch(() => {}) }, [])

  useEffect(() => {
    const p = new URLSearchParams()
    if (debouncedSearch) p.set("search", debouncedSearch)
    if (page > 1) p.set("page", String(page))
    router.replace(`/admin/kelas?${p.toString()}`, { scroll: false })
  }, [debouncedSearch, page, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.nama) { toast.error("Nama kelas harus diisi"); return }
    setSubmitting(true)
    try {
      if (editing) {
        await updateKelas(editing.id, { nama: formData.nama, tingkat: parseInt(formData.tingkat), guruId: formData.guruId || undefined })
        toast.success("Kelas berhasil diperbarui")
      } else {
        await createKelas({ nama: formData.nama, tingkat: parseInt(formData.tingkat), guruId: formData.guruId || undefined })
        toast.success("Kelas berhasil ditambahkan")
      }
      setDialogOpen(false); resetForm(); fetchData()
    } catch { toast.error("Terjadi kesalahan") } finally { setSubmitting(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try { await deleteKelas(deleteId); toast.success("Kelas berhasil dinonaktifkan"); setDeleteId(null); fetchData() }
    catch { toast.error("Terjadi kesalahan") }
  }

  function resetForm() {
    setEditing(null)
    setFormData({ nama: "", tingkat: "1", guruId: "" })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Data Kelas</h1>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Tambah Kelas</span>
        </Button>
      </div>

      <div className="w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari kelas..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">No</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Tingkat</TableHead>
              <TableHead>Wali Kelas</TableHead>
              <TableHead>Jumlah Murid</TableHead>
              <TableHead className="w-40">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, ci) => <TableCell key={ci}><Skeleton className="h-5 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                {search ? "Tidak ada kelas yang sesuai" : "Belum ada data kelas"}
              </TableCell></TableRow>
            ) : (
              data.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{(page - 1) * 10 + idx + 1}</TableCell>
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell>Kelas {item.tingkat}</TableCell>
                  <TableCell>{item.guru?.nama || "-"}</TableCell>
                  <TableCell><Badge variant="secondary">{item._count.siswas} Murid</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditing(item)
                        setFormData({ nama: item.nama, tingkat: String(item.tingkat), guruId: item.guruId || "" })
                        setDialogOpen(true)
                      }} className="p-2 sm:px-3 sm:py-1">
                        <Edit className="h-4 w-4" /><span className="hidden sm:inline ml-1">Edit</span>
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteId(item.id)} className="p-2 sm:px-3 sm:py-1">
                        <Trash2 className="h-4 w-4" /><span className="hidden sm:inline ml-1">Hapus</span>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Kelas" : "Tambah Kelas"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Kelas *</label>
              <Input value={formData.nama} onChange={(e) => setFormData((f) => ({ ...f, nama: e.target.value }))} placeholder="Contoh: VII-A" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tingkat</label>
              <Select value={formData.tingkat} onValueChange={(v) => setFormData((f) => ({ ...f, tingkat: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tingkatList.map((t) => <SelectItem key={t} value={String(t)}>Kelas {t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Wali Kelas / Guru</label>
              <Select value={formData.guruId || "none"} onValueChange={(v) => setFormData((f) => ({ ...f, guruId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih Guru" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  {guruRefs.map((g) => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}
                </SelectContent>
              </Select>
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
          <DialogHeader><DialogTitle>Nonaktifkan Kelas</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Kelas yang dinonaktifkan tidak akan muncul di daftar aktif.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Nonaktifkan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

