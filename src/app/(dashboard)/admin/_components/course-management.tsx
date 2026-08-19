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
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Loader2,
  Settings,
  BookOpen,
  FileText,
  Layers,
} from "lucide-react"
import {
  getCourses,
  getCourseDetail,
  createCourse,
  updateCourse,
  deleteCourse,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
  updateLesson,
  deleteLesson,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from "../courses/actions"

import { getMapelRefs, getGuruRefs } from "../actions"

interface Course {
  id: string
  title: string
  description: string | null
  mapelId: string
  guruId: string
  isPublished: boolean
  sortOrder: number
  createdAt: Date
  deletedAt: Date | null
  mapel: { nama: string }
  guru: { nama: string }
  _count: { modules: number }
}

interface CourseModule {
  id: string
  courseId: string
  title: string
  description: string | null
  sortOrder: number
  isPublished: boolean
  lessons: CourseLesson[]
}

interface CourseLesson {
  id: string
  moduleId: string
  title: string
  description: string | null
  content: string | null
  sortOrder: number
  isPublished: boolean
  materials: CourseMaterial[]
}

interface CourseMaterial {
  id: string
  lessonId: string
  title: string
  content: string | null
  fileUrl: string | null
  fileType: string | null
  sortOrder: number
}

interface Props {
  initialData: Course[]
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

export function CourseManagement(props: Props) {
  const router = useRouter()

  const [data, setData] = useState<Course[]>(props.initialData)
  const [total, setTotal] = useState(props.initialTotal)
  const [totalPages, setTotalPages] = useState(props.initialTotalPages)
  const [page, setPage] = useState(props.initialPage)
  const [search, setSearch] = useState(props.initialSearch)
  const [loading, setLoading] = useState(false)

  const debouncedSearch = useDebounce(search, 500)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Course | null>(null)
  const [formData, setFormData] = useState({ title: "", description: "", mapelId: "", guruId: "" })
  const [submitting, setSubmitting] = useState(false)

  const [mapelRefs, setMapelRefs] = useState<{ id: string; nama: string }[]>([])
  const [guruRefs, setGuruRefs] = useState<{ id: string; nama: string }[]>([])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set())

  const [moduleDialogOpen, setModuleDialogOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null)
  const [moduleForm, setModuleForm] = useState({ title: "", description: "" })

  const [lessonDialogOpen, setLessonDialogOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null)
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", content: "" })
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)

  const [materialDialogOpen, setMaterialDialogOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<CourseMaterial | null>(null)
  const [materialForm, setMaterialForm] = useState({ title: "", content: "", fileUrl: "", fileType: "" })
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getCourses({ search: debouncedSearch, page, limit: 10 })
      setData(result.data as Course[])
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch { toast.error("Gagal memuat data") } finally { setLoading(false) }
  }, [debouncedSearch, page])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    getMapelRefs().then(setMapelRefs).catch(() => {})
    getGuruRefs().then(setGuruRefs).catch(() => {})
  }, [])

  useEffect(() => {
    const p = new URLSearchParams()
    if (debouncedSearch) p.set("search", debouncedSearch)
    if (page > 1) p.set("page", String(page))
    router.replace(`/admin/courses?${p.toString()}`, { scroll: false })
  }, [debouncedSearch, page, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.title) { toast.error("Judul course harus diisi"); return }
    if (!formData.mapelId) { toast.error("Mata pelajaran harus dipilih"); return }
    if (!formData.guruId) { toast.error("Guru harus dipilih"); return }
    setSubmitting(true)
    try {
      if (editing) {
        await updateCourse(editing.id, { title: formData.title, description: formData.description || undefined })
        toast.success("Course berhasil diperbarui")
      } else {
        await createCourse({ title: formData.title, description: formData.description || undefined, mapelId: formData.mapelId, guruId: formData.guruId })
        toast.success("Course berhasil ditambahkan")
      }
      setDialogOpen(false); resetForm(); fetchData()
    } catch { toast.error("Terjadi kesalahan") } finally { setSubmitting(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try { await deleteCourse(deleteId); toast.success("Course berhasil dihapus"); setDeleteId(null); fetchData() }
    catch { toast.error("Terjadi kesalahan") }
  }

  function resetForm() {
    setEditing(null)
    setFormData({ title: "", description: "", mapelId: "", guruId: "" })
  }

  async function openDetail(course: Course) {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const detail = await getCourseDetail(course.id)
      setDetailData(detail)
      setExpandedModules(new Set())
      setExpandedLessons(new Set())
    } catch { toast.error("Gagal memuat detail") } finally { setDetailLoading(false) }
  }

  function toggleModule(id: string) {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleLesson(id: string) {
    setExpandedLessons(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleModuleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!moduleForm.title || !detailData) return
    setSubmitting(true)
    try {
      if (editingModule) {
        await updateModule(editingModule.id, { title: moduleForm.title, description: moduleForm.description || undefined })
        toast.success("Module berhasil diperbarui")
      } else {
        await createModule({ courseId: detailData.id, title: moduleForm.title, description: moduleForm.description || undefined })
        toast.success("Module berhasil ditambahkan")
      }
      setModuleDialogOpen(false); setModuleForm({ title: "", description: "" }); setEditingModule(null)
      const detail = await getCourseDetail(detailData.id); setDetailData(detail)
    } catch { toast.error("Terjadi kesalahan") } finally { setSubmitting(false) }
  }

  async function handleDeleteModule(id: string) {
    try { await deleteModule(id); toast.success("Module berhasil dihapus")
      const detail = await getCourseDetail(detailData.id); setDetailData(detail)
    } catch { toast.error("Terjadi kesalahan") }
  }

  async function handleToggleModulePublish(id: string, current: boolean) {
    try { await updateModule(id, { isPublished: !current })
      const detail = await getCourseDetail(detailData.id); setDetailData(detail)
    } catch { toast.error("Terjadi kesalahan") }
  }

  async function handleLessonSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lessonForm.title || !activeModuleId) return
    setSubmitting(true)
    try {
      if (editingLesson) {
        await updateLesson(editingLesson.id, { title: lessonForm.title, description: lessonForm.description || undefined, content: lessonForm.content || undefined })
        toast.success("Lesson berhasil diperbarui")
      } else {
        await createLesson({ moduleId: activeModuleId, title: lessonForm.title, description: lessonForm.description || undefined, content: lessonForm.content || undefined })
        toast.success("Lesson berhasil ditambahkan")
      }
      setLessonDialogOpen(false); setLessonForm({ title: "", description: "", content: "" }); setEditingLesson(null); setActiveModuleId(null)
      const detail = await getCourseDetail(detailData.id); setDetailData(detail)
    } catch { toast.error("Terjadi kesalahan") } finally { setSubmitting(false) }
  }

  async function handleDeleteLesson(id: string) {
    try { await deleteLesson(id); toast.success("Lesson berhasil dihapus")
      const detail = await getCourseDetail(detailData.id); setDetailData(detail)
    } catch { toast.error("Terjadi kesalahan") }
  }

  async function handleToggleLessonPublish(id: string, current: boolean) {
    try { await updateLesson(id, { isPublished: !current })
      const detail = await getCourseDetail(detailData.id); setDetailData(detail)
    } catch { toast.error("Terjadi kesalahan") }
  }

  async function handleMaterialSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!materialForm.title || !activeLessonId) return
    setSubmitting(true)
    try {
      if (editingMaterial) {
        await updateMaterial(editingMaterial.id, { title: materialForm.title, content: materialForm.content || undefined, fileUrl: materialForm.fileUrl || undefined, fileType: materialForm.fileType || undefined })
        toast.success("Material berhasil diperbarui")
      } else {
        await createMaterial({ lessonId: activeLessonId, title: materialForm.title, content: materialForm.content || undefined, fileUrl: materialForm.fileUrl || undefined, fileType: materialForm.fileType || undefined })
        toast.success("Material berhasil ditambahkan")
      }
      setMaterialDialogOpen(false); setMaterialForm({ title: "", content: "", fileUrl: "", fileType: "" }); setEditingMaterial(null); setActiveLessonId(null)
      const detail = await getCourseDetail(detailData.id); setDetailData(detail)
    } catch { toast.error("Terjadi kesalahan") } finally { setSubmitting(false) }
  }

  async function handleDeleteMaterial(id: string) {
    try { await deleteMaterial(id); toast.success("Material berhasil dihapus")
      const detail = await getCourseDetail(detailData.id); setDetailData(detail)
    } catch { toast.error("Terjadi kesalahan") }
  }

  async function handleToggleCoursePublish(id: string, current: boolean) {
    try {
      await updateCourse(id, { isPublished: !current })
      fetchData()
      if (detailData?.id === id) {
        const detail = await getCourseDetail(id); setDetailData(detail)
      }
    } catch { toast.error("Terjadi kesalahan") }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Data Courses</h1>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Tambah Course</span>
        </Button>
      </div>

      <div className="w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari course..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
      </div>

      <div className="rounded-2xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">No</TableHead>
              <TableHead>Judul</TableHead>
              <TableHead>Mapel</TableHead>
              <TableHead>Guru</TableHead>
              <TableHead>Modules</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-48">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, ci) => <TableCell key={ci}><Skeleton className="h-5 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                {search ? "Tidak ada course yang sesuai" : "Belum ada data course"}
              </TableCell></TableRow>
            ) : (
              data.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{(page - 1) * 10 + idx + 1}</TableCell>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>{item.mapel.nama}</TableCell>
                  <TableCell>{item.guru.nama}</TableCell>
                  <TableCell><Badge variant="secondary">{item._count.modules} Modul</Badge></TableCell>
                  <TableCell>
                    <Badge variant={item.isPublished ? "default" : "outline"}>
                      {item.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => openDetail(item)} className="p-2 sm:px-2 sm:py-1">
                        <Settings className="h-4 w-4" /><span className="hidden sm:inline ml-1">Kelola</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditing(item)
                        setFormData({ title: item.title, description: item.description || "", mapelId: item.mapelId, guruId: item.guruId })
                        setDialogOpen(true)
                      }} className="p-2 sm:px-2 sm:py-1">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteId(item.id)} className="p-2 sm:px-2 sm:py-1">
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
          <DialogHeader><DialogTitle>{editing ? "Edit Course" : "Tambah Course"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Judul Course *</label>
              <Input value={formData.title} onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))} placeholder="Contoh: Pemrograman Web" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Deskripsi</label>
              <Input value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} placeholder="Deskripsi singkat course" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mata Pelajaran *</label>
              <Select value={formData.mapelId || "none"} onValueChange={(v) => setFormData((f) => ({ ...f, mapelId: v === "none" ? "" : v }))} disabled={!!editing}>
                <SelectTrigger><SelectValue placeholder="Pilih Mata Pelajaran" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Mapel</SelectItem>
                  {mapelRefs.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Guru *</label>
              <Select value={formData.guruId || "none"} onValueChange={(v) => setFormData((f) => ({ ...f, guruId: v === "none" ? "" : v }))} disabled={!!editing}>
                <SelectTrigger><SelectValue placeholder="Pilih Guru" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Guru</SelectItem>
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
          <DialogHeader><DialogTitle>Hapus Course</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Course yang dihapus tidak akan muncul di daftar aktif.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={moduleDialogOpen} onOpenChange={(o) => { setModuleDialogOpen(o); if (!o) { setEditingModule(null); setModuleForm({ title: "", description: "" }) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingModule ? "Edit Module" : "Tambah Module"}</DialogTitle></DialogHeader>
          <form onSubmit={handleModuleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Judul Module *</label>
              <Input value={moduleForm.title} onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))} placeholder="Contoh: Modul 1 - Pengenalan" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Deskripsi</label>
              <Input value={moduleForm.description} onChange={(e) => setModuleForm((f) => ({ ...f, description: e.target.value }))} placeholder="Deskripsi module" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setModuleDialogOpen(false); setEditingModule(null); setModuleForm({ title: "", description: "" }) }}>Batal</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingModule ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={lessonDialogOpen} onOpenChange={(o) => { setLessonDialogOpen(o); if (!o) { setEditingLesson(null); setLessonForm({ title: "", description: "", content: "" }); setActiveModuleId(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingLesson ? "Edit Lesson" : "Tambah Lesson"}</DialogTitle></DialogHeader>
          <form onSubmit={handleLessonSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Judul Lesson *</label>
              <Input value={lessonForm.title} onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))} placeholder="Contoh: Pengenalan HTML" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Deskripsi</label>
              <Input value={lessonForm.description} onChange={(e) => setLessonForm((f) => ({ ...f, description: e.target.value }))} placeholder="Deskripsi lesson" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Konten</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={lessonForm.content}
                onChange={(e) => setLessonForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Konten lesson..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setLessonDialogOpen(false); setEditingLesson(null); setLessonForm({ title: "", description: "", content: "" }); setActiveModuleId(null) }}>Batal</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingLesson ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={materialDialogOpen} onOpenChange={(o) => { setMaterialDialogOpen(o); if (!o) { setEditingMaterial(null); setMaterialForm({ title: "", content: "", fileUrl: "", fileType: "" }); setActiveLessonId(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingMaterial ? "Edit Material" : "Tambah Material"}</DialogTitle></DialogHeader>
          <form onSubmit={handleMaterialSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Judul Material *</label>
              <Input value={materialForm.title} onChange={(e) => setMaterialForm((f) => ({ ...f, title: e.target.value }))} placeholder="Contoh: Slide Presentasi" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Konten</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={materialForm.content}
                onChange={(e) => setMaterialForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Konten material..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">File URL</label>
              <Input value={materialForm.fileUrl} onChange={(e) => setMaterialForm((f) => ({ ...f, fileUrl: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">File Type</label>
              <Input value={materialForm.fileType} onChange={(e) => setMaterialForm((f) => ({ ...f, fileType: e.target.value }))} placeholder="pdf, docx, dll" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setMaterialDialogOpen(false); setEditingMaterial(null); setMaterialForm({ title: "", content: "", fileUrl: "", fileType: "" }); setActiveLessonId(null) }}>Batal</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingMaterial ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {detailData ? detailData.title : "Loading..."}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : detailData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {detailData.mapel?.nama} &middot; {detailData.guru?.nama}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {detailData.modules?.length || 0} modul
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={detailData.isPublished ? "default" : "outline"}>
                    {detailData.isPublished ? "Published" : "Draft"}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => handleToggleCoursePublish(detailData.id, detailData.isPublished)}>
                    {detailData.isPublished ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4" /> Modules
                  </h3>
                  <Button size="sm" onClick={() => { setEditingModule(null); setModuleForm({ title: "", description: "" }); setModuleDialogOpen(true) }}>
                    <Plus className="h-4 w-4 mr-1" /> Tambah Module
                  </Button>
                </div>

                {(detailData.modules?.length || 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Belum ada module</p>
                ) : (
                  <div className="space-y-2">
                    {(detailData.modules || []).map((mod: CourseModule) => (
                      <div key={mod.id} className="border rounded-lg">
                        <div className="flex items-center gap-2 p-3 hover:bg-muted/50">
                          <button onClick={() => toggleModule(mod.id)} className="p-1 hover:bg-muted rounded">
                            {expandedModules.has(mod.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                          </button>
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm flex-1">{mod.title}</span>
                          <Badge variant={mod.isPublished ? "default" : "outline"} className="text-xs">
                            {mod.isPublished ? "Published" : "Draft"}
                          </Badge>
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleToggleModulePublish(mod.id, mod.isPublished)}>
                            {mod.isPublished ? "Unpublish" : "Publish"}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => {
                            setEditingModule(mod); setModuleForm({ title: mod.title, description: mod.description || "" }); setModuleDialogOpen(true)
                          }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => handleDeleteModule(mod.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {expandedModules.has(mod.id) && (
                          <div className="border-t px-3 py-2 space-y-2 bg-muted/30">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lessons</span>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => { setEditingLesson(null); setLessonForm({ title: "", description: "", content: "" }); setActiveModuleId(mod.id); setLessonDialogOpen(true) }}>
                                <Plus className="h-3 w-3 mr-1" /> Tambah Lesson
                              </Button>
                            </div>
                            {(mod.lessons?.length || 0) === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">Belum ada lesson</p>
                            ) : (
                              mod.lessons.map((lesson: CourseLesson) => (
                                <div key={lesson.id} className="border rounded-md">
                                  <div className="flex items-center gap-2 p-2 hover:bg-background">
                                    <button onClick={() => toggleLesson(lesson.id)} className="p-1 hover:bg-muted rounded">
                                      {expandedLessons.has(lesson.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
                                    </button>
                                    <FileText className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm flex-1">{lesson.title}</span>
                                    <Badge variant={lesson.isPublished ? "default" : "outline"} className="text-xs">
                                      {lesson.isPublished ? "Published" : "Draft"}
                                    </Badge>
                                    <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => handleToggleLessonPublish(lesson.id, lesson.isPublished)}>
                                      {lesson.isPublished ? "Unpublish" : "Publish"}
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => {
                                      setEditingLesson(lesson); setLessonForm({ title: lesson.title, description: lesson.description || "", content: lesson.content || "" }); setActiveModuleId(mod.id); setLessonDialogOpen(true)
                                    }}>
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-6 px-1.5 text-destructive" onClick={() => handleDeleteLesson(lesson.id)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  {expandedLessons.has(lesson.id) && (
                                    <div className="border-t px-2 py-2 space-y-2 bg-background">
                                      {lesson.content && (
                                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{lesson.content}</p>
                                      )}
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Materials</span>
                                        <Button size="sm" variant="ghost" className="h-6" onClick={() => { setEditingMaterial(null); setMaterialForm({ title: "", content: "", fileUrl: "", fileType: "" }); setActiveLessonId(lesson.id); setMaterialDialogOpen(true) }}>
                                          <Plus className="h-3 w-3 mr-1" /> Tambah Material
                                        </Button>
                                      </div>
                                      {(lesson.materials?.length || 0) === 0 ? (
                                        <p className="text-xs text-muted-foreground py-1">Belum ada material</p>
                                      ) : (
                                        lesson.materials.map((mat: CourseMaterial) => (
                                          <div key={mat.id} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                                            <FileText className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs flex-1">{mat.title}</span>
                                            {mat.fileUrl && (
                                              <Badge variant="outline" className="text-xs">{mat.fileType || "file"}</Badge>
                                            )}
                                            <Button variant="ghost" size="sm" className="h-5 px-1" onClick={() => {
                                              setEditingMaterial(mat); setMaterialForm({ title: mat.title, content: mat.content || "", fileUrl: mat.fileUrl || "", fileType: mat.fileType || "" }); setActiveLessonId(lesson.id); setMaterialDialogOpen(true)
                                            }}>
                                              <Edit className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-5 px-1 text-destructive" onClick={() => handleDeleteMaterial(mat.id)}>
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
