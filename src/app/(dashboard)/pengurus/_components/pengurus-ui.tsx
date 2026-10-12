"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { STATUS_IZIN_CLASS, STATUS_IZIN_LABEL, KEBERADAAN_LABEL } from "@/components/izin/izin-badges"
import {
  getSantriBinaan, getAntreanIzinPengurus, setujuiIzinPengurusAction, tolakIzinPengurusAction,
  getIzinPulangPengurus, getKegiatanPengurus, createKegiatanAction, deleteKegiatanAction, getAbsensiKegiatan,
  simpanAbsensiKegiatanAction, getAsramaPengurus, createPembinaanAction, createDraftPengumumanAction,
  kirimPengumumanAction, getPengumumanPengurus, getLaporanPengurus,
} from "../actions"

type Dash = {
  tanggungJawab: number; diPondok: number; sedangPulang: number; terlambat: number
  izinMenunggu: number; izinAktif: number; kegiatanHariIni: number; absensiBelumLengkap: number; scopeSemua: boolean
}

const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" })
const fmtTgl = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" })
const STATUS_ABSENSI = ["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "ALPA", "TIDAK_HADIR"] as const

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

export function PengurusUI({ dash }: { dash: Dash }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [dialog, setDialog] = useState<{ mode: "setuju" | "tolak"; id: string; teks: string } | null>(null)
  const [data, setData] = useState<Record<string, unknown>>({})
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const [formKegiatan, setFormKegiatan] = useState({ nama: "", tanggal: "", jamMulai: "", jamSelesai: "", lokasi: "", wajib: false })
  const [absensiState, setAbsensiState] = useState<{ kegiatanId: string; tanggal: string; rows: { santriId: string; nama: string; nisNo: string | null; status: string | null }[] } | null>(null)
  const [formPembinaan, setFormPembinaan] = useState({ santriId: "", tipe: "CATATAN", judul: "", deskripsi: "" })
  const [formPengumuman, setFormPengumuman] = useState({ judul: "", isi: "" })

  const muat = async (key: string, fn: () => Promise<unknown>) => {
    if (loaded[key]) return
    setLoading(true)
    try {
      const hasil = await fn()
      setData((d) => ({ ...d, [key]: hasil }))
      setLoaded((t) => ({ ...t, [key]: true }))
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal memuat") } finally { setLoading(false) }
  }
  const segarkan = (key: string) => setLoaded((t) => ({ ...t, [key]: false }))

  const aksi = async () => {
    if (!dialog) return
    if (dialog.mode === "tolak" && dialog.teks.trim().length < 5) return toast.error("Alasan minimal 5 karakter")
    setLoading(true)
    try {
      if (dialog.mode === "setuju") { await setujuiIzinPengurusAction(dialog.id, dialog.teks || undefined); toast.success("Validasi lolos — lanjut ke tahap berikutnya") }
      else { await tolakIzinPengurusAction(dialog.id, dialog.teks); toast.success("Izin ditolak") }
      setDialog(null); segarkan("antrean"); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const antrean = data.antrean as { rows: { id: string; jenis: string; alasan: string; rencanaKeluar: string; rencanaKembali: string; santri: { nama: string; nisNo: string | null; asrama: { nama: string } | null } }[]; jenisLabel: Record<string, string> } | undefined
  const santri = data.santri as { rows: { id: string; nama: string; nisNo: string | null; keberadaan: string; asrama: { nama: string } | null; kamar: { nama: string } | null }[]; keberadaanLabel: Record<string, string>; scopeSemua: boolean } | undefined
  const pulang = data.pulang as { rows: { id: string; jenis: string; rencanaKembali: string; checkoutAt: string; santri: { nama: string; asrama: { nama: string } | null } }[]; jenisLabel: Record<string, string> } | undefined
  const kegiatan = data.kegiatan as { id: string; nama: string; tipe: string; tanggal: string; jamMulai: string | null; jamSelesai: string | null; lokasi: string | null; wajib: boolean; jumlahAbsensi: number }[] | undefined
  const asrama = data.asrama as { id: string; nama: string; musyrif: string | null; totalPenghuni: number; kamars: { id: string; nama: string; kapasitas: number | null; terisi: number }[] }[] | undefined
  const pengumuman = data.pengumuman as { id: string; judul: string; isi: string; status: string; pembuat: string | null; createdAt: string }[] | undefined
  const laporan = data.laporan as { kehadiran: { status: string; jumlah: number }[]; izin: { status: string; jumlah: number }[]; pembinaan: { tipe: string; jumlah: number }[] } | undefined

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat label="Santri Tanggung Jawab" value={dash.tanggungJawab} hint={dash.scopeSemua ? "Seluruh pondok" : "Sesuai penugasan"} />
        <Stat label="Di Pondok" value={dash.diPondok} />
        <Stat label="Sedang Pulang" value={dash.sedangPulang} />
        <Stat label="Terlambat Kembali" value={dash.terlambat} />
        <Stat label="Izin Menunggu Validasi" value={dash.izinMenunggu} />
        <Stat label="Izin Disetujui Belum Keluar" value={dash.izinAktif} />
        <Stat label="Kegiatan Hari Ini" value={dash.kegiatanHariIni} />
        <Stat label="Absensi Belum Lengkap" value={dash.absensiBelumLengkap} />
      </div>

      <Tabs defaultValue="izin" className="mt-4" onValueChange={(v) => {
        if (v === "izin") { void muat("antrean", getAntreanIzinPengurus); void muat("pulang", getIzinPulangPengurus) }
        if (v === "santri") void muat("santri", () => getSantriBinaan())
        if (v === "kegiatan") void muat("kegiatan", () => getKegiatanPengurus())
        if (v === "asrama") void muat("asrama", getAsramaPengurus)
        if (v === "pengumuman") void muat("pengumuman", getPengumumanPengurus)
        if (v === "laporan") void muat("laporan", getLaporanPengurus)
        if (v === "pembinaan") void muat("pembinaan", () => getSantriBinaan())
      }}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="izin">Perizinan</TabsTrigger>
          <TabsTrigger value="santri">Data Santri</TabsTrigger>
          <TabsTrigger value="kegiatan">Kegiatan & Absensi</TabsTrigger>
          <TabsTrigger value="asrama">Asrama</TabsTrigger>
          <TabsTrigger value="pembinaan">Pembinaan</TabsTrigger>
          <TabsTrigger value="pengumuman">Pengumuman</TabsTrigger>
          <TabsTrigger value="laporan">Laporan</TabsTrigger>
        </TabsList>

        <TabsContent value="izin" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Antrean Validasi Izin ({antrean?.rows.length ?? "-"})</CardTitle></CardHeader>
            <CardContent>
              {loading && !antrean && <p className="text-sm text-gray-500">Memuat…</p>}
              {antrean && antrean.rows.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Tidak ada pengajuan izin menunggu validasi.</p>}
              {antrean && antrean.rows.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Santri</TableHead><TableHead>Jenis</TableHead><TableHead>Alasan</TableHead><TableHead>Rencana</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {antrean.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.santri.nama}<br /><span className="text-xs text-gray-500">{r.santri.asrama?.nama ?? "-"}</span></TableCell>
                        <TableCell className="text-sm">{antrean.jenisLabel[r.jenis] ?? r.jenis}</TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate" title={r.alasan}>{r.alasan}</TableCell>
                        <TableCell className="text-xs">{fmt.format(new Date(r.rencanaKeluar))} → {fmt.format(new Date(r.rencanaKembali))}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => setDialog({ mode: "setuju", id: r.id, teks: "" })} disabled={loading}>Validasi Lolos</Button>
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
          <Card>
            <CardHeader><CardTitle className="text-base">Santri Sedang Pulang (belum check-in)</CardTitle></CardHeader>
            <CardContent>
              {pulang && pulang.rows.length === 0 && <p className="text-sm text-gray-500 py-4 text-center">Tidak ada santri sedang pulang.</p>}
              {pulang && pulang.rows.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Santri</TableHead><TableHead>Jenis</TableHead><TableHead>Keluar</TableHead><TableHead>Batas Kembali</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pulang.rows.map((r) => {
                      const telat = new Date(r.rencanaKembali).getTime() < Date.now()
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.santri.nama} <span className="text-xs text-gray-500">{r.santri.asrama?.nama ?? ""}</span></TableCell>
                          <TableCell className="text-sm">{pulang.jenisLabel[r.jenis] ?? r.jenis}</TableCell>
                          <TableCell className="text-sm">{fmt.format(new Date(r.checkoutAt))}</TableCell>
                          <TableCell className="text-sm">
                            {fmt.format(new Date(r.rencanaKembali))}
                            {telat && <Badge className="ml-2 border-0 bg-red-100 text-red-700">TERLAMBAT</Badge>}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="santri" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Data Santri ({santri?.rows.length ?? "-"})</CardTitle></CardHeader>
            <CardContent>
              {loading && !santri && <p className="text-sm text-gray-500">Memuat…</p>}
              {santri && santri.rows.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Tidak ada santri dalam cakupan penugasan Anda.</p>}
              {santri && santri.rows.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>NIS</TableHead><TableHead>Nama</TableHead><TableHead>Asrama/Kamar</TableHead><TableHead>Keberadaan</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {santri.rows.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm font-mono">{s.nisNo ?? "-"}</TableCell>
                        <TableCell className="font-medium">{s.nama}</TableCell>
                        <TableCell className="text-sm">{s.asrama?.nama ?? "-"} / {s.kamar?.nama ?? "-"}</TableCell>
                        <TableCell><Badge className="border-0 bg-sky-100 text-sky-700">{KEBERADAAN_LABEL[s.keberadaan] ?? s.keberadaan}</Badge></TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => setFormPembinaan({ santriId: s.id, tipe: "CATATAN", judul: "", deskripsi: "" })}>Catat Pembinaan</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kegiatan" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Buat Kegiatan</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Nama Kegiatan</Label><Input value={formKegiatan.nama} onChange={(e) => setFormKegiatan({ ...formKegiatan, nama: e.target.value })} placeholder="Pengajian Malam Jumat" /></div>
              <div className="space-y-1"><Label>Tanggal</Label><Input type="date" value={formKegiatan.tanggal} onChange={(e) => setFormKegiatan({ ...formKegiatan, tanggal: e.target.value })} /></div>
              <div className="space-y-1"><Label>Lokasi</Label><Input value={formKegiatan.lokasi} onChange={(e) => setFormKegiatan({ ...formKegiatan, lokasi: e.target.value })} /></div>
              <div className="space-y-1"><Label>Jam Mulai</Label><Input type="time" value={formKegiatan.jamMulai} onChange={(e) => setFormKegiatan({ ...formKegiatan, jamMulai: e.target.value })} /></div>
              <div className="space-y-1"><Label>Jam Selesai</Label><Input type="time" value={formKegiatan.jamSelesai} onChange={(e) => setFormKegiatan({ ...formKegiatan, jamSelesai: e.target.value })} /></div>
              <div className="flex items-end gap-3 pb-1">
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={formKegiatan.wajib} onChange={(e) => setFormKegiatan({ ...formKegiatan, wajib: e.target.checked })} className="rounded" /> Kegiatan Wajib</label>
                <Button size="sm" disabled={loading} onClick={async () => {
                  if (formKegiatan.nama.trim().length < 3 || !formKegiatan.tanggal) return toast.error("Nama & tanggal wajib diisi")
                  setLoading(true)
                  try { await createKegiatanAction(formKegiatan as never); toast.success("Kegiatan dibuat"); setFormKegiatan({ nama: "", tanggal: "", jamMulai: "", jamSelesai: "", lokasi: "", wajib: false }); segarkan("kegiatan") } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
                }}>Simpan</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Daftar Kegiatan</CardTitle></CardHeader>
            <CardContent>
              {loading && !kegiatan && <p className="text-sm text-gray-500">Memuat…</p>}
              {kegiatan && kegiatan.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Belum ada kegiatan.</p>}
              {kegiatan && kegiatan.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Kegiatan</TableHead><TableHead>Tanggal</TableHead><TableHead>Jam</TableHead><TableHead>Lokasi</TableHead><TableHead>Wajib</TableHead><TableHead>Absensi</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {kegiatan.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.nama}</TableCell>
                        <TableCell className="text-sm">{fmtTgl.format(new Date(k.tanggal))}</TableCell>
                        <TableCell className="text-sm">{k.jamMulai ?? "-"}</TableCell>
                        <TableCell className="text-sm">{k.lokasi ?? "-"}</TableCell>
                        <TableCell>{k.wajib ? <Badge className="border-0 bg-red-100 text-red-700">Wajib</Badge> : <span className="text-xs text-gray-400">-</span>}</TableCell>
                        <TableCell className="text-sm">{k.jumlahAbsensi}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" disabled={loading} onClick={async () => {
                              setLoading(true)
                              try {
                                const tgl = k.tanggal.slice(0, 10)
                                const hasil = await getAbsensiKegiatan(k.id, tgl) as never
                                setAbsensiState(hasil)
                              } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
                            }}>Absensi</Button>
                            <Button size="sm" variant="destructive" disabled={loading} onClick={async () => {
                              setLoading(true)
                              try { await deleteKegiatanAction(k.id); toast.success("Kegiatan dihapus"); segarkan("kegiatan") } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
                            }}>Hapus</Button>
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

        <TabsContent value="asrama" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Monitoring Asrama & Kamar</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {loading && !asrama && <p className="text-sm text-gray-500">Memuat…</p>}
              {asrama && asrama.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Belum ada asrama dalam cakupan Anda.</p>}
              {asrama && asrama.map((a) => (
                <div key={a.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm">{a.nama}</p>
                    <p className="text-xs text-gray-500">Musyrif: {a.musyrif ?? "-"} · {a.totalPenghuni} penghuni</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {a.kamars.map((k) => (
                      <div key={k.id} className="bg-gray-50 rounded p-2 text-xs">
                        <p className="font-medium">{k.nama}</p>
                        <p className="text-gray-500">{k.terisi}/{k.kapasitas ?? "?"} terisi{k.kapasitas && k.terisi >= k.kapasitas ? " · PENUH" : ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pembinaan" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Catat Pembinaan / Prestasi</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Jenis</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={formPembinaan.tipe} onChange={(e) => setFormPembinaan({ ...formPembinaan, tipe: e.target.value })}>
                  <option value="CATATAN">Catatan Perkembangan</option>
                  <option value="PRESTASI">Prestasi</option>
                  <option value="PELANGGARAN">Pelanggaran</option>
                  <option value="TINDAK_LANJUT">Tindak Lanjut</option>
                </select>
              </div>
              <div className="space-y-1"><Label>Judul</Label><Input value={formPembinaan.judul} onChange={(e) => setFormPembinaan({ ...formPembinaan, judul: e.target.value })} placeholder="Juara Tahfidz Tingkat Kecamatan" /></div>
              <div className="space-y-1 md:col-span-2"><Label>Deskripsi</Label><Textarea value={formPembinaan.deskripsi} onChange={(e) => setFormPembinaan({ ...formPembinaan, deskripsi: e.target.value })} /></div>
              <div className="md:col-span-2">
                <Button size="sm" disabled={loading} onClick={async () => {
                  if (!formPembinaan.santriId) return toast.error("Pilih santri lewat tab Data Santri terlebih dahulu")
                  setLoading(true)
                  try { await createPembinaanAction(formPembinaan as never); toast.success("Pembinaan dicatat"); setFormPembinaan({ santriId: "", tipe: "CATATAN", judul: "", deskripsi: "" }) } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
                }}>Simpan (santri terpilih: {formPembinaan.santriId ? "ya" : "belum"})</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pengumuman" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Buat Pengumuman (draft → menunggu persetujuan Kepala Pondok)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1"><Label>Judul</Label><Input value={formPengumuman.judul} onChange={(e) => setFormPengumuman({ ...formPengumuman, judul: e.target.value })} /></div>
              <div className="space-y-1"><Label>Isi</Label><Textarea value={formPengumuman.isi} onChange={(e) => setFormPengumuman({ ...formPengumuman, isi: e.target.value })} rows={3} /></div>
              <Button size="sm" disabled={loading} onClick={async () => {
                if (formPengumuman.judul.trim().length < 3 || formPengumuman.isi.trim().length < 5) return toast.error("Judul & isi wajib diisi")
                setLoading(true)
                try {
                  const row = await createDraftPengumumanAction(formPengumuman as never) as { id: string }
                  await kirimPengumumanAction(row.id)
                  toast.success("Pengumuman dikirim untuk disetujui")
                  setFormPengumuman({ judul: "", isi: "" }); segarkan("pengumuman")
                } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
              }}>Kirim untuk Disetujui</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Riwayat Pengumuman</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {loading && !pengumuman && <p className="text-sm text-gray-500">Memuat…</p>}
              {pengumuman && pengumuman.map((p) => (
                <div key={p.id} className="border rounded-lg p-3 flex justify-between items-start gap-3">
                  <div><p className="text-sm font-medium">{p.judul}</p><p className="text-xs text-gray-500 line-clamp-2">{p.isi}</p></div>
                  <Badge className={`border-0 shrink-0 ${p.status === "TERBIT" ? "bg-green-100 text-green-700" : p.status === "MENUNGGU" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{p.status}</Badge>
                </div>
              ))}
              {pengumuman && pengumuman.length === 0 && <p className="text-sm text-gray-500 py-4 text-center">Belum ada pengumuman.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="laporan" className="mt-4">
          {loading && !laporan && <p className="text-sm text-gray-500">Memuat…</p>}
          {laporan && (
            <div className="grid md:grid-cols-3 gap-4">
              <Card><CardHeader><CardTitle className="text-sm">Kehadiran Kegiatan (bln)</CardTitle></CardHeader><CardContent>
                {laporan.kehadiran.map((k) => <div key={k.status} className="flex justify-between text-sm py-1"><span>{k.status}</span><span className="font-semibold">{k.jumlah}</span></div>)}
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Izin (bln)</CardTitle></CardHeader><CardContent>
                {laporan.izin.map((i) => <div key={i.status} className="flex justify-between text-sm py-1"><span>{STATUS_IZIN_LABEL[i.status] ?? i.status}</span><span className="font-semibold">{i.jumlah}</span></div>)}
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Pembinaan (bln)</CardTitle></CardHeader><CardContent>
                {laporan.pembinaan.map((p) => <div key={p.tipe} className="flex justify-between text-sm py-1"><span>{p.tipe}</span><span className="font-semibold">{p.jumlah}</span></div>)}
              </CardContent></Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(dialog)} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog?.mode === "setuju" ? "Validasi Kelengkapan Izin" : "Tolak Izin"}</DialogTitle></DialogHeader>
          <Textarea placeholder={dialog?.mode === "setuju" ? "Catatan validasi (opsional)" : "Alasan penolakan (min. 5 karakter)"} value={dialog?.teks ?? ""} onChange={(e) => setDialog((d) => (d ? { ...d, teks: e.target.value } : d))} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
            <Button onClick={aksi} disabled={loading}>{loading ? "Memproses…" : "Konfirmasi"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(absensiState)} onOpenChange={(o) => !o && setAbsensiState(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Absensi — {absensiState?.kegiatanId ? "Kegiatan" : ""}</DialogTitle></DialogHeader>
          {absensiState && (
            <Table>
              <TableHeader><TableRow><TableHead>Santri</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {absensiState.rows.map((r, i) => (
                  <TableRow key={r.santriId}>
                    <TableCell className="text-sm">{r.nama} <span className="text-xs text-gray-400">{r.nisNo}</span></TableCell>
                    <TableCell>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={r.status ?? "HADIR"}
                        onChange={(e) => {
                          const nilai = e.target.value
                          setAbsensiState((s) => (s ? { ...s, rows: s.rows.map((x, j) => (j === i ? { ...x, status: nilai } : x)) } : s))
                        }}
                      >
                        {STATUS_ABSENSI.map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAbsensiState(null)}>Batal</Button>
            <Button disabled={loading} onClick={async () => {
              if (!absensiState) return
              setLoading(true)
              try {
                await simpanAbsensiKegiatanAction(absensiState.kegiatanId, absensiState.tanggal, absensiState.rows.map((r) => ({ santriId: r.santriId, status: (r.status ?? "HADIR") as never })))
                toast.success("Absensi tersimpan"); setAbsensiState(null); segarkan("kegiatan")
              } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
            }}>{loading ? "Menyimpan…" : "Simpan Absensi"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
