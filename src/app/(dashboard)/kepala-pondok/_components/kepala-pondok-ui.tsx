"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { KEBERADAAN_LABEL, STATUS_IZIN_CLASS, STATUS_IZIN_LABEL } from "@/components/izin/izin-badges"
import {
  getMonitoringKeberadaan, getAntreanIzinKepala, setujuiIzinKepalaAction, tolakIzinKepalaAction,
  getRiwayatIzinPondok, getPengumumanPondok, setujuiPengumumanAction, getPembinaanPondok,
  setujuiPembinaanAction, getLaporanPondok, getKegiatanPondok,
} from "../actions"

type Dash = {
  totalSantri: number; diPondok: number; izinPulang: number; terlambat: number; tidakDiketahui: number
  totalAsrama: number; totalKamar: number; kegiatanHariIni: number; kehadiranKegiatanPersen: number | null
  pelanggaranBulanIni: number; prestasiBulanIni: number
  capaianTahfidz: { setoranBulanIni: number; halaqahAktif: number }
  diniyah: { kelasAktif: number; hadirPersenBulan: number | null }
  izinMenunggu: number; izinMenungguKepala: number; izinMenungguAdmin: number
  pengumumanMenunggu: number; pembinaanMenunggu: number
  kegiatanMendatang: { id: string; nama: string; tanggal: string; jamMulai: string | null; lokasi: string | null; penanggungJawab: { name: string | null } | null }[]
}

const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" })
const fmtTgl = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" })

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export function KepalaPondokUI({ dash }: { dash: Dash }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [dialog, setDialog] = useState<{ mode: "setuju" | "tolak"; id: string; teks: string } | null>(null)
  const [data, setData] = useState<Record<string, unknown>>({})
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})

  const muat = async (key: string, fn: () => Promise<unknown>) => {
    if (loaded[key]) return
    setLoading(true)
    try {
      const hasil = await fn()
      setData((d) => ({ ...d, [key]: hasil }))
      setLoaded((t) => ({ ...t, [key]: true }))
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal memuat") } finally { setLoading(false) }
  }

  const aksi = async () => {
    if (!dialog) return
    if (dialog.mode === "tolak" && dialog.teks.trim().length < 5) return toast.error("Alasan minimal 5 karakter")
    setLoading(true)
    try {
      if (dialog.mode === "setuju") { await setujuiIzinKepalaAction(dialog.id, dialog.teks || undefined); toast.success("Izin disetujui tahap Kepala Pondok") }
      else { await tolakIzinKepalaAction(dialog.id, dialog.teks); toast.success("Izin ditolak") }
      setDialog(null); setLoaded((t) => ({ ...t, antrean: false, riwayat: false })); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const antrean = data.antrean as { rows: { id: string; jenis: string; alasan: string; rencanaKeluar: string; rencanaKembali: string; alamatTujuan: string; santri: { nama: string; nisNo: string | null; asrama: { nama: string } | null } }[]; jenisLabel: Record<string, string> } | undefined
  const keberadaan = data.keberadaan as { rows: { id: string; nama: string; nisNo: string | null; keberadaan: string; asrama: string | null; kamar: string | null; izinAktif: { suratNomor: string | null; rencanaKembali: string; jenis: string } | null }[] } | undefined
  const riwayat = data.riwayat as { data: { id: string; jenis: string; status: string; createdAt: string; suratNomor: string | null; santri: { nama: string } }[]; jenisLabel: Record<string, string> } | undefined
  const pengumuman = data.pengumuman as { id: string; judul: string; isi: string; tipe: string; status: string; user: { name: string | null } }[] | undefined
  const pembinaan = data.pembinaan as { id: string; tipe: string; judul: string; status: string; tanggal: string; santri: { nama: string }; petugas: { name: string | null } | null }[] | undefined
  const laporan = data.laporan as Awaited<ReturnType<typeof getLaporanPondok>> | undefined
  const kegiatan = data.kegiatan as Awaited<ReturnType<typeof getKegiatanPondok>> | undefined

  const exportCsv = (nama: string, rows: Record<string, unknown>[]) => {
    if (!rows.length) return toast.error("Tidak ada data untuk diekspor")
    const header = Object.keys(rows[0])
    const csv = [header.join(";"), ...rows.map((r) => header.map((h) => String(r[h] ?? "")).join(";"))].join("\n")
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${nama}.csv`; a.click()
    toast.success(`Ekspor ${nama}.csv`)
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat label="Santri Aktif" value={dash.totalSantri} />
        <Stat label="Di Pondok" value={dash.diPondok} />
        <Stat label="Sedang Pulang/Izin" value={dash.izinPulang} />
        <Stat label="Terlambat Kembali" value={dash.terlambat} hint={dash.terlambat > 0 ? "Perlu tindakan" : undefined} />
        <Stat label="Keberadaan Belum Diketahui" value={dash.tidakDiketahui} />
        <Stat label="Asrama / Kamar" value={`${dash.totalAsrama} / ${dash.totalKamar}`} />
        <Stat label="Kegiatan Hari Ini" value={dash.kegiatanHariIni} hint={dash.kehadiranKegiatanPersen != null ? `Kehadiran ${dash.kehadiranKegiatanPersen}%` : "Belum ada absensi"} />
        <Stat label="Tahfidz (setoran/bln)" value={dash.capaianTahfidz.setoranBulanIni} hint={`${dash.capaianTahfidz.halaqahAktif} halaqah aktif`} />
        <Stat label="Diniyah" value={`${dash.diniyah.kelasAktif} kelas`} hint={dash.diniyah.hadirPersenBulan != null ? `Hadir ${dash.diniyah.hadirPersenBulan}%` : undefined} />
        <Stat label="Pelanggaran (bln)" value={dash.pelanggaranBulanIni} />
        <Stat label="Prestasi (bln)" value={dash.prestasiBulanIni} />
        <Stat label="Izin Menunggu" value={dash.izinMenunggu} hint={`Kepala: ${dash.izinMenungguKepala} · Admin: ${dash.izinMenungguAdmin}`} />
      </div>

      <Tabs defaultValue="kepala" className="mt-4" onValueChange={(v) => {
        if (v === "izin") void muat("antrean", getAntreanIzinKepala)
        if (v === "keberadaan") void muat("keberadaan", getMonitoringKeberadaan)
        if (v === "riwayat") void muat("riwayat", () => getRiwayatIzinPondok({ page: 1 }))
        if (v === "pengumuman") void muat("pengumuman", getPengumumanPondok)
        if (v === "pembinaan") void muat("pembinaan", () => getPembinaanPondok({}))
        if (v === "laporan") void muat("laporan", getLaporanPondok)
        if (v === "kegiatan") void muat("kegiatan", () => getKegiatanPondok({}))
      }}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="kepala">Persetujuan Izin</TabsTrigger>
          <TabsTrigger value="keberadaan">Monitoring Keberadaan</TabsTrigger>
          <TabsTrigger value="kegiatan">Kegiatan</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat Izin</TabsTrigger>
          <TabsTrigger value="pembinaan">Pembinaan</TabsTrigger>
          <TabsTrigger value="pengumuman">Pengumuman</TabsTrigger>
          <TabsTrigger value="laporan">Laporan</TabsTrigger>
        </TabsList>

        <TabsContent value="kepala" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Antrean Persetujuan Tahap Kepala Pondok ({antrean?.rows.length ?? dash.izinMenungguKepala})</CardTitle></CardHeader>
            <CardContent>
              {loading && !antrean && <p className="text-sm text-gray-500">Memuat…</p>}
              {antrean && antrean.rows.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Tidak ada izin menunggu persetujuan Anda.</p>}
              {antrean && antrean.rows.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Santri</TableHead><TableHead>Jenis</TableHead><TableHead>Rencana</TableHead><TableHead>Alamat</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {antrean.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.santri.nama}<br /><span className="text-xs text-gray-500">{r.santri.nisNo ?? "-"} · {r.santri.asrama?.nama ?? "-"}</span></TableCell>
                        <TableCell className="text-sm">{antrean.jenisLabel[r.jenis] ?? r.jenis}</TableCell>
                        <TableCell className="text-xs">{fmt.format(new Date(r.rencanaKeluar))} → {fmt.format(new Date(r.rencanaKembali))}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{r.alamatTujuan}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => setDialog({ mode: "setuju", id: r.id, teks: "" })} disabled={loading}>Setujui</Button>
                            <Button size="sm" variant="destructive" onClick={() => setDialog({ mode: "tolak", id: r.id, teks: "" })} disabled={loading}>Tolak</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keberadaan" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Santri Tidak di Pondok</CardTitle></CardHeader>
            <CardContent>
              {loading && !keberadaan && <p className="text-sm text-gray-500">Memuat…</p>}
              {keberadaan && keberadaan.rows.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Semua santri aktif berada di pondok.</p>}
              {keberadaan && keberadaan.rows.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Santri</TableHead><TableHead>Keberadaan</TableHead><TableHead>Asrama/Kamar</TableHead><TableHead>Izin Aktif</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {keberadaan.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.nama} <span className="text-xs text-gray-500">{r.nisNo}</span></TableCell>
                        <TableCell><Badge className="border-0 bg-sky-100 text-sky-700">{KEBERADAAN_LABEL[r.keberadaan] ?? r.keberadaan}</Badge></TableCell>
                        <TableCell className="text-sm">{r.asrama ?? "-"} / {r.kamar ?? "-"}</TableCell>
                        <TableCell className="text-xs">{r.izinAktif ? `${r.izinAktif.jenis} (${r.izinAktif.suratNomor ?? "-"}) sampai ${fmt.format(new Date(r.izinAktif.rencanaKembali))}` : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kegiatan" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Kegiatan Pondok</CardTitle></CardHeader>
            <CardContent>
              {loading && !kegiatan && <p className="text-sm text-gray-500">Memuat…</p>}
              {kegiatan && kegiatan.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Belum ada kegiatan tercatat.</p>}
              {kegiatan && kegiatan.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Kegiatan</TableHead><TableHead>Tanggal</TableHead><TableHead>Jam</TableHead><TableHead>Lokasi</TableHead><TableHead>PJ</TableHead><TableHead>Wajib</TableHead><TableHead>Absensi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {kegiatan.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.nama}</TableCell>
                        <TableCell className="text-sm">{fmtTgl.format(new Date(k.tanggal))}</TableCell>
                        <TableCell className="text-sm">{k.jamMulai ?? "-"} {k.jamSelesai ? `– ${k.jamSelesai}` : ""}</TableCell>
                        <TableCell className="text-sm">{k.lokasi ?? "-"}</TableCell>
                        <TableCell className="text-sm">{k.penanggungJawab ?? "-"}</TableCell>
                        <TableCell>{k.wajib ? <Badge className="border-0 bg-red-100 text-red-700">Wajib</Badge> : <span className="text-xs text-gray-400">Opsional</span>}</TableCell>
                        <TableCell className="text-sm">{k.jumlahAbsensi}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="riwayat" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Riwayat Izin</CardTitle></CardHeader>
            <CardContent>
              {loading && !riwayat && <p className="text-sm text-gray-500">Memuat…</p>}
              {riwayat && (
                <Table>
                  <TableHeader><TableRow><TableHead>Santri</TableHead><TableHead>Jenis</TableHead><TableHead>Status</TableHead><TableHead>Surat</TableHead><TableHead>Diajukan</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {riwayat.data.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.santri.nama}</TableCell>
                        <TableCell className="text-sm">{riwayat.jenisLabel[r.jenis] ?? r.jenis}</TableCell>
                        <TableCell><Badge className={`border-0 ${STATUS_IZIN_CLASS[r.status] ?? ""}`}>{STATUS_IZIN_LABEL[r.status] ?? r.status}</Badge></TableCell>
                        <TableCell className="text-xs font-mono">{r.suratNomor ?? "-"}</TableCell>
                        <TableCell className="text-xs">{fmt.format(new Date(r.createdAt))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pembinaan" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Pembinaan & Kedisiplinan</CardTitle></CardHeader>
            <CardContent>
              {loading && !pembinaan && <p className="text-sm text-gray-500">Memuat…</p>}
              {pembinaan && pembinaan.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Belum ada catatan pembinaan.</p>}
              {pembinaan && pembinaan.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Santri</TableHead><TableHead>Tipe</TableHead><TableHead>Judul</TableHead><TableHead>Petugas</TableHead><TableHead>Status</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pembinaan.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.santri.nama}</TableCell>
                        <TableCell><Badge className="border-0 bg-gray-100 text-gray-700">{p.tipe}</Badge></TableCell>
                        <TableCell className="text-sm">{p.judul}</TableCell>
                        <TableCell className="text-sm">{p.petugas?.name ?? "-"}</TableCell>
                        <TableCell className="text-sm">{p.status}</TableCell>
                        <TableCell>
                          {p.status === "MENUNGGU" && (
                            <Button size="sm" disabled={loading} onClick={async () => {
                              setLoading(true)
                              try { await setujuiPembinaanAction(p.id); toast.success("Tindak lanjut disetujui"); setLoaded((t) => ({ ...t, pembinaan: false })) } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
                            }}>Setujui</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pengumuman" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Pengumuman Pondok</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {loading && !pengumuman && <p className="text-sm text-gray-500">Memuat…</p>}
              {pengumuman && pengumuman.map((p) => (
                <div key={p.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{p.judul}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{p.isi}</p>
                    <p className="text-[11px] text-gray-400 mt-1">oleh {p.user?.name ?? "-"} · {p.tipe}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`border-0 ${p.status === "TERBIT" ? "bg-green-100 text-green-700" : p.status === "MENUNGGU" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{p.status}</Badge>
                    {(p.status === "MENUNGGU" || p.status === "DRAFT") && (
                      <Button size="sm" disabled={loading} onClick={async () => {
                        setLoading(true)
                        try { await setujuiPengumumanAction(p.id); toast.success("Pengumuman disetujui & diterbitkan"); setLoaded((t) => ({ ...t, pengumuman: false })) } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
                      }}>Setujui Terbit</Button>
                    )}
                  </div>
                </div>
              ))}
              {pengumuman && pengumuman.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Belum ada pengumuman.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="laporan" className="mt-4 space-y-4">
          {loading && !laporan && <p className="text-sm text-gray-500">Memuat…</p>}
          {laporan && (
            <>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => exportCsv("rekap-keberadaan", laporan.santri)}>Export Keberadaan (CSV)</Button>
                <Button variant="outline" size="sm" onClick={() => exportCsv("rekap-asrama", laporan.asrama)}>Export Asrama (CSV)</Button>
                <Button variant="outline" size="sm" onClick={() => exportCsv("rekap-izin", laporan.izin)}>Export Izin (CSV)</Button>
                <Button variant="outline" size="sm" onClick={() => exportCsv("rekap-kegiatan", laporan.kegiatan)}>Export Kegiatan (CSV)</Button>
                <Button variant="outline" size="sm" onClick={() => exportCsv("rekap-tahfidz", laporan.setoran)}>Export Tahfidz (CSV)</Button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Card><CardHeader><CardTitle className="text-sm">Keberadaan Santri</CardTitle></CardHeader><CardContent>
                  {laporan.santri.map((s) => <div key={s.keberadaan} className="flex justify-between text-sm py-1"><span>{KEBERADAAN_LABEL[s.keberadaan] ?? s.keberadaan}</span><span className="font-semibold">{s.jumlah}</span></div>)}
                </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Asrama ({laporan.asrama.length}) · {laporan.totalKamar} kamar</CardTitle></CardHeader><CardContent>
                  {laporan.asrama.map((a) => <div key={a.id} className="flex justify-between text-sm py-1"><span>{a.nama}</span><span className="font-semibold">{a.penghuni} santri / {a.kamar} kamar</span></div>)}
                </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Izin Bulan Ini</CardTitle></CardHeader><CardContent>
                  {laporan.izin.map((i) => <div key={i.status} className="flex justify-between text-sm py-1"><span>{STATUS_IZIN_LABEL[i.status] ?? i.status}</span><span className="font-semibold">{i.jumlah}</span></div>)}
                </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">Pembinaan Bulan Ini</CardTitle></CardHeader><CardContent>
                  {laporan.pembinaan.map((p) => <div key={p.tipe} className="flex justify-between text-sm py-1"><span>{p.tipe}</span><span className="font-semibold">{p.jumlah}</span></div>)}
                </CardContent></Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(dialog)} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog?.mode === "setuju" ? "Setujui Izin" : "Tolak Izin"}</DialogTitle></DialogHeader>
          <Textarea
            placeholder={dialog?.mode === "setuju" ? "Catatan persetujuan (opsional)" : "Alasan penolakan (min. 5 karakter)"}
            value={dialog?.teks ?? ""}
            onChange={(e) => setDialog((d) => (d ? { ...d, teks: e.target.value } : d))}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
            <Button onClick={aksi} disabled={loading}>{loading ? "Memproses…" : "Konfirmasi"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
