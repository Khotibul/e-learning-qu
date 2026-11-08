"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { BarChart3, CheckCircle2, Clock, ExternalLink, Loader2, RefreshCw, ScanFace, ShieldCheck, Trash2, UserCheck, Users, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WajahPendaftaran } from "@/components/absensi/wajah-pendaftaran"
import { WajahVerifikator } from "@/components/absensi/wajah-verifikator"
import { AMBANG_WAJAH } from "@/lib/wajah-matematika"
import {
  aktifkanKioskDesktop,
  daftarLogWajah,
  daftarPengajuanWajah,
  daftarProfilWajah,
  hapusProfilWajah,
  putuskanPengajuanWajahAdmin,
  ringkasanWajah,
  statusKioskDesktop,
  tokenKioskWajah,
  ubahStatusProfilWajah,
  type LogWajahRingkas,
  type PengajuanWajahRingkas,
  type ProfilWajahRingkas,
  type RingkasanWajah,
  type StatusKioskDesktop,
} from "../actions"

function Foto({ src, nama, size = 30 }: { src?: string | null; nama: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={nama} className="rounded-full object-cover ring-1 ring-border" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-1 ring-border"
      style={{ width: size, height: size }}
    >
      {nama.trim().slice(0, 1).toUpperCase()}
    </span>
  )
}

const badgeStatus = (status: string) =>
  status === "SUKSES"
    ? "bg-emerald-100 text-emerald-800"
    : status === "DUPLIKAT"
      ? "bg-amber-100 text-amber-800"
      : status === "TIDAK_DIKENAL"
        ? "bg-slate-200 text-slate-700"
        : "bg-rose-100 text-rose-800"

const tanggalKiosk = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    : "-"

const waktuKiosk = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-"

export default function AdminWajah() {
  const [tab, setTab] = useState("profil")
  const [profil, setProfil] = useState<ProfilWajahRingkas[]>([])
  const [log, setLog] = useState<LogWajahRingkas[]>([])
  const [ringkasan, setRingkasan] = useState<RingkasanWajah | null>(null)
  const [pengajuan, setPengajuan] = useState<PengajuanWajahRingkas[]>([])
  const [kiosk, setKiosk] = useState<StatusKioskDesktop | null>(null)
  const [memuat, setMemuat] = useState(true)
  const [membukaKiosk, setMembukaKiosk] = useState(false)
  const [mengaktifkanKiosk, setMengaktifkanKiosk] = useState(false)

  const muat = useCallback(async () => {
    try {
      const [p, l, r, pg, ks] = await Promise.all([
        daftarProfilWajah(),
        daftarLogWajah(100),
        ringkasanWajah(),
        daftarPengajuanWajah(),
        statusKioskDesktop(),
      ])
      setProfil(p)
      setLog(l)
      setRingkasan(r)
      setPengajuan(pg)
      setKiosk(ks)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat data wajah")
    } finally {
      setMemuat(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => void muat(), 0)
    return () => clearTimeout(id)
  }, [muat])

  const bukaKiosk = async () => {
    setMembukaKiosk(true)
    try {
      const { url } = await tokenKioskWajah()
      window.open(url, "_blank", "noopener")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuka kiosk")
    } finally {
      setMembukaKiosk(false)
    }
  }

  const aktifkanKiosk = async () => {
    setMengaktifkanKiosk(true)
    try {
      const { url } = await aktifkanKioskDesktop()
      window.location.href = url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengaktifkan kiosk")
    } finally {
      setMengaktifkanKiosk(false)
    }
  }

  const hapus = async (row: ProfilWajahRingkas) => {
    if (!confirm(`Hapus profil wajah ${row.nama}?`)) return
    try {
      await hapusProfilWajah(row.id)
      toast.success("Profil wajah dihapus")
      void muat()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus")
    }
  }

  const toggleAktif = async (row: ProfilWajahRingkas) => {
    try {
      await ubahStatusProfilWajah(row.id, !row.aktif)
      toast.success(row.aktif ? "Profil dinonaktifkan" : "Profil diaktifkan")
      void muat()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah status")
    }
  }

  const setujuiPengajuan = async (row: PengajuanWajahRingkas) => {
    try {
      await putuskanPengajuanWajahAdmin(row.id, "SETUJUI")
      toast.success(`Wajah ${row.nama} disetujui — absensi wajah aktif`)
      void muat()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyetujui pengajuan")
    }
  }

  const tolakPengajuan = async (row: PengajuanWajahRingkas) => {
    const alasan = prompt(`Tolak pengajuan wajah ${row.nama}? Alasan (opsional, dikirim ke pengguna):`)
    if (alasan === null) return
    try {
      await putuskanPengajuanWajahAdmin(row.id, "TOLAK", alasan)
      toast.success(`Pengajuan ${row.nama} ditolak`)
      void muat()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menolak pengajuan")
    }
  }

  const onHasil = () => {
    void daftarLogWajah(100).then(setLog).catch(() => {})
    void ringkasanWajah().then(setRingkasan).catch(() => {})
  }

  const segarkan = () => {
    setMemuat(true)
    void muat()
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <ScanFace className="h-5 w-5 text-primary" /> Absensi Wajah (Face Recognition)
          </h1>
          <p className="text-sm text-muted-foreground">
            Admin mendaftarkan foto wajah guru &amp; siswa, lalu absensi diverifikasi lewat webcam — bisa dipakai di browser
            desktop maupun Android.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={segarkan} disabled={memuat}>
            {memuat ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />} Muat Ulang
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/wajah/rekap">
              <BarChart3 className="mr-1.5 h-4 w-4" /> Rekap
            </Link>
          </Button>
          <Button size="sm" onClick={bukaKiosk} disabled={membukaKiosk}>
            {membukaKiosk ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-1.5 h-4 w-4" />}
            Buka Kiosk Webcam
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Profil aktif</p><p className="text-xl font-bold">{ringkasan?.totalProfil ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Siswa terdaftar</p><p className="text-xl font-bold text-emerald-600">{ringkasan?.siswa ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Guru terdaftar</p><p className="text-xl font-bold text-sky-600">{ringkasan?.guru ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Scan hari ini</p><p className="text-xl font-bold">{ringkasan?.scanHariIni ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Verifikasi sukses</p><p className="text-xl font-bold text-emerald-600">{ringkasan?.suksesHariIni ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Pengajuan menunggu</p><p className={`text-xl font-bold ${(ringkasan?.pengajuan ?? 0) > 0 ? "text-amber-600" : ""}`}>{ringkasan?.pengajuan ?? 0}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="profil">Profil Wajah ({profil.length})</TabsTrigger>
          <TabsTrigger value="pengajuan">
            Pengajuan ({pengajuan.length})
          </TabsTrigger>
          <TabsTrigger value="kiosk">Absensi Webcam &amp; Log</TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="space-y-4">
          <WajahPendaftaran onTersimpan={() => void muat()} />

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Profil Wajah Terdaftar</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>NIS/NIP</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Sampel</TableHead>
                    <TableHead>Sumber</TableHead>
                    <TableHead>Diperbarui</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profil.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Belum ada profil wajah terdaftar</TableCell></TableRow>
                  ) : (
                    profil.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            <Foto src={p.fotoUrl} nama={p.nama} />
                            {p.nama}
                          </span>
                        </TableCell>
                        <TableCell><Badge variant="outline">{p.tipe === "SISWA" ? "Siswa" : p.tipe === "GURU" ? "Guru" : "Pegawai"}</Badge></TableCell>
                        <TableCell>{p.nis ?? "-"}</TableCell>
                        <TableCell>{p.kelas ?? "-"}</TableCell>
                        <TableCell>{p.sampel}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.sumber}</TableCell>
                        <TableCell className="text-xs">{new Date(p.updatedAt).toLocaleString("id-ID")}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              p.status === "MENUNGGU"
                                ? "bg-amber-100 text-amber-800"
                                : p.status === "DITOLAK"
                                  ? "bg-rose-100 text-rose-800"
                                  : p.aktif
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-200 text-slate-700"
                            }
                          >
                            {p.status === "MENUNGGU" ? "MENUNGGU" : p.status === "DITOLAK" ? "DITOLAK" : p.aktif ? "AKTIF" : "NONAKTIF"}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Button size="sm" variant="ghost" onClick={() => void toggleAktif(p)}>
                            <UserCheck className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void hapus(p)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pengajuan" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4" /> Pendaftaran Wajah Mandiri — Menunggu Persetujuan
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Foto tangkapan</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>NIS/NIP</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Sampel</TableHead>
                    <TableHead>Diajukan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pengajuan.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Tidak ada pengajuan wajah yang menunggu
                      </TableCell>
                    </TableRow>
                  ) : (
                    pengajuan.map((pg) => (
                      <TableRow key={pg.id}>
                        <TableCell>
                          {pg.foto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pg.foto} alt={`Tangkapan wajah ${pg.nama}`} className="h-14 w-12 rounded-md border object-cover" />
                          ) : (
                            <Foto nama={pg.nama} size={40} />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{pg.nama}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{pg.tipe === "SISWA" ? "Siswa" : pg.tipe === "GURU" ? "Guru" : "Pegawai"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{pg.nis ?? "-"}</TableCell>
                        <TableCell>{pg.kelas ?? "-"}</TableCell>
                        <TableCell>{pg.sampel}</TableCell>
                        <TableCell className="text-xs">{new Date(pg.diajukanPada).toLocaleString("id-ID")}</TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Button size="sm" variant="outline" onClick={() => void setujuiPengajuan(pg)}>
                            <CheckCircle2 className="mr-1 h-4 w-4 text-emerald-600" /> Setujui
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void tolakPengajuan(pg)}>
                            <XCircle className="h-4 w-4 text-destructive" /> Tolak
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Alur pendaftaran mandiri</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-xs text-muted-foreground">
              <p>1. Siswa/guru membuka kartu <b className="text-foreground">Daftarkan Wajah</b> di aplikasi Android mereka.</p>
              <p>2. Kamera perangkat mengambil wajah di browser; descriptor + satu foto tangkapan dikirim ke server.</p>
              <p>3. Profil berstatus <b className="text-foreground">MENUNGGU</b> dan belum bisa dipakai absensi.</p>
              <p>4. Admin mencocokkan foto tangkapan dengan identitas, lalu <b className="text-foreground">Setujui</b> atau <b className="text-foreground">Tolak</b>.</p>
              <p>Setelah disetujui, foto tangkapan dihapus dan descriptor wajah langsung aktif untuk absensi.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kiosk" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <ShieldCheck className="h-4 w-4" /> Verifikasi &amp; Absensi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WajahVerifikator
                  perangkat="DESKTOP"
                  onHasil={onHasil}
                  petunjuk="Hadapkan wajah ke kamera. Sistem mencocokkan dengan semua profil terdaftar (1:N), lalu mencatat absen masuk/pulang siswa atau kehadiran harian guru."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Catatan penggunaan</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>
                  <b className="text-foreground">Android:</b> buka tab Absensi pada aplikasi, tekan{" "}
                  <b className="text-foreground">Absensi Wajah</b> — kamera depan perangkat terbuka di browser dengan token
                  sekali pakai (berlaku 20 menit).
                </p>
                <p>
                  <b className="text-foreground">Desktop:</b> gunakan tombol <b className="text-foreground">Buka Kiosk Webcam</b>{" "}
                  di atas pada browser komputer, atau jalankan dari halaman ini langsung.
                </p>
                <p>
                  Wajah dideteksi &amp; diubah menjadi descriptor di perangkat. Server hanya membandingkan descriptor
                  (ambang {AMBANG_WAJAH}) dengan profil terdaftar; foto wajah mentah tidak dikirim ke server saat absensi.
                </p>
                <p>Semua percobaan tercatat di log di bawah, termasuk yang gagal dikenali.</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <ScanFace className="h-4 w-4" /> Kiosk Desktop Tanpa Login
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={() => void muat()} disabled={memuat}>
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${memuat ? "animate-spin" : ""}`} /> Segarkan
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <p>
                Guru dan siswa bisa absen lewat wajah atau NIS/NIP tanpa login, dengan kartu identitas (nama, foto,
                kelas/jabatan, NIS/NIP, sekolah formal &amp; non formal). Aktivasi berlaku 30 hari.
              </p>

              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">Kiosk di browser ini</span>
                  {kiosk?.browser.aktif ? (
                    <Badge className="bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Aktif s.d. {tanggalKiosk(kiosk.browser.berlakuSampai)}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Tidak aktif</Badge>
                  )}
                </div>

                <div className="border-t border-border pt-2">
                  <div className="mb-1.5 font-medium text-foreground">Kiosk aplikasi desktop</div>
                  {!kiosk || kiosk.perangkat.length === 0 ? (
                    <p>
                      Belum ada komputer yang diaktifkan dari aplikasi desktop. Login Admin di aplikasi desktop, lalu
                      tekan <b className="text-foreground">Absensi Wajah &amp; Sidik Jari</b> di layar login.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Komputer</TableHead>
                            <TableHead>Diaktifkan</TableHead>
                            <TableHead>Oleh</TableHead>
                            <TableHead>Berlaku s.d.</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kiosk.perangkat.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs font-medium">{p.perangkat}</TableCell>
                              <TableCell className="text-xs">{waktuKiosk(p.diaktifkan)}</TableCell>
                              <TableCell className="text-xs">{p.oleh}</TableCell>
                              <TableCell className="text-xs">{tanggalKiosk(p.berlakuSampai)}</TableCell>
                              <TableCell>
                                <Badge className={p.aktif ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}>
                                  {p.aktif ? "Aktif" : "Kedaluwarsa"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>

              <Button size="sm" onClick={aktifkanKiosk} disabled={mengaktifkanKiosk}>
                {mengaktifkanKiosk ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                )}
                Aktifkan Kiosk di Browser Ini
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Log Verifikasi Wajah</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Jarak</TableHead>
                    <TableHead>Perangkat</TableHead>
                    <TableHead>Pesan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {log.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Belum ada log</TableCell></TableRow>
                  ) : (
                    log.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{new Date(l.createdAt).toLocaleString("id-ID")}</TableCell>
                        <TableCell className="text-xs">{l.nama}</TableCell>
                        <TableCell><Badge variant="outline">{l.tipe}</Badge></TableCell>
                        <TableCell><Badge className={badgeStatus(l.status)}>{l.status}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{l.jarak ?? "-"}</TableCell>
                        <TableCell className="text-xs">{l.perangkat ?? "-"}</TableCell>
                        <TableCell className="max-w-72 truncate text-xs">{l.pesan ?? "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> Absensi siswa tercatat di kehadiran harian (sumber: WAJAH); kehadiran guru tercatat di
        absensi harian guru dengan bukti wajah.
      </p>
    </div>
  )
}
