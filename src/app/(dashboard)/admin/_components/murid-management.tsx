"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
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
  RotateCcw,
  ChevronLeft,
  ChevronRight,
Loader2,
  Upload,
  FileSpreadsheet,
  FileText,
  KeyRound,
} from "lucide-react"
import {
  getMurids,
  createMurid,
  updateMurid,
  deleteMurid,
  restoreMurid,
  resetMuridPassword,
  getKelasRefs,
} from "../actions"

interface Murid {
  id: string
  nama: string
  nis: string | null
  nisn: string | null
  alamat: string | null
  noTelp: string | null
  kelasId: string | null
  jabatan: string | null
  deletedAt: Date | null
  user: { email: string; isActive: boolean }
  kelas: { nama: string } | null
}

interface Props {
  initialData: Murid[]
  initialTotal: number
  initialTotalPages: number
  initialPage: number
  initialSearch: string
  initialIncludeDeleted: boolean
  initialKelasId?: string
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t) }, [value, delay])
  return debounced
}

export function MuridManagement(props: Props) {
  const router = useRouter()

  const [data, setData] = useState<Murid[]>(props.initialData)
  const [total, setTotal] = useState(props.initialTotal)
  const [totalPages, setTotalPages] = useState(props.initialTotalPages)
  const [page, setPage] = useState(props.initialPage)
  const [search, setSearch] = useState(props.initialSearch)
  const [includeDeleted, setIncludeDeleted] = useState(props.initialIncludeDeleted)
  const [kelasId, setKelasId] = useState(props.initialKelasId || "")
  const [kelasRefs, setKelasRefs] = useState<{ id: string; nama: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])

  const debouncedSearch = useDebounce(search, 500)

  const [dialogOpen, setDialogOpen] = useState(false)
const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; restore: boolean }>({
    open: false, id: "", restore: false,
  })
  const [resetDialog, setResetDialog] = useState<{ open: boolean; id: string; nama: string }>({
    open: false, id: "", nama: "",
  })
  const [editing, setEditing] = useState<Murid | null>(null)
  const [formData, setFormData] = useState({
    nama: "", nis: "", nisn: "", alamat: "", noTelp: "", email: "", kelasId: "", jabatan: "", password: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getMurids({
        search: debouncedSearch,
        page,
        limit: 10,
        includeDeleted,
        kelasId: kelasId || undefined,
      })
      setData(result.data as Murid[])
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch { toast.error("Gagal memuat data") } finally { setLoading(false) }
  }, [debouncedSearch, page, includeDeleted, kelasId])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    getKelasRefs().then(setKelasRefs).catch(() => {})
  }, [])

  useEffect(() => {
    const p = new URLSearchParams()
    if (debouncedSearch) p.set("search", debouncedSearch)
    if (page > 1) p.set("page", String(page))
    if (includeDeleted) p.set("status", "all")
    if (kelasId) p.set("kelas", kelasId)
    router.replace(`/admin/murid?${p.toString()}`, { scroll: false })
  }, [debouncedSearch, page, includeDeleted, kelasId, router])

  const columns: ColumnDef<Murid>[] = [
    { header: "No", cell: ({ row }) => (page - 1) * 10 + row.index + 1, size: 60 },
{ accessorKey: "nama", header: "Nama" },
    { accessorKey: "nis", header: "NIS", cell: ({ row }) => row.original.nis || "-" },
    { accessorKey: "nisn", header: "NISN", cell: ({ row }) => row.original.nisn || "-" },
    {
      header: "Email",
      cell: ({ row }) => <span className="block max-w-[200px] truncate text-sm">{row.original.user.email}</span>,
    },
    {
      header: "Kelas",
      cell: ({ row }) => row.original.kelas?.nama || "-",
    },
    {
      header: "Jabatan",
      cell: ({ row }) => {
        const j = row.original.jabatan
        if (!j) return "-"
        const labels: Record<string, string> = { KETUA: "Ketua", WAKIL: "Wakil Ketua", BENDAHARA: "Bendahara", SEKRETARIS: "Sekretaris" }
        return <Badge variant="secondary">{labels[j] || j}</Badge>
      },
    },
    { accessorKey: "noTelp", header: "No Telp", cell: ({ row }) => row.original.noTelp || "-" },
    {
      header: "Aksi",
      cell: ({ row }) => {
        const m = row.original
        if (m.deletedAt) {
          return (
            <Button variant="outline" size="sm" onClick={() => setDeleteDialog({ open: true, id: m.id, restore: true })} className="p-2 sm:px-3 sm:py-1">
              <RotateCcw className="h-4 w-4" /><span className="hidden sm:inline ml-1">Restore</span>
            </Button>
          )
        }
        return (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setEditing(m)
              setFormData({
                nama: m.nama, nis: m.nis || "", nisn: m.nisn || "",
                alamat: m.alamat || "", noTelp: m.noTelp || "", email: m.user.email,
                kelasId: m.kelasId || "", password: "", jabatan: m.jabatan || "",
              })
              setDialogOpen(true)
            }} className="p-2 sm:px-3 sm:py-1">
              <Edit className="h-4 w-4" /><span className="hidden sm:inline ml-1">Edit</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setResetDialog({ open: true, id: m.id, nama: m.nama })} className="p-2 sm:px-3 sm:py-1">
              <KeyRound className="h-4 w-4" /><span className="hidden sm:inline ml-1">Reset Password</span>
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteDialog({ open: true, id: m.id, restore: false })} className="p-2 sm:px-3 sm:py-1">
              <Trash2 className="h-4 w-4" /><span className="hidden sm:inline ml-1">Hapus</span>
            </Button>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data, columns, state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true, pageCount: totalPages, rowCount: total,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.nama || !formData.email) { toast.error("Nama dan Email harus diisi"); return }
    setSubmitting(true)
    try {
      if (editing) {
        await updateMurid(editing.id, {
          nama: formData.nama, nis: formData.nis || undefined, nisn: formData.nisn || undefined,
          alamat: formData.alamat || undefined, noTelp: formData.noTelp || undefined,
          kelasId: formData.kelasId || undefined, jabatan: formData.jabatan || undefined,
        })
        toast.success("Murid berhasil diperbarui")
      } else {
        await createMurid({
          nama: formData.nama, nis: formData.nis || undefined, nisn: formData.nisn || undefined,
          alamat: formData.alamat || undefined, noTelp: formData.noTelp || undefined,
          email: formData.email, kelasId: formData.kelasId || undefined,
          jabatan: formData.jabatan || undefined,
          password: formData.password || undefined,
        })
        toast.success("Murid berhasil ditambahkan")
      }
      setDialogOpen(false); resetForm(); fetchData()
    } catch (err: any) { toast.error(err?.message || "Terjadi kesalahan") } finally { setSubmitting(false) }
  }

  async function handleResetPassword() {
    try {
      const nama = await resetMuridPassword(resetDialog.id)
      toast.success(`Password ${nama} direset ke siswa123`)
      setResetDialog({ open: false, id: "", nama: "" })
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan")
    }
  }

  async function handleDeleteRestore() {
    try {
      if (deleteDialog.restore) { await restoreMurid(deleteDialog.id); toast.success("Murid berhasil direstore") }
      else { await deleteMurid(deleteDialog.id); toast.success("Murid berhasil dinonaktifkan") }
      setDeleteDialog({ open: false, id: "", restore: false }); fetchData()
    } catch { toast.error("Terjadi kesalahan") }
  }

  function resetForm() {
    setEditing(null)
    setFormData({ nama: "", nis: "", nisn: "", alamat: "", noTelp: "", email: "", kelasId: "", jabatan: "", password: "" })
  }

  const handleExport = async (format: "excel" | "pdf") => {
    try {
      const res = await fetch(`/api/export?type=murid&format=${format}`)
      if (!res.ok) throw new Error("Gagal mengekspor data")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const ext = format === "pdf" ? "pdf" : "xls"
      const a = document.createElement("a")
      a.href = url
      a.download = `murid_${new Date().toISOString().split("T")[0]}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Ekspor ${format === "pdf" ? "PDF" : "Excel"} berhasil`)
    } catch {
      toast.error("Gagal mengekspor data")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Data Murid</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="sm:hidden p-2" title="Import"><Upload className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex"><Upload className="h-4 w-4 mr-1" /> Import</Button>
          <Button variant="outline" size="sm" className="sm:hidden p-2" title="Excel" onClick={() => handleExport("excel")}><FileSpreadsheet className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => handleExport("excel")}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
          <Button variant="outline" size="sm" className="sm:hidden p-2" title="PDF" onClick={() => handleExport("pdf")}><FileText className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => handleExport("pdf")}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Tambah Murid</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari murid..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
        </div>
        <Select value={kelasId || "all"} onValueChange={(v) => { setKelasId(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {kelasRefs.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={includeDeleted ? "all" : "active"} onValueChange={(v) => { setIncludeDeleted(v === "all"); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="all">Semua</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} style={{ width: h.getSize() }} onClick={h.column.getToggleSortingHandler()}
                    className={h.column.getCanSort() ? "cursor-pointer select-none" : ""}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{columns.map((_, ci) => <TableCell key={ci}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                {search ? "Tidak ada murid yang sesuai" : "Belum ada data murid"}
              </TableCell></TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>{row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}</TableRow>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Murid" : "Tambah Murid"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nama Lengkap *</label>
                <Input value={formData.nama} onChange={(e) => setFormData((f) => ({ ...f, nama: e.target.value }))} placeholder="Nama murid" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email *</label>
                <Input value={formData.email} onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))} placeholder="email@siswa.sch.id" disabled={!!editing} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">NIS</label>
                <Input value={formData.nis} onChange={(e) => setFormData((f) => ({ ...f, nis: e.target.value }))} placeholder="NIS" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">NISN</label>
                <Input value={formData.nisn} onChange={(e) => setFormData((f) => ({ ...f, nisn: e.target.value }))} placeholder="NISN" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Kelas</label>
                <Select value={formData.kelasId || "none"} onValueChange={(v) => setFormData((f) => ({ ...f, kelasId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    {kelasRefs.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">No Telp</label>
                <Input value={formData.noTelp} onChange={(e) => setFormData((f) => ({ ...f, noTelp: e.target.value }))} placeholder="0812xxxx" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Jabatan</label>
                <Select value={formData.jabatan || "none"} onValueChange={(v) => setFormData((f) => ({ ...f, jabatan: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Tidak ada" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    <SelectItem value="KETUA">Ketua Kelas</SelectItem>
                    <SelectItem value="WAKIL">Wakil Ketua</SelectItem>
                    <SelectItem value="BENDAHARA">Bendahara</SelectItem>
                    <SelectItem value="SEKRETARIS">Sekretaris</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Alamat</label>
                <Input value={formData.alamat} onChange={(e) => setFormData((f) => ({ ...f, alamat: e.target.value }))} placeholder="Alamat" />
              </div>
              {!editing && (
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">
                    Password <span className="text-xs text-muted-foreground">(opsional, untuk login tanpa Google)</span>
                  </label>
                  <Input type="password" value={formData.password} onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))} placeholder="Kosongkan jika hanya pakai Google" />
                </div>
              )}
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

<Dialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o, id: "", restore: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{deleteDialog.restore ? "Restore Murid" : "Nonaktifkan Murid"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteDialog.restore
              ? "Apakah Anda yakin ingin mengembalikan data murid ini?"
              : "Murid yang dinonaktifkan tidak akan muncul di daftar aktif."}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, id: "", restore: false })}>Batal</Button>
            <Button variant={deleteDialog.restore ? "default" : "destructive"} onClick={handleDeleteRestore}>
              {deleteDialog.restore ? "Restore" : "Nonaktifkan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetDialog.open} onOpenChange={(o) => setResetDialog({ open: o, id: "", nama: "" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reset Password Murid</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Password akun <strong>{resetDialog.nama}</strong> akan direset menjadi <strong>siswa123</strong>.
            Murid dapat login dengan password default ini dan mengubahnya di menu Pengaturan.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setResetDialog({ open: false, id: "", nama: "" })}>Batal</Button>
            <Button variant="default" onClick={handleResetPassword}>
              <KeyRound className="h-4 w-4 mr-2" /> Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

