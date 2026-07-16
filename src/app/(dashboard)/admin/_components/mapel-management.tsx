"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  getMapels,
  createMapel,
  updateMapel,
  deleteMapel,
  getGuruRefs,
  getKelasRefs,
  getSemesterRefs,
} from "../actions"

interface Mapel {
  id: string
  kode: string
  nama: string
  deskripsi: string | null
  guruId: string
  kelasId: string
  semesterId: string
  deletedAt: Date | null
  guru: { nama: string }
  kelas: { nama: string }
  semester: { nama: string; tahunAjaran: { nama: string } }
}

interface Props {
  initialData: Mapel[]
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

export function MapelManagement(props: Props) {
  const router = useRouter()

  const [data, setData] = useState<Mapel[]>(props.initialData)
  const [total, setTotal] = useState(props.initialTotal)
  const [totalPages, setTotalPages] = useState(props.initialTotalPages)
  const [page, setPage] = useState(props.initialPage)
  const [search, setSearch] = useState(props.initialSearch)
  const [guruRefs, setGuruRefs] = useState<{ id: string; nama: string }[]>([])
  const [kelasRefs, setKelasRefs] = useState<{ id: string; nama: string; tingkat: number }[]>([])
  const [semesterRefs, setSemesterRefs] = useState<{ id: string; nama: string; tahunAjaran: { nama: string } }[]>([])
  const [loading, setLoading] = useState(false)

  const debouncedSearch = useDebounce(search, 500)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Mapel | null>(null)
  const [formData, setFormData] = useState({
    kode: "", nama: "", deskripsi: "", guruId: "", kelasId: "", semesterId: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getMapels({ search: debouncedSearch, page, limit: 10 })
      setData(result.data as Mapel[])
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch { toast.error("Gagal memuat data") } finally { setLoading(false) }
  }, [debouncedSearch, page])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    Promise.all([getGuruRefs(), getKelasRefs(), getSemesterRefs()])
      .then(([g, k, s]) => { setGuruRefs(g); setKelasRefs(k); setSemesterRefs(s) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const p = new URLSearchParams()
    if (debouncedSearch) p.set("search", debouncedSearch)
    if (page > 1) p.set("page", String(page))
    router.replace(`/admin/mapel?${p.toString()}`, { scroll: false })
  }, [debouncedSearch, page, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.kode || !formData.nama || !formData.guruId || !formData.kelasId || !formData.semesterId) {
      toast.error("Semua field wajib diisi"); return
    }
    setSubmitting(true)
    try {
      if (editing) {
        await updateMapel(editing.id, {
          kode: formData.kode, nama: formData.nama, deskripsi: formData.deskripsi || undefined,
          guruId: formData.guruId, kelasId: formData.kelasId, semesterId: formData.semesterId,
        })
        toast.success("Mapel berhasil diperbarui")
      } else {
        await createMapel({
          kode: formData.kode, nama: formData.nama, deskripsi: formData.deskripsi || undefined,
          guruId: formData.guruId, kelasId: formData.kelasId, semesterId: formData.semesterId,
        })
        toast.success("Mapel berhasil ditambahkan")
      }
      setDialogOpen(false); resetForm(); fetchData()
    } catch { toast.error("Terjadi kesalahan") } finally { setSubmitting(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try { await deleteMapel(deleteId); toast.success("Mapel berhasil dinonaktifkan"); setDeleteId(null); fetchData() }
    catch { toast.error("Terjadi kesalahan") }
  }

  function resetForm() {
    setEditing(null)
    setFormData({ kode: "", nama: "", deskripsi: "", guruId: "", kelasId: "", semesterId: "" })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Data Mata Pelajaran</h1>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Tambah Mapel</span>
        </Button>
      </div>

      <div className="w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari mapel..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">No</TableHead>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Guru Pengampu</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>Semester</TableHead>
              <TableHead className="w-40">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((_, ci) => <TableCell key={ci}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                {search ? "Tidak ada mapel yang sesuai" : "Belum ada data mapel"}
              </TableCell></TableRow>
            ) : (
              data.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{(page - 1) * 10 + idx + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{item.kode}</TableCell>
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell>{item.guru.nama}</TableCell>
                  <TableCell>{item.kelas.nama}</TableCell>
                  <TableCell>{item.semester.nama} ({item.semester.tahunAjaran.nama})</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditing(item)
                        setFormData({
                          kode: item.kode, nama: item.nama, deskripsi: item.deskripsi || "",
                          guruId: item.guruId, kelasId: item.kelasId, semesterId: item.semesterId,
                        })
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Mapel" : "Tambah Mapel"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kode Mapel *</label>
                <Input value={formData.kode} onChange={(e) => setFormData((f) => ({ ...f, kode: e.target.value }))} placeholder="MTK-01" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nama Mapel *</label>
                <Input value={formData.nama} onChange={(e) => setFormData((f) => ({ ...f, nama: e.target.value }))} placeholder="Matematika" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Guru Pengampu *</label>
                <Select value={formData.guruId || "none"} onValueChange={(v) => setFormData((f) => ({ ...f, guruId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih Guru" /></SelectTrigger>
                  <SelectContent>
                    {guruRefs.map((g) => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Kelas *</label>
                <Select value={formData.kelasId || "none"} onValueChange={(v) => setFormData((f) => ({ ...f, kelasId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                  <SelectContent>
                    {kelasRefs.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Semester *</label>
                <Select value={formData.semesterId || "none"} onValueChange={(v) => setFormData((f) => ({ ...f, semesterId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih Semester" /></SelectTrigger>
                  <SelectContent>
                    {semesterRefs.map((s) => <SelectItem key={s.id} value={s.id}>{s.nama} ({s.tahunAjaran.nama})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Deskripsi</label>
                <Input value={formData.deskripsi} onChange={(e) => setFormData((f) => ({ ...f, deskripsi: e.target.value }))} placeholder="Deskripsi" />
              </div>
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
          <DialogHeader><DialogTitle>Nonaktifkan Mapel</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Mapel yang dinonaktifkan tidak akan muncul di daftar aktif.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Nonaktifkan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

