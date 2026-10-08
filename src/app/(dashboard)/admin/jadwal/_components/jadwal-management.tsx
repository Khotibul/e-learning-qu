"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, CalendarClock, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react"
import {
  cekBentrokJadwal,
  createJadwalAdmin,
  deleteJadwalAdmin,
  getJadwalAdmin,
  updateJadwalAdmin,
} from "../actions"

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
const ONE = "__all__"

const kosong = { kelasId: "", mataPelajaranId: "", hari: "Senin", jamMulai: "07:00", jamSelesai: "07:45" }

export function JadwalManagement() {
  const [rows, setRows] = useState<any[]>([])
  const [kelasList, setKelasList] = useState<any[]>([])
  const [mapelList, setMapelList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [fKelas, setFKelas] = useState(ONE)
  const [fHari, setFHari] = useState(ONE)

  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(kosong)
  const [saving, setSaving] = useState(false)
  const [bentrok, setBentrok] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getJadwalAdmin({
        kelasId: fKelas === ONE ? undefined : fKelas,
        hari: fHari === ONE ? undefined : fHari,
        search: search || undefined,
      })
      setRows((d as any).rows || [])
      setKelasList((d as any).kelas || [])
      setMapelList((d as any).mapel || [])
    } catch (e: any) {
      toast.error(e?.message || "Gagal memuat jadwal")
    } finally {
      setLoading(false)
    }
  }, [search, fKelas, fHari])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  // Cek bentrok real-time
  useEffect(() => {
    if (!dialog || !form.kelasId || !form.hari || !form.jamMulai || !form.jamSelesai) {
      setBentrok([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await cekBentrokJadwal({
          kelasId: form.kelasId,
          mataPelajaranId: form.mataPelajaranId,
          hari: form.hari,
          jamMulai: form.jamMulai,
          jamSelesai: form.jamSelesai,
          excludeId: editing?.id,
        })
        setBentrok(res)
      } catch {
        setBentrok([])
      }
    }, 400)
    return () => clearTimeout(t)
  }, [dialog, form, editing])

  const bukaTambah = () => {
    setEditing(null)
    setForm({ ...kosong, kelasId: kelasList[0]?.id ?? "", mataPelajaranId: mapelList[0]?.id ?? "" })
    setBentrok([])
    setDialog(true)
  }

  const bukaEdit = (row: any) => {
    setEditing(row)
    setForm({
      kelasId: row.kelasId,
      mataPelajaranId: row.mataPelajaranId,
      hari: row.hari,
      jamMulai: row.jamMulai,
      jamSelesai: row.jamSelesai,
    })
    setBentrok([])
    setDialog(true)
  }

  const simpan = async () => {
    if (!form.kelasId || !form.mataPelajaranId) {
      toast.error("Pilih kelas dan mata pelajaran")
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateJadwalAdmin(editing.id, form)
        toast.success("Jadwal diperbarui")
      } else {
        await createJadwalAdmin(form)
        toast.success("Jadwal ditambahkan")
      }
      setDialog(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  const hapus = async (row: any) => {
    if (!confirm(`Hapus jadwal ${row.mataPelajaran?.nama} di ${row.kelas?.nama} (${row.hari} ${row.jamMulai}-${row.jamSelesai})?`)) return
    try {
      await deleteJadwalAdmin(row.id)
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      toast.success("Jadwal dihapus")
    } catch (e: any) {
      toast.error(e?.message || "Gagal menghapus")
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Kelola Jadwal Mengajar
            </CardTitle>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari kelas/mapel..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-[200px] pl-8"
                />
              </div>
              <Select value={fHari} onValueChange={setFHari}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Hari" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ONE}>Semua Hari</SelectItem>
                  {HARI.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fKelas} onValueChange={setFKelas}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Kelas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ONE}>Semua Kelas</SelectItem>
                  {kelasList.map((k) => (
                    <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={bukaTambah}>
                <Plus className="h-4 w-4" /> Tambah Jadwal
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Belum ada jadwal mengajar. Klik &quot;Tambah Jadwal&quot; untuk membuat jadwal (senin-minggu, jam, kelas, mapel).
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">Hari</th>
                    <th className="p-3">Jam</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3">Mata Pelajaran</th>
                    <th className="p-3">Guru Pengampu</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-3">
                        <Badge variant="outline">{r.hari}</Badge>
                      </td>
                      <td className="p-3 whitespace-nowrap tabular-nums font-medium">
                        {r.jamMulai} - {r.jamSelesai}
                      </td>
                      <td className="p-3">{r.kelas?.nama}</td>
                      <td className="p-3">{r.mataPelajaran?.nama}</td>
                      <td className="p-3">
                        {r.pengampu?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {r.pengampu.map((g: any) => (
                              <Badge key={g.id} variant="secondary" className="text-[10px]">{g.nama}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600">Belum ada pengampu</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => bukaEdit(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => hapus(r)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Jadwal Mengajar" : "Tambah Jadwal Mengajar"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kelas</Label>
                <Select value={form.kelasId} onValueChange={(v) => setForm((f) => ({ ...f, kelasId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent>
                    {kelasList.map((k) => (
                      <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mata Pelajaran</Label>
                <Select value={form.mataPelajaranId} onValueChange={(v) => setForm((f) => ({ ...f, mataPelajaranId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
                  <SelectContent>
                    {mapelList.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Hari</Label>
              <Select value={form.hari} onValueChange={(v) => setForm((f) => ({ ...f, hari: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HARI.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Jam Mulai</Label>
                <Input type="time" value={form.jamMulai} onChange={(e) => setForm((f) => ({ ...f, jamMulai: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Jam Selesai</Label>
                <Input type="time" value={form.jamSelesai} onChange={(e) => setForm((f) => ({ ...f, jamSelesai: e.target.value }))} />
              </div>
            </div>

            {bentrok.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <div className="mb-1 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" /> Jadwal bentrok:
                </div>
                <ul className="list-disc pl-5">
                  {bentrok.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(false)}>Batal</Button>
            <Button onClick={simpan} disabled={saving || bentrok.length > 0}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Simpan Perubahan" : "Tambah Jadwal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
