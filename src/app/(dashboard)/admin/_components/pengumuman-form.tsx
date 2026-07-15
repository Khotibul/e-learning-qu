"use client"

import { useState } from "react"
import { toast } from "react-hot-toast"
import { formatDate } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Megaphone,
  Trash2,
  Send,
  Loader2,
} from "lucide-react"
import { createPengumuman, deletePengumuman } from "../actions"

interface Pengumuman {
  id: string
  judul: string
  isi: string
  gambar: string | null
  lampiran: string | null
  tipe: string
  userId: string
  kelasId: string | null
  createdAt: Date
  user: { name: string | null }
  kelas: { nama: string } | null
}

interface Props {
  userId: string
  initialData: Pengumuman[]
  kelasRefs: { id: string; nama: string; tingkat: number }[]
}

export function PengumumanForm({ userId, initialData, kelasRefs }: Props) {
  const [pengumumen, setPengumumen] = useState<Pengumuman[]>(initialData)
  const [judul, setJudul] = useState("")
  const [isi, setIsi] = useState("")
  const [gambar, setGambar] = useState("")
  const [tipe, setTipe] = useState("UMUM")
  const [kelasId, setKelasId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!judul || !isi) { toast.error("Judul dan isi pengumuman harus diisi"); return }
    setSubmitting(true)
    try {
      await createPengumuman({
        judul,
        isi,
        gambar: gambar || undefined,
        tipe,
        userId,
        kelasId: kelasId || undefined,
      })
      toast.success("Pengumuman berhasil dikirim")
      setJudul(""); setIsi(""); setGambar(""); setTipe("UMUM"); setKelasId("")
      const res = await fetch("/admin/pengumuman/api")
      // re-fetch is handled by revalidation
    } catch { toast.error("Gagal membuat pengumuman") } finally { setSubmitting(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      await deletePengumuman(deleteId)
      setPengumumen((prev) => prev.filter((p) => p.id !== deleteId))
      toast.success("Pengumuman berhasil dihapus")
      setDeleteId(null)
    } catch { toast.error("Gagal menghapus pengumuman") }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Megaphone className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Pengumuman</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buat Pengumuman Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Judul *</label>
                <Input
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="Judul pengumuman"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Isi Pengumuman *</label>
                <textarea
                  value={isi}
                  onChange={(e) => setIsi(e.target.value)}
                  placeholder="Tulis isi pengumuman di sini..."
                  rows={6}
                  className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipe</label>
                  <Select value={tipe} onValueChange={setTipe}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UMUM">Umum</SelectItem>
                      <SelectItem value="KELAS">Per Kelas</SelectItem>
                      <SelectItem value="PENTING">Penting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL Gambar</label>
                  <Input
                    value={gambar}
                    onChange={(e) => setGambar(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>
              {tipe === "KELAS" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Kelas</label>
                  <Select value={kelasId} onValueChange={setKelasId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas (opsional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kelas</SelectItem>
                      {kelasRefs.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" />
                Kirim Pengumuman
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Pengumuman</CardTitle>
          </CardHeader>
          <CardContent>
            {pengumumen.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Belum ada pengumuman
              </p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {pengumumen.map((p) => (
                  <div key={p.id} className="rounded-xl border p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{p.judul}</h4>
                        <p className="text-xs text-muted-foreground">
                          Oleh {p.user.name || "-"} &middot; {formatDate(p.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.tipe === "PENTING" ? "destructive" : p.tipe === "KELAS" ? "warning" : "default"}>
                          {p.tipe}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap line-clamp-2">{p.isi}</p>
                    {p.kelas && <Badge variant="secondary">{p.kelas.nama}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Hapus Pengumuman</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Apakah Anda yakin ingin menghapus pengumuman ini?</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

