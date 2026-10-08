"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle, CalendarOff, Copy, Fingerprint, KeyRound, Loader2, MapPin, Plus,
  QrCode, RefreshCw, Search, ShieldCheck, Trash2, UserCheck, UserX,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  daftarPerangkat, buatPerangkat, ubahPerangkat, hapusPerangkat, rotasiApiKey,
  daftarPemetaan, cariSiswaUntukPemetaan, tambahPemetaan, hapusPemetaan,
  monitoringHarian, daftarEvent, daftarNotifikasiAdmin, getKebijakanHarianAdmin, simpanKebijakanHarian,
  daftarLibur, tambahLibur, hapusLibur, daftarPermintaanManual, putuskanPermintaan,
  koreksiHarian, daftarKoreksiHarian,
} from "../actions"

type Baris = {
  id: string | null
  siswaId: string
  nama: string
  nis: string | null
  kelas: string
  jamMasuk: string | null
  jamPulang: string | null
  statusMasuk: string | null
  statusPulang: string | null
  terlambatMenit: number | null
  sumberMasuk: string | null
  sumberPulang: string | null
  perangkatMasuk: string | null
  perangkatPulang: string | null
  koreksiAlasan: string | null
}

const hariIni = () => new Date().toISOString().slice(0, 10)

export default function AdminFingerprint() {
  const [tab, setTab] = useState("monitoring")
  const [busy, setBusy] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: "ok" | "err"; teks: string } | null>(null)

  const toast = useCallback((tipe: "ok" | "err", teks: string) => {
    setPesan({ tipe, teks })
    setTimeout(() => setPesan(null), 5000)
  }, [])

  // state monitoring
  const [tanggal, setTanggal] = useState(hariIni())
  const [filter, setFilter] = useState("SEMUA")
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<Baris[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [events, setEvents] = useState<any[]>([])
  const [notifikasi, setNotifikasi] = useState<{ rows: any[]; summary: any }>({ rows: [], summary: null })
  const [koreksi, setKoreksi] = useState<Baris | null>(null)

  // perangkat
  const [perangkat, setPerangkat] = useState<any[]>([])
  const [dialogBaru, setDialogBaru] = useState(false)
  const [formBaru, setFormBaru] = useState({ nama: "", lokasi: "" })
  const [apiKeyBaru, setApiKeyBaru] = useState<{ kode: string; apiKey: string } | null>(null)

  // pemetaan
  const [perangkatAktif, setPerangkatAktif] = useState<string>("")
  const [pemetaan, setPemetaan] = useState<any[]>([])
  const [cariQ, setCariQ] = useState("")
  const [hasilCari, setHasilCari] = useState<any[]>([])
  const [pilihSiswa, setPilihSiswa] = useState<any | null>(null)
  const [uidBaru, setUidBaru] = useState("")

  // permintaan & kebijakan
  const [permintaan, setPermintaan] = useState<any[]>([])
  const [kebijakan, setKebijakan] = useState<any>({})
  const [libur, setLibur] = useState<any[]>([])
  const [formLibur, setFormLibur] = useState({ tanggal: hariIni(), keterangan: "" })
  const [logKoreksi, setLogKoreksi] = useState<any[]>([])

  const muatMonitoring = useCallback(async () => {
    setBusy(true)
    try {
      const [m, ev, notif] = await Promise.all([
        monitoringHarian({ tanggal, status: filter === "SEMUA" ? undefined : filter, q }),
        daftarEvent({ tanggal, take: 150 }),
        daftarNotifikasiAdmin({ take: 100 }),
      ])
      setRows(m.rows)
      setSummary(m.summary)
      setEvents(ev)
      setNotifikasi(notif)
    } catch (e: any) {
      toast("err", e?.message || "Gagal memuat monitoring")
    } finally {
      setBusy(false)
    }
  }, [tanggal, filter, q, toast])

  const muatPerangkat = useCallback(async () => {
    try {
      const rows = await daftarPerangkat()
      setPerangkat(rows)
      setPerangkatAktif((p) => p || rows[0]?.id || "")
    } catch (e: any) {
      toast("err", e?.message || "Gagal memuat perangkat")
    }
  }, [toast])

  const muatPemetaan = useCallback(async () => {
    if (!perangkatAktif) return
    try {
      setPemetaan(await daftarPemetaan(perangkatAktif))
    } catch (e: any) {
      toast("err", e?.message || "Gagal memuat pemetaan")
    }
  }, [perangkatAktif, toast])

  const muatLain = useCallback(async () => {
    try {
      const [perm, keb, lb, lk] = await Promise.all([
        daftarPermintaanManual(),
        getKebijakanHarianAdmin(),
        daftarLibur(),
        daftarKoreksiHarian(),
      ])
      setPermintaan(perm)
      setKebijakan(keb)
      setLibur(lb)
      setLogKoreksi(lk)
    } catch (e: any) {
      toast("err", e?.message || "Gagal memuat data")
    }
  }, [toast])

  useEffect(() => { muatMonitoring() }, [muatMonitoring])
  useEffect(() => { muatPerangkat() }, [muatPerangkat])
  useEffect(() => { muatPemetaan() }, [muatPemetaan])
  useEffect(() => { muatLain() }, [muatLain])

  const jalankan = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      if (ok) toast("ok", ok)
    } catch (e: any) {
      toast("err", e?.message || "Terjadi kesalahan")
    } finally {
      setBusy(false)
    }
  }

  const cariSiswa = async () => {
    if (cariQ.trim().length < 2) return
    try {
      setHasilCari(await cariSiswaUntukPemetaan(cariQ))
    } catch (e: any) {
      toast("err", e?.message || "Pencarian gagal")
    }
  }

  const statBadge = (b: Baris) => {
    if (!b.jamMasuk) return <Badge variant="outline" className="text-slate-500">Belum Masuk</Badge>
    if (b.statusMasuk === "TERLAMBAT") return <Badge className="bg-amber-100 text-amber-800">Terlambat {b.terlambatMenit}m</Badge>
    return <Badge className="bg-emerald-100 text-emerald-800">Hadir</Badge>
  }

  const pulangBadge = (b: Baris) => {
    if (!b.jamPulang) return <Badge variant="outline" className="text-slate-400">Belum Pulang</Badge>
    if (b.statusPulang === "AWAL") return <Badge className="bg-rose-100 text-rose-800">Pulang Awal</Badge>
    return <Badge className="bg-sky-100 text-sky-800">Normal</Badge>
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Fingerprint className="h-5 w-5 text-primary" /> Fingerprint & Absensi Harian Siswa
          </h1>
          <p className="text-sm text-muted-foreground">
            Masuk/pulang sekolah per sidik jari — terpisah dari absensi per mata pelajaran
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => jalankan(async () => { await muatMonitoring(); await muatPerangkat(); await muatLain() })}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Muat Ulang
        </Button>
      </div>

      {pesan && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${pesan.tipe === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {pesan.tipe === "ok" ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {pesan.teks}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="monitoring">Monitoring Harian</TabsTrigger>
          <TabsTrigger value="perangkat">Perangkat ({perangkat.length})</TabsTrigger>
          <TabsTrigger value="pemetaan">Pemetaan Siswa</TabsTrigger>
          <TabsTrigger value="permintaan">Permintaan Manual ({permintaan.filter((p) => p.status === "MENUNGGU").length})</TabsTrigger>
          <TabsTrigger value="kebijakan">Kebijakan & Jam</TabsTrigger>
        </TabsList>

        {/* ── MONITORING ── */}
        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Siswa</p><p className="text-xl font-bold">{summary.totalSiswa ?? 0}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Sudah Masuk</p><p className="text-xl font-bold text-emerald-600">{summary.masuk ?? 0}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Belum Masuk</p><p className="text-xl font-bold text-slate-500">{summary.belumMasuk ?? 0}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Terlambat</p><p className="text-xl font-bold text-amber-600">{summary.terlambat ?? 0}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Sudah Pulang</p><p className="text-xl font-bold text-sky-600">{summary.pulang ?? 0}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Pulang Awal</p><p className="text-xl font-bold text-rose-600">{summary.pulangAwal ?? 0}</p></CardContent></Card>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="w-40" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SEMUA">Semua Status</SelectItem>
                <SelectItem value="BELUM">Belum Masuk</SelectItem>
                <SelectItem value="MASUK">Sudah Masuk</SelectItem>
                <SelectItem value="PULANG">Sudah Pulang</SelectItem>
                <SelectItem value="TERLAMBAT">Terlambat</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama/NIS…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-8" />
            </div>
            <Button size="sm" variant="outline" onClick={muatMonitoring}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />} Tampilkan</Button>
            <a href={`/api/admin/absensi-harian/export?tanggal=${tanggal}&format=xlsx`} target="_blank">
              <Button size="sm" variant="outline">Export Excel</Button>
            </a>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Daftar Kehadiran — {tanggal}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Masuk</TableHead>
                    <TableHead>Status Masuk</TableHead>
                    <TableHead>Pulang</TableHead>
                    <TableHead>Status Pulang</TableHead>
                    <TableHead>Perangkat</TableHead>
                    <TableHead>Sumber</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {busy && rows.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground"><Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin" />Memuat…</TableCell></TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Tidak ada data</TableCell></TableRow>
                  ) : (
                    rows.map((b, i) => (
                      <TableRow key={(b.id ?? "x") + i}>
                        <TableCell className="font-medium">{b.nama}</TableCell>
                        <TableCell>{b.nis ?? "-"}</TableCell>
                        <TableCell>{b.kelas}</TableCell>
                        <TableCell className="font-mono">{b.jamMasuk ?? "-"}</TableCell>
                        <TableCell>{statBadge(b)}</TableCell>
                        <TableCell className="font-mono">{b.jamPulang ?? "-"}</TableCell>
                        <TableCell>{pulangBadge(b)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{b.perangkatMasuk ?? b.perangkatPulang ?? "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{[b.sumberMasuk, b.sumberPulang].filter(Boolean).join("/") || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" disabled={!b.id} onClick={() => setKoreksi(b)}>Koreksi</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Log Scan Fingerprint (hari ini)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu Server</TableHead>
                    <TableHead>Perangkat</TableHead>
                    <TableHead>Siswa</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pesan</TableHead>
                    <TableHead>Event Key</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Belum ada scan</TableCell></TableRow>
                  ) : (
                    events.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{new Date(e.serverAt).toLocaleString("id-ID")}</TableCell>
                        <TableCell className="text-xs">{e.perangkat}<br /><span className="text-muted-foreground">{e.kode}</span></TableCell>
                        <TableCell className="text-xs">{e.nama}{e.nis ? ` (${e.nis})` : ""}</TableCell>
                        <TableCell><Badge variant="outline">{e.tipe}</Badge></TableCell>
                        <TableCell>
                          <Badge className={
                            e.status === "SUKSES" ? "bg-emerald-100 text-emerald-800"
                            : e.status === "DUPLIKAT" ? "bg-slate-100 text-slate-700"
                            : e.status === "DITOLAK" || e.status === "GAGAL" ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"}>{e.status}</Badge>
                        </TableCell>
                        <TableCell className="max-w-64 truncate text-xs">{e.pesan ?? "-"}</TableCell>
                        <TableCell className="max-w-40 truncate font-mono text-[10px] text-muted-foreground">{e.eventKey}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Log Notifikasi Otomatis
                {notifikasi.summary && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    (total {notifikasi.summary.total} · belum dibaca {notifikasi.summary.unread} · gagal {notifikasi.summary.gagal})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Penerima</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead>Judul</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dibaca</TableHead>
                    <TableHead>Event Key</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifikasi.rows.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Belum ada notifikasi</TableCell></TableRow>
                  ) : (
                    notifikasi.rows.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-mono text-xs">{new Date(n.createdAt).toLocaleString("id-ID")}</TableCell>
                        <TableCell className="text-xs">{n.penerima}</TableCell>
                        <TableCell className="text-xs">{n.rolePenerima}</TableCell>
                        <TableCell className="max-w-56 truncate text-xs">
                          <span className="font-medium">{n.judul}</span><br />
                          <span className="text-muted-foreground">{n.pesan}</span>
                        </TableCell>
                        <TableCell><Badge variant="outline">{n.tipe}</Badge></TableCell>
                        <TableCell>
                          <Badge className={n.status === "GAGAL" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}>{n.status}</Badge>
                        </TableCell>
                        <TableCell>{n.isRead ? <Badge className="bg-sky-100 text-sky-800">Dibaca</Badge> : <Badge variant="outline" className="text-muted-foreground">Belum</Badge>}</TableCell>
                        <TableCell className="max-w-40 truncate font-mono text-[10px] text-muted-foreground">{n.eventKey ?? "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {logKoreksi.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Riwayat Koreksi (Audit Log)</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 p-3">
                {logKoreksi.map((l) => (
                  <p key={l.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{l.oleh}</span> — {l.action} • {new Date(l.createdAt).toLocaleString("id-ID")}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── PERANGKAT ── */}
        <TabsContent value="perangkat" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setDialogBaru(true)}><Plus className="mr-1.5 h-4 w-4" /> Daftarkan Perangkat</Button>
          </div>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Siswa</TableHead>
                    <TableHead>Scan Hari Ini</TableHead>
                    <TableHead>Total Event</TableHead>
                    <TableHead>Terakhir Terlihat</TableHead>
                    <TableHead>Sync Terakhir</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perangkat.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Belum ada perangkat terdaftar</TableCell></TableRow>
                  ) : perangkat.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.kode}</TableCell>
                      <TableCell className="font-medium">{p.nama}</TableCell>
                      <TableCell className="text-xs">{p.lokasi ?? "-"}</TableCell>
                      <TableCell>
                        <Badge className={p.status === "AKTIF" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}>{p.status}</Badge>
                      </TableCell>
                      <TableCell>{p.jumlahSiswa}</TableCell>
                      <TableCell>{p.scanHariIni}</TableCell>
                      <TableCell>{p.totalEvent}</TableCell>
                      <TableCell className="text-xs">{p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleString("id-ID") : "-"}</TableCell>
                      <TableCell className="text-xs">{p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleString("id-ID") : "-"}</TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button size="sm" variant="ghost" title="Aktif/nonaktifkan"
                          onClick={() => jalankan(async () => { await ubahPerangkat(p.id, { status: p.status === "AKTIF" ? "NONAKTIF" : "AKTIF" }); await muatPerangkat() }, "Status diperbarui")}>
                          {p.status === "AKTIF" ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        <Button size="sm" variant="ghost" title="Rotasi API key"
                          onClick={() => jalankan(async () => {
                            const r = await rotasiApiKey(p.id)
                            setApiKeyBaru({ kode: p.kode, apiKey: r.apiKey })
                          }, "API key baru dibuat")}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Hapus"
                          onClick={() => jalankan(async () => { await hapusPerangkat(p.id); await muatPerangkat() }, "Perangkat dihapus")}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            API key hanya ditampilkan satu kali saat pendaftaran/rotasi. Perangkat mengirim POST ke{" "}
            <code className="rounded bg-muted px-1">/api/fingerprint/scan</code> dengan header{" "}
            <code className="rounded bg-muted px-1">X-Api-Key</code> + <code className="rounded bg-muted px-1">X-Device-Code</code>.
            Retry offline aman (idempoten). Template sidik jari mentah TIDAK disimpan — hanya UID di mesin.
          </p>
        </TabsContent>

        {/* ── PEMETAAN ── */}
        <TabsContent value="pemetaan" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={perangkatAktif} onValueChange={setPerangkatAktif}>
              <SelectTrigger className="w-72"><SelectValue placeholder="Pilih perangkat" /></SelectTrigger>
              <SelectContent>
                {perangkat.map((p) => <SelectItem key={p.id} value={p.id}>{p.nama} ({p.kode})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Tambah Pemetaan UID → Siswa</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Cari siswa (nama/NIS)…" value={cariQ} onChange={(e) => setCariQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && cariSiswa()} className="w-72 pl-8" />
                </div>
                <Button size="sm" variant="outline" onClick={cariSiswa}>Cari</Button>
              </div>
              {hasilCari.length > 0 && (
                <div className="divide-y rounded-lg border">
                  {hasilCari.map((s) => (
                    <button key={s.id} onClick={() => setPilihSiswa(s)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50 ${pilihSiswa?.id === s.id ? "bg-primary/5" : ""}`}>
                      <span>{s.nama} <span className="text-muted-foreground">({s.nis ?? "-"} • {s.kelas})</span></span>
                      {pilihSiswa?.id === s.id && <UserCheck className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label>UID sidik jari di mesin</Label>
                  <Input placeholder="misal: 1024" value={uidBaru} onChange={(e) => setUidBaru(e.target.value)} className="w-44" />
                </div>
                <Button size="sm" disabled={!pilihSiswa || !uidBaru.trim() || busy}
                  onClick={() => jalankan(async () => {
                    await tambahPemetaan({ perangkatId: perangkatAktif, siswaId: pilihSiswa.id, perangkatUserId: uidBaru.trim() })
                    setPilihSiswa(null); setUidBaru(""); setCariQ(""); setHasilCari([])
                    await muatPemetaan(); await muatPerangkat()
                  }, "Pemetaan ditambahkan")}>
                  <Plus className="mr-1.5 h-4 w-4" /> Petakan
                </Button>
                {pilihSiswa && <span className="text-sm text-muted-foreground">Terpilih: <b>{pilihSiswa.nama}</b></span>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pemetaan Aktif</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UID Mesin</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Sejak</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pemetaan.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Belum ada pemetaan</TableCell></TableRow>
                  ) : pemetaan.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.perangkatUserId}</TableCell>
                      <TableCell className="font-medium">{p.nama}</TableCell>
                      <TableCell>{p.nis ?? "-"}</TableCell>
                      <TableCell>{p.kelas}</TableCell>
                      <TableCell className="text-xs">{new Date(p.createdAt).toLocaleDateString("id-ID")}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => jalankan(async () => { await hapusPemetaan(p.id); await muatPemetaan(); await muatPerangkat() }, "Pemetaan dihapus")}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PERMINTAAN MANUAL ── */}
        <TabsContent value="permintaan" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Permintaan Verifikasi Manual (fingerprint gagal)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Siswa</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Catatan Admin</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permintaan.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Tidak ada permintaan</TableCell></TableRow>
                  ) : permintaan.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.tanggal}</TableCell>
                      <TableCell className="font-medium">{p.nama}</TableCell>
                      <TableCell>{p.kelas}</TableCell>
                      <TableCell><Badge variant="outline">{p.tipe}</Badge></TableCell>
                      <TableCell className="max-w-64 truncate text-xs">{p.alasan}</TableCell>
                      <TableCell>
                        <Badge className={
                          p.status === "DISETUJUI" ? "bg-emerald-100 text-emerald-800"
                          : p.status === "DITOLAK" ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-xs">{p.catatanAdmin ?? "-"}</TableCell>
                      <TableCell className="space-x-1 text-right">
                        {p.status === "MENUNGGU" && <>
                          <Button size="sm" variant="ghost" onClick={() => jalankan(async () => { await putuskanPermintaan(p.id, "DISETUJUI", "Disetujui Admin"); await muatLain(); await muatMonitoring() }, "Disetujui")}>
                            <UserCheck className="mr-1 h-3.5 w-3.5" /> Setujui
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => jalankan(async () => { await putuskanPermintaan(p.id, "DITOLAK", "Tidak memenuhi syarat"); await muatLain() }, "Ditolak")}>
                            <UserX className="mr-1 h-3.5 w-3.5" /> Tolak
                          </Button>
                        </>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── KEBIJAKAN ── */}
        <TabsContent value="kebijakan" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Jam & Toleransi Absensi Harian</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Jam masuk (batas)</Label>
                  <Input value={kebijakan.jamMasuk ?? ""} onChange={(e) => setKebijakan({ ...kebijakan, jamMasuk: e.target.value })} placeholder="07:00" /></div>
                <div className="space-y-1"><Label>Toleransi masuk (menit)</Label>
                  <Input type="number" value={kebijakan.toleransiMasukMenit ?? 15} onChange={(e) => setKebijakan({ ...kebijakan, toleransiMasukMenit: e.target.value })} /></div>
                <div className="space-y-1"><Label>Jam pulang resmi</Label>
                  <Input value={kebijakan.jamPulang ?? ""} onChange={(e) => setKebijakan({ ...kebijakan, jamPulang: e.target.value })} placeholder="15:00" /></div>
                <div className="space-y-1"><Label>Toleransi pulang awal (menit)</Label>
                  <Input type="number" value={kebijakan.toleransiPulangMenit ?? 0} onChange={(e) => setKebijakan({ ...kebijakan, toleransiPulangMenit: e.target.value })} /></div>
              </div>
              <Button size="sm" disabled={busy}
                onClick={() => jalankan(async () => {
                  await simpanKebijakanHarian({
                    siswaJamMasuk: kebijakan.jamMasuk,
                    siswaJamPulang: kebijakan.jamPulang,
                    siswaToleransiMenit: Number(kebijakan.toleransiMasukMenit),
                    siswaPulangToleransiMenit: Number(kebijakan.toleransiPulangMenit),
                  })
                  await muatLain()
                }, "Kebijakan disimpan")}>
                Simpan Kebijakan
              </Button>
              <p className="text-xs text-muted-foreground">
                Scan masuk setelah jam masuk + toleransi → TERLAMBAT. Scan pulang sebelum jam pulang − toleransi → PULANG AWAL.
                Waktu server adalah acuan (bukan jam perangkat).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><CalendarOff className="h-4 w-4" /> Hari Libur / Kalender Akademik</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input type="date" value={formLibur.tanggal} onChange={(e) => setFormLibur({ ...formLibur, tanggal: e.target.value })} className="w-40" />
                <Input placeholder="Keterangan (opsional)" value={formLibur.keterangan} onChange={(e) => setFormLibur({ ...formLibur, keterangan: e.target.value })} className="w-56" />
                <Button size="sm" variant="outline" onClick={() => jalankan(async () => { await tambahLibur(formLibur.tanggal, formLibur.keterangan); await muatLain() }, "Hari libur ditambahkan")}>
                  <Plus className="mr-1.5 h-4 w-4" /> Tambah
                </Button>
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {libur.length === 0 && <p className="text-sm text-muted-foreground">Belum ada hari libur terjadwal.</p>}
                {libur.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                    <span>{l.tanggal} <span className="text-muted-foreground">— {l.keterangan ?? "Libur"}</span></span>
                    <Button size="sm" variant="ghost" onClick={() => jalankan(async () => { await hapusLibur(l.id); await muatLain() }, "Dihapus")}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Scan pada tanggal libur ditolak otomatis oleh sistem.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: daftar perangkat baru / API key sekali tampil */}
      <Dialog open={dialogBaru} onOpenChange={setDialogBaru}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrCode className="h-4 w-4" /> Daftarkan Perangkat</DialogTitle>
            <p className="text-sm text-muted-foreground">Perangkat memerlukan kode + API key untuk autentikasi ke /api/fingerprint/scan.</p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nama perangkat</Label>
              <Input value={formBaru.nama} onChange={(e) => setFormBaru({ ...formBaru, nama: e.target.value })} placeholder="Fingerprint Gerbang Utama" /></div>
            <div className="space-y-1"><Label>Lokasi (opsional)</Label>
              <Input value={formBaru.lokasi} onChange={(e) => setFormBaru({ ...formBaru, lokasi: e.target.value })} placeholder="Gerbang Utama" /></div>
            <Button className="w-full" disabled={busy}
              onClick={() => jalankan(async () => {
                const r = await buatPerangkat(formBaru)
                setApiKeyBaru({ kode: r.kode, apiKey: r.apiKey })
                setFormBaru({ nama: "", lokasi: "" })
                setDialogBaru(false)
                await muatPerangkat()
              }, "Perangkat terdaftar")}>
              Daftarkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!apiKeyBaru} onOpenChange={(o) => !o && setApiKeyBaru(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simpan Kredensial Perangkat</DialogTitle>
            <p className="text-sm text-muted-foreground">API key hanya ditampilkan SEKALI. Simpan aman di perangkat.</p>
          </DialogHeader>
          {apiKeyBaru && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="text-xs text-muted-foreground">Kode Perangkat (X-Device-Code)</p>
                <p className="flex items-center justify-between font-mono font-bold">{apiKeyBaru.kode}
                  <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(apiKeyBaru.kode)}><Copy className="h-3.5 w-3.5" /></Button></p>
                <p className="mt-2 text-xs text-muted-foreground">API Key (X-Api-Key)</p>
                <p className="flex items-center justify-between break-all font-mono text-xs">{apiKeyBaru.apiKey}
                  <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(apiKeyBaru.apiKey)}><Copy className="h-3.5 w-3.5" /></Button></p>
              </div>
              <p className="text-xs text-muted-foreground">Contoh pengiriman: POST /api/fingerprint/scan {"{"} scanId, tipe: "MASUK", perangkatUserId {"}"}</p>
              <Button className="w-full" onClick={() => setApiKeyBaru(null)}>Saya Sudah Menyimpan</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: koreksi absensi harian */}
      <Dialog open={!!koreksi} onOpenChange={(o) => !o && setKoreksi(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Koreksi Absensi Harian</DialogTitle>
            <p className="text-sm text-muted-foreground">{koreksi?.nama} — {koreksi?.kelas}. Alasan wajib diisi (tersimpan di audit log).</p>
          </DialogHeader>
          {koreksi && <FormKoreksi baris={koreksi} busy={busy} onSimpan={async (v) => {
            await jalankan(async () => {
              await koreksiHarian({ absensiId: koreksi.id!, ...v })
              setKoreksi(null)
              await muatMonitoring()
            }, "Koreksi tersimpan")
          }} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FormKoreksi({ baris, busy, onSimpan }: { baris: Baris; busy: boolean; onSimpan: (v: any) => void }) {
  const [jamMasuk, setJamMasuk] = useState(baris.jamMasuk ?? "")
  const [jamPulang, setJamPulang] = useState(baris.jamPulang ?? "")
  const [statusMasuk, setStatusMasuk] = useState(baris.statusMasuk ?? "")
  const [statusPulang, setStatusPulang] = useState(baris.statusPulang ?? "")
  const [alasan, setAlasan] = useState("")

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Jam masuk (kosongkan = hapus)</Label><Input value={jamMasuk} onChange={(e) => setJamMasuk(e.target.value)} placeholder="07:05" /></div>
        <div className="space-y-1"><Label>Status masuk</Label>
          <Select value={statusMasuk} onValueChange={setStatusMasuk}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="HADIR">HADIR</SelectItem>
              <SelectItem value="TERLAMBAT">TERLAMBAT</SelectItem>
            </SelectContent>
          </Select></div>
        <div className="space-y-1"><Label>Jam pulang (kosongkan = hapus)</Label><Input value={jamPulang} onChange={(e) => setJamPulang(e.target.value)} placeholder="15:00" /></div>
        <div className="space-y-1"><Label>Status pulang</Label>
          <Select value={statusPulang} onValueChange={setStatusPulang}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NORMAL">NORMAL</SelectItem>
              <SelectItem value="AWAL">AWAL</SelectItem>
            </SelectContent>
          </Select></div>
      </div>
      <div className="space-y-1"><Label>Alasan koreksi (wajib)</Label>
        <Textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="misal: mesin rusak, siswa sakit, dsb." rows={2} /></div>
      <Button className="w-full" disabled={busy || alasan.trim().length < 5}
        onClick={() => onSimpan({ jamMasuk: jamMasuk || null, jamPulang: jamPulang || null, statusMasuk: statusMasuk || null, statusPulang: statusPulang || null, alasan: alasan.trim() })}>
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MapPin className="mr-1.5 h-4 w-4" />} Simpan Koreksi
      </Button>
    </div>
  )
}
