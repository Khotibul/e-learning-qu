"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "react-hot-toast"
import { BookOpen, Plus, Save, Trash2, ClipboardList, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { JENIS_KOMPONEN } from "@/lib/raport"
import {
  buatKomponen, getKomponens, getNilaiGrid, getPengaturanRaport, hapusKomponen, simpanNilaiKomponen,
} from "@/app/(dashboard)/raport/actions"
import type { KomponenRow, RaportRefs } from "./types"

interface GridState {
  komponen: { id: string; nama: string; jenis: string; bobot: number; mapel: { nama: string }; kelas: { nama: string } }
  siswas: { id: string; nama: string; nis: string | null; nilai: number | null; catatan: string }[]
}

export function PanelNilai({ refs }: { refs: RaportRefs }) {
  const [semesterId, setSemesterId] = useState(refs.semesters.find((s) => s.isAktif)?.id ?? refs.semesters[0]?.id ?? "")
  const mapelsSemester = useMemo(() => refs.mapels.filter((m) => m.semesterId === semesterId), [refs.mapels, semesterId])
  const [kelasId, setKelasId] = useState("")
  const [mapelId, setMapelId] = useState("")
  const [komponens, setKomponens] = useState<KomponenRow[]>([])
  const [loading, setLoading] = useState(false)
  const [pengaturan, setPengaturan] = useState<{ bobotFormatif: number; bobotSumatif: number; bobotProyek: number; bobotPraktik: number; kktp: number } | null>(null)
  const [grid, setGrid] = useState<GridState | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ nama: "", jenis: "FORMATIF", bobot: "1", tanggal: new Date().toISOString().slice(0, 10) })

  useEffect(() => {
    if (!semesterId) return
    let batal = false
    getPengaturanRaport(semesterId)
      .then((p) => { if (!batal) setPengaturan(p as never) })
      .catch(() => { if (!batal) setPengaturan(null) })
    return () => { batal = true }
  }, [semesterId])

  const muatKomponen = useCallback(async (tampilkanLoading = false) => {
    if (!mapelId || !kelasId || !semesterId) {
      setKomponens([])
      return
    }
    if (tampilkanLoading) setLoading(true)
    try {
      const data = await getKomponens(mapelId, kelasId, semesterId)
      setKomponens(data as KomponenRow[])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat komponen nilai")
    } finally {
      setLoading(false)
    }
  }, [mapelId, kelasId, semesterId])

  useEffect(() => {
    if (!mapelId || !kelasId || !semesterId) return
    let batal = false
    getKomponens(mapelId, kelasId, semesterId)
      .then((data) => { if (!batal) setKomponens(data as KomponenRow[]) })
      .catch((e) => { if (!batal) toast.error(e instanceof Error ? e.message : "Gagal memuat komponen nilai") })
      .finally(() => { if (!batal) setLoading(false) })
    return () => { batal = true }
  }, [mapelId, kelasId, semesterId])

  const gantiSemester = (v: string) => {
    setSemesterId(v)
    setKelasId("")
    setMapelId("")
    setKomponens([])
    setGrid(null)
    setLoading(false)
  }

  const gantiKelas = (v: string) => {
    setKelasId(v)
    setKomponens([])
    setGrid(null)
    setLoading(Boolean(v && mapelId))
  }

  const gantiMapel = (v: string) => {
    setMapelId(v)
    setKomponens([])
    setGrid(null)
    setLoading(Boolean(v && kelasId))
  }

  const bukaGrid = async (komponenId: string) => {
    try {
      const data = await getNilaiGrid(komponenId)
      setGrid(data as GridState)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat nilai")
    }
  }

  const simpanGrid = async () => {
    if (!grid) return
    setMenyimpan(true)
    try {
      await simpanNilaiKomponen(
        grid.komponen.id,
        grid.siswas.map((s) => ({
          siswaId: s.id,
          nilai: s.nilai == null || Number.isNaN(s.nilai) ? null : s.nilai,
          catatan: s.catatan,
        })),
      )
      toast.success("Nilai tersimpan")
      await muatKomponen(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan nilai")
    } finally {
      setMenyimpan(false)
    }
  }

  const simpanKomponen = async () => {
    if (!form.nama.trim()) return toast.error("Nama komponen wajib diisi")
    try {
      await buatKomponen({
        nama: form.nama,
        jenis: form.jenis as "FORMATIF" | "SUMATIF" | "PROYEK" | "PRAKTIK",
        bobot: Number(form.bobot),
        tanggal: form.tanggal,
        mapelId,
        kelasId,
        semesterId,
      })
      toast.success("Komponen ditambahkan")
      setDialog(false)
      setForm({ nama: "", jenis: "FORMATIF", bobot: "1", tanggal: new Date().toISOString().slice(0, 10) })
      await muatKomponen(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menambah komponen")
    }
  }

  const hapus = async (id: string) => {
    if (!window.confirm("Hapus komponen ini beserta nilainya?")) return
    try {
      await hapusKomponen(id)
      toast.success("Komponen dihapus")
      await muatKomponen(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus komponen")
    }
  }

  const kelasTerpilih = refs.kelas.find((k) => k.id === kelasId)
  const mapelTerpilih = refs.mapels.find((m) => m.id === mapelId)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Pilih kelas & mata pelajaran
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Semester</Label>
            <Select value={semesterId} onValueChange={gantiSemester}>
              <SelectTrigger><SelectValue placeholder="Pilih semester" /></SelectTrigger>
              <SelectContent>
                {refs.semesters.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nama} — {s.tahunAjaran.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kelas</Label>
            <Select value={kelasId} onValueChange={gantiKelas}>
              <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
              <SelectContent>
                {refs.kelas.map((k) => (
                  <SelectItem key={k.id} value={k.id}>{k.nama}{k.guru ? ` • ${k.guru.nama}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mata pelajaran</Label>
            <Select value={mapelId} onValueChange={gantiMapel}>
              <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
              <SelectContent>
                {mapelsSemester.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        {pengaturan && (
          <CardContent className="pt-0 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            <span>Bobot:</span>
            <Badge variant="secondary" className="text-[10px]">Formatif {pengaturan.bobotFormatif}%</Badge>
            <Badge variant="secondary" className="text-[10px]">Sumatif {pengaturan.bobotSumatif}%</Badge>
            <Badge variant="secondary" className="text-[10px]">Proyek {pengaturan.bobotProyek}%</Badge>
            <Badge variant="secondary" className="text-[10px]">Praktik {pengaturan.bobotPraktik}%</Badge>
            <span>• KKTP {pengaturan.kktp}</span>
          </CardContent>
        )}
      </Card>

      {!kelasId || !mapelId ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Pilih kelas dan mata pelajaran untuk mulai menilai.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Komponen penilaian — {mapelTerpilih?.nama} / {kelasTerpilih?.nama}
            </CardTitle>
            <Button size="sm" onClick={() => setDialog(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Komponen
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : komponens.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Belum ada komponen. Tambahkan nilai formatif, sumatif, proyek, atau praktik.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama komponen</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="text-center">Bobot</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-center">Terisi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {komponens.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.nama}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{k.jenis}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{k.bobot}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(k.tanggal).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell className="text-center text-sm">{k._count.nilais}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => bukaGrid(k.id)}>
                            <ClipboardList className="h-3.5 w-3.5 mr-1" /> Input
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => hapus(k.id)} aria-label="Hapus komponen">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {grid && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Input nilai — {grid.komponen.nama}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {grid.komponen.mapel.nama} • {grid.komponen.kelas.nama} • bobot komponen {grid.komponen.bobot}
              </p>
            </div>
            <Button size="sm" onClick={simpanGrid} disabled={menyimpan}>
              <Save className="h-4 w-4 mr-1.5" /> {menyimpan ? "Menyimpan..." : "Simpan nilai"}
            </Button>
          </CardHeader>
          <CardContent className="p-0 max-h-[28rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">No</TableHead>
                  <TableHead>Nama siswa</TableHead>
                  <TableHead>NIS</TableHead>
                  <TableHead className="w-28 text-center">Nilai (0–100)</TableHead>
                  <TableHead className="w-56">Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grid.siswas.map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{s.nama}</TableCell>
                    <TableCell className="text-sm">{s.nis || "-"}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={s.nilai ?? ""}
                        onChange={(e) => {
                          const v = e.target.value
                          setGrid((g) => g ? {
                            ...g,
                            siswas: g.siswas.map((row) => row.id === s.id
                              ? { ...row, nilai: v === "" ? null : Math.max(0, Math.min(100, Number(v))) }
                              : row),
                          } : g)
                        }}
                        className="h-8 text-center"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={s.catatan}
                        placeholder="Opsional"
                        onChange={(e) => setGrid((g) => g ? {
                          ...g,
                          siswas: g.siswas.map((row) => row.id === s.id ? { ...row, catatan: e.target.value } : row),
                        } : g)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah komponen penilaian</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nama komponen</Label>
              <Input
                placeholder="Contoh: Sumatif Bab 3"
                value={form.nama}
                onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jenis</Label>
                <Select value={form.jenis} onValueChange={(v) => setForm((f) => ({ ...f, jenis: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JENIS_KOMPONEN.map((j) => (
                      <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Bobot komponen</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.bobot}
                  onChange={(e) => setForm((f) => ({ ...f, bobot: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal penilaian</Label>
              <Input
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
              />
            </div>
            <Button className="w-full" onClick={simpanKomponen}>Simpan komponen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
