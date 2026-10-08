"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react"
import {
  buatPengganti,
  getDataPendukung,
  getKebijakanAdmin,
  getMonitoringKehadiran,
  getPenggantiList,
  getRekapKehadiran,
  hapusPengganti,
  koreksiAbsensiSesi,
  setMetodeGuru,
  simpanKebijakanAbsensi,
} from "../actions"
import { getJadwalAdmin } from "../../jadwal/actions"
import { getSemesterRefs } from "../../actions"
import { AdminAbsensiSiswa } from "./admin-absensi-siswa"
import { AdminPengecualian } from "./admin-pengecualian"
import { DAFTAR_METODE } from "@/lib/absensi-metode"

const STATUS_OPTIONS = [
  { v: "HADIR", label: "Hadir" },
  { v: "TERLAMBAT", label: "Terlambat" },
  { v: "IZIN", label: "Izin" },
  { v: "SAKIT", label: "Sakit" },
  { v: "TIDAK_HADIR", label: "Tidak Hadir" },
  { v: "BELUM_ABSEN", label: "Belum Absen" },
]

const STATUS_STYLE: Record<string, string> = {
  BELUM_ABSEN: "bg-slate-100 text-slate-600 border-slate-200",
  HADIR: "bg-emerald-100 text-emerald-700 border-emerald-200",
  TERLAMBAT: "bg-amber-100 text-amber-700 border-amber-200",
  IZIN: "bg-sky-100 text-sky-700 border-sky-200",
  SAKIT: "bg-violet-100 text-violet-700 border-violet-200",
  TIDAK_HADIR: "bg-red-100 text-red-700 border-red-200",
}

const STATUS_LABEL: Record<string, string> = {
  BELUM_ABSEN: "Belum Absen",
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  IZIN: "Izin",
  SAKIT: "Sakit",
  TIDAK_HADIR: "Tidak Hadir",
}

const ONE = "__all__"

function statusBadge(status: string, terlambat?: number | null) {
  return (
    <Badge variant="outline" className={`${STATUS_STYLE[status] ?? ""} font-semibold`}>
      {STATUS_LABEL[status] ?? status}
      {status === "TERLAMBAT" && terlambat ? ` +${terlambat}m` : ""}
    </Badge>
  )
}

export function AdminAbsensiGuru() {
  const [tab, setTab] = useState("monitoring")
  const [pendukung, setPendukung] = useState<{ guru: any[]; kelas: any[]; mapel: any[] }>({ guru: [], kelas: [], mapel: [] })

  // monitoring
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [fGuru, setFGuru] = useState(ONE)
  const [fKelas, setFKelas] = useState(ONE)
  const [fMapel, setFMapel] = useState(ONE)
  const [fStatus, setFStatus] = useState(ONE)
  const [search, setSearch] = useState("")
  const [monitoring, setMonitoring] = useState<any>(null)
  const [loadingM, setLoadingM] = useState(true)

  // rekap
  const [start, setStart] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`)
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10))
  const [rGuru, setRGuru] = useState(ONE)
  const [rKelas, setRKelas] = useState(ONE)
  const [rMapel, setRMapel] = useState(ONE)
  const [rSemester, setRSemester] = useState(ONE)
  const [semesters, setSemesters] = useState<{ id: string; nama: string }[]>([])
  const [rekap, setRekap] = useState<any>(null)
  const [loadingR, setLoadingR] = useState(false)

  // pengganti
  const [pengganti, setPengganti] = useState<any[]>([])
  const [dialogPengganti, setDialogPengganti] = useState(false)
  const [pgForm, setPgForm] = useState({ jadwalPelajaranId: ONE, asliGuruId: ONE, penggantiGuruId: ONE, alasan: "", tanggal: new Date().toISOString().slice(0, 10) })
  const [jadwalList, setJadwalList] = useState<any[]>([])

  // kebijakan
  const [kebijakan, setKebijakan] = useState<any>({
    toleransiTerlambatMenit: 15,
    autoTidakHadirSetelahMenit: 60,
    metode: "TANPA",
    lokasi: { lat: null, lng: null, radiusMeter: 100, akurasiMaksMeter: 50, gpsWajib: false, lokasiNama: null },
  })
  const [retensiFoto, setRetensiFoto] = useState(90)
  const [mencariLokasi, setMencariLokasi] = useState(false)
  const [savingKebijakan, setSavingKebijakan] = useState(false)

  // koreksi
  const [koreksiRow, setKoreksiRow] = useState<any>(null)
  const [kForm, setKForm] = useState({ status: "HADIR", jamMasuk: "", jamSelesai: "", keterangan: "", alasan: "" })
  const [savingKoreksi, setSavingKoreksi] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadMonitoring = useCallback(async () => {
    setLoadingM(true)
    try {
      const data = await getMonitoringKehadiran({
        tanggal,
        guruId: fGuru === ONE ? undefined : fGuru,
        kelasId: fKelas === ONE ? undefined : fKelas,
        mataPelajaranId: fMapel === ONE ? undefined : fMapel,
        status: fStatus === ONE ? undefined : fStatus,
        search: search || undefined,
      })
      setMonitoring(data)
      setKebijakan(data.kebijakan ?? kebijakan)
      if (data.kebijakan?.fotoRetensiHari) setRetensiFoto(data.kebijakan.fotoRetensiHari)
    } catch (e: any) {
      toast.error(e?.message || "Gagal memuat monitoring")
    } finally {
      setLoadingM(false)
    }
  }, [tanggal, fGuru, fKelas, fMapel, fStatus, search])

  useEffect(() => {
    getDataPendukung()
      .then((d) => setPendukung(d as any))
      .catch(() => {})
    getKebijakanAdmin()
      .then((k: any) => {
        setKebijakan(k)
        if (k?.fotoRetensiHari) setRetensiFoto(k.fotoRetensiHari)
      })
      .catch(() => {})
    getPenggantiList()
      .then((l) => setPengganti(l as any[]))
      .catch(() => {})
    getJadwalAdmin({})
      .then((d) => setJadwalList((d as any).rows || []))
      .catch(() => {})
    getSemesterRefs()
      .then((s) => setSemesters((s as any[]) || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadMonitoring()
    const id = setInterval(loadMonitoring, 30000) // real-time
    return () => clearInterval(id)
  }, [loadMonitoring])

  const loadRekap = async () => {
    setLoadingR(true)
    try {
      const data = await getRekapKehadiran({
        start,
        end,
        guruId: rGuru === ONE ? undefined : rGuru,
        kelasId: rKelas === ONE ? undefined : rKelas,
        mataPelajaranId: rMapel === ONE ? undefined : rMapel,
        semesterId: rSemester === ONE ? undefined : rSemester,
      })
      setRekap(data)
    } catch (e: any) {
      toast.error(e?.message || "Gagal memuat rekap")
    } finally {
      setLoadingR(false)
    }
  }

  useEffect(() => {
    if (tab === "rekap" && !rekap) loadRekap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const exportUrl = (format: string) =>
    `/api/admin/absensi-guru/export?format=${format}&start=${start}&end=${end}` +
    `${rGuru !== ONE ? `&guruId=${rGuru}` : ""}${rKelas !== ONE ? `&kelasId=${rKelas}` : ""}${
      rMapel !== ONE ? `&mataPelajaranId=${rMapel}` : ""
    }${rSemester !== ONE ? `&semesterId=${rSemester}` : ""}`

  const bukaKoreksi = (row: any) => {
    setKoreksiRow(row)
    setKForm({
      status: row.status,
      jamMasuk: row.jamMasuk || "",
      jamSelesai: row.jamKeluar || "",
      keterangan: row.keterangan || "",
      alasan: "",
    })
  }

  const submitKoreksi = async () => {
    if (kForm.alasan.trim().length < 3) {
      toast.error("Alasan koreksi wajib diisi")
      return
    }
    setSavingKoreksi(true)
    try {
      await koreksiAbsensiSesi({
        sesiId: koreksiRow.sesiId ?? null,
        guruId: koreksiRow.guruId,
        jadwalPelajaranId: koreksiRow.jadwalId,
        tanggal,
        status: kForm.status as never,
        alasan: kForm.alasan,
        jamMasuk: kForm.jamMasuk || null,
        jamSelesai: kForm.jamSelesai || null,
        keterangan: kForm.keterangan || null,
      })
      toast.success("Koreksi tersimpan + audit log")
      setKoreksiRow(null)
      loadMonitoring()
    } catch (e: any) {
      toast.error(e?.message || "Gagal mengoreksi")
    } finally {
      setSavingKoreksi(false)
    }
  }

  const submitPengganti = async () => {
    if (pgForm.jadwalPelajaranId === ONE || pgForm.asliGuruId === ONE || pgForm.penggantiGuruId === ONE) {
      toast.error("Lengkapi jadwal, guru asli, dan guru pengganti")
      return
    }
    setBusy(true)
    try {
      await buatPengganti({
        jadwalPelajaranId: pgForm.jadwalPelajaranId,
        tanggal: pgForm.tanggal,
        asliGuruId: pgForm.asliGuruId,
        penggantiGuruId: pgForm.penggantiGuruId,
        alasan: pgForm.alasan,
      })
      toast.success("Pengganti guru ditetapkan")
      setDialogPengganti(false)
      setPgForm({ ...pgForm, alasan: "" })
      const l = await getPenggantiList()
      setPengganti(l as any[])
      loadMonitoring()
    } catch (e: any) {
      toast.error(e?.message || "Gagal membuat pengganti")
    } finally {
      setBusy(false)
    }
  }

  const hapusPg = async (id: string) => {
    try {
      await hapusPengganti(id)
      setPengganti((prev) => prev.filter((p) => p.id !== id))
      toast.success("Pengganti dihapus")
    } catch (e: any) {
      toast.error(e?.message || "Gagal menghapus")
    }
  }

  const saveKebijakan = async () => {
    setSavingKebijakan(true)
    try {
      const loc = kebijakan.lokasi ?? {}
      const k = await simpanKebijakanAbsensi({
        toleransiTerlambatMenit: kebijakan.toleransiTerlambatMenit,
        autoTidakHadirSetelahMenit: kebijakan.autoTidakHadirSetelahMenit,
        absensiMetode: kebijakan.metode || "TANPA",
        gpsWajib: !!loc.gpsWajib,
        gpsLokasiNama: loc.lokasiNama || null,
        gpsLat: loc.lat,
        gpsLng: loc.lng,
        gpsRadiusMeter: loc.radiusMeter,
        gpsAkurasiMaksMeter: loc.akurasiMaksMeter,
        fotoRetensiHari: retensiFoto,
      })
      setKebijakan(k as any)
      toast.success("Kebijakan absensi & geofencing tersimpan")
      loadMonitoring()
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan kebijakan")
    } finally {
      setSavingKebijakan(false)
    }
  }

  const setLokasi = (patch: Partial<any>) =>
    setKebijakan((k: any) => ({ ...k, lokasi: { ...(k.lokasi ?? {}), ...patch } }))

  const pakaiLokasiSaya = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Perangkat tidak mendukung GPS")
      return
    }
    setMencariLokasi(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLokasi({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) })
        setMencariLokasi(false)
        toast.success("Koordinat lokasi diambil dari perangkat")
      },
      () => {
        setMencariLokasi(false)
        toast.error("Gagal mengambil lokasi — izinkan akses GPS")
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const simpanMetodeGuru = async (guruId: string, metode: string) => {
    try {
      await setMetodeGuru(guruId, metode === ONE ? null : metode)
      setPendukung((p) => ({
        ...p,
        guru: p.guru.map((g) => (g.id === guruId ? { ...g, absensiMetode: metode === ONE ? null : metode } : g)),
      }))
      toast.success("Metode guru diperbarui")
    } catch (e: any) {
      toast.error(e?.message || "Gagal memperbarui metode")
    }
  }

  const summary = monitoring?.summary
  const rows: any[] = monitoring?.rows ?? []

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="monitoring">Monitoring Guru</TabsTrigger>
          <TabsTrigger value="siswa">Absensi Siswa</TabsTrigger>
          <TabsTrigger value="rekap">Rekap &amp; Export</TabsTrigger>
          <TabsTrigger value="pengganti">Pengganti Guru</TabsTrigger>
          <TabsTrigger value="pengecualian">Pengecualian</TabsTrigger>
          <TabsTrigger value="kebijakan">Kebijakan &amp; GPS</TabsTrigger>
        </TabsList>

        {/* â”€â”€ MONITORING â”€â”€ */}
        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Kehadiran Guru â€” {monitoring?.hari ?? ""}
                </CardTitle>
                <div className="ml-auto flex items-center gap-2">
                  <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="h-9 w-[150px]" />
                  <Button variant="outline" size="sm" onClick={loadMonitoring}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {[
                  { l: "Total Sesi", v: summary?.total ?? 0, c: "text-foreground" },
                  { l: "Hadir", v: summary?.hadir ?? 0, c: "text-emerald-600" },
                  { l: "Terlambat", v: summary?.terlambat ?? 0, c: "text-amber-600" },
                  { l: "Izin", v: summary?.izin ?? 0, c: "text-sky-600" },
                  { l: "Sakit", v: summary?.sakit ?? 0, c: "text-violet-600" },
                  { l: "Tidak Hadir", v: summary?.tidakHadir ?? 0, c: "text-red-600" },
                  { l: "Sedang Berlangsung", v: summary?.aktif ?? 0, c: "text-primary" },
                ].map((x) => (
                  <div key={x.l} className="rounded-lg border p-3 text-center">
                    <div className={`text-lg font-bold tabular-nums ${x.c}`}>{x.v}</div>
                    <div className="text-[11px] text-muted-foreground">{x.l}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari guru/kelas/mapel..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 w-[220px] pl-8"
                  />
                </div>
                <Select value={fGuru} onValueChange={setFGuru}>
                  <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Guru" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ONE}>Semua Guru</SelectItem>
                    {pendukung.guru.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={fKelas} onValueChange={setFKelas}>
                  <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Kelas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ONE}>Semua Kelas</SelectItem>
                    {pendukung.kelas.map((k) => (
                      <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={fMapel} onValueChange={setFMapel}>
                  <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Mapel" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ONE}>Semua Mapel</SelectItem>
                    {pendukung.mapel.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ONE}>Semua Status</SelectItem>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loadingM && !monitoring ? (
                <div className="h-40 animate-pulse rounded-xl bg-muted" />
              ) : rows.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Tidak ada jadwal mengajar pada tanggal ini
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="p-3">Jam</th>
                        <th className="p-3">Guru</th>
                        <th className="p-3">Kelas</th>
                        <th className="p-3">Mapel</th>
                        <th className="p-3">Masuk</th>
                        <th className="p-3">Selesai</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Verifikasi</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={`${r.guruId}-${r.jadwalId}-${i}`} className={`border-t ${r.fase === "AKTIF" ? "bg-primary/5" : ""}`}>
                          <td className="p-3 whitespace-nowrap tabular-nums">
                            {r.jamMulai}-{r.jamSelesai}
                            {r.fase === "AKTIF" && <span className="ml-1 text-[10px] font-bold text-primary">â— LIVE</span>}
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{r.guruNama}</div>
                            {r.penggantiNama && <div className="text-[11px] text-sky-600">{r.penggantiNama}</div>}
                          </td>
                          <td className="p-3">{r.kelasNama}</td>
                          <td className="p-3">{r.mataPelajaranNama}</td>
                          <td className="p-3 tabular-nums">{r.jamMasuk || "-"}</td>
                          <td className="p-3 tabular-nums">
                            {r.jamKeluar || "-"}
                            {r.durasiMenit != null && <span className="text-[11px] text-muted-foreground"> ({r.durasiMenit}m)</span>}
                          </td>
                          <td className="p-3">
                            {statusBadge(r.status, r.terlambatMenit)}
                            {r.koreksiAlasan && (
                              <div className="mt-1 text-[11px] text-amber-600">Koreksi: {r.koreksiAlasan}</div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className={`justify-start text-[10px] ${r.fotoUrl ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "text-muted-foreground"}`}>
                                Foto {r.fotoUrl ? <a href={r.fotoUrl} target="_blank" rel="noreferrer" className="ml-1 underline">lihat</a> : "—"}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`justify-start text-[10px] ${r.gps ? (r.gps.valid ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600") : "text-muted-foreground"}`}
                              >
                                GPS {r.gps ? `${r.gps.jarakMeter != null ? `${r.gps.jarakMeter}m` : "tersimpan"}${r.gps.valid ? " ✓" : " ✗"}` : "—"}
                                {r.gps?.mock ? " • mock?" : ""}
                              </Badge>
                              <Badge variant="outline" className={`justify-start text-[10px] ${r.sidikJariVerified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "text-muted-foreground"}`}>
                                Sidik {r.sidikJariVerified ? "✓" : "—"}
                              </Badge>
                              {r.gps && (
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                  {r.gps.lat.toFixed(5)}, {r.gps.lng.toFixed(5)} • akurasi {r.gps.akurasiMeter != null ? `${Math.round(r.gps.akurasiMeter)}m` : "-"}
                                </span>
                              )}
                              {r.verifikasiCatatan && (
                                <span className="text-[10px] text-amber-600">{r.verifikasiCatatan}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <Button size="sm" variant="outline" onClick={() => bukaKoreksi(r)}>
                              <Pencil className="h-3.5 w-3.5" /> Koreksi
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
        </TabsContent>

        {/* ── ABSENSI SISWA ── */}
        <TabsContent value="siswa" className="space-y-4">
          <AdminAbsensiSiswa pendukung={pendukung} />
        </TabsContent>

        {/* ── PENGECAULIAN ── */}
        <TabsContent value="pengecualian" className="space-y-4">
          <AdminPengecualian />
        </TabsContent>

        {/* ── REKAP & EXPORT ── */}
        <TabsContent value="rekap" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Rekap Kehadiran Guru</CardTitle>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-[150px]" />
                  <span className="text-xs text-muted-foreground">s/d</span>
                  <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-[150px]" />
                  <Button size="sm" onClick={loadRekap} disabled={loadingR}>
                    {loadingR ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Tampilkan
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Select value={rGuru} onValueChange={setRGuru}>
                  <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Guru" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ONE}>Semua Guru</SelectItem>
                    {pendukung.guru.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={rKelas} onValueChange={setRKelas}>
                  <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Kelas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ONE}>Semua Kelas</SelectItem>
                    {pendukung.kelas.map((k) => (
                      <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={rMapel} onValueChange={setRMapel}>
                  <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Mapel" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ONE}>Semua Mapel</SelectItem>
                    {pendukung.mapel.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={rSemester} onValueChange={setRSemester}>
                  <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Semester" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ONE}>Semua Semester</SelectItem>
                    {semesters.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => window.open(exportUrl("xlsx"), "_blank")}>
                    <FileSpreadsheet className="h-4 w-4" /> Export Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(exportUrl("pdf"), "_blank")}>
                    <FileText className="h-4 w-4" /> Export PDF
                  </Button>
                </div>
              </div>

              {rekap?.total && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {[
                    { l: "Total Sesi", v: rekap.total.totalSesi, c: "text-foreground" },
                    { l: "Hadir", v: rekap.total.hadir, c: "text-emerald-600" },
                    { l: "Terlambat", v: rekap.total.terlambat, c: "text-amber-600" },
                    { l: "Izin", v: rekap.total.izin, c: "text-sky-600" },
                    { l: "Sakit", v: rekap.total.sakit, c: "text-violet-600" },
                    { l: "Tidak Hadir", v: rekap.total.tidakHadir, c: "text-red-600" },
                    { l: "Kehadiran", v: `${rekap.total.rataKehadiranPersen}%`, c: "text-primary" },
                  ].map((x) => (
                    <div key={x.l} className="rounded-lg border p-3 text-center">
                      <div className={`text-lg font-bold tabular-nums ${x.c}`}>{x.v}</div>
                      <div className="text-[11px] text-muted-foreground">{x.l}</div>
                    </div>
                  ))}
                </div>
              )}

              {rekap && (rekap.rekapPerGuru?.length ?? 0) > 0 && (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="p-3">Guru</th>
                        <th className="p-3">Sesi</th>
                        <th className="p-3">Hadir</th>
                        <th className="p-3">Terlambat</th>
                        <th className="p-3">Izin</th>
                        <th className="p-3">Sakit</th>
                        <th className="p-3">Tidak Hadir</th>
                        <th className="p-3">Kehadiran</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rekap.rekapPerGuru.map((r: any) => (
                        <tr key={r.guruId} className="border-t">
                          <td className="p-3 font-medium">{r.guruNama}</td>
                          <td className="p-3 tabular-nums">{r.totalSesi}</td>
                          <td className="p-3 tabular-nums text-emerald-600">{r.hadir}</td>
                          <td className="p-3 tabular-nums text-amber-600">{r.terlambat}</td>
                          <td className="p-3 tabular-nums text-sky-600">{r.izin}</td>
                          <td className="p-3 tabular-nums text-violet-600">{r.sakit}</td>
                          <td className="p-3 tabular-nums text-red-600">{r.tidakHadir}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                                <div className="h-full bg-primary" style={{ width: `${r.rataKehadiranPersen}%` }} />
                              </div>
                              <span className="tabular-nums text-xs font-semibold">{r.rataKehadiranPersen}%</span>
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
        </TabsContent>

        {/* â”€â”€ PENGGANTI GURU â”€â”€ */}
        <TabsContent value="pengganti" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-primary" /> Pengganti Guru
                </CardTitle>
                <Button size="sm" className="ml-auto" onClick={() => setDialogPengganti(true)}>
                  <Plus className="h-4 w-4" /> Tetapkan Pengganti
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {pengganti.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Belum ada pengganti guru
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="p-3">Tanggal</th>
                        <th className="p-3">Sesi</th>
                        <th className="p-3">Guru Asli</th>
                        <th className="p-3">Pengganti</th>
                        <th className="p-3">Alasan</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pengganti.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="p-3 whitespace-nowrap">{new Date(p.tanggal).toLocaleDateString("id-ID")}</td>
                          <td className="p-3">
                            {p.jadwal?.kelas?.nama} â€¢ {p.jadwal?.mataPelajaran?.nama}
                            <div className="text-[11px] text-muted-foreground">
                              {p.jadwal?.hari} {p.jadwal?.jamMulai}-{p.jadwal?.jamSelesai}
                            </div>
                          </td>
                          <td className="p-3">{p.asliGuru?.nama}</td>
                          <td className="p-3 font-medium">{p.pengganti?.nama}</td>
                          <td className="p-3 max-w-[220px] truncate text-xs">{p.alasan}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={p.status === "DISETUJUI" ? "bg-emerald-100 text-emerald-700" : p.status === "DITOLAK" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
                              {p.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <Button size="sm" variant="ghost" onClick={() => hapusPg(p.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
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
        </TabsContent>

        {/* â”€â”€ KEBIJAKAN â”€â”€ */}
        <TabsContent value="kebijakan" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" /> Kebijakan Absensi, Metode &amp; GPS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 max-w-2xl">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Batas toleransi keterlambatan (menit)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={kebijakan.toleransiTerlambatMenit}
                    onChange={(e) => setKebijakan((k: any) => ({ ...k, toleransiTerlambatMenit: Number(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Guru yang absen masuk melebihi batas ini akan berstatus <strong>Terlambat</strong>.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Tandai Tidak Hadir setelah sesi berakhir (menit)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={480}
                    value={kebijakan.autoTidakHadirSetelahMenit}
                    onChange={(e) => setKebijakan((k: any) => ({ ...k, autoTidakHadirSetelahMenit: Number(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sesi yang belum diabsen otomatis menjadi <strong>Tidak Hadir</strong> (waktu server).
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border p-4">
                <Label className="text-sm font-semibold">Metode Absensi (berlaku umum, kecuali override per guru)</Label>
                <Select value={kebijakan.metode || "TANPA"} onValueChange={(v) => setKebijakan((k: any) => ({ ...k, metode: v }))}>
                  <SelectTrigger className="w-full sm:w-[320px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAFTAR_METODE.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Metode yang tidak dipilih tidak diwajibkan. Foto/GPS/sidik jari divalidasi ulang di server saat guru absen.
                </p>
              </div>

              <div className="space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-semibold">Validasi Lokasi (GPS Geofencing)</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!kebijakan.lokasi?.gpsWajib}
                      onChange={(e) => setLokasi({ gpsWajib: e.target.checked })}
                      className="h-4 w-4"
                    />
                    Wajibkan GPS
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nama lokasi / unit</Label>
                    <Input
                      value={kebijakan.lokasi?.lokasiNama ?? ""}
                      onChange={(e) => setLokasi({ lokasiNama: e.target.value })}
                      placeholder="mis. SMK Kampus A"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Radius absensi (meter)</Label>
                    <Input
                      type="number"
                      min={10}
                      max={2000}
                      value={kebijakan.lokasi?.radiusMeter ?? 100}
                      onChange={(e) => setLokasi({ radiusMeter: Number(e.target.value) })}
                    />
                    <p className="text-[11px] text-muted-foreground">Umumnya 50–200 meter dari titik lokasi.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={kebijakan.lokasi?.lat ?? ""}
                      onChange={(e) => setLokasi({ lat: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="-7.123456"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={kebijakan.lokasi?.lng ?? ""}
                      onChange={(e) => setLokasi({ lng: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="110.123456"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Toleransi akurasi GPS maksimal (meter)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={kebijakan.lokasi?.akurasiMaksMeter ?? 50}
                      onChange={(e) => setLokasi({ akurasiMaksMeter: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Retensi foto bukti (hari)</Label>
                    <Input type="number" min={1} max={3650} value={retensiFoto} onChange={(e) => setRetensiFoto(Number(e.target.value))} />
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={pakaiLokasiSaya} disabled={mencariLokasi}>
                  {mencariLokasi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                  Gunakan Lokasi Perangkat Ini
                </Button>
                <p className="text-xs text-muted-foreground">
                  Jarak dihitung dengan Haversine dan divalidasi ulang di server. Mock location tercatat sebagai indikasi, bukan jaminan anti-manipulasi.
                </p>
              </div>

              <div className="space-y-2 rounded-xl border p-4">
                <Label className="text-sm font-semibold">Override Metode per Guru</Label>
                <div className="max-h-[240px] overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="p-2">Guru</th>
                        <th className="p-2 w-[260px]">Metode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendukung.guru.map((g) => (
                        <tr key={g.id} className="border-t">
                          <td className="p-2 font-medium">{g.nama}</td>
                          <td className="p-2">
                            <Select value={g.absensiMetode || ONE} onValueChange={(v) => simpanMetodeGuru(g.id, v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={ONE}>Ikut pengaturan umum</SelectItem>
                                {DAFTAR_METODE.map((m) => (
                                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Button onClick={saveKebijakan} disabled={savingKebijakan}>
                {savingKebijakan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Simpan Kebijakan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* â”€â”€ DIALOG KOREKSI â”€â”€ */}
      <Dialog open={!!koreksiRow} onOpenChange={(o) => !o && setKoreksiRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Koreksi Absensi
            </DialogTitle>
          </DialogHeader>
          {koreksiRow && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="font-medium">{koreksiRow.guruNama}</div>
                <div className="text-xs text-muted-foreground">
                  {koreksiRow.kelasNama} â€¢ {koreksiRow.mataPelajaranNama} â€¢ {koreksiRow.jamMulai}-{koreksiRow.jamSelesai}
                </div>
                {!koreksiRow.sesiId && (
                  <div className="mt-1 text-xs text-amber-600">
                    Guru belum memiliki data absensi untuk sesi ini â€” koreksi akan membuat status baru.
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={kForm.status} onValueChange={(v) => setKForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Jam Masuk</Label>
                  <Input type="time" value={kForm.jamMasuk} onChange={(e) => setKForm((f) => ({ ...f, jamMasuk: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Jam Selesai</Label>
                  <Input type="time" value={kForm.jamSelesai} onChange={(e) => setKForm((f) => ({ ...f, jamSelesai: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Keterangan</Label>
                <Input value={kForm.keterangan} onChange={(e) => setKForm((f) => ({ ...f, keterangan: e.target.value }))} placeholder="Opsional" />
              </div>
              <div className="space-y-2">
                <Label>Alasan Koreksi (wajib, tersimpan di audit log)</Label>
                <Textarea
                  value={kForm.alasan}
                  onChange={(e) => setKForm((f) => ({ ...f, alasan: e.target.value }))}
                  placeholder="Contoh: Guru lupa absen masuk, konfirmasi satpam pukul 07.10"
                  rows={3}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setKoreksiRow(null)}>Batal</Button>
            <Button onClick={submitKoreksi} disabled={savingKoreksi}>
              {savingKoreksi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan Koreksi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* â”€â”€ DIALOG PENGGANTI â”€â”€ */}
      <Dialog open={dialogPengganti} onOpenChange={setDialogPengganti}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tetapkan Pengganti Guru</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={pgForm.tanggal} onChange={(e) => setPgForm((f) => ({ ...f, tanggal: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Sesi Jadwal</Label>
              <Select value={pgForm.jadwalPelajaranId} onValueChange={(v) => setPgForm((f) => ({ ...f, jadwalPelajaranId: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih jadwal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ONE}>Pilih jadwal...</SelectItem>
                  {jadwalList.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.hari} {j.jamMulai}-{j.jamSelesai} â€¢ {j.kelas?.nama} â€¢ {j.mataPelajaran?.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Guru Asli</Label>
                <Select value={pgForm.asliGuruId} onValueChange={(v) => setPgForm((f) => ({ ...f, asliGuruId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Guru" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ONE}>Pilih guru...</SelectItem>
                    {pendukung.guru.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Guru Pengganti</Label>
                <Select value={pgForm.penggantiGuruId} onValueChange={(v) => setPgForm((f) => ({ ...f, penggantiGuruId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Guru" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ONE}>Pilih guru...</SelectItem>
                    {pendukung.guru.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Alasan</Label>
              <Textarea value={pgForm.alasan} onChange={(e) => setPgForm((f) => ({ ...f, alasan: e.target.value }))} rows={2} placeholder="Sakit, dinas luar, ..." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogPengganti(false)}>Batal</Button>
            <Button onClick={submitPengganti} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Tetapkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
