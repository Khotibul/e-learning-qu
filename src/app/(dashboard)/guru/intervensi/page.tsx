"use client"

import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Trash2, Clock, CheckCircle, XCircle, AlertCircle, Shield } from "lucide-react"
import { getInterventions, createIntervention, updateInterventionStatus, deleteIntervention } from "./actions"

interface Intervention {
  id: string
  siswa: { id: string; nama: string; kelas: string }
  tipe: string
  reason: string
  action: string
  deadline: string | null
  status: string
  notes: string | null
  createdAt: string
}

const TIPE_LABELS: Record<string, string> = {
  REMEDIAL: "Remedial",
  TUGAS_TAMBAHAN: "Tugas Tambahan",
  MENTORING: "Mentoring",
  REKOMENDASI_MATERI: "Rekomendasi Materi",
  KONSULTASI: "Konsultasi",
  FOLLOW_UP: "Follow-up",
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
}

export default function IntervensiPage() {
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [form, setForm] = useState({ siswaId: "", tipe: "REMEDIAL", reason: "", action: "", deadline: "", notes: "" })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    try {
      const data = await getInterventions(filterStatus !== "all" ? { status: filterStatus as any } : undefined)
      setInterventions(data as any)
    } catch {
      toast.error("Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterStatus])

  const handleCreate = async () => {
    if (!form.siswaId || !form.reason || !form.action) return toast.error("Isi semua field wajib")
    setSubmitting(true)
    try {
      await createIntervention({
        siswaId: form.siswaId,
        tipe: form.tipe as any,
        reason: form.reason,
        action: form.action,
        deadline: form.deadline || null,
        notes: form.notes || null,
      })
      toast.success("Intervensi dibuat")
      setDialogOpen(false)
      setForm({ siswaId: "", tipe: "REMEDIAL", reason: "", action: "", deadline: "", notes: "" })
      load()
    } catch {
      toast.error("Gagal membuat intervensi")
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatus = async (id: string, status: string) => {
    try {
      await updateInterventionStatus(id, status as any)
      toast.success("Status diperbarui")
      load()
    } catch {
      toast.error("Gagal update status")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus intervensi ini?")) return
    try {
      await deleteIntervention(id)
      toast.success("Dihapus")
      load()
    } catch {
      toast.error("Gagal menghapus")
    }
  }

  const counts = {
    all: interventions.length,
    OPEN: interventions.filter((i) => i.status === "OPEN").length,
    IN_PROGRESS: interventions.filter((i) => i.status === "IN_PROGRESS").length,
    COMPLETED: interventions.filter((i) => i.status === "COMPLETED").length,
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Intervensi Siswa
          </h1>
          <p className="text-muted-foreground mt-1">Buat dan kelola intervensi untuk siswa yang membutuhkan perhatian</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Buat Intervensi</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Buat Intervensi Baru</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="Siswa ID" value={form.siswaId} onChange={(e) => setForm({ ...form, siswaId: e.target.value })} />
              <Select value={form.tipe} onValueChange={(v) => setForm({ ...form, tipe: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea placeholder="Alasan intervensi" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              <Textarea placeholder="Tindakan yang akan dilakukan" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
              <Input type="date" placeholder="Deadline" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              <Textarea placeholder="Catatan (opsional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <Button onClick={handleCreate} disabled={submitting} className="w-full">{submitting ? "Menyimpan..." : "Simpan"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "OPEN", "IN_PROGRESS", "COMPLETED"].map((s) => (
          <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)}>
            {s === "all" ? "Semua" : s === "OPEN" ? "Open" : s === "IN_PROGRESS" ? "In Progress" : "Selesai"}
            <Badge variant="secondary" className="ml-1 text-xs">{counts[s as keyof typeof counts]}</Badge>
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Memuat...</div>
      ) : interventions.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Belum ada intervensi</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {interventions.map((i) => (
            <Card key={i.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={STATUS_COLORS[i.status]}>{i.status}</Badge>
                      <Badge variant="outline">{TIPE_LABELS[i.tipe] || i.tipe}</Badge>
                      <span className="text-sm text-muted-foreground">{i.siswa.nama} ({i.siswa.kelas})</span>
                    </div>
                    <p className="text-sm mt-2"><strong>Alasan:</strong> {i.reason}</p>
                    <p className="text-sm"><strong>Tindakan:</strong> {i.action}</p>
                    {i.notes && <p className="text-sm text-muted-foreground mt-1">Catatan: {i.notes}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{new Date(i.createdAt).toLocaleDateString("id-ID")}</span>
                      {i.deadline && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Deadline: {new Date(i.deadline).toLocaleDateString("id-ID")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {i.status === "OPEN" && (
                      <Button variant="ghost" size="sm" onClick={() => handleStatus(i.id, "IN_PROGRESS")} title="Mulai">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      </Button>
                    )}
                    {i.status === "IN_PROGRESS" && (
                      <Button variant="ghost" size="sm" onClick={() => handleStatus(i.id, "COMPLETED")} title="Selesai">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                    {i.status !== "COMPLETED" && i.status !== "CANCELLED" && (
                      <Button variant="ghost" size="sm" onClick={() => handleStatus(i.id, "CANCELLED")} title="Batalkan">
                        <XCircle className="h-4 w-4 text-gray-400" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(i.id)} title="Hapus">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
