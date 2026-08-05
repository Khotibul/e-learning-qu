"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  DialogTrigger,
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
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react"
import {
  getGurus,
  createGuru,
  updateGuru,
  deleteGuru,
  restoreGuru,
} from "../actions"
import { cn } from "@/lib/utils"

interface Guru {
  id: string
  nama: string
  jabatan: string | null
  nip: string | null
  nuptk: string | null
  alamat: string | null
  noTelp: string | null
  deletedAt: Date | null
  user: { email: string; isActive: boolean }
}

interface Props {
  initialData: Guru[]
  initialTotal: number
  initialTotalPages: number
  initialPage: number
  initialSearch: string
  initialIncludeDeleted: boolean
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function GuruManagement({
  initialData,
  initialTotal,
  initialTotalPages,
  initialPage,
  initialSearch,
  initialIncludeDeleted,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [data, setData] = useState<Guru[]>(initialData)
  const [total, setTotal] = useState(initialTotal)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [page, setPage] = useState(initialPage)
  const [search, setSearch] = useState(initialSearch)
  const [includeDeleted, setIncludeDeleted] = useState(initialIncludeDeleted)
  const [loading, setLoading] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])

  const debouncedSearch = useDebounce(search, 500)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; restore: boolean }>({
    open: false,
    id: "",
    restore: false,
  })
  const [editingGuru, setEditingGuru] = useState<Guru | null>(null)
const [formData, setFormData] = useState({
    nama: "",
    jabatan: "",
    nip: "",
    nuptk: "",
    alamat: "",
    noTelp: "",
    email: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getGurus({ search: debouncedSearch, page, limit: 10, includeDeleted })
      setData(result.data as Guru[])
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch {
      toast.error("Gagal memuat data guru")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, includeDeleted])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (page > 1) params.set("page", String(page))
    if (includeDeleted) params.set("status", "all")
    router.replace(`/admin/guru?${params.toString()}`, { scroll: false })
  }, [debouncedSearch, page, includeDeleted, router])

  const columns: ColumnDef<Guru>[] = [
    {
      header: "No",
      cell: ({ row }) => (page - 1) * 10 + row.index + 1,
      size: 60,
    },
{ accessorKey: "nama", header: "Nama" },
    {
      accessorKey: "jabatan",
      header: "Jabatan",
      cell: ({ row }) => {
        const j = row.original.jabatan
        if (j === "BK") return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">BK / BP</Badge>
        return <Badge variant="secondary">Guru</Badge>
      },
    },
    { accessorKey: "nip", header: "NIP", cell: ({ row }) => row.original.nip || "-" },
    { accessorKey: "nuptk", header: "NUPTK", cell: ({ row }) => row.original.nuptk || "-" },
    { accessorKey: "noTelp", header: "No Telp", cell: ({ row }) => row.original.noTelp || "-" },
    {
      header: "Status",
      cell: ({ row }) => {
        if (row.original.deletedAt) return <Badge variant="destructive">Nonaktif</Badge>
        return <Badge variant="success">Aktif</Badge>
      },
    },
    {
      header: "Aksi",
      cell: ({ row }) => {
        const guru = row.original
        if (guru.deletedAt) {
          return (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialog({ open: true, id: guru.id, restore: true })}
                className="p-2 sm:px-3 sm:py-1"
              >
                <RotateCcw className="h-4 w-4" /><span className="hidden sm:inline ml-1">Restore</span>
              </Button>
            </div>
          )
        }
        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingGuru(guru)
                setFormData({
                  nama: guru.nama,
                  jabatan: guru.jabatan || "",
                  nip: guru.nip || "",
                  nuptk: guru.nuptk || "",
                  alamat: guru.alamat || "",
                  noTelp: guru.noTelp || "",
                  email: guru.user.email,
                })
                setDialogOpen(true)
              }}
              className="p-2 sm:px-3 sm:py-1"
            >
              <Edit className="h-4 w-4" /><span className="hidden sm:inline ml-1">Edit</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialog({ open: true, id: guru.id, restore: false })}
              className="p-2 sm:px-3 sm:py-1"
            >
              <Trash2 className="h-4 w-4" /><span className="hidden sm:inline ml-1">Hapus</span>
            </Button>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    rowCount: total,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.nama || !formData.email) {
      toast.error("Nama dan Email harus diisi")
      return
    }
    setSubmitting(true)
    try {
if (editingGuru) {
        await updateGuru(editingGuru.id, {
          nama: formData.nama,
          jabatan: formData.jabatan || undefined,
          nip: formData.nip || undefined,
          nuptk: formData.nuptk || undefined,
          alamat: formData.alamat || undefined,
          noTelp: formData.noTelp || undefined,
        })
        toast.success("Guru berhasil diperbarui")
      } else {
        await createGuru({
          nama: formData.nama,
          jabatan: formData.jabatan || undefined,
          nip: formData.nip || undefined,
          nuptk: formData.nuptk || undefined,
          alamat: formData.alamat || undefined,
          noTelp: formData.noTelp || undefined,
          email: formData.email,
        })
        toast.success("Guru berhasil ditambahkan")
      }
      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteRestore() {
    try {
      if (deleteDialog.restore) {
        await restoreGuru(deleteDialog.id)
        toast.success("Guru berhasil direstore")
      } else {
        await deleteGuru(deleteDialog.id)
        toast.success("Guru berhasil dinonaktifkan")
      }
      setDeleteDialog({ open: false, id: "", restore: false })
      fetchData()
    } catch {
      toast.error("Terjadi kesalahan")
    }
  }

function resetForm() {
    setEditingGuru(null)
    setFormData({ nama: "", jabatan: "", nip: "", nuptk: "", alamat: "", noTelp: "", email: "" })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Data Guru</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="sm:hidden p-2" title="Import">
            <Upload className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <Button variant="outline" size="sm" className="sm:hidden p-2" title="Excel">
            <FileSpreadsheet className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="sm:hidden p-2" title="PDF">
            <FileText className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Tambah Guru</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari guru..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select
          value={includeDeleted ? "all" : "active"}
          onValueChange={(v) => { setIncludeDeleted(v === "all"); setPage(1) }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
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
                  <TableHead
                    key={h.id}
                    style={{ width: h.getSize() }}
                    onClick={h.column.getToggleSortingHandler()}
                    className={h.column.getCanSort() ? "cursor-pointer select-none" : ""}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, ci) => (
                    <TableCell key={ci}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  {search ? "Tidak ada guru yang sesuai pencarian" : "Belum ada data guru"}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Total: {total} data
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGuru ? "Edit Guru" : "Tambah Guru"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nama Lengkap *</label>
                <Input
                  value={formData.nama}
                  onChange={(e) => setFormData((f) => ({ ...f, nama: e.target.value }))}
                  placeholder="Nama guru"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email *</label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@sekolah.sch.id"
                  disabled={!!editingGuru}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Jabatan</label>
                <Select
                  value={formData.jabatan}
                  onValueChange={(v) => setFormData((f) => ({ ...f, jabatan: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jabatan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Guru</SelectItem>
                    <SelectItem value="BK">BK / BP</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">BK / BP mendapat menu Pelanggaran untuk semua kelas</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">NIP</label>
                <Input
                  value={formData.nip}
                  onChange={(e) => setFormData((f) => ({ ...f, nip: e.target.value }))}
                  placeholder="NIP"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">NUPTK</label>
                <Input
                  value={formData.nuptk}
                  onChange={(e) => setFormData((f) => ({ ...f, nuptk: e.target.value }))}
                  placeholder="NUPTK"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">No Telp</label>
                <Input
                  value={formData.noTelp}
                  onChange={(e) => setFormData((f) => ({ ...f, noTelp: e.target.value }))}
                  placeholder="0812xxxx"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Alamat</label>
                <Input
                  value={formData.alamat}
                  onChange={(e) => setFormData((f) => ({ ...f, alamat: e.target.value }))}
                  placeholder="Alamat"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingGuru ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialog.open}
        onOpenChange={(o) => setDeleteDialog({ open: o, id: "", restore: false })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deleteDialog.restore ? "Restore Guru" : "Nonaktifkan Guru"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteDialog.restore
              ? "Apakah Anda yakin ingin mengembalikan data guru ini?"
              : "Guru yang dinonaktifkan tidak akan muncul di daftar aktif. Anda dapat mengembalikannya nanti."}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, id: "", restore: false })}>
              Batal
            </Button>
            <Button
              variant={deleteDialog.restore ? "default" : "destructive"}
              onClick={handleDeleteRestore}
            >
              {deleteDialog.restore ? "Restore" : "Nonaktifkan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

