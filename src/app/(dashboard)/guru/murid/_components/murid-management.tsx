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
import { Label } from "@/components/ui/label"
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
  Users,
  Plus,
  UserPlus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react"
import {
  getGuruMurids,
  getGuruPendingMurids,
  createGuruMurid,
  updateGuruMurid,
  deleteGuruMurid,
} from "../../actions"

interface Murid {
  id: string
  nama: string
  nis: string | null
  nisn: string | null
  alamat: string | null
  noTelp: string | null
  kelasId: string | null
  user: { email: string; isActive: boolean }
  kelas: { nama: string; tingkat: number } | null
}

interface KelasRef {
  id: string
  nama: string
  tingkat: number
}

interface Props {
  initialData: Murid[]
  initialTotal: number
  initialTotalPages: number
  initialPage: number
  initialSearch: string
  initialKelasId: string
  kelasRefs: KelasRef[]
  initialTab?: string
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t) }, [value, delay])
  return debounced
}

export function MuridManagement(props: Props) {
  const router = useRouter()

  const [tab, setTab] = useState(props.initialTab || "saya")
  const [data, setData] = useState<Murid[]>(props.initialData)
  const [total, setTotal] = useState(props.initialTotal)
  const [totalPages, setTotalPages] = useState(props.initialTotalPages)
  const [page, setPage] = useState(props.initialPage)
  const [search, setSearch] = useState(props.initialSearch)
  const [kelasId, setKelasId] = useState(props.initialKelasId)
  const [loading, setLoading] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMurid, setEditingMurid] = useState<Murid | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    nama: "",
    email: "",
    nis: "",
    nisn: "",
    alamat: "",
    noTelp: "",
    kelasId: "",
    password: "",
  })

  const debouncedSearch = useDebounce(search, 300)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      let result
      if (tab === "pendaftar") {
        result = await getGuruPendingMurids({ search: debouncedSearch, page, limit: 10 })
      } else {
        result = await getGuruMurids({ search: debouncedSearch, page, limit: 10, kelasId: kelasId || undefined })
      }
      setData(result.data as Murid[])
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch {
      toast.error("Gagal memuat data murid")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, kelasId, tab])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (page > 1) params.set("page", String(page))
    if (tab === "pendaftar") params.set("tab", "pendaftar")
    else if (kelasId) params.set("kelas", kelasId)
    router.replace(`/guru/murid?${params.toString()}`, { scroll: false })
  }, [debouncedSearch, page, kelasId, tab, router])

  function resetForm() {
    setFormData({ nama: "", email: "", nis: "", nisn: "", alamat: "", noTelp: "", kelasId: "", password: "" })
  }

  function openCreateDialog() {
    setEditingMurid(null)
    resetForm()
    setDialogOpen(true)
  }

  function openEditDialog(murid: Murid) {
    setEditingMurid(murid)
    setFormData({
      nama: murid.nama,
      email: murid.user.email,
      nis: murid.nis || "",
      nisn: murid.nisn || "",
      alamat: murid.alamat || "",
      noTelp: murid.noTelp || "",
      kelasId: murid.kelasId || "",
      password: "",
    })
    setDialogOpen(true)
  }

  function switchTab(newTab: string) {
    setTab(newTab)
    setPage(1)
    setSearch("")
    setKelasId("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.nama.trim()) { toast.error("Nama harus diisi"); return }
    if (!formData.email.trim() && !editingMurid) { toast.error("Email harus diisi"); return }
    if (!formData.kelasId) { toast.error("Kelas harus dipilih"); return }

    setSubmitting(true)
    try {
      if (editingMurid) {
        await updateGuruMurid(editingMurid.id, {
          nama: formData.nama,
          nis: formData.nis || undefined,
          nisn: formData.nisn || undefined,
          alamat: formData.alamat || undefined,
          noTelp: formData.noTelp || undefined,
          kelasId: formData.kelasId,
        })
        toast.success("Murid berhasil diperbarui")
      } else {
        await createGuruMurid({
          nama: formData.nama,
          email: formData.email,
          nis: formData.nis || undefined,
          nisn: formData.nisn || undefined,
          alamat: formData.alamat || undefined,
          noTelp: formData.noTelp || undefined,
          kelasId: formData.kelasId,
          password: formData.password || undefined,
        })
        toast.success("Murid berhasil ditambahkan")
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

  async function handleDelete(id: string) {
    if (!confirm("Yakin ingin menonaktifkan murid ini?")) return
    try {
      await deleteGuruMurid(id)
      toast.success("Murid berhasil dinonaktifkan")
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan")
    }
  }

  const columns: ColumnDef<Murid>[] = [
    {
      header: "No",
      cell: ({ row }) => (page - 1) * 10 + row.index + 1,
      size: 60,
    },
    { accessorKey: "nama", header: "Nama" },
    { accessorKey: "nis", header: "NIS", cell: ({ row }) => row.original.nis || "-" },
    { accessorKey: "nisn", header: "NISN", cell: ({ row }) => row.original.nisn || "-" },
    {
      header: "Kelas",
      cell: ({ row }) => row.original.kelas?.nama || "-",
    },
    {
      header: tab === "pendaftar" ? "Email" : "Status",
      cell: ({ row }) =>
        tab === "pendaftar" ? (
          <span className="text-sm truncate max-w-[180px] block">{row.original.user.email}</span>
        ) : (
          <Badge variant={row.original.user.isActive ? "success" : "destructive"}>
            {row.original.user.isActive ? "Aktif" : "Nonaktif"}
          </Badge>
        ),
    },
    {
      header: "Aksi",
      cell: ({ row }) => {
        const murid = row.original
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="p-2 sm:px-3 sm:py-1" onClick={() => openEditDialog(murid)} title="Edit">
              <Edit className="h-4 w-4" /><span className="hidden sm:inline ml-1">Edit</span>
            </Button>
            <Button variant="ghost" size="sm" className="p-2 sm:px-3 sm:py-1 text-destructive" onClick={() => handleDelete(murid.id)} title="Nonaktifkan">
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Data Murid
        </h1>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground hidden sm:block">Total: {total} murid</p>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Tambah Murid</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => switchTab("saya")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "saya"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Murid Saya
        </button>
        <button
          onClick={() => switchTab("pendaftar")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-1.5 ${
            tab === "pendaftar"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Pendaftar Baru
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tab === "pendaftar" ? "Cari pendaftar..." : "Cari murid..."}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        {tab !== "pendaftar" && props.kelasRefs.length > 0 && (
          <Select value={kelasId} onValueChange={(v) => { setKelasId(v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Semua Kelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua Kelas</SelectItem>
              {props.kelasRefs.map((k) => (
                <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
                  {search
                    ? "Tidak ada data yang sesuai pencarian"
                    : tab === "pendaftar"
                      ? "Belum ada pendaftar baru"
                      : "Belum ada murid di kelas Anda"}
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm text-muted-foreground">Total: {total} murid</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Sebelumnya
            </Button>
            <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Selanjutnya <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMurid ? "Edit Murid" : "Tambah Murid Baru"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nama">Nama Lengkap</Label>
              <Input id="nama" value={formData.nama} onChange={(e) => setFormData((p) => ({ ...p, nama: e.target.value }))} placeholder="Nama siswa" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} placeholder="email@sekolah.com" required={!editingMurid} disabled={!!editingMurid} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kelas">Kelas</Label>
                <Select value={formData.kelasId} onValueChange={(v) => setFormData((p) => ({ ...p, kelasId: v }))}>
                  <SelectTrigger id="kelas"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent>
                    {props.kelasRefs.map((k) => (
                      <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nis">NIS</Label>
                <Input id="nis" value={formData.nis} onChange={(e) => setFormData((p) => ({ ...p, nis: e.target.value }))} placeholder="Nomor Induk Siswa" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nisn">NISN</Label>
                <Input id="nisn" value={formData.nisn} onChange={(e) => setFormData((p) => ({ ...p, nisn: e.target.value }))} placeholder="NISN" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="alamat">Alamat</Label>
                <Input id="alamat" value={formData.alamat} onChange={(e) => setFormData((p) => ({ ...p, alamat: e.target.value }))} placeholder="Alamat" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="noTelp">No. Telepon</Label>
                <Input id="noTelp" value={formData.noTelp} onChange={(e) => setFormData((p) => ({ ...p, noTelp: e.target.value }))} placeholder="08xxx" />
              </div>
            </div>
            {!editingMurid && (
              <div className="space-y-2">
                <Label htmlFor="password">Password <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                <Input id="password" type="text" value={formData.password} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} placeholder="Kosongkan untuk auto-generate" />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Menyimpan...</> : editingMurid ? "Simpan" : "Tambah Murid"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
