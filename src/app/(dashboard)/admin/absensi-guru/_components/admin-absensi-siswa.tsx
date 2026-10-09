"use client"

import { ymd } from "@/lib/utils"

import { useCallback, useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Pencil, RefreshCw, Save, Search, Users, UserX } from "lucide-react"
import {
  getMonitoringSiswa,
  getSiswaSeringTidakHadir,
  koreksiAbsensiSiswaAdmin,
} from "../actions"

const ONE = "__all__"
const STATUS_SISWA = ["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "ALPA", "TIDAK_HADIR"]
const STATUS_SISWA_LABEL: Record<string, string> = {
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  IZIN: "Izin",
  SAKIT: "Sakit",
  ALPA: "Alpa",
  TIDAK_HADIR: "Tidak Hadir",
}
const STATUS_SISWA_STYLE: Record<string, string> = {
  HADIR: "bg-emerald-100 text-emerald-700 border-emerald-200",
  TERLAMBAT: "bg-amber-100 text-amber-700 border-amber-200",
  IZIN: "bg-sky-100 text-sky-700 border-sky-200",
  SAKIT: "bg-yellow-100 text-yellow-700 border-yellow-200",
  ALPA: "bg-red-100 text-red-700 border-red-200",
  TIDAK_HADIR: "bg-red-100 text-red-700 border-red-200",
}

export function AdminAbsensiSiswa({
  pendukung,
}: {
  pendukung: { guru: any[]; kelas: any[]; mapel: any[] }
}) {
  const [tanggal, setTanggal] = useState(ymd())
  const [fKelas, setFKelas] = useState(ONE)
  const [fMapel, setFMapel] = useState(ONE)
  const [fGuru, setFGuru] = useState(ONE)
  const [search, setSearch] = useState("")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // siswa sering tidak hadir
  const [start, setStart] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`)
  const [end, setEnd] = useState(ymd())
  const [alpaList, setAlpaList] = useState<any[]>([])

  // dialog detail + koreksi
  const [detail, setDetail] = useState<any>(null)
  const [form, setForm] = useState<Record<string, { status: string; keterangan: string }>>({})
  const [alasan, setAlasan] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getMonitoringSiswa({
        tanggal,
        kelasId: fKelas === ONE ? undefined : fKelas,
        mataPelajaranId: fMapel === ONE ? undefined : fMapel,
        guruId: fGuru === ONE ? undefined : fGuru,
        search: search || undefined,
      })
      setData(d)
    } catch (e: any) {
      toast.error(e?.message || "Gagal memuat absensi siswa")
    } finally {
      setLoading(false)
    }
  }, [tanggal, fKelas, fMapel, fGuru, search])

  useEffect(() => { load() }, [load])

  const loadAlpa = async () => {
    try {
      const rows = await getSiswaSeringTidakHadir({ start, end, kelasId: fKelas === ONE ? undefined : fKelas })
      setAlpaList(rows as any[])
    } catch { /* abaikan */ }
  }
  useEffect(() => { loadAlpa() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [start, end, fKelas])

  const bukaDetail = (row: any) => {
    if (!row.absensiId) {
      toast.error("Belum ada absensi tersimpan untuk sesi ini")
      return
    }
    const f: Record<string, { status: string; keterangan: string }> = {}
    for (const s of row.detail || []) {
      f[s.siswaId] = { status: s.status, keterangan: s.keterangan || "" }
    }
    setForm(f)
    setAlasan("")
    setDetail(row)
  }

  const submit = async () => {
    if (alasan.trim().length < 3) {
      toast.error("Alasan koreksi wajib diisi (min. 3 karakter)")
      return
    }
    setSaving(true)
    try {
      await koreksiAbsensiSiswaAdmin({
        absensiId: detail.absensiId,
        alasan,
        siswaStatus: Object.entries(form).map(([siswaId, v]) => ({ siswaId, status: v.status, keterangan: v.keterangan || undefined })),
      })
      toast.success("Koreksi absensi siswa tersimpan + audit log")
      setDetail(null)
      load()
    } catch (e: any) {
      toast.error(e?.message || "Gagal mengoreksi")
    } finally {
      setSaving(false)
    }
  }

  const sesi: any[] = data?.sesi ?? []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Absensi Siswa per Mata Pelajaran
            </CardTitle>
            <div className="ml-auto flex items-center gap-2">
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="h-9 w-[150px]" />
              <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari kelas/mapel/guru..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-[220px] pl-8" />
            </div>
            <Select value={fKelas} onValueChange={setFKelas}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ONE}>Semua Kelas</SelectItem>
                {pendukung.kelas.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fMapel} onValueChange={setFMapel}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Mapel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ONE}>Semua Mapel</SelectItem>
                {pendukung.mapel.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fGuru} onValueChange={setFGuru}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Guru" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ONE}>Semua Guru</SelectItem>
                {pendukung.guru.map((g) => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="ml-auto self-center">
              Guru belum absen: {data?.belumAbsenGuru ?? 0} / {data?.jadwalTotal ?? 0} sesi
            </Badge>
          </div>

          {loading && !data ? (
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
          ) : sesi.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Tidak ada jadwal pelajaran pada tanggal ini
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">Jam</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3">Mapel</th>
                    <th className="p-3">Guru</th>
                    <th className="p-3">Absen Guru</th>
                    <th className="p-3 text-center">Terisi</th>
                    <th className="p-3 text-center">Hadir</th>
                    <th className="p-3 text-center">Terlambat</th>
                    <th className="p-3 text-center">Izin</th>
                    <th className="p-3 text-center">Sakit</th>
                    <th className="p-3 text-center">Alpa</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {sesi.map((s) => (
                    <tr key={s.jadwalId} className="border-t">
                      <td className="p-3 whitespace-nowrap tabular-nums">{s.jamMulai}-{s.jamSelesai}</td>
                      <td className="p-3">{s.kelasNama}</td>
                      <td className="p-3">{s.mataPelajaranNama}</td>
                      <td className="p-3">{s.guruNama || "-"}</td>
                      <td className="p-3">
                        {s.guruNama ? (
                          s.guruSesiAbsen ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">✓ Absen</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px]">Belum</Badge>
                          )
                        ) : "-"}
                      </td>
                      <td className="p-3 text-center tabular-nums">{s.tercatat}/{s.totalSiswa}</td>
                      <td className="p-3 text-center tabular-nums text-emerald-600">{s.hadir}</td>
                      <td className="p-3 text-center tabular-nums text-amber-600">{s.terlambat}</td>
                      <td className="p-3 text-center tabular-nums text-sky-600">{s.izin}</td>
                      <td className="p-3 text-center tabular-nums text-yellow-600">{s.sakit}</td>
                      <td className="p-3 text-center tabular-nums text-red-600">{s.alpa}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => bukaDetail(s)} disabled={!s.absensiId}>
                          <Pencil className="h-3.5 w-3.5" /> Detail
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-500" /> Siswa Sering Tidak Hadir
            </CardTitle>
            <div className="ml-auto flex items-center gap-2">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-[150px]" />
              <span className="text-xs text-muted-foreground">s/d</span>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-[150px]" />
              <Button size="sm" variant="outline" onClick={loadAlpa}><RefreshCw className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {alpaList.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Tidak ada siswa dengan status Alpa/Tidak Hadir pada rentang ini
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Nama</th>
                    <th className="p-3">NIS</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3 text-right">Jumlah Alpa/Tidak Hadir</th>
                  </tr>
                </thead>
                <tbody>
                  {alpaList.map((r, i) => (
                    <tr key={r.siswaId} className="border-t">
                      <td className="p-3 text-muted-foreground">{i + 1}</td>
                      <td className="p-3 font-medium">{r.nama}</td>
                      <td className="p-3">{r.nis || "-"}</td>
                      <td className="p-3">{r.kelas || "-"}</td>
                      <td className="p-3 text-right font-bold text-red-600 tabular-nums">{r.alpa}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Koreksi Absensi Siswa — {detail?.mataPelajaranNama}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="font-medium">{detail.kelasNama} • {detail.jamMulai}-{detail.jamSelesai}</div>
                <div className="text-xs text-muted-foreground">
                  Guru: {detail.guruNama || "-"} • Pencatat: {detail.pencatat || "-"}
                </div>
              </div>
              <div className="max-h-[320px] overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="p-2">Nama</th>
                      <th className="p-2 w-36">Status</th>
                      <th className="p-2">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.detail || []).map((s: any) => (
                      <tr key={s.siswaId} className="border-t">
                        <td className="p-2 font-medium">{s.siswa?.nama}</td>
                        <td className="p-2">
                          <Select
                            value={form[s.siswaId]?.status || s.status}
                            onValueChange={(v) => setForm((f) => ({ ...f, [s.siswaId]: { ...(f[s.siswaId] || { status: s.status, keterangan: s.keterangan || "" }), status: v } }))}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STATUS_SISWA.map((st) => <SelectItem key={st} value={st}>{STATUS_SISWA_LABEL[st]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            value={form[s.siswaId]?.keterangan ?? s.keterangan ?? ""}
                            onChange={(e) => setForm((f) => ({ ...f, [s.siswaId]: { ...(f[s.siswaId] || { status: s.status, keterangan: "" }), keterangan: e.target.value } }))}
                            className="h-8 text-xs"
                            placeholder="mis. Izin sakit"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2">
                <Label>Alasan Koreksi (wajib — tersimpan di audit log)</Label>
                <Textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={2} placeholder="Contoh: Koreksi data absensi setelah konfirmasi wali kelas" />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDetail(null)}>Batal</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Simpan Koreksi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
