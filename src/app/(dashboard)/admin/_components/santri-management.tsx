"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight, Loader2, Users, HeartHandshake, MapPin, History,
} from "lucide-react"
import {
  getSantris, getSiswaOpts, createSantriDariSiswa, createSantriNonformal, updateSantri, deleteSantri,
  getWaliOpts, createWali, deleteWali, assignWaliToSantri, unassignWaliFromSantri,
  updateKeberadaan, getSantriStatusLog,
} from "../santri/actions"

interface SantriWaliItem { isPrimary: boolean; wali: { id: string; nama: string; hubungan: string; noTelp: string | null } }
interface Santri {
  id: string
  nisNo: string | null
  nama: string
  status: string
  keberadaan: string
  tanggalMasuk: string | null
  catatan: string | null
  user: { email: string; isActive: boolean }
  siswa: { id: string; nis: string | null; nama: string; kelas: { nama: string } | null } | null
  walis: SantriWaliItem[]
}
interface SiswaOpt { id: string; nama: string; nis: string | null; kelas: { nama: string } | null; user: { email: string } }
interface WaliOpt { id: string; nama: string; hubungan: string; noTelp: string | null; _count: { anak: number } }

const STATUS_LABEL: Record<string, string> = {
  CALON: "Calon", AKTIF: "Aktif", CUTI: "Cuti", NONAKTIF: "Nonaktif",
  MUTASI: "Mutasi", LULUS: "Lulus", ALUMNI: "Alumni", KELUAR: "Keluar",
}
const STATUS_CLASS: Record<string, string> = {
  AKTIF: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  CALON: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  CUTI: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  LULUS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ALUMNI: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
}
const HUBUNGAN_LABEL: Record<string, string> = { AYAH: "Ayah", IBU: "Ibu", WALI: "Wali", LAINNYA: "Lainnya" }
const KEBERADAAN_LABEL: Record<string, string> = {
  DI_PONDOK: "Di Pondok", KEGIATAN_LUAR: "Kegiatan Luar", IZIN_KELUAR: "Izin Keluar",
  IZIN_PULANG: "Izin Pulang", DALAM_PERJALANAN: "Dalam Perjalanan", DI_RUMAH: "Di Rumah",
  TERLAMBAT_KEMBALI: "Terlambat Kembali", BELUM_KEMBALI: "Belum Kembali", TIDAK_DIKETAHUI: "Tidak Diketahui",
}
const KEBERADAAN_CLASS: Record<string, string> = {
  DI_PONDOK: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  KEGIATAN_LUAR: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  IZIN_KELUAR: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  IZIN_PULANG: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  DALAM_PERJALANAN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  DI_RUMAH: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  TERLAMBAT_KEMBALI: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  BELUM_KEMBALI: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  TIDAK_DIKETAHUI: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t) }, [value, delay])
  return debounced
}

interface Props {
  initialData: Santri[]
  initialTotal: number
  initialTotalPages: number
  initialPage: number
  initialSearch: string
  initialStatus: string
}

export function SantriManagement(props: Props) {
  const router = useRouter()

  const [data, setData] = useState<Santri[]>(props.initialData)
  const [total, setTotal] = useState(props.initialTotal)
  const [totalPages, setTotalPages] = useState(props.initialTotalPages)
  const [page, setPage] = useState(props.initialPage)
  const [search, setSearch] = useState(props.initialSearch)
  const [status, setStatus] = useState(props.initialStatus)
  const [loading, setLoading] = useState(false)

  const debouncedSearch = useDebounce(search, 500)

  const load = useCallback(async (p: number, s: string, st: string) => {
    setLoading(true)
    try {
      const res = await getSantris({ search: s, page: p, limit: 10, status: st || undefined })
      setData(res.data as any)
      setTotal(res.total)
      setTotalPages(res.totalPages)
      setPage(res.page)
    } catch {
      toast.error("Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(1, debouncedSearch, status); router.refresh() }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(1, search, status); router.refresh() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── dialog tambah (2 mode) ──
  const [addOpen, setAddOpen] = useState(false)
  const [addMode, setAddMode] = useState<"siswa" | "nonformal">("siswa")
  const [submitting, setSubmitting] = useState(false)
  const [siswaOpts, setSiswaOpts] = useState<SiswaOpt[]>([])
  const [siswaSearch, setSiswaSearch] = useState("")
  const [siswaId, setSiswaId] = useState("")
  const [form, setForm] = useState({ nama: "", email: "", password: "", nisNo: "", noTelp: "", tanggalMasuk: "", catatan: "" })

  const resetAdd = () => { setForm({ nama: "", email: "", password: "", nisNo: "", noTelp: "", tanggalMasuk: "", catatan: "" }); setSiswaId(""); setSiswaSearch(""); setSiswaOpts([]) }

  const openAdd = () => { resetAdd(); setAddMode("siswa"); setAddOpen(true) }

  useEffect(() => {
    if (!addOpen || addMode !== "siswa") return
    const t = setTimeout(async () => {
      try { setSiswaOpts(await getSiswaOpts(siswaSearch)) } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(t)
  }, [addOpen, addMode, siswaSearch])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (addMode === "siswa") {
        if (!siswaId) throw new Error("Pilih siswa terlebih dahulu")
        await createSantriDariSiswa({ siswaId, nisNo: form.nisNo || undefined, tanggalMasuk: form.tanggalMasuk || undefined, catatan: form.catatan || undefined })
      } else {
        await createSantriNonformal({ ...form })
      }
      toast.success("Santri berhasil didaftarkan")
      setAddOpen(false)
      resetAdd()
      load(1, search, status)
    } catch (err: any) {
      toast.error(err?.message || "Gagal mendaftarkan santri")
    } finally {
      setSubmitting(false)
    }
  }

  // ── dialog edit ──
  const [editing, setEditing] = useState<Santri | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ nisNo: "", tanggalMasuk: "", catatan: "", status: "AKTIF" })

  const openEdit = (s: Santri) => {
    setEditing(s)
    setEditForm({ nisNo: s.nisNo || "", tanggalMasuk: s.tanggalMasuk ? s.tanggalMasuk.slice(0, 10) : "", catatan: s.catatan || "", status: s.status })
    setEditOpen(true)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSubmitting(true)
    try {
      await updateSantri(editing.id, { ...editForm, status: editForm.status as any })
      toast.success("Data santri diperbarui")
      setEditOpen(false)
      setEditing(null)
      load(page, search, status)
    } catch (err: any) {
      toast.error(err?.message || "Gagal memperbarui")
    } finally {
      setSubmitting(false)
    }
  }

  // ── delete ──
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const handleDelete = async () => {
    if (!deleteId) return
    setSubmitting(true)
    try {
      await deleteSantri(deleteId)
      toast.success("Santri dinonaktifkan (akun tetap tersimpan)")
      setDeleteId(null)
      load(page, search, status)
    } catch (err: any) {
      toast.error(err?.message || "Gagal menonaktifkan")
    } finally {
      setSubmitting(false)
    }
  }

  // ── dialog keberadaan ──
  const [kebSantri, setKebSantri] = useState<Santri | null>(null)
  const [kebValue, setKebValue] = useState("")
  const [kebAlasan, setKebAlasan] = useState("")
  const [kebSubmitting, setKebSubmitting] = useState(false)

  const openKeb = (s: Santri) => { setKebSantri(s); setKebValue(s.keberadaan); setKebAlasan("") }

  const handleKeb = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kebSantri || !kebValue) return
    setKebSubmitting(true)
    try {
      await updateKeberadaan(kebSantri.id, kebValue as any, kebAlasan || undefined)
      toast.success("Keberadaan santri diperbarui")
      setKebSantri(null)
      load(page, search, status)
    } catch (err: any) {
      toast.error(err?.message || "Gagal memperbarui")
    } finally {
      setKebSubmitting(false)
    }
  }

  // ── dialog riwayat status ──
  const [riwayatSantri, setRiwayatSantri] = useState<Santri | null>(null)
  const [riwayat, setRiwayat] = useState<any[]>([])
  const [riwayatLoading, setRiwayatLoading] = useState(false)

  const openRiwayat = async (s: Santri) => {
    setRiwayatSantri(s)
    setRiwayatLoading(true)
    setRiwayat([])
    try { setRiwayat(await getSantriStatusLog(s.id)) } catch { toast.error("Gagal memuat riwayat") }
    finally { setRiwayatLoading(false) }
  }

  // ── dialog wali ──
  const [waliSantri, setWaliSantri] = useState<Santri | null>(null)
  const [waliOpts, setWaliOpts] = useState<WaliOpt[]>([])
  const [waliSearch, setWaliSearch] = useState("")
  const [pilihWaliId, setPilihWaliId] = useState("")
  const [waliBaruOpen, setWaliBaruOpen] = useState(false)
  const [waliBaru, setWaliBaru] = useState({ nama: "", hubungan: "AYAH", noTelp: "" })
  const [waliSubmitting, setWaliSubmitting] = useState(false)

  const openWali = (s: Santri) => { setWaliSantri(s); setWaliSearch(""); setPilihWaliId(""); setWaliBaruOpen(false) }

  useEffect(() => {
    if (!waliSantri) return
    const t = setTimeout(async () => {
      try { setWaliOpts(await getWaliOpts(waliSearch)) } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(t)
  }, [waliSantri, waliSearch])

  const handleAssign = async () => {
    if (!waliSantri || !pilihWaliId) return
    setWaliSubmitting(true)
    try {
      await assignWaliToSantri(waliSantri.id, pilihWaliId)
      toast.success("Wali ditambahkan")
      const fresh = await getSantris({ search, page, limit: 10, status: status || undefined })
      setData(fresh.data as any)
      setWaliSantri((fresh.data as any[]).find((d) => d.id === waliSantri.id) || null)
      setPilihWaliId("")
    } catch (err: any) {
      toast.error(err?.message || "Gagal menambahkan wali")
    } finally {
      setWaliSubmitting(false)
    }
  }

  const handleUnassign = async (waliId: string) => {
    if (!waliSantri) return
    setWaliSubmitting(true)
    try {
      await unassignWaliFromSantri(waliSantri.id, waliId)
      toast.success("Wali dihapus dari santri")
      const fresh = await getSantris({ search, page, limit: 10, status: status || undefined })
      setData(fresh.data as any)
      setWaliSantri((fresh.data as any[]).find((d) => d.id === waliSantri.id) || null)
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus")
    } finally {
      setWaliSubmitting(false)
    }
  }

  const handleCreateWali = async (e: React.FormEvent) => {
    e.preventDefault()
    setWaliSubmitting(true)
    try {
      const wali = await createWali(waliBaru as any)
      toast.success("Wali dibuat & ditautkan")
      const sid = waliSantri?.id
      if (sid) await assignWaliToSantri(sid, wali.id)
      setWaliBaru({ nama: "", hubungan: "AYAH", noTelp: "" })
      setWaliBaruOpen(false)
      const fresh = await getSantris({ search, page, limit: 10, status: status || undefined })
      setData(fresh.data as any)
      setWaliSantri(sid ? ((fresh.data as any[]).find((d) => d.id === sid) || null) : null)
    } catch (err: any) {
      toast.error(err?.message || "Gagal membuat wali")
    } finally {
      setWaliSubmitting(false)
    }
  }

  const tersediaUntukAssign = waliOpts.filter((w) => !waliSantri?.walis.some((x) => x.wali.id === w.id))

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Santri</h1>
          <p className="text-muted-foreground mt-1">Identitas terpadu kepesantrenan — satu akun dengan siswa sekolah</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Daftarkan Santri</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari nama, NISantri, atau email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="flex h-10 w-full sm:w-44 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm">
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">No</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead className="hidden sm:table-cell">NISantri</TableHead>
              <TableHead className="hidden sm:table-cell">Akun</TableHead>
              <TableHead className="hidden md:table-cell">Siswa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Kehadiran</TableHead>
              <TableHead className="hidden md:table-cell">Wali</TableHead>
              <TableHead className="w-48">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 9 }).map((_, ci) => <TableCell key={ci}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                {search || status ? "Tidak ada santri yang sesuai" : "Belum ada data santri"}
              </TableCell></TableRow>
            ) : (
              data.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{(page - 1) * 10 + idx + 1}</TableCell>
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell className="hidden sm:table-cell"><Badge variant="outline">{item.nisNo || "-"}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{item.user.email}{!item.user.isActive && <Badge variant="destructive" className="ml-1">Nonaktif</Badge>}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {item.siswa ? `${item.siswa.nama}${item.siswa.kelas ? ` · ${item.siswa.kelas.nama}` : ""}` : <span className="italic">Nonformal</span>}
                  </TableCell>
                  <TableCell><Badge className={STATUS_CLASS[item.status] || ""}>{STATUS_LABEL[item.status] || item.status}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell"><Badge className={KEBERADAAN_CLASS[item.keberadaan] || ""}>{KEBERADAAN_LABEL[item.keberadaan] || item.keberadaan}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{item.walis.length ? item.walis.map((w) => w.wali.nama).join(", ") : "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => openWali(item)} className="p-2" title="Kelola Wali">
                        <HeartHandshake className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openKeb(item)} className="p-2" title="Ubah Keberadaan">
                        <MapPin className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openRiwayat(item)} className="p-2" title="Riwayat Status">
                        <History className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(item)} className="p-2" title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteId(item.id)} className="p-2" title="Nonaktifkan">
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
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => load(page - 1, search, status)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => load(page + 1, search, status)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Dialog Tambah */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAdd() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Daftarkan Santri</DialogTitle></DialogHeader>
          <div className="flex gap-2 mb-2">
            <Button type="button" variant={addMode === "siswa" ? "default" : "outline"} size="sm" onClick={() => setAddMode("siswa")}>Siswa Sekolah</Button>
            <Button type="button" variant={addMode === "nonformal" ? "default" : "outline"} size="sm" onClick={() => setAddMode("nonformal")}>Santri Nonformal</Button>
          </div>
          <form onSubmit={handleAdd} className="space-y-4">
            {addMode === "siswa" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pilih Siswa *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Cari siswa (nama/NIS)..." value={siswaSearch} onChange={(e) => setSiswaSearch(e.target.value)} className="pl-9" />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                    {siswaOpts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">Tidak ada siswa tersedia (semua sudah jadi santri?)</p>
                    ) : siswaOpts.map((s) => (
                      <label key={s.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                        <input type="radio" name="siswa" checked={siswaId === s.id} onChange={() => setSiswaId(s.id)} />
                        <span className="text-sm font-medium">{s.nama}</span>
                        <span className="text-xs text-muted-foreground">{s.nis || "-"} · {s.kelas?.nama || "-"} · {s.user.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nomor Induk Santri (NISantri)</label>
                  <Input value={form.nisNo} onChange={(e) => setForm((f) => ({ ...f, nisNo: e.target.value }))} placeholder="Kosongkan bila belum ada" />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Santri *</label>
                  <Input value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} placeholder="Nama lengkap santri" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Akun *</label>
                    <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@contoh.com" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password *</label>
                    <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min. 6 karakter" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">NISantri</label>
                    <Input value={form.nisNo} onChange={(e) => setForm((f) => ({ ...f, nisNo: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">No. Telp</label>
                    <Input value={form.noTelp} onChange={(e) => setForm((f) => ({ ...f, noTelp: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tanggal Masuk</label>
                <Input type="date" value={form.tanggalMasuk} onChange={(e) => setForm((f) => ({ ...f, tanggalMasuk: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Catatan</label>
                <Input value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} placeholder="Opsional" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setAddOpen(false); resetAdd() }}>Batal</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Daftarkan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Edit */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditing(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Santri — {editing?.nama}</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nomor Induk Santri</label>
              <Input value={editForm.nisNo} onChange={(e) => setEditForm((f) => ({ ...f, nisNo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status Administrasi</label>
              <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm">
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tanggal Masuk</label>
              <Input type="date" value={editForm.tanggalMasuk} onChange={(e) => setEditForm((f) => ({ ...f, tanggalMasuk: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Catatan</label>
              <Input value={editForm.catatan} onChange={(e) => setEditForm((f) => ({ ...f, catatan: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setEditOpen(false); setEditing(null) }}>Batal</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Hapus */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nonaktifkan Santri</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Status santri menjadi KELUAR (soft-delete). Akun pengguna dan data siswa TIDAK dihapus — histori tetap tersimpan.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Nonaktifkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Wali */}
      <Dialog open={!!waliSantri} onOpenChange={(o) => { if (!o) setWaliSantri(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Wali Santri — {waliSantri?.nama}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {waliSantri?.walis.length ? waliSantri.walis.map((w) => (
                <div key={w.wali.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{w.wali.nama} {w.isPrimary && <Badge className="ml-1 bg-primary/10 text-primary">Utama</Badge>}</p>
                    <p className="text-xs text-muted-foreground">{HUBUNGAN_LABEL[w.wali.hubungan] || w.wali.hubungan}{w.wali.noTelp ? ` · ${w.wali.noTelp}` : ""}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleUnassign(w.wali.id)} disabled={waliSubmitting}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )) : <p className="text-sm text-muted-foreground text-center py-2">Belum ada wali terhubung</p>}
            </div>

            {!waliBaruOpen ? (
              <div className="space-y-2 border-t pt-3">
                <label className="text-sm font-medium">Tambah Wali</label>
                <div className="flex gap-2">
                  <select value={pilihWaliId} onChange={(e) => setPilihWaliId(e.target.value)} className="flex h-10 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm">
                    <option value="">— Pilih wali terdaftar —</option>
                    {tersediaUntukAssign.map((w) => <option key={w.id} value={w.id}>{w.nama} ({HUBUNGAN_LABEL[w.hubungan] || w.hubungan}{w._count.anak ? ` · ${w._count.anak} anak` : ""})</option>)}
                  </select>
                  <Button variant="outline" size="sm" onClick={() => setWaliBaruOpen(true)} title="Buat wali baru"><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Cari wali..." value={waliSearch} onChange={(e) => setWaliSearch(e.target.value)} className="pl-9" />
                </div>
                <Button className="w-full" onClick={handleAssign} disabled={!pilihWaliId || waliSubmitting}>
                  {waliSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Hubungkan Wali
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreateWali} className="space-y-3 border-t pt-3">
                <label className="text-sm font-medium">Wali Baru</label>
                <Input placeholder="Nama wali" value={waliBaru.nama} onChange={(e) => setWaliBaru((f) => ({ ...f, nama: e.target.value }))} required />
                <div className="grid grid-cols-2 gap-3">
                  <select value={waliBaru.hubungan} onChange={(e) => setWaliBaru((f) => ({ ...f, hubungan: e.target.value }))} className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm">
                    {Object.entries(HUBUNGAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <Input placeholder="No. telp" value={waliBaru.noTelp} onChange={(e) => setWaliBaru((f) => ({ ...f, noTelp: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setWaliBaruOpen(false)}>Batal</Button>
                  <Button type="submit" size="sm" disabled={waliSubmitting}>
                    {waliSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Buat & Tautkan
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Ubah Keberadaan */}
      <Dialog open={!!kebSantri} onOpenChange={(o) => { if (!o) setKebSantri(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Ubah Keberadaan — {kebSantri?.nama}</DialogTitle></DialogHeader>
          <form onSubmit={handleKeb} className="space-y-4">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Saat ini:</span>{" "}
              <Badge className={KEBERADAAN_CLASS[kebSantri?.keberadaan || ""]}>{KEBERADAAN_LABEL[kebSantri?.keberadaan || ""] || kebSantri?.keberadaan}</Badge>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Kehadiran Baru *</label>
              <select value={kebValue} onChange={(e) => setKebValue(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm">
                {Object.entries(KEBERADAAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Alasan (opsional)</label>
              <Input placeholder="Misal: izin keluarga, kegiatan luar..." value={kebAlasan} onChange={(e) => setKebAlasan(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setKebSantri(null)}>Batal</Button>
              <Button type="submit" size="sm" disabled={kebSubmitting || !kebValue}>
                {kebSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Riwayat Status */}
      <Dialog open={!!riwayatSantri} onOpenChange={(o) => { if (!o) setRiwayatSantri(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Riwayat Status — {riwayatSantri?.nama}</DialogTitle></DialogHeader>
          {riwayatLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : riwayat.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Belum ada riwayat perubahan status</p>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-3">
              {riwayat.map((log) => (
                <div key={log.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant={log.jenis === "KEBERADAAN" ? "default" : "secondary"}>{log.jenis === "KEBERADAAN" ? "Keberadaan" : "Administrasi"}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {log.jenis === "KEBERADAAN" ? (
                      <>
                        <Badge className={KEBERADAAN_CLASS[log.dari] || ""}>{KEBERADAAN_LABEL[log.dari] || log.dari}</Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge className={KEBERADAAN_CLASS[log.ke] || ""}>{KEBERADAAN_LABEL[log.ke] || log.ke}</Badge>
                      </>
                    ) : (
                      <>
                        <Badge className={STATUS_CLASS[log.dari] || ""}>{STATUS_LABEL[log.dari] || log.dari}</Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge className={STATUS_CLASS[log.ke] || ""}>{STATUS_LABEL[log.ke] || log.ke}</Badge>
                      </>
                    )}
                  </div>
                  {log.alasan && <p className="mt-1 text-xs text-muted-foreground">Alasan: {log.alasan}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
