"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Calendar,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Stethoscope,
  UserCheck,
  AlertTriangle,
  CalendarClock,
  Camera,
  MapPin,
  Fingerprint,
} from "lucide-react"
import {
  absenMasukAction,
  absenSelesaiAction,
  absenStatusAction,
  getKebijakanAbsensiAction,
  getRekapBulananAction,
  getRiwayatSesiAction,
  getSesiAbsensiHariIni,
} from "../actions"
import { AbsensiClient } from "./absensi-form"
import { VerifikasiWidget, type LokasiConfig, type VerifState } from "./verifikasi-widget"
import { labelMetode, wajibFoto, wajibGps, wajibSidikJari } from "@/lib/absensi-metode"

type KelasListType = { id: string; nama: string; siswas: { id: string; nis: string | null; nama: string }[] }[]

type Sesi = {
  jadwalId: string
  kelasNama: string
  mataPelajaranNama: string
  jamMulai: string
  jamSelesai: string
  status: string
  fase: "SEBELUM" | "AKTIF" | "SELESAI"
  jamMasuk: string | null
  jamKeluar: string | null
  durasiMenit: number | null
  terlambatMenit: number | null
  keterangan: string | null
  koreksiAlasan: string | null
  penggantiNama: string | null
  penggantiStatus: string | null
  metode: string
  fotoUrl: string | null
  gps: { lat: number; lng: number; akurasiMeter: number | null; jarakMeter: number | null; valid: boolean; mock: boolean } | null
  sidikJariVerified: boolean
  verifikasiCatatan: string | null
}

type Kebijakan = {
  toleransiTerlambatMenit: number
  autoTidakHadirSetelahMenit: number
  metode?: string
  lokasi?: LokasiConfig
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  BELUM_ABSEN: { label: "Belum Absen", className: "bg-slate-100 text-slate-600 border-slate-200" },
  HADIR: { label: "Hadir", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  TERLAMBAT: { label: "Terlambat", className: "bg-amber-100 text-amber-700 border-amber-200" },
  IZIN: { label: "Izin", className: "bg-sky-100 text-sky-700 border-sky-200" },
  SAKIT: { label: "Sakit", className: "bg-violet-100 text-violet-700 border-violet-200" },
  TIDAK_HADIR: { label: "Tidak Hadir", className: "bg-red-100 text-red-700 border-red-200" },
}

function StatusBadge({ status, terlambat }: { status: string; terlambat?: number | null }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.BELUM_ABSEN
  return (
    <Badge variant="outline" className={`${s.className} font-semibold`}>
      {s.label}
      {status === "TERLAMBAT" && terlambat ? ` +${terlambat} mnt` : ""}
    </Badge>
  )
}

export function SesiAbsensiClient({ kelasList }: { kelasList: KelasListType }) {
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [sesi, setSesi] = useState<Sesi[]>([])
  const [kebijakan, setKebijakan] = useState<Kebijakan | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [jamSekarang, setJamSekarang] = useState("")
  const [bulan, setBulan] = useState(new Date().toISOString().slice(0, 7))
  const [riwayat, setRiwayat] = useState<any[]>([])
  const [rekap, setRekap] = useState<any>(null)
  const [verifMap, setVerifMap] = useState<Record<string, VerifState>>({})

  const setVerif = (key: string, v: VerifState) => setVerifMap((prev) => ({ ...prev, [key]: v }))

  const load = useCallback(async (tgl: string) => {
    try {
      const [data, keb] = await Promise.all([getSesiAbsensiHariIni(tgl), getKebijakanAbsensiAction().catch(() => null)])
      setSesi((data as Sesi[]) || [])
      if (keb) setKebijakan(keb as any)
    } catch {
      setSesi([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load(tanggal)
    const id = setInterval(() => load(tanggal), 30000) // real-time polling 30 detik
    return () => clearInterval(id)
  }, [tanggal, load])

  useEffect(() => {
    const tick = () => setJamSekarang(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const start = `${bulan}-01`
    const [y, m] = bulan.split("-").map((v) => parseInt(v, 10))
    const end = `${y}-${String(m).padStart(2, "0")}-31`
    Promise.all([getRiwayatSesiAction(start, end).catch(() => []), getRekapBulananAction(bulan).catch(() => null)])
      .then(([r, k]) => {
        setRiwayat((r as any[]) || [])
        setRekap(k || null)
      })
  }, [bulan])

  const aksi = async (fn: () => Promise<Sesi>, key: string, pesan: string) => {
    setActing(key)
    try {
      await fn()
      toast.success(pesan)
      await load(tanggal)
    } catch (e: any) {
      toast.error(e?.message || "Gagal")
    } finally {
      setActing(null)
    }
  }

  const summary = useMemo(() => {
    const c = { hadir: 0, terlambat: 0, belum: 0, izin: 0, sakit: 0, tidakHadir: 0 }
    sesi.forEach((s) => {
      if (s.status === "HADIR") c.hadir++
      else if (s.status === "TERLAMBAT") c.terlambat++
      else if (s.status === "IZIN") c.izin++
      else if (s.status === "SAKIT") c.sakit++
      else if (s.status === "TIDAK_HADIR") c.tidakHadir++
      else c.belum++
    })
    return c
  }, [sesi])

  return (
    <div className="space-y-4">
      <Tabs defaultValue="sesi" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sesi">Absensi Sesi Mengajar</TabsTrigger>
          <TabsTrigger value="siswa">Absensi Siswa</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat &amp; Rekap</TabsTrigger>
        </TabsList>

        <TabsContent value="sesi" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Jadwal Mengajar Hari Ini
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                  <Button variant="outline" size="sm" onClick={() => load(tanggal)}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="tabular-nums font-semibold text-foreground">{jamSekarang || "--:--:--"}</span>
                  <span className="text-xs">(waktu server)</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Sesi: {sesi.length}</Badge>
                <Badge className="bg-emerald-100 text-emerald-700">Hadir {summary.hadir}</Badge>
                <Badge className="bg-amber-100 text-amber-700">Terlambat {summary.terlambat}</Badge>
                <Badge variant="outline">Belum {summary.belum}</Badge>
                <Badge className="bg-sky-100 text-sky-700">Izin {summary.izin}</Badge>
                <Badge className="bg-violet-100 text-violet-700">Sakit {summary.sakit}</Badge>
                <Badge className="bg-red-100 text-red-700">Tidak Hadir {summary.tidakHadir}</Badge>
              </div>

              {kebijakan && (
                <p className="text-xs text-muted-foreground">
                  Kebijakan Admin: toleransi terlambat{" "}
                  <span className="font-semibold text-foreground">{kebijakan.toleransiTerlambatMenit} menit</span> • status
                  Tidak Hadir otomatis{" "}
                  <span className="font-semibold text-foreground">
                    {kebijakan.autoTidakHadirSetelahMenit} menit
                  </span>{" "}
                  setelah sesi berakhir
                  {kebijakan.metode && (
                    <>
                      {" "}• metode absensi{" "}
                      <span className="font-semibold text-foreground">{labelMetode(kebijakan.metode)}</span>
                      {kebijakan.lokasi?.gpsWajib || wajibGps(kebijakan.metode)
                        ? ` • radius ${kebijakan.lokasi?.radiusMeter ?? 100}m`
                        : ""}
                    </>
                  )}
                </p>
              )}

              {loading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : sesi.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Tidak ada jadwal mengajar pada tanggal ini
                </div>
              ) : (
                <div className="space-y-3">
                  {sesi.map((s) => {
                    const key = s.jadwalId
                    const busy = acting === key
                    const sudahAbsen = !!s.jamMasuk
                    const sudahSelesai = !!s.jamKeluar
                    const metode = s.metode || kebijakan?.metode || "TANPA"
                    const lokasiCfg: LokasiConfig = kebijakan?.lokasi ?? {
                      lat: null, lng: null, radiusMeter: 100, akurasiMaksMeter: 50, gpsWajib: false, lokasiNama: null,
                    }
                    const butuh = {
                      foto: wajibFoto(metode),
                      gps: wajibGps(metode) || !!lokasiCfg.gpsWajib,
                      sidik: wajibSidikJari(metode),
                    }
                    const vMasuk = verifMap[`${key}:MASUK`] ?? {}
                    const vSelesai = verifMap[`${key}:SELESAI`] ?? {}
                    const verifMasukOk =
                      (!butuh.foto || !!vMasuk.fotoUrl) &&
                      (!butuh.gps || !!vMasuk.gpsHasil?.valid) &&
                      (!butuh.sidik || !!vMasuk.sidik?.verified)
                    const verifSelesaiOk =
                      (!butuh.gps || !!vSelesai.gpsHasil?.valid) &&
                      (!butuh.sidik || !!vSelesai.sidik?.verified)
                    const bisaAbsen =
                      s.status === "BELUM_ABSEN" &&
                      !sudahAbsen &&
                      s.fase !== "SEBELUM" &&
                      verifMasukOk
                    const butuhVerif =
                      (butuh.foto || butuh.gps || butuh.sidik) &&
                      s.status === "BELUM_ABSEN" &&
                      !sudahAbsen &&
                      s.fase !== "SEBELUM"
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-4 transition-colors ${
                          s.fase === "AKTIF" ? "border-primary/40 bg-primary/5" : "bg-card"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{s.kelasNama}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="font-medium">{s.mataPelajaranNama}</span>
                              <StatusBadge status={s.status} terlambat={s.terlambatMenit} />
                              {s.fase === "AKTIF" && (
                                <Badge className="bg-primary text-primary-foreground animate-pulse">
                                  Sedang Berlangsung
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CalendarClock className="h-3.5 w-3.5" /> {s.jamMulai} - {s.jamSelesai}
                              </span>
                              {s.jamMasuk && (
                                <span className="flex items-center gap-1 text-emerald-600">
                                  <LogIn className="h-3.5 w-3.5" /> Masuk {s.jamMasuk}
                                </span>
                              )}
                              {s.jamKeluar && (
                                <span className="flex items-center gap-1 text-emerald-600">
                                  <LogOut className="h-3.5 w-3.5" /> Selesai {s.jamKeluar}
                                  {s.durasiMenit != null && ` (${s.durasiMenit} mnt)`}
                                </span>
                              )}
                              {s.terlambatMenit ? (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Terlambat {s.terlambatMenit} menit
                                </span>
                              ) : null}
                              {s.penggantiNama && (
                                <span className="text-sky-600">
                                  Pengganti: {s.penggantiNama} ({s.penggantiStatus})
                                </span>
                              )}
                            </div>
                            {s.koreksiAlasan && (
                              <p className="text-xs text-amber-600">Koreksi Admin: {s.koreksiAlasan}</p>
                            )}
                            {sudahAbsen && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                <Badge variant="outline" className={`text-[11px] ${s.fotoUrl ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "text-muted-foreground"}`}>
                                  <Camera className="mr-1 h-3 w-3" /> Foto {s.fotoUrl ? "✓" : "—"}
                                </Badge>
                                <Badge variant="outline" className={`text-[11px] ${s.gps ? (s.gps.valid ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-600") : "text-muted-foreground"}`}>
                                  <MapPin className="mr-1 h-3 w-3" />
                                  GPS {s.gps ? `${s.gps.jarakMeter != null ? `${s.gps.jarakMeter}m` : "tersimpan"}${s.gps.valid ? " ✓" : " ✗"}` : "—"}
                                  {s.gps?.mock ? " (indikasi mock)" : ""}
                                </Badge>
                                <Badge variant="outline" className={`text-[11px] ${s.sidikJariVerified ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "text-muted-foreground"}`}>
                                  <Fingerprint className="mr-1 h-3 w-3" /> Sidik Jari {s.sidikJariVerified ? "✓" : "—"}
                                </Badge>
                                {s.verifikasiCatatan && (
                                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[11px]">
                                    {s.verifikasiCatatan}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {!sudahSelesai && (
                              <Button
                                size="sm"
                                disabled={busy || !bisaAbsen}
                                onClick={() => aksi(() => absenMasukAction(key, tanggal, vMasuk), key, "Absen masuk tersimpan")}
                              >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                                Absen Masuk
                              </Button>
                            )}
                            {!sudahSelesai && sudahAbsen && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy || ((butuh.gps || butuh.sidik) && !verifSelesaiOk)}
                                onClick={() => aksi(() => absenSelesaiAction(key, tanggal, vSelesai), key, "Sesi mengajar ditutup")}
                              >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                                Absen Selesai Mengajar
                              </Button>
                            )}
                            {sudahSelesai && (
                              <Badge className="bg-emerald-100 text-emerald-700">
                                <UserCheck className="mr-1 h-3 w-3" /> Sesi selesai
                              </Badge>
                            )}
                            {!sudahAbsen && s.fase !== "SEBELUM" && s.status === "BELUM_ABSEN" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => aksi(() => absenStatusAction(key, tanggal, "IZIN"), key, "Status izin tersimpan")}
                                >
                                  Izin
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => aksi(() => absenStatusAction(key, tanggal, "SAKIT"), key, "Status sakit tersimpan")}
                                >
                                  <Stethoscope className="mr-1 h-4 w-4" /> Sakit
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {!sudahAbsen && s.status === "BELUM_ABSEN" && s.fase !== "SEBELUM" && (
                          <VerifikasiWidget
                            metode={metode}
                            lokasi={lokasiCfg}
                            tanggal={tanggal}
                            jadwalPelajaranId={key}
                            tahap="MASUK"
                            value={vMasuk}
                            onChange={(v) => setVerif(`${key}:MASUK`, v)}
                            disabled={busy}
                          />
                        )}
                        {sudahAbsen && !sudahSelesai && (butuh.gps || butuh.sidik) && (
                          <VerifikasiWidget
                            metode={metode}
                            lokasi={lokasiCfg}
                            tanggal={tanggal}
                            jadwalPelajaranId={key}
                            tahap="SELESAI"
                            value={vSelesai}
                            onChange={(v) => setVerif(`${key}:SELESAI`, v)}
                            disabled={busy}
                          />
                        )}
                        {butuhVerif && !verifMasukOk && (
                          <p className="mt-2 text-[11px] text-amber-600">
                            Lengkapi verifikasi ({[
                              butuh.foto ? "foto" : null,
                              butuh.gps ? "GPS" : null,
                              butuh.sidik ? "sidik jari" : null,
                            ].filter(Boolean).join(", ")}) sebelum Absen Masuk — atau ajukan pengecualian untuk persetujuan Admin.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="siswa">
          <AbsensiClient kelasList={kelasList as any} />
        </TabsContent>

        <TabsContent value="riwayat" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-base">Riwayat &amp; Rekap Kehadiran Bulanan</CardTitle>
                <Label htmlFor="bulan" className="text-xs text-muted-foreground">
                  Bulan
                </Label>
                <Input id="bulan" type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} className="h-9 w-[160px]" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {rekap && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {[
                    { l: "Total Sesi", v: rekap.totalSesi, c: "text-foreground" },
                    { l: "Hadir", v: rekap.hadir, c: "text-emerald-600" },
                    { l: "Terlambat", v: rekap.terlambat, c: "text-amber-600" },
                    { l: "Izin", v: rekap.izin, c: "text-sky-600" },
                    { l: "Sakit", v: rekap.sakit, c: "text-violet-600" },
                    { l: "Tidak Hadir", v: rekap.tidakHadir, c: "text-red-600" },
                    { l: "Kehadiran", v: `${rekap.rataKehadiranPersen}%`, c: "text-primary" },
                  ].map((x) => (
                    <div key={x.l} className="rounded-lg border p-3 text-center">
                      <div className={`text-lg font-bold tabular-nums ${x.c}`}>{x.v}</div>
                      <div className="text-[11px] text-muted-foreground">{x.l}</div>
                    </div>
                  ))}
                </div>
              )}

              {riwayat.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Belum ada riwayat absensi pada bulan ini
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="p-3">Tanggal</th>
                        <th className="p-3">Jam</th>
                        <th className="p-3">Kelas</th>
                        <th className="p-3">Mata Pelajaran</th>
                        <th className="p-3">Masuk</th>
                        <th className="p-3">Selesai</th>
                        <th className="p-3">Durasi</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riwayat.map((r: any) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-3 whitespace-nowrap">
                            {new Date(r.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="p-3 whitespace-nowrap tabular-nums">
                            {r.jadwal?.jamMulai} - {r.jadwal?.jamSelesai}
                          </td>
                          <td className="p-3">{r.jadwal?.kelas?.nama}</td>
                          <td className="p-3">{r.jadwal?.mataPelajaran?.nama}</td>
                          <td className="p-3 tabular-nums">{r.jamMasuk || "-"}</td>
                          <td className="p-3 tabular-nums">{r.jamSelesai || "-"}</td>
                          <td className="p-3 tabular-nums">{r.durasiMenit != null ? `${r.durasiMenit} mnt` : "-"}</td>
                          <td className="p-3">
                            <StatusBadge status={r.status} terlambat={r.terlambatMenit} />
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
      </Tabs>
    </div>
  )
}
