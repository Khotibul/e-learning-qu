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
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
} from "lucide-react"
import {
  getJurussans,
  createJurusan,
  updateJurusan,
  deleteJurusan,
  getJurusanRefs,
  getMurids,
  assignSiswaToJurusan,
  getJurusanSiswa,
} from "../actions"

interface Jurusan {
  id: string
  kode: string
  nama: string
  deskripsi: string | null
  deletedAt: Date | null
  _count: { siswas: number }
}

interface Siswa {
  id: string
  nama: string
  nis: string | null
}

interface Props {
  initialData: Jurusan[]
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

export function JurusanManagement(props: Props) {
  const router = useRouter()

  const [data, setData] = useState<Jurusan[]>(props.initialData)
  const [total, setTotal] = useState(props.initialTotal)
  const [totalPages, setTotalPages] = useState(props.initialTotalPages)
  const [page, setPage] = useState(props.initialPage)
  const [search, setSearch] = useState(props.initialSearch)
  const [loading, setLoading] = useState(false)

  const debouncedSearch = useDebounce(search, 500)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Jurusan | null>(null)
  const [formData, setFormData] = useState({ kode: "", nama: "", deskripsi: "" })
  const [submitting, setSubmitting] = useState(false)

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignJurusanId, setAssignJurusanId] = useState<string | null>(null)
  const [assignJurusanNama, setAssignJurusanNama] = useState("")
  const [allSiswa, setAllSiswa] = useState<Siswa[]>([])
  const [currentSiswaIds, setCurrentSiswaIds] = useState<string[]>([])
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<string[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [siswaSearch, setSiswaSearch] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getJurussans({ search: debouncedSearch, page, limit: 10 })
      setData(result.data as Jurusan[])
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch { toast.error("Gagal memuat data") } finally { setLoading(false) }
  }, [debouncedSearch, page])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const p = new URLSearchParams()
    if (debouncedSearch) p.set("search", debouncedSearch)
    if (page > 1) p.set("page", String(page))
    router.replace(`/admin/jurusan?${p.toString()}`, { scroll: false })
  }, [debouncedSearch, page, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.kode || !formData.nama) { toast.error("Kode dan nama jurusan harus diisi"); return }
    setSubmitting(true)
    try {
      if (editing) {
        await updateJurusan(editing.id, { kode: formData.kode, nama: formData.nama, deskripsi: formData.deskripsi || undefined })
        toast.success("Jurusan berhasil diperbarui")
      } else {
        await createJurusan({ kode: formData.kode, nama: formData.nama, deskripsi: formData.deskripsi || undefined })
        toast.success("Jurusan berhasil ditambahkan")
      }
      setDialogOpen(false); resetForm(); fetchData()
    } catch { toast.error("Terjadi kesalahan") } finally { setSubmitting(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try { await deleteJurusan(deleteId); toast.success("Jurusan berhasil dinonaktifkan"); setDeleteId(null); fetchData() }
    catch { toast.error("Terjadi kesalahan") }
  }

  function resetForm() {
    setEditing(null)
    setFormData({ kode: "", nama: "", deskripsi: "" })
  }

  async function openAssignDialog(jurusanId: string, jurusanNama: string) {
    setAssignJurusanId(jurusanId)
    setAssignJurusanNama(jurusanNama)
    setAssignDialogOpen(true)
    setSiswaSearch("")
    setAssignLoading(true)
    try {
      const [jurusanSiswa, allResult] = await Promise.all([
        getJurusanSiswa(jurusanId),
        getMurids({ search: "", page: 1, limit: 1000 }),
      ])
      const currentIds = jurusanSiswa.map((s) => s.id)
      setCurrentSiswaIds(currentIds)
      setSelectedSiswaIds([...currentIds])
      setAllSiswa(allResult.data.map((s: any) => ({ id: s.id, nama: s.nama, nis: s.nis })))
    } catch { toast.error("Gagal memuat data siswa") }
    setAssignLoading(false)
  }

  async function handleAssign() {
    if (!assignJurusanId) return
    setAssignLoading(true)
    try {
      await assignSiswaToJurusan(assignJurusanId, selectedSiswaIds)
      toast.success("Siswa jurusan berhasil diperbarui")
      setAssignDialogOpen(false)
      fetchData()
    } catch { toast.error("Terjadi kesalahan") }
    setAssignLoading(false)
  }

  const filteredSiswa = allSiswa.filter((s) =>
    s.nama.toLowerCase().includes(siswaSearch.toLowerCase()) ||
    (s.nis && s.nis.toLowerCase().includes(siswaSearch.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Data Jurusan</h1>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Tambah Jurusan</span>
        </Button>
      </div>

      <div className="w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari jurusan..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">No</TableHead>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead className="hidden sm:table-cell">Deskripsi</TableHead>
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
                {search ? "Tidak ada jurusan yang sesuai" : "Belum ada data jurusan"}
              </TableCell></TableRow>
            ) : (
              data.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{(page - 1) * 10 + idx + 1}</TableCell>
                  <TableCell><Badge variant="outline">{item.kode}</Badge></TableCell>
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground truncate max-w-[200px]">{item.deskripsi || "-"}</TableCell>
                  <TableCell><Badge variant="secondary">{item._count.siswas} Murid</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openAssignDialog(item.id, item.nama)} className="p-2 sm:px-3 sm:py-1" title="Atur Siswa">
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditing(item)
                        setFormData({ kode: item.kode, nama: item.nama, deskripsi: item.deskripsi || "" })
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
          <DialogHeader><DialogTitle>{editing ? "Edit Jurusan" : "Tambah Jurusan"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Kode Jurusan *</label>
              <Input value={formData.kode} onChange={(e) => setFormData((f) => ({ ...f, kode: e.target.value }))} placeholder="Contoh: TKJ, RPL, AKL" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Jurusan *</label>
              <Input value={formData.nama} onChange={(e) => setFormData((f) => ({ ...f, nama: e.target.value }))} placeholder="Contoh: Teknik Komputer dan Jaringan" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Deskripsi</label>
              <Input value={formData.deskripsi} onChange={(e) => setFormData((f) => ({ ...f, deskripsi: e.target.value }))} placeholder="Deskripsi jurusan (opsional)" />
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
          <DialogHeader><DialogTitle>Nonaktifkan Jurusan</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Jurusan yang dinonaktifkan tidak akan muncul di daftar aktif.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Nonaktifkan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={(o) => { setAssignDialogOpen(o); if (!o) { setAssignJurusanId(null); setSelectedSiswaIds([]); setAllSiswa([]) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Atur Siswa - {assignJurusanNama}</DialogTitle></DialogHeader>
          {assignLoading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari siswa..." value={siswaSearch} onChange={(e) => setSiswaSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
                {filteredSiswa.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Tidak ada siswa ditemukan</p>
                ) : (
                  filteredSiswa.map((siswa) => (
                    <label key={siswa.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSiswaIds.includes(siswa.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSiswaIds((ids) => [...ids, siswa.id])
                          } else {
                            setSelectedSiswaIds((ids) => ids.filter((id) => id !== siswa.id))
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">{siswa.nama}</span>
                      {siswa.nis && <span className="text-xs text-muted-foreground">({siswa.nis})</span>}
                    </label>
                  ))
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setAssignDialogOpen(false); setAssignJurusanId(null) }}>Batal</Button>
                <Button onClick={handleAssign} disabled={assignLoading}>
                  {assignLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
