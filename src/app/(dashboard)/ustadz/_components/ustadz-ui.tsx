"use client"

import { useState } from "react"
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
import { STATUS_IZIN_CLASS, STATUS_IZIN_LABEL } from "@/components/izin/izin-badges"
import {
  getJadwalUstadz, getKelasDiniyahOpts, getSantriKelasDiniyah, simpanAbsensiDiniyahAction,
  getHalaqahOpts, getSetoranHalaqah, catatSetoranAction, getCapaianHalaqah,
  createPembinaanUstadzAction, getIzinSantriBinaan, rekomendasiIzinAction, getLaporanUstadz,
  createKelasDiniyahAction, createHalaqahAction,
} from "../actions"

type Dash = {
  kelasSaya: { id: string; nama: string; hari: string | null; jam: string | null }[]
  halaqahSaya: { id: string; nama: string; targetSurah: string | null }[]
  santriBinaan: number
  absensiBelumDiniyah: number
  absensiKegiatanTerisi: number
  kegiatanDitugaskan: number
  setoranTerbaru: { id: string; nama: string; halaqah: string; surah: string; ayat: string; status: string; tanggal: string }[]
  targetHalaqah: { id: string; nama: string; targetSurah: string | null; jumlahSantri: number }[]
  izinTerkait: { id: string; nama: string; jenis: string; status: string }[]
}

const STATUS_ABSENSI = ["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "ALPA", "TIDAK_HADIR"] as const
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

export function UstadzUI({ dash }: { dash: Dash }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Record<string, unknown>>({})
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const [absensi, setAbsensi] = useState<{ kelas: { id: string; nama: string }; tanggal: string; rows: { santriId: string; nama: string; nisNo: string | null; status: string | null }[] } | null>(null)
  const [dialogSetoran, setDialogSetoran] = useState<{ halaqahId: string; santriId: string; surah: string; ayatMulai: string; ayatAkhir: string; tipe: string; status: string; tajwid: string; kelancaran: string; catatan: string } | null>(null)
  const [dialogIzin, setDialogIzin] = useState<{ izinId: string; mode: "SETUJUI" | "TIDAK_SETUJUI"; catatan: string } | null>(null)
  const [dialogPembinaan, setDialogPembinaan] = useState<{ santriId: string; tipe: string; judul: string; deskripsi: string } | null>(null)

  const muat = async (key: string, fn: () => Promise<unknown>) => {
    if (loaded[key]) return
    setLoading(true)
    try {
      const hasil = await fn()
      setData((d) => ({ ...d, [key]: hasil }))
      setLoaded((t) => ({ ...t, [key]: true }))
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal memuat") } finally { setLoading(false) }
  }

  const jadwal = data.jadwal as Awaited<ReturnType<typeof getJadwalUstadz>> | undefined
  const kelasOpts = data.kelasOpts as { id: string; nama: string }[] | undefined
  const halaqahOpts = data.halaqahOpts as { id: string; nama: string }[] | undefined
  const setoran = data.setoran as { data: { id: string; surah: string; ayatMulai: number; ayatAkhir: number; status: string; tanggal: string; tajwid: number | null; kelancaran: number | null; santri: { nama: string; nisNo: string | null } }[]; total: number } | undefined
  const capaian = data.capaian as { santriId: string; nama: string; jumlahSetoran: number; terakhir: { surah: string; ayat: string; status: string; tanggal: string } | null; rataTajwid: number | null; rataKelancaran: number | null }[] | undefined
  const izin = data.izin as { rows: { id: string; jenis: string; status: string; alasan: string; rencanaKeluar: string; rencanaKembali: string; santri: { nama: string; nisNo: string | null } }[]; jenisLabel: Record<string, string> } | undefined
  const laporan = data.laporan as Awaited<ReturnType<typeof getLaporanUstadz>> | undefined

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat label="Kelas Diniyah Diampu" value={dash.kelasSaya.length} hint={dash.kelasSaya.map((k) => k.nama).slice(0, 2).join(", ") || "-"} />
        <Stat label="Halaqah Dibina" value={dash.halaqahSaya.length} />
        <Stat label="Santri Binaan" value={dash.santriBinaan} />
        <Stat label="Absensi Diniyah Belum" value={dash.absensiBelumDiniyah} />
        <Stat label="Setoran Terbaru" value={dash.setoranTerbaru.length} />
        <Stat label="Izin Terkait" value={dash.izinTerkait.length} />
      </div>

      {dash.izinTerkait.length > 0 && (
        <Card className="mt-3">
          <CardHeader><CardTitle className="text-sm">Izin Santri Binaan</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {dash.izinTerkait.map((i) => (
              <Badge key={i.id} className="border-0 bg-amber-100 text-amber-800">{i.nama} — {i.jenis} ({i.status})</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="jadwal" className="mt-4" onValueChange={(v) => {
        if (v === "jadwal") void muat("jadwal", getJadwalUstadz)
        if (v === "absensi") void muat("kelasOpts", getKelasDiniyahOpts)
        if (v === "tahfidz") { void muat("halaqahOpts", getHalaqahOpts) }
        if (v === "izin") void muat("izin", getIzinSantriBinaan)
        if (v === "laporan") void muat("laporan", getLaporanUstadz)
      }}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="jadwal">Jadwal</TabsTrigger>
          <TabsTrigger value="absensi">Absensi Diniyah</TabsTrigger>
          <TabsTrigger value="tahfidz">Tahfidz</TabsTrigger>
          <TabsTrigger value="izin">Perizinan</TabsTrigger>
          <TabsTrigger value="laporan">Laporan</TabsTrigger>
        </TabsList>

        <TabsContent value="jadwal" className="mt-4 space-y-4">
          {loading && !jadwal && <p className="text-sm text-gray-500">Memuat…</p>}
          {jadwal && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Kelas Diniyah</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {jadwal.kelas.length === 0 && <p className="text-sm text-gray-500">Belum ada kelas diampu.</p>}
                  {jadwal.kelas.map((k) => (
                    <div key={k.id} className="border rounded-lg p-3 flex justify-between items-center">
                      <div><p className="text-sm font-medium">{k.nama}</p><p className="text-xs text-gray-500">{k.hari ?? "-"} {k.jam ?? ""}</p></div>
                      <Badge className="border-0 bg-blue-100 text-blue-700">Diniyah</Badge>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" disabled={loading} onClick={async () => {
                    const nama = prompt("Nama kelas diniyah baru (mis. Diniyah Alfiyat):")
                    if (!nama || nama.trim().length < 3) return
                    setLoading(true)
                    try { await createKelasDiniyahAction({ nama: nama.trim() }); toast.success("Kelas dibuat & Anda ditugaskan sebagai pengampu"); setLoaded((t) => ({ ...t, kelasOpts: false, jadwal: false })) } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
                  }}>+ Kelas Baru</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Halaqah Tahfidz</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {jadwal.halaqah.length === 0 && <p className="text-sm text-gray-500">Belum ada halaqah dibina.</p>}
                  {jadwal.halaqah.map((h) => (
                    <div key={h.id} className="border rounded-lg p-3 flex justify-between items-center">
                      <div><p className="text-sm font-medium">{h.nama}</p><p className="text-xs text-gray-500">{h.jumlahSantri} santri · target: {h.targetSurah ?? "-"}</p></div>
                      <Badge className="border-0 bg-emerald-100 text-emerald-700">Tahfidz</Badge>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" disabled={loading} onClick={async () => {
                    const nama = prompt("Nama halaqah baru (mis. Halaqah An-Nur):")
                    if (!nama || nama.trim().length < 2) return
                    setLoading(true)
                    try { await createHalaqahAction({ nama: nama.trim() }); toast.success("Halaqah dibuat & Anda ditugaskan sebagai pembina"); setLoaded((t) => ({ ...t, halaqahOpts: false, jadwal: false })) } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
                  }}>+ Halaqah Baru</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Kegiatan Ditugaskan Hari Ini</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {jadwal.kegiatanHariIni.length === 0 && <p className="text-sm text-gray-500">Tidak ada kegiatan ditugaskan hari ini.</p>}
                  {jadwal.kegiatanHariIni.map((k) => (
                    <div key={k.id} className="border rounded-lg p-3">
                      <p className="text-sm font-medium">{k.nama}</p>
                      <p className="text-xs text-gray-500">{k.jamMulai ?? "-"} {k.lokasi ?? ""}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="absensi" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Ambil Absensi Diniyah</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label>Kelas</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={absensi?.kelas.id ?? ""} onChange={async (e) => {
                  const k = kelasOpts?.find((x) => x.id === e.target.value)
                  if (!k) return setAbsensi(null)
                  const tanggal = new Date().toISOString().slice(0, 10)
                  setLoading(true)
                  try { setAbsensi(await getSantriKelasDiniyah(k.id, tanggal) as never) } catch (err) { toast.error(err instanceof Error ? err.message : "Gagal") } finally { setLoading(false) }
                }}>
                  <option value="">— pilih kelas —</option>
                  {kelasOpts?.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
              </div>
              {absensi && (
                <Table>
                  <TableHeader><TableRow><TableHead>Santri</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {absensi.rows.map((r, i) => (
                      <TableRow key={r.santriId}>
                        <TableCell className="text-sm">{r.nama} <span className="text-xs text-gray-400">{r.nisNo}</span></TableCell>
                        <TableCell>
                          <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={r.status ?? "HADIR"} onChange={(e) => {
                            const v = e.target.value
                            setAbsensi((s) => (s ? { ...s, rows: s.rows.map((x, j) => (j === i ? { ...x, status: v } : x)) } : s))
                          }}>
                            {STATUS_ABSENSI.map((st) => <option key={st} value={st}>{st}</option>)}
                          </select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {absensi && (
                <Button size="sm" disabled={loading} onClick={async () => {
                  setLoading(true)
                  try {
                    await simpanAbsensiDiniyahAction(absensi.kelas.id, absensi.tanggal, absensi.rows.map((r) => ({ santriId: r.santriId, status: (r.status ?? "HADIR") as never })))
                    toast.success("Absensi diniyah tersimpan")
                  } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
                }}>{loading ? "Menyimpan…" : "Simpan Absensi"}</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tahfidz" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Setoran / Murajaah</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label>Halaqah</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={dialogSetoran?.halaqahId ?? ""} onChange={(e) => {
                  const hId = e.target.value
                  if (!hId) return setDialogSetoran(null)
                  setDialogSetoran({ halaqahId: hId, santriId: "", surah: "", ayatMulai: "", ayatAkhir: "", tipe: "SETORAN", status: "DITERIMA", tajwid: "", kelancaran: "", catatan: "" })
                  void muat(`setoran-${hId}`, () => getSetoranHalaqah(hId))
                  void muat(`capaian-${hId}`, () => getCapaianHalaqah(hId))
                }}>
                  <option value="">— pilih halaqah —</option>
                  {halaqahOpts?.map((h) => <option key={h.id} value={h.id}>{h.nama}</option>)}
                </select>
              </div>
              {dialogSetoran?.halaqahId && (
                <Button size="sm" onClick={() => {
                  const cap = data[`capaian-${dialogSetoran.halaqahId}`] as { santriId: string; nama: string }[] | undefined
                  if (!cap || cap.length === 0) return toast.error("Belum ada santri di halaqah ini")
                  setDialogSetoran({ ...dialogSetoran, santriId: cap[0].santriId })
                }}>Catat Setoran…</Button>
              )}
            </CardContent>
          </Card>
          {dialogSetoran?.halaqahId && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Capaian Halaqah</CardTitle></CardHeader>
              <CardContent>
                {loading && !(data[`capaian-${dialogSetoran.halaqahId}`]) && <p className="text-sm text-gray-500">Memuat…</p>}
                {(() => {
                  const cap = data[`capaian-${dialogSetoran.halaqahId}`] as { santriId: string; nama: string; nisNo: string | null; jumlahSetoran: number; terakhir: { surah: string; ayat: string; status: string; tanggal: string } | null; rataTajwid: number | null; rataKelancaran: number | null }[] | undefined
                  if (!cap) return null
                  if (cap.length === 0) return <p className="text-sm text-gray-500 py-4 text-center">Belum ada santri di halaqah ini. Tempatkan santri lewat admin/pengurus.</p>
                  return (
                    <Table>
                      <TableHeader><TableRow><TableHead>Santri</TableHead><TableHead>Jumlah Setoran</TableHead><TableHead>Terakhir</TableHead><TableHead>Rata Tajwid/Kelancaran</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {cap.map((c) => (
                          <TableRow key={c.santriId}>
                            <TableCell className="font-medium">{c.nama} <span className="text-xs text-gray-400">{c.nisNo}</span></TableCell>
                            <TableCell className="text-sm">{c.jumlahSetoran}</TableCell>
                            <TableCell className="text-xs">{c.terakhir ? `${c.terakhir.surah} ${c.terakhir.ayat} (${c.terakhir.status})` : "-"}</TableCell>
                            <TableCell className="text-sm">{c.rataTajwid ?? "-"} / {c.rataKelancaran ?? "-"}</TableCell>
                            <TableCell><Button size="sm" variant="outline" onClick={() => setDialogSetoran({ halaqahId: dialogSetoran.halaqahId, santriId: c.santriId, surah: "", ayatMulai: "", ayatAkhir: "", tipe: "SETORAN", status: "DITERIMA", tajwid: "", kelancaran: "", catatan: "" })}>Catat Setoran</Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="izin" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Izin Santri Binaan (rekomendasi, bukan persetujuan final)</CardTitle></CardHeader>
            <CardContent>
              {loading && !izin && <p className="text-sm text-gray-500">Memuat…</p>}
              {izin && izin.rows.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Belum ada data izin santri binaan Anda.</p>}
              {izin && izin.rows.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Santri</TableHead><TableHead>Jenis</TableHead><TableHead>Alasan</TableHead><TableHead>Rencana</TableHead><TableHead>Status</TableHead><TableHead>Rekomendasi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {izin.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.santri.nama}</TableCell>
                        <TableCell className="text-sm">{izin.jenisLabel[r.jenis] ?? r.jenis}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={r.alasan}>{r.alasan}</TableCell>
                        <TableCell className="text-xs">{fmtTgl.format(new Date(r.rencanaKeluar))} → {fmtTgl.format(new Date(r.rencanaKembali))}</TableCell>
                        <TableCell><Badge className={`border-0 ${STATUS_IZIN_CLASS[r.status] ?? ""}`}>{STATUS_IZIN_LABEL[r.status] ?? r.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" disabled={loading} onClick={() => setDialogIzin({ izinId: r.id, mode: "SETUJUI", catatan: "" })}>Setujui</Button>
                            <Button size="sm" variant="destructive" disabled={loading} onClick={() => setDialogIzin({ izinId: r.id, mode: "TIDAK_SETUJUI", catatan: "" })}>Tidak</Button>
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

        <TabsContent value="laporan" className="mt-4">
          {loading && !laporan && <p className="text-sm text-gray-500">Memuat…</p>}
          {laporan && (
            <div className="grid md:grid-cols-3 gap-4">
              <Card><CardHeader><CardTitle className="text-sm">Kehadiran Diniyah (bln)</CardTitle></CardHeader><CardContent>
                {laporan.kehadiranDiniyah.length === 0 && <p className="text-xs text-gray-400">Belum ada data.</p>}
                {laporan.kehadiranDiniyah.map((k) => <div key={k.status} className="flex justify-between text-sm py-1"><span>{k.status}</span><span className="font-semibold">{k.jumlah}</span></div>)}
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Setoran Tahfidz (bln)</CardTitle></CardHeader><CardContent>
                {laporan.setoran.length === 0 && <p className="text-xs text-gray-400">Belum ada data.</p>}
                {laporan.setoran.map((s) => <div key={s.status} className="flex justify-between text-sm py-1"><span>{s.status}</span><span className="font-semibold">{s.jumlah}</span></div>)}
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Penilaian</CardTitle></CardHeader><CardContent>
                <div className="flex justify-between text-sm py-1"><span>Rata Tajwid</span><span className="font-semibold">{laporan.rataTajwid ?? "-"}</span></div>
                <div className="flex justify-between text-sm py-1"><span>Rata Kelancaran</span><span className="font-semibold">{laporan.rataKelancaran ?? "-"}</span></div>
                <div className="flex justify-between text-sm py-1"><span>Jumlah Dinilai</span><span className="font-semibold">{laporan.jumlahDinilai}</span></div>
              </CardContent></Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(dialogSetoran && dialogSetoran.santriId)} onOpenChange={(o) => !o && setDialogSetoran(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Catat Setoran Tahfidz</DialogTitle></DialogHeader>
          {dialogSetoran && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Santri</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={dialogSetoran.santriId} onChange={(e) => setDialogSetoran({ ...dialogSetoran, santriId: e.target.value })}>
                  {((data[`capaian-${dialogSetoran.halaqahId}`]) as { santriId: string; nama: string }[] | undefined)?.map((s) => <option key={s.santriId} value={s.santriId}>{s.nama}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>Surah</Label><Input value={dialogSetoran.surah} onChange={(e) => setDialogSetoran({ ...dialogSetoran, surah: e.target.value })} placeholder="Al-Baqarah" /></div>
              <div className="space-y-1"><Label>Tipe</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={dialogSetoran.tipe} onChange={(e) => setDialogSetoran({ ...dialogSetoran, tipe: e.target.value })}>
                  <option value="SETORAN">Setoran</option>
                  <option value="MURAJAAH">Murajaah</option>
                </select>
              </div>
              <div className="space-y-1"><Label>Ayat Mulai</Label><Input type="number" value={dialogSetoran.ayatMulai} onChange={(e) => setDialogSetoran({ ...dialogSetoran, ayatMulai: e.target.value })} /></div>
              <div className="space-y-1"><Label>Ayat Akhir</Label><Input type="number" value={dialogSetoran.ayatAkhir} onChange={(e) => setDialogSetoran({ ...dialogSetoran, ayatAkhir: e.target.value })} /></div>
              <div className="space-y-1"><Label>Status</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={dialogSetoran.status} onChange={(e) => setDialogSetoran({ ...dialogSetoran, status: e.target.value })}>
                  <option value="DITERIMA">Diterima</option>
                  <option value="ULANG">Ulang</option>
                  <option value="BERKELANJUTAN">Berlanjut</option>
                </select>
              </div>
              <div className="space-y-1"><Label>Tajwid (0–100)</Label><Input type="number" value={dialogSetoran.tajwid} onChange={(e) => setDialogSetoran({ ...dialogSetoran, tajwid: e.target.value })} /></div>
              <div className="space-y-1"><Label>Kelancaran (0–100)</Label><Input type="number" value={dialogSetoran.kelancaran} onChange={(e) => setDialogSetoran({ ...dialogSetoran, kelancaran: e.target.value })} /></div>
              <div className="col-span-2 space-y-1"><Label>Catatan</Label><Textarea value={dialogSetoran.catatan} onChange={(e) => setDialogSetoran({ ...dialogSetoran, catatan: e.target.value })} rows={2} /></div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogSetoran(null)}>Batal</Button>
            <Button disabled={loading} onClick={async () => {
              if (!dialogSetoran) return
              if (!dialogSetoran.surah || !dialogSetoran.ayatMulai || !dialogSetoran.ayatAkhir) return toast.error("Surah & range ayat wajib diisi")
              setLoading(true)
              try {
                await catatSetoranAction({
                  halaqahId: dialogSetoran.halaqahId, santriId: dialogSetoran.santriId, surah: dialogSetoran.surah,
                  ayatMulai: Number(dialogSetoran.ayatMulai), ayatAkhir: Number(dialogSetoran.ayatAkhir),
                  tipe: dialogSetoran.tipe, status: dialogSetoran.status,
                  tajwid: dialogSetoran.tajwid ? Number(dialogSetoran.tajwid) : undefined,
                  kelancaran: dialogSetoran.kelancaran ? Number(dialogSetoran.kelancaran) : undefined,
                  catatan: dialogSetoran.catatan || undefined,
                })
                toast.success("Setoran tercatat")
                setDialogSetoran(null)
                setLoaded((t) => ({ ...t, [`setoran-${dialogSetoran.halaqahId}`]: false, [`capaian-${dialogSetoran.halaqahId}`]: false }))
              } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
            }}>{loading ? "Menyimpan…" : "Simpan Setoran"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(dialogIzin)} onOpenChange={(o) => !o && setDialogIzin(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rekomendasi Izin ({dialogIzin?.mode === "SETUJUI" ? "Setujui" : "Tidak Setujui"})</DialogTitle></DialogHeader>
          <Textarea placeholder="Catatan rekomendasi (min. 5 karakter)" value={dialogIzin?.catatan ?? ""} onChange={(e) => setDialogIzin((d) => (d ? { ...d, catatan: e.target.value } : d))} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogIzin(null)}>Batal</Button>
            <Button disabled={loading} onClick={async () => {
              if (!dialogIzin) return
              if (dialogIzin.catatan.trim().length < 5) return toast.error("Catatan minimal 5 karakter")
              setLoading(true)
              try { await rekomendasiIzinAction(dialogIzin.izinId, dialogIzin.mode, dialogIzin.catatan); toast.success("Rekomendasi tercatat"); setDialogIzin(null); setLoaded((t) => ({ ...t, izin: false })) } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
            }}>{loading ? "Mengirim…" : "Kirim Rekomendasi"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(dialogPembinaan)} onOpenChange={(o) => !o && setDialogPembinaan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Catatan Pembinaan</DialogTitle></DialogHeader>
          {dialogPembinaan && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Judul</Label><Input value={dialogPembinaan.judul} onChange={(e) => setDialogPembinaan({ ...dialogPembinaan, judul: e.target.value })} /></div>
              <div className="space-y-1"><Label>Deskripsi</Label><Textarea value={dialogPembinaan.deskripsi} onChange={(e) => setDialogPembinaan({ ...dialogPembinaan, deskripsi: e.target.value })} rows={3} /></div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogPembinaan(null)}>Batal</Button>
            <Button disabled={loading} onClick={async () => {
              if (!dialogPembinaan) return
              setLoading(true)
              try { await createPembinaanUstadzAction(dialogPembinaan as never); toast.success("Catatan pembinaan tersimpan"); setDialogPembinaan(null) } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
            }}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
