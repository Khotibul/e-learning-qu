"use client"

import { useState, useEffect } from "react"
import { toast } from "react-hot-toast"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { BadgeIzin, fmtTanggal, JENIS_IZIN_LABEL } from "@/components/izin/izin-badges"
import { Loader2, CheckCircle, XCircle, Plus, AlertTriangle, Building2 } from "lucide-react"
import {
  getAntreanAdmin, setujuiIzinAdminAction, tolakIzinAdminAction, getStatistikAdmin,
  getRiwayatAdmin, getPengaturanIzin, simpanPengaturanIzinAction, getAsramaOpts,
  createAsramaAction, createKamarAction, getKonflikAbsensiAction, resolveKonflikAbsensiAction,
} from "../actions"

interface IzinRow {
  id: string; jenis: string; alasan: string; status: string
  rencanaKeluar: string; rencanaKembali: string; alamatTujuan: string
  namaPenjemput: string; noTelpPenjemput: string; suratNomor: string | null
  checkoutAt: string | null; checkinAt: string | null; alasanKeputusan: string | null; createdAt: string
  santri: { nama: string; nisNo: string | null; asrama: { nama: string } | null; kamar: { nama: string } | null }
}

type Pengaturan = { jenis: string; butuhWali: boolean; butuhMusyrif: boolean; butuhAdmin: boolean; aktif: boolean }
type Asrama = { id: string; nama: string; musyrif: { id: string; nama: string } | null; kamars: { id: string; nama: string; kapasitas: number | null }[] }
type Konflik = { id: string; tanggal: string; catatan: string; siswa: { id: string; nama: string; nis: string | null }; izin: { suratNomor: string | null; jenis: string; rencanaKembali: string } }

const HUB_LABEL: Record<string, string> = { butuhWali: "Wali", butuhMusyrif: "Musyrif", butuhAdmin: "Admin" }

export function IzinAdminUI(props: {
  antrean: IzinRow[]; statistik: { totalSantri: number; diPondok: number; izinAktif: number; menunggu: number; sedangPulang: number; terlambat: number }
  riwayat: IzinRow[]; pengaturan: Pengaturan[]; asrama: Asrama[]; konflik: Konflik[]
}) {
  const [antrean, setAntrean] = useState(props.antrean)
  const [riwayat, setRiwayat] = useState(props.riwayat)
  const [pengaturan, setPengaturan] = useState(props.pengaturan)
  const [asrama, setAsrama] = useState(props.asrama)
  const [konflik, setKonflik] = useState(props.konflik)
  const [statistik] = useState(props.statistik)
  const [loading, setLoading] = useState(false)
  const [dialog, setDialog] = useState<{ mode: "setuju" | "tolak"; id: string; teks: string } | null>(null)
  const [formAsrama, setFormAsrama] = useState({ nama: "", deskripsi: "" })
  const [formKamar, setFormKamar] = useState<{ asramaId: string; nama: string; kapasitas: string } | null>(null)
  const router = useRouter()

  const aksi = async () => {
    if (!dialog) return
    if (dialog.mode === "tolak" && dialog.teks.trim().length < 5) return toast.error("Alasan minimal 5 karakter")
    setLoading(true)
    try {
      if (dialog.mode === "setuju") { await setujuiIzinAdminAction(dialog.id, dialog.teks || undefined); toast.success("Izin DISETUJUI — surat digital diterbitkan") }
      else { await tolakIzinAdminAction(dialog.id, dialog.teks); toast.success("Izin DITOLAK") }
      setDialog(null); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const togglePengaturan = async (p: Pengaturan, key: "butuhWali" | "butuhMusyrif" | "butuhAdmin" | "aktif") => {
    const baru = { ...p, [key]: !p[key] }
    setPengaturan((ps) => ps.map((x) => (x.jenis === p.jenis ? baru : x)))
    try {
      await simpanPengaturanIzinAction(p.jenis as never, { butuhWali: baru.butuhWali, butuhMusyrif: baru.butuhMusyrif, butuhAdmin: baru.butuhAdmin, aktif: baru.aktif })
      toast.success("Pengaturan tersimpan")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal"); setPengaturan((ps) => ps.map((x) => (x.jenis === p.jenis ? p : x))) }
  }

  const tambahAsrama = async () => {
    if (formAsrama.nama.trim().length < 2) return toast.error("Nama asrama minimal 2 karakter")
    setLoading(true)
    try {
      await createAsramaAction({ nama: formAsrama.nama, deskripsi: formAsrama.deskripsi })
      toast.success("Asrama dibuat"); setFormAsrama({ nama: "", deskripsi: "" })
      setAsrama(await getAsramaOpts() as never)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const tambahKamar = async () => {
    if (!formKamar || formKamar.nama.trim().length < 1) return toast.error("Nama kamar wajib")
    setLoading(true)
    try {
      await createKamarAction(formKamar.asramaId, { nama: formKamar.nama, kapasitas: formKamar.kapasitas ? Number(formKamar.kapasitas) : null })
      toast.success("Kamar dibuat"); setFormKamar(null)
      setAsrama(await getAsramaOpts() as never)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const selesaikanKonflik = async (id: string) => {
    setLoading(true)
    try {
      await resolveKonflikAbsensiAction(id)
      toast.success("Konflik ditandai selesai"); setKonflik((k) => k.filter((x) => x.id !== id))
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const s = statistik
  return (
    <Tabs defaultValue="antrean">
      <TabsList>
        <TabsTrigger value="antrean">Antrean ({antrean.length})</TabsTrigger>
        <TabsTrigger value="statistik">Statistik</TabsTrigger>
        <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
        <TabsTrigger value="pengaturan">Pengaturan</TabsTrigger>
        <TabsTrigger value="asrama">Asrama & Kamar</TabsTrigger>
        {konflik.length > 0 && <TabsTrigger value="konflik" className="text-red-600">Konflik ({konflik.length})</TabsTrigger>}
      </TabsList>

      <TabsContent value="antrean" className="space-y-4 mt-4">
        {antrean.length === 0 && <p className="text-sm text-gray-500 text-center py-8">Tidak ada izin menunggu keputusan admin pondok.</p>}
        {antrean.map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{r.santri.nama}</span>
                  <span className="text-xs text-gray-400 ml-2">{r.santri.nisNo ?? "-"} • {r.santri.asrama?.nama ?? "-"} / {r.santri.kamar?.nama ?? "-"}</span>
                  <div className="text-sm">{JENIS_IZIN_LABEL[r.jenis] ?? r.jenis}</div>
                </div>
                <BadgeIzin status={r.status} />
              </div>
              <p className="text-sm text-gray-600">{r.alasan}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500">
                <div>Keluar: {fmtTanggal(r.rencanaKeluar)}</div>
                <div>Kembali: {fmtTanggal(r.rencanaKembali)}</div>
                <div>Tujuan: {r.alamatTujuan}</div>
                <div>Penjemput: {r.namaPenjemput} — {r.noTelpPenjemput}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={loading} onClick={() => setDialog({ mode: "setuju", id: r.id, teks: "" })}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} className="mr-1" />}Setujui & Terbitkan Surat
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDialog({ mode: "tolak", id: r.id, teks: "" })}>
                  <XCircle size={14} className="mr-1" />Tolak
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="statistik" className="mt-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "Total Santri Aktif", value: s.totalSantri, cls: "" }, { label: "Di Pondok", value: s.diPondok, cls: "text-green-600" },
            { label: "Izin Disetujui", value: s.izinAktif, cls: "text-amber-600" }, { label: "Menunggu Persetujuan", value: s.menunggu, cls: "text-violet-600" },
            { label: "Sedang Pulang", value: s.sedangPulang, cls: "text-orange-600" }, { label: "Terlambat Kembali", value: s.terlambat, cls: "text-red-600" },
          ].map((k) => (
            <Card key={k.label}><CardContent className="pt-4 text-center">
              <div className={`text-3xl font-bold ${k.cls}`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-1">{k.label}</div>
            </CardContent></Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="riwayat" className="mt-4 space-y-3">
        {riwayat.map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <span className="font-medium">{r.santri.nama}</span> ({r.santri.nisNo ?? "-"}) — {JENIS_IZIN_LABEL[r.jenis] ?? r.jenis}
                <div className="text-xs text-gray-500">{fmtTanggal(r.rencanaKeluar)} → {fmtTanggal(r.rencanaKembali)} • Diajukan {fmtTanggal(r.createdAt)}</div>
                {r.suratNomor && <div className="text-xs text-gray-500">Surat: {r.suratNomor}</div>}
                {r.alasanKeputusan && <div className="text-xs text-red-600 mt-1">{r.alasanKeputusan}</div>}
              </div>
              <div className="flex items-center gap-2">
                <BadgeIzin status={r.status} />
                {r.suratNomor && <a href={`/api/izin/surat/${r.id}`} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">Surat PDF</a>}
              </div>
            </CardContent>
          </Card>
        ))}
        {riwayat.length === 0 && <p className="text-sm text-gray-500 text-center py-8">Belum ada riwayat.</p>}
      </TabsContent>

      <TabsContent value="pengaturan" className="mt-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Tahap Persetujuan per Jenis Izin</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">Admin dapat mengatur apakah suatu jenis izin memerlukan satu atau beberapa tingkat persetujuan. Nonaktifkan jenis izin untuk menutup pendaftaran jenis tersebut.</p>
            {pengaturan.map((p) => (
              <div key={p.jenis} className="flex flex-wrap items-center justify-between gap-3 border rounded-lg p-3">
                <span className="text-sm font-medium">{JENIS_IZIN_LABEL[p.jenis] ?? p.jenis}</span>
                <div className="flex flex-wrap gap-3">
                  {(["butuhWali", "butuhMusyrif", "butuhAdmin"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={p[k]} onChange={() => togglePengaturan(p, k)} className="rounded" />
                      {HUB_LABEL[k]}
                    </label>
                  ))}
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={p.aktif} onChange={() => togglePengaturan(p, "aktif")} className="rounded" />
                    Aktif
                  </label>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="asrama" className="mt-4 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Tambah Asrama</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1"><Label>Nama Asrama</Label><Input value={formAsrama.nama} onChange={(e) => setFormAsrama({ ...formAsrama, nama: e.target.value })} placeholder="e.g. Asrama Al-Fatih" /></div>
            <div className="space-y-1 flex-1 min-w-[200px]"><Label>Deskripsi</Label><Input value={formAsrama.deskripsi} onChange={(e) => setFormAsrama({ ...formAsrama, deskripsi: e.target.value })} /></div>
            <Button onClick={tambahAsrama} disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} className="mr-1" />}Buat</Button>
          </CardContent>
        </Card>
        {asrama.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Building2 size={16} />{a.nama}</CardTitle>
              {a.musyrif && <p className="text-xs text-gray-500">Musyrif pembina: {a.musyrif.nama}</p>}
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {a.kamars.map((k) => (
                  <Badge key={k.id} variant="outline">{k.nama}{k.kapasitas ? ` (${k.kapasitas})` : ""}</Badge>
                ))}
                {a.kamars.length === 0 && <span className="text-xs text-gray-400">Belum ada kamar</span>}
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <Input placeholder="Nama kamar baru" className="w-40" value={formKamar?.asramaId === a.id ? formKamar.nama : ""} onChange={(e) => setFormKamar({ asramaId: a.id, nama: e.target.value, kapasitas: formKamar?.asramaId === a.id ? formKamar.kapasitas : "" })} />
                <Input placeholder="Kapasitas" className="w-24" type="number" value={formKamar?.asramaId === a.id ? formKamar.kapasitas : ""} onChange={(e) => setFormKamar({ asramaId: a.id, nama: formKamar?.asramaId === a.id ? formKamar.nama : "", kapasitas: e.target.value })} />
                <Button size="sm" variant="outline" onClick={tambahKamar} disabled={loading || formKamar?.asramaId !== a.id}>+ Kamar</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="konflik" className="mt-4 space-y-3">
        <p className="text-xs text-gray-500">Santri yang tercatat HADIR pada absensi padahal sedang dalam masa izin keluar pondok. Perlu pemeriksaan — absensi aktual tidak diubah otomatis.</p>
        {konflik.map((k) => (
          <Card key={k.id}>
            <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <div className="flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" /><span className="font-medium">{k.siswa.nama}</span> ({k.siswa.nis ?? "-"})</div>
                <p className="text-xs text-gray-600 mt-1">{k.catatan}</p>
                <p className="text-xs text-gray-400">Izin {JENIS_IZIN_LABEL[k.izin.jenis] ?? k.izin.jenis} ({k.izin.suratNomor ?? "-"}) — batas kembali {fmtTanggal(k.izin.rencanaKembali)} • Tanggal {fmtTanggal(k.tanggal)}</p>
              </div>
              <Button size="sm" variant="outline" disabled={loading} onClick={() => selesaikanKonflik(k.id)}>Tandai Selesai</Button>
            </CardContent>
          </Card>
        ))}
        {konflik.length === 0 && <p className="text-sm text-gray-500 text-center py-8">Tidak ada konflik.</p>}
      </TabsContent>

      {dialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDialog(null)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardContent className="pt-6 space-y-3">
              <p className="font-medium">{dialog.mode === "setuju" ? "Keputusan Akhir Admin Pondok" : "Tolak Izin"}</p>
              {dialog.mode === "setuju" && <p className="text-sm text-gray-600">Surat izin digital dengan QR verifikasi akan diterbitkan otomatis. Santri masih tercatat di pondok sampai check-out dikonfirmasi petugas gerbang.</p>}
              <textarea value={dialog.teks} onChange={(e) => setDialog({ ...dialog, teks: e.target.value })} rows={3} placeholder={dialog.mode === "tolak" ? "Alasan penolakan (wajib)" : "Catatan (opsional)"} className="w-full rounded-md border border-gray-200 p-2 text-sm" />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
                <Button variant={dialog.mode === "tolak" ? "destructive" : "default"} onClick={aksi} disabled={loading}>
                  {loading && <Loader2 size={14} className="mr-1 animate-spin" />}Konfirmasi
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Tabs>
  )
}
