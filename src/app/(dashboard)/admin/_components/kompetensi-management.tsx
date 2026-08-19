"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  getKompetensis,
  createKompetensi,
  updateKompetensi,
  deleteKompetensi,
} from "../actions"

interface Kompetensi {
  id: string
  kode: string
  nama: string
  deskripsi: string | null
  jurusanId: string
  mataPelajaranId: string | null
  tingkat: number
  urutan: number
  jurusan: { nama: string }
  mataPelajaran: { nama: string } | null
  _count: { soals: number }
}

interface JurusanRef {
  id: string
  nama: string
  kode: string
}

interface MapelRef {
  id: string
  nama: string
  kode: string
}

interface Props {
  initialData: Kompetensi[]
  initialTotal: number
  initialTotalPages: number
  initialPage: number
  initialSearch: string
  jurusanRefs: JurusanRef[]
  mapelRefs: MapelRef[]
  initialJurusanId: string
  initialMapelId: string
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t) }, [value, delay])
  return debounced
}

export function KompetensiManagement(props: Props) {
  const router = useRouter()

  const [data, setData] = useState<Kompetensi[]>(props.initialData)
  const [total, setTotal] = useState(props.initialTotal)
  const [totalPages, setTotalPages] = useState(props.initialTotalPages)
  const [page, setPage] = useState(props.initialPage)
  const [search, setSearch] = useState(props.initialSearch)
  const [jurusanId, setJurusanId] = useState(props.initialJurusanId)
  const [mapelId, setMapelId] = useState(props.initialMapelId)
  const [loading, setLoading] = useState(false)

  const debouncedSearch = useDebounce(search, 500)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Kompetensi | null>(null)
  const [formData, setFormData] = useState({
    kode: "",
    nama: "",
    deskripsi: "",
    jurusanId: "",
    mataPelajaranId: "",
    tingkat: "1",
    urutan: "0",
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getKompetensis({
        search: debouncedSearch,
        page,
        limit: 10,
        jurusanId: jurusanId || undefined,
        mapelId: mapelId || undefined,
      })
      setData(result.data as Kompetensi[])
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch { toast.error("Gagal memuat data") } finally { setLoading(false) }
  }, [debouncedSearch, page, jurusanId, mapelId])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const p = new URLSearchParams()
    if (debouncedSearch) p.set("search", debouncedSearch)
    if (page > 1) p.set("page", String(page))
    if (jurusanId) p.set("jurusanId", jurusanId)
    if (mapelId) p.set("mapelId", mapelId)
    router.replace(`/admin/kompetensi?${p.toString()}`, { scroll: false })
  }, [debouncedSearch, page, jurusanId, mapelId, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.kode || !formData.nama || !formData.jurusanId) {
      toast.error("Kode, nama, dan jurusan harus diisi")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        kode: formData.kode,
        nama: formData.nama,
        deskripsi: formData.deskripsi || undefined,
        jurusanId: formData.jurusanId,
        mataPelajaranId: formData.mataPelajaranId || undefined,
        tingkat: parseInt(formData.tingkat) || 1,
        urutan: parseInt(formData.urutan) || 0,
      }
      if (editing) {
        await updateKompetensi(editing.id, payload)
        toast.success("Kompetensi berhasil diperbarui")
      } else {
        await createKompetensi(payload)
        toast.success("Kompetensi berhasil ditambahkan")
      }
      setDialogOpen(false); resetForm(); fetchData()
    } catch { toast.error("Terjadi kesalahan") } finally { setSubmitting(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try { await deleteKompetensi(deleteId); toast.success("Kompetensi berhasil dinonaktifkan"); setDeleteId(null); fetchData() }
    catch { toast.error("Terjadi kesalahan") }
  }

  function resetForm() {
    setEditing(null)
    setFormData({ kode: "", nama: "", deskripsi: "", jurusanId: "", mataPelajaranId: "", tingkat: "1", urutan: "0" })
  }

  const filteredMapel = formData.jurusanId
    ? props.mapelRefs
    : props.mapelRefs

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Data Kompetensi</h1>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Tambah Kompetensi</span>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari kompetensi..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
        </div>
        <Select value={jurusanId || "all"} onValueChange={(v) => { setJurusanId(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Semua Jurusan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Jurusan</SelectItem>
            {props.jurusanRefs.map((j) => <SelectItem key={j.id} value={j.id}>{j.nama}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mapelId || "all"} onValueChange={(v) => { setMapelId(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Semua Mapel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Mapel</SelectItem>
            {props.mapelRefs.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">No</TableHead>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Jurusan</TableHead>
              <TableHead>Mapel</TableHead>
              <TableHead className="text-center">Tingkat</TableHead>
              <TableHead className="text-center">Urutan</TableHead>
              <TableHead className="text-center">Soal</TableHead>
              <TableHead className="w-40">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, ci) => <TableCell key={ci}><Skeleton className="h-5 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                {search || jurusanId || mapelId ? "Tidak ada kompetensi yang sesuai" : "Belum ada data kompetensi"}
              </TableCell></TableRow>
            ) : (
              data.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{(page - 1) * 10 + idx + 1}</TableCell>
                  <TableCell><Badge variant="outline">{item.kode}</Badge></TableCell>
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell>{item.jurusan.nama}</TableCell>
                  <TableCell>{item.mataPelajaran?.nama || "-"}</TableCell>
                  <TableCell className="text-center">{item.tingkat}</TableCell>
                  <TableCell className="text-center">{item.urutan}</TableCell>
                  <TableCell className="text-center"><Badge variant="secondary">{item._count.soals}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditing(item)
                        setFormData({
                          kode: item.kode,
                          nama: item.nama,
                          deskripsi: item.deskripsi || "",
                          jurusanId: item.jurusanId,
                          mataPelajaranId: item.mataPelajaranId || "",
                          tingkat: String(item.tingkat),
                          urutan: String(item.urutan),
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
          <DialogHeader><DialogTitle>{editing ? "Edit Kompetensi" : "Tambah Kompetensi"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kode *</label>
                <Input value={formData.kode} onChange={(e) => setFormData((f) => ({ ...f, kode: e.target.value }))} placeholder="Contoh: K001" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nama *</label>
                <Input value={formData.nama} onChange={(e) => setFormData((f) => ({ ...f, nama: e.target.value }))} placeholder="Nama kompetensi" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Deskripsi</label>
              <Textarea value={formData.deskripsi} onChange={(e) => setFormData((f) => ({ ...f, deskripsi: e.target.value }))} placeholder="Deskripsi kompetensi" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Jurusan *</label>
                <Select value={formData.jurusanId || "none"} onValueChange={(v) => setFormData((f) => ({ ...f, jurusanId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih Jurusan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Jurusan</SelectItem>
                    {props.jurusanRefs.map((j) => <SelectItem key={j.id} value={j.id}>{j.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mata Pelajaran</label>
                <Select value={formData.mataPelajaranId || "none"} onValueChange={(v) => setFormData((f) => ({ ...f, mataPelajaranId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih Mapel" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    {filteredMapel.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tingkat</label>
                <Input type="number" min={1} value={formData.tingkat} onChange={(e) => setFormData((f) => ({ ...f, tingkat: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Urutan</label>
                <Input type="number" min={0} value={formData.urutan} onChange={(e) => setFormData((f) => ({ ...f, urutan: e.target.value }))} />
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
          <DialogHeader><DialogTitle>Nonaktifkan Kompetensi</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Kompetensi yang dinonaktifkan tidak akan muncul di daftar aktif.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Nonaktifkan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
