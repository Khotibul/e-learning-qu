"use client"

import { ymd, ym } from "@/lib/utils"

import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle, Clock, Fingerprint, Loader2, LogIn, LogOut, RefreshCw,
  ShieldCheck, TriangleAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  getKehadiranHariIni, getRiwayatKehadiranSaya, getAbsensiPelajaranSaya,
  ajukanAbsensiManualSaya, getPermintaanManualSaya,
} from "../../actions"

const bulanIni = () => ym()

export default function KehadiranSiswa() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: "ok" | "err"; teks: string } | null>(null)
  const [hariIni, setHariIni] = useState<any>(null)
  const [riwayat, setRiwayat] = useState<any>(null)
  const [pelajaran, setPelajaran] = useState<any[]>([])
  const [permintaan, setPermintaan] = useState<any[]>([])
  const [bulan, setBulan] = useState(bulanIni())
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ tanggal: ymd(), tipe: "MASUK", alasan: "" })

  const muat = useCallback(async () => {
    try {
      const [h, r, p, pm] = await Promise.all([
        getKehadiranHariIni(),
        getRiwayatKehadiranSaya(bulan),
        getAbsensiPelajaranSaya(bulan),
        getPermintaanManualSaya(),
      ])
      setHariIni(h)
      setRiwayat(r)
      setPelajaran(p)
      setPermintaan(pm)
    } catch (e: any) {
      setPesan({ tipe: "err", teks: e?.message || "Gagal memuat kehadiran" })
    } finally {
      setLoading(false)
    }
  }, [bulan])

  useEffect(() => { muat() }, [muat])

  const toast = (tipe: "ok" | "err", teks: string) => {
    setPesan({ tipe, teks })
    setTimeout(() => setPesan(null), 5000)
  }

  const ajukan = async () => {
    setBusy(true)
    try {
      await ajukanAbsensiManualSaya(form)
      setDialog(false)
      setForm({ ...form, alasan: "" })
      toast("ok", "Permintaan diajukan — menunggu persetujuan Admin")
      await muat()
    } catch (e: any) {
      toast("err", e?.message || "Gagal mengajukan")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const hi = hariIni?.hariIni
  const kebijakan = hariIni?.kebijakan ?? {}
  const rekap = riwayat?.rekap ?? {}

  const warnaStatus = (s: string | null, tipe: "masuk" | "pulang") => {
    if (!s) return "bg-slate-100 text-slate-600"
    if (s === "TERLAMBAT") return "bg-amber-100 text-amber-800"
    if (s === "AWAL") return "bg-rose-100 text-rose-800"
    if (s === "NORMAL" || s === "HADIR") return "bg-emerald-100 text-emerald-800"
    return "bg-slate-100 text-slate-600"
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Fingerprint className="h-5 w-5 text-primary" /> Monitoring Kehadiran
          </h1>
          <p className="text-sm text-muted-foreground">
            Absensi masuk/pulang sekolah (fingerprint) — terpisah dari absensi per mata pelajaran
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={muat}><RefreshCw className="mr-1.5 h-4 w-4" /> Muat Ulang</Button>
          <Button size="sm" onClick={() => setDialog(true)}><Clock className="mr-1.5 h-4 w-4" /> Ajukan Verifikasi Manual</Button>
        </div>
      </div>

      {pesan && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${pesan.tipe === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {pesan.tipe === "ok" ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {pesan.teks}
        </div>
      )}

      {/* Status hari ini */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={hi?.jamMasuk ? "border-emerald-200 bg-emerald-50/40" : ""}>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><LogIn className="h-3.5 w-3.5" /> Absen Masuk</p>
            <p className="mt-1 text-2xl font-bold">{hi?.jamMasuk ?? "--:--"}</p>
            <Badge className={`mt-1 ${warnaStatus(hi?.statusMasuk, "masuk")}`}>
              {!hi?.jamMasuk ? "BELUM SCAN" : hi.statusMasuk === "TERLAMBAT" ? `TERLAMBAT ${hi.terlambatMenit} MENIT` : "HADIR"}
            </Badge>
            {hi?.sumberMasuk && <p className="mt-1 text-[10px] text-muted-foreground">Sumber: {hi.sumberMasuk}</p>}
          </CardContent>
        </Card>
        <Card className={hi?.jamPulang ? "border-sky-200 bg-sky-50/40" : ""}>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><LogOut className="h-3.5 w-3.5" /> Absen Pulang</p>
            <p className="mt-1 text-2xl font-bold">{hi?.jamPulang ?? "--:--"}</p>
            <Badge className={`mt-1 ${warnaStatus(hi?.statusPulang, "pulang")}`}>
              {!hi?.jamPulang ? "BELUM SCAN" : hi.statusPulang === "AWAL" ? "PULANG AWAL" : "PULANG NORMAL"}
            </Badge>
            {hi?.sumberPulang && <p className="mt-1 text-[10px] text-muted-foreground">Sumber: {hi.sumberPulang}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Kehadiran Bulan Ini</p>
            <p className="mt-1 text-2xl font-bold">{rekap.persenKehadiran ?? 0}%</p>
            <p className="text-xs text-muted-foreground">{rekap.hadir ?? 0} hadir • {rekap.terlambat ?? 0} terlambat dari {riwayat?.hariSekolah ?? 0} hari</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Kebijakan Sekolah</p>
            <p className="mt-1 text-sm font-semibold">Masuk ≤ {kebijakan.jamMasuk ?? "07:00"} (+{kebijakan.toleransiMasukMenit ?? 15} mnt)</p>
            <p className="text-sm font-semibold">Pulang ≥ {kebijakan.jamPulang ?? "15:00"} (−{kebijakan.toleransiPulangMenit ?? 0} mnt)</p>
          </CardContent>
        </Card>
      </div>

      {permintaan.filter((p) => p.status === "MENUNGGU").length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <TriangleAlert className="h-4 w-4" />
          Ada permintaan verifikasi manual yang masih menunggu persetujuan Admin.
        </div>
      )}

      <Tabs defaultValue="riwayat">
        <TabsList>
          <TabsTrigger value="riwayat">Riwayat Fingerprint</TabsTrigger>
          <TabsTrigger value="pelajaran">Absensi Per Pelajaran</TabsTrigger>
          <TabsTrigger value="permintaan">Permintaan Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="riwayat" className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Bulan</Label>
            <Input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} className="w-44" />
          </div>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Masuk</TableHead>
                    <TableHead>Status Masuk</TableHead>
                    <TableHead>Pulang</TableHead>
                    <TableHead>Status Pulang</TableHead>
                    <TableHead>Sumber</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(riwayat?.rows ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Belum ada absensi fingerprint</TableCell></TableRow>
                  ) : (
                    (riwayat?.rows ?? []).map((r: any) => (
                      <TableRow key={r.tanggal}>
                        <TableCell>{r.tanggal}</TableCell>
                        <TableCell className="font-mono">{r.jamMasuk ?? "-"}</TableCell>
                        <TableCell><Badge className={warnaStatus(r.statusMasuk, "masuk")}>{!r.jamMasuk ? "BELUM" : r.statusMasuk === "TERLAMBAT" ? `TERLAMBAT ${r.terlambatMenit}M` : "HADIR"}</Badge></TableCell>
                        <TableCell className="font-mono">{r.jamPulang ?? "-"}</TableCell>
                        <TableCell><Badge className={warnaStatus(r.statusPulang, "pulang")}>{!r.jamPulang ? "BELUM" : r.statusPulang === "AWAL" ? "AWAL" : "NORMAL"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.sumber ?? "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pelajaran" className="space-y-3">
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Mata Pelajaran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pelajaran.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Belum ada absensi per pelajaran</TableCell></TableRow>
                  ) : (
                    pelajaran.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{p.tanggal}</TableCell>
                        <TableCell>{p.mataPelajaran}</TableCell>
                        <TableCell>
                          <Badge className={
                            p.status === "HADIR" ? "bg-emerald-100 text-emerald-800"
                            : p.status === "TERLAMBAT" ? "bg-amber-100 text-amber-800"
                            : p.status === "IZIN" ? "bg-sky-100 text-sky-800"
                            : p.status === "SAKIT" ? "bg-violet-100 text-violet-800"
                            : "bg-rose-100 text-rose-800"}>{p.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.keterangan ?? "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Catatan: absensi masuk sekolah tidak otomatis membuat Anda hadir pada setiap mata pelajaran — guru tetap mengabsensi per sesi.
          </p>
        </TabsContent>

        <TabsContent value="permintaan" className="space-y-3">
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Catatan Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permintaan.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Belum ada permintaan</TableCell></TableRow>
                  ) : (
                    permintaan.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.tanggal}</TableCell>
                        <TableCell><Badge variant="outline">{p.tipe}</Badge></TableCell>
                        <TableCell className="max-w-72 truncate text-xs">{p.alasan}</TableCell>
                        <TableCell><Badge className={
                          p.status === "DISETUJUI" ? "bg-emerald-100 text-emerald-800"
                          : p.status === "DITOLAK" ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"}>{p.status}</Badge></TableCell>
                        <TableCell className="max-w-56 truncate text-xs">{p.catatanAdmin ?? "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Ajukan Verifikasi Manual</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Gunakan bila fingerprint gagal/tidak dikenal. Perlu persetujuan Admin sebelum dicatat.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Tanggal</Label>
                <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} /></div>
              <div className="space-y-1"><Label>Tipe</Label>
                <Select value={form.tipe} onValueChange={(v) => setForm({ ...form, tipe: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MASUK">Absen Masuk</SelectItem>
                    <SelectItem value="PULANG">Absen Pulang</SelectItem>
                  </SelectContent>
                </Select></div>
            </div>
            <div className="space-y-1"><Label>Alasan (min. 5 karakter)</Label>
              <Textarea rows={3} value={form.alasan} onChange={(e) => setForm({ ...form, alasan: e.target.value })}
                placeholder="misal: sensor fingerprint mesin utama tidak membaca sidik jari saya" /></div>
            <Button className="w-full" disabled={busy || form.alasan.trim().length < 5} onClick={ajukan}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Ajukan Permintaan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
