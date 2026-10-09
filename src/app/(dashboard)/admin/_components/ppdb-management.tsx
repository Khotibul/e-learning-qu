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
  Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight, Loader2, Route, ArrowRight,
} from "lucide-react"
import {
  getGelombangs, createGelombang, updateGelombang, deleteGelombang, updateStatusGelombang,
  createJalur, updateJalur, deleteJalur, getTahunAjaranOpts,
} from "../ppdb/actions"

interface Jalur { id: string; nama: string; deskripsi: string | null; kuota: number | null; isActive: boolean }
interface Gelombang {
  id: string
  nama: string
  unit: string | null
  jenjang: string | null
  program: string | null
  tanggalBuka: string
  tanggalTutup: string
  status: string
  kuota: number | null
  biayaDaftar: number | null
  jadwalSeleksi: string | null
  jadwalPengumuman: string | null
  jadwalDaftarUlang: string | null
  deskripsi: string | null
  tahunAjaran: { id: string; nama: string }
  jalur: Jalur[]
}

interface Props {
  initialData: Gelombang[]
  initialTotal: number
  initialTotalPages: number
  initialPage: number
  initialSearch: string
  initialStatus: string
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", DIJADWALKAN: "Dijadwalkan", DIBUKA: "Dibuka", DITUTUP: "Ditutup",
  SELEKSI: "Seleksi", PENGUMUMAN: "Pengumuman", DAFTAR_ULANG: "Daftar Ulang", SELESAI: "Selesai",
}
const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  DIJADWALKAN: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  DIBUKA: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DITUTUP: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  SELEKSI: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  PENGUMUMAN: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  DAFTAR_ULANG: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  SELESAI: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
}
const URUTAN: StatusGelombang[] = ["DRAFT", "DIJADWALKAN", "DIBUKA", "DITUTUP", "SELEKSI", "PENGUMUMAN", "DAFTAR_ULANG", "SELESAI"]
type StatusGelombang = "DRAFT" | "DIJADWALKAN" | "DIBUKA" | "DITUTUP" | "SELEKSI" | "PENGUMUMAN" | "DAFTAR_ULANG" | "SELESAI"

function nextStatus(s: string): StatusGelombang | null {
  const i = URUTAN.indexOf(s as StatusGelombang)
  return i >= 0 && i < URUTAN.length - 1 ? URUTAN[i + 1] : null
}
function prevStatus(s: string): StatusGelombang | null {
  const i = URUTAN.indexOf(s as StatusGelombang)
  if (i <= 0) return null
  return i === 2 ? "DRAFT" : URUTAN[i - 1] // index 2 = DIBUKA, mundur → reset DRAFT
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtTanggal(iso: string | null): string {
  if (!iso) return "-"
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}
function fmtRupiah(n: number | null): string {
  if (n == null) return "-"
  return n === 0 ? "Gratis" : `Rp ${n.toLocaleString("id-ID")}`
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t) }, [value, delay])
  return debounced
}

const FORM_KOSONG = {
  nama: "", tahunAjaranId: "", unit: "", jenjang: "", program: "",
  tanggalBuka: "", tanggalTutup: "", kuota: "", biayaDaftar: "",
  jadwalSeleksi: "", jadwalPengumuman: "", jadwalDaftarUlang: "", deskripsi: "",
}

export function PpdbManagement(props: Props) {
  const router = useRouter()

  const [data, setData] = useState<Gelombang[]>(props.initialData)
  const [total, setTotal] = useState(props.initialTotal)
  const [totalPages, setTotalPages] = useState(props.initialTotalPages)
  const [page, setPage] = useState(props.initialPage)
  const [search, setSearch] = useState(props.initialSearch)
  const [statusFilter, setStatusFilter] = useState(props.initialStatus)
  const [loading, setLoading] = useState(false)

  const debouncedSearch = useDebounce(search, 500)

  const load = useCallback(async (p: number, s: string, st: string) => {
    setLoading(true)
    try {
      const res = await getGelombangs({ search: s, page: p, limit: 10, status: st || undefined })
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

  useEffect(() => { load(1, debouncedSearch, statusFilter); router.refresh() }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(1, search, statusFilter); router.refresh() }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── dialog tambah/edit ──
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Gelombang | null>(null)
  const [form, setForm] = useState({ ...FORM_KOSONG })
  const [taOpts, setTaOpts] = useState<{ id: string; nama: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  // load tahun ajaran options (sekali)
  useEffect(() => {
    let cancelled = false
    getTahunAjaranOpts().then((opts) => { if (!cancelled) setTaOpts(opts) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...FORM_KOSONG })
    setDialogOpen(true)
  }
  const openEdit = (g: Gelombang) => {
    setEditing(g)
    setForm({
      nama: g.nama,
      tahunAjaranId: g.tahunAjaran.id,
      unit: g.unit || "",
      jenjang: g.jenjang || "",
      program: g.program || "",
      tanggalBuka: toLocalInput(g.tanggalBuka),
      tanggalTutup: toLocalInput(g.tanggalTutup),
      kuota: g.kuota != null ? String(g.kuota) : "",
      biayaDaftar: g.biayaDaftar != null ? String(g.biayaDaftar) : "",
      jadwalSeleksi: toLocalInput(g.jadwalSeleksi),
      jadwalPengumuman: toLocalInput(g.jadwalPengumuman),
      jadwalDaftarUlang: toLocalInput(g.jadwalDaftarUlang),
      deskripsi: g.deskripsi || "",
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nama || !form.tanggalBuka || !form.tanggalTutup) {
      toast.error("Nama, tanggal buka, dan tutup wajib diisi"); return
    }
    setSubmitting(true)
    try {
      const payload = {
        nama: form.nama,
        unit: form.unit || undefined,
        jenjang: form.jenjang || undefined,
        program: form.program || undefined,
        tanggalBuka: form.tanggalBuka,
        tanggalTutup: form.tanggalTutup,
        kuota: form.kuota ? parseInt(form.kuota) : null,
        biayaDaftar: form.biayaDaftar ? parseInt(form.biayaDaftar) : null,
        jadwalSeleksi: form.jadwalSeleksi || null,
        jadwalPengumuman: form.jadwalPengumuman || null,
        jadwalDaftarUlang: form.jadwalDaftarUlang || null,
        deskripsi: form.deskripsi || undefined,
      }
      if (editing) {
        await updateGelombang(editing.id, payload)
        toast.success("Gelombang diperbarui")
      } else {
        if (!form.tahunAjaranId) { toast.error("Pilih tahun ajaran"); setSubmitting(false); return }
        await createGelombang({ ...payload, tahunAjaranId: form.tahunAjaranId })
        toast.success("Gelombang dibuat (status Draft)")
      }
      setDialogOpen(false)
      load(page, search, statusFilter)
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan")
    } finally {
      setSubmitting(false)
    }
  }

  // ── transisi status ──
  const handleStatus = async (g: Gelombang, target: StatusGelombang) => {
    try {
      await updateStatusGelombang(g.id, target)
      toast.success(`Status → ${STATUS_LABEL[target]}`)
      load(page, search, statusFilter)
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengubah status")
    }
  }

  // ── hapus ──
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteGelombang(deleteId)
      toast.success("Gelombang dinonaktifkan")
      setDeleteId(null)
      load(page, search, statusFilter)
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus")
    }
  }

  // ── dialog jalur ──
  const [jalurGelombang, setJalurGelombang] = useState<Gelombang | null>(null)
  const [jalurForm, setJalurForm] = useState({ nama: "", deskripsi: "", kuota: "" })
  const [jalurSubmitting, setJalurSubmitting] = useState(false)
  const [editJalur, setEditJalur] = useState<Jalur | null>(null)

  const openJalur = (g: Gelombang) => { setJalurGelombang(g); setJalurForm({ nama: "", deskripsi: "", kuota: "" }); setEditJalur(null) }

  const handleJalurSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!jalurGelombang || !jalurForm.nama) return
    setJalurSubmitting(true)
    try {
      const payload = { nama: jalurForm.nama, deskripsi: jalurForm.deskripsi || undefined, kuota: jalurForm.kuota ? parseInt(jalurForm.kuota) : null }
      if (editJalur) {
        await updateJalur(editJalur.id, payload)
        toast.success("Jalur diperbarui")
      } else {
        await createJalur(jalurGelombang.id, payload)
        toast.success("Jalur ditambahkan")
      }
      setJalurForm({ nama: "", deskripsi: "", kuota: "" })
      setEditJalur(null)
      const fresh = await getGelombangs({ search, page, limit: 10, status: statusFilter || undefined })
      setData(fresh.data as any)
      setJalurGelombang((fresh.data as any[]).find((d) => d.id === jalurGelombang.id) || null)
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan jalur")
    } finally {
      setJalurSubmitting(false)
    }
  }

  const handleJalurDelete = async (jalurId: string) => {
    if (!jalurGelombang) return
    try {
      await deleteJalur(jalurId)
      toast.success("Jalur dihapus")
      const fresh = await getGelombangs({ search, page, limit: 10, status: statusFilter || undefined })
      setData(fresh.data as any)
      setJalurGelombang((fresh.data as any[]).find((d) => d.id === jalurGelombang.id) || null)
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus jalur")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">PPDB — Gelombang Pendaftaran</h1>
          <p className="text-sm text-muted-foreground">Manajemen penerimaan peserta didik &amp; santri baru</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Tambah Gelombang</span>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari gelombang..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex h-10 w-full sm:w-48 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm"
        >
          <option value="">Semua Status</option>
          {URUTAN.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">No</TableHead>
              <TableHead>Gelombang</TableHead>
              <TableHead className="hidden md:table-cell">TA</TableHead>
              <TableHead className="hidden lg:table-cell">Unit/Jenjang</TableHead>
              <TableHead className="hidden lg:table-cell">Periode</TableHead>
              <TableHead className="hidden md:table-cell">Kuota</TableHead>
              <TableHead className="hidden md:table-cell">Biaya</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-56">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 9 }).map((_, ci) => <TableCell key={ci}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                {search || statusFilter ? "Tidak ada gelombang yang sesuai" : "Belum ada gelombang pendaftaran"}
              </TableCell></TableRow>
            ) : (
              data.map((item, idx) => {
                const next = nextStatus(item.status)
                const prev = prevStatus(item.status)
                return (
                  <TableRow key={item.id}>
                    <TableCell>{(page - 1) * 10 + idx + 1}</TableCell>
                    <TableCell className="font-medium">
                      {item.nama}
                      <div className="text-xs text-muted-foreground font-normal">
                        {[item.unit, item.jenjang, item.program].filter(Boolean).join(" · ") || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{item.tahunAjaran.nama}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{item.unit || "-"} / {item.jenjang || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {fmtTanggal(item.tanggalBuka)} – {fmtTanggal(item.tanggalTutup)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{item.kuota ?? "∞"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{fmtRupiah(item.biayaDaftar)}</TableCell>
                    <TableCell><Badge className={STATUS_CLASS[item.status] || ""}>{STATUS_LABEL[item.status] || item.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {next && (
                          <Button variant="outline" size="sm" className="p-2" title={`Lanjut ke ${STATUS_LABEL[next]}`} onClick={() => handleStatus(item, next)}>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                        {prev && (
                          <Button variant="outline" size="sm" className="p-2" title={`Kembali ke ${STATUS_LABEL[prev]}`} onClick={() => handleStatus(item, prev)}>
                            <ArrowRight className="h-4 w-4 rotate-180" />
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="p-2" title="Kelola Jalur" onClick={() => openJalur(item)}>
                          <Route className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="p-2" title="Edit" onClick={() => openEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {(item.status === "DRAFT" || item.status === "DIJADWALKAN") && (
                          <Button variant="destructive" size="sm" className="p-2" title="Hapus" onClick={() => setDeleteId(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total: {total} data</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => load(page - 1, search, statusFilter)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => load(page + 1, search, statusFilter)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Dialog Tambah/Edit Gelombang */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Gelombang" : "Tambah Gelombang"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Gelombang *</label>
              <Input value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} placeholder="Gelombang 1 — Penerimaan Siswa & Santri" />
            </div>
            {!editing && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Tahun Ajaran *</label>
                <select value={form.tahunAjaranId} onChange={(e) => setForm((f) => ({ ...f, tahunAjaranId: e.target.value }))} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm">
                  <option value="">— Pilih tahun ajaran —</option>
                  {taOpts.map((ta) => <option key={ta.id} value={ta.id}>{ta.nama}</option>)}
                  {taOpts.length === 0 && <option disabled>Belum ada tahun ajaran — buat dulu di menu Tahun Ajaran</option>}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Unit</label>
                <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="SMK / Pondok" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Jenjang</label>
                <Input value={form.jenjang} onChange={(e) => setForm((f) => ({ ...f, jenjang: e.target.value }))} placeholder="Kelas X / 7" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Program</label>
                <Input value={form.program} onChange={(e) => setForm((f) => ({ ...f, program: e.target.value }))} placeholder="Reguler / Tahfidz" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tanggal Buka *</label>
                <Input type="datetime-local" value={form.tanggalBuka} onChange={(e) => setForm((f) => ({ ...f, tanggalBuka: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tanggal Tutup *</label>
                <Input type="datetime-local" value={form.tanggalTutup} onChange={(e) => setForm((f) => ({ ...f, tanggalTutup: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kuota (kosong = tanpa batas)</label>
                <Input type="number" min={0} value={form.kuota} onChange={(e) => setForm((f) => ({ ...f, kuota: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Biaya Pendaftaran (Rp, kosong = gratis)</label>
                <Input type="number" min={0} value={form.biayaDaftar} onChange={(e) => setForm((f) => ({ ...f, biayaDaftar: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Jadwal Seleksi</label>
                <Input type="datetime-local" value={form.jadwalSeleksi} onChange={(e) => setForm((f) => ({ ...f, jadwalSeleksi: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Jadwal Pengumuman</label>
                <Input type="datetime-local" value={form.jadwalPengumuman} onChange={(e) => setForm((f) => ({ ...f, jadwalPengumuman: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Jadwal Daftar Ulang</label>
                <Input type="datetime-local" value={form.jadwalDaftarUlang} onChange={(e) => setForm((f) => ({ ...f, jadwalDaftarUlang: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Deskripsi</label>
              <textarea
                value={form.deskripsi}
                onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))}
                rows={3}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm"
                placeholder="Informasi singkat gelombang ini..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editing ? "Simpan" : "Buat Gelombang"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Kelola Jalur */}
      <Dialog open={!!jalurGelombang} onOpenChange={(o) => { if (!o) setJalurGelombang(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Jalur Pendaftaran — {jalurGelombang?.nama}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(jalurGelombang?.jalur || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada jalur — tambahkan jalur penerimaan (mis. Domisili, Afirmasi, Prestasi, Tahfidz)</p>
            ) : (
              <div className="space-y-2">
                {(jalurGelombang?.jalur || []).map((j) => (
                  <div key={j.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{j.nama}</span>
                        {!j.isActive && <Badge variant="secondary">Nonaktif</Badge>}
                      </div>
                      {j.deskripsi && <p className="text-xs text-muted-foreground">{j.deskripsi}</p>}
                      <p className="text-xs text-muted-foreground">Kuota: {j.kuota ?? "∞"}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="p-2" title="Edit" onClick={() => { setEditJalur(j); setJalurForm({ nama: j.nama, deskripsi: j.deskripsi || "", kuota: j.kuota != null ? String(j.kuota) : "" }) }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="p-2" title={j.isActive ? "Nonaktifkan" : "Aktifkan"} onClick={() => updateJalur(j.id, { isActive: !j.isActive }).then(() => { toast.success(j.isActive ? "Jalur dinonaktifkan" : "Jalur diaktifkan"); const fresh = getGelombangs({ search, page, limit: 10, status: statusFilter || undefined }); fresh.then((fr) => { setData(fr.data as any); setJalurGelombang((fr.data as any[]).find((d) => d.id === jalurGelombang!.id) || null) }) }).catch((e) => toast.error(e?.message || "Gagal"))}>
                        {j.isActive ? <Trash2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleJalurSubmit} className="border-t pt-3 space-y-3">
              <label className="text-sm font-medium">{editJalur ? "Edit Jalur" : "Tambah Jalur"}</label>
              <Input placeholder="Nama jalur (mis. Domisili)" value={jalurForm.nama} onChange={(e) => setJalurForm((f) => ({ ...f, nama: e.target.value }))} required />
              <Input placeholder="Deskripsi (opsional)" value={jalurForm.deskripsi} onChange={(e) => setJalurForm((f) => ({ ...f, deskripsi: e.target.value }))} />
              <Input type="number" min={0} placeholder="Kuota (kosong = tanpa batas)" value={jalurForm.kuota} onChange={(e) => setJalurForm((f) => ({ ...f, kuota: e.target.value }))} />
              <div className="flex justify-end gap-2">
                {editJalur && (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEditJalur(null); setJalurForm({ nama: "", deskripsi: "", kuota: "" }) }}>Batal Edit</Button>
                )}
                <Button type="submit" size="sm" disabled={jalurSubmitting || !jalurForm.nama}>
                  {jalurSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editJalur ? "Simpan" : "Tambah"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Hapus */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Hapus Gelombang</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Gelombang hanya dinonaktifkan (soft-delete) — data pendaftar yang sudah ada tidak akan terpengaruh.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Nonaktifkan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
