"use client"

import { useState } from "react"
import { toast } from "react-hot-toast"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BadgeIzin, BadgeKeberadaan, fmtTanggal, JENIS_IZIN_LABEL } from "@/components/izin/izin-badges"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { setujuiIzinMusyrifAction, tolakIzinMusyrifAction } from "../actions"

interface IzinRow {
  id: string; jenis: string; alasan: string; status: string
  rencanaKeluar: string; rencanaKembali: string; alamatTujuan: string
  namaPenjemput: string; noTelpPenjemput: string; suratNomor: string | null
  checkoutAt: string | null; checkinAt: string | null; alasanKeputusan: string | null
  santri: { nama: string; nisNo: string | null; asrama: { nama: string } | null; kamar: { nama: string } | null }
}

interface Monitoring {
  statistik: { totalSantri: number; diPondok: number; izinAktif: number; menunggu: number; sedangPulang: number; terlambat: number }
  diPondok: { id: string; nama: string; nisNo: string | null; asrama: { nama: string } | null; kamar: { nama: string } | null }[]
  sedangIzin: { id: string; nama: string; nisNo: string | null; keberadaan: string; asrama: { nama: string } | null; izins: { id: string; rencanaKembali: string; suratNomor: string | null; jenis: string }[] }[]
  terlambat: { id: string; nama: string; nisNo: string | null; asrama: { nama: string } | null; izins: { id: string; rencanaKembali: string; suratNomor: string | null }[] }[]
}

export function IzinMusyrifUI({ antrean, monitoring }: { antrean: IzinRow[]; monitoring: Monitoring }) {
  const [rows, setRows] = useState(antrean)
  const [loading, setLoading] = useState(false)
  const [dialog, setDialog] = useState<{ mode: "setuju" | "tolak"; id: string; teks: string } | null>(null)
  const router = useRouter()

  const aksi = async () => {
    if (!dialog) return
    if (dialog.mode === "tolak" && dialog.teks.trim().length < 5) return toast.error("Alasan minimal 5 karakter")
    setLoading(true)
    try {
      if (dialog.mode === "setuju") { await setujuiIzinMusyrifAction(dialog.id, dialog.teks || undefined); toast.success("Disetujui musyrif") }
      else { await tolakIzinMusyrifAction(dialog.id, dialog.teks); toast.success("Ditolak") }
      setDialog(null); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const s = monitoring.statistik

  return (
    <Tabs defaultValue="antrean">
      <TabsList>
        <TabsTrigger value="antrean">Antrean Persetujuan ({rows.length})</TabsTrigger>
        <TabsTrigger value="monitoring">Monitoring Pondok</TabsTrigger>
      </TabsList>

      <TabsContent value="antrean" className="space-y-4 mt-4">
        {rows.length === 0 && <p className="text-sm text-gray-500 text-center py-8">Tidak ada izin yang menunggu persetujuan musyrif.</p>}
        {rows.map((r) => (
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
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} className="mr-1" />}Setujui
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDialog({ mode: "tolak", id: r.id, teks: "" })}>
                  <XCircle size={14} className="mr-1" />Tolak
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="monitoring" className="mt-4 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "Total Santri", value: s.totalSantri }, { label: "Di Pondok", value: s.diPondok },
            { label: "Izin Disetujui", value: s.izinAktif }, { label: "Menunggu", value: s.menunggu },
            { label: "Sedang Pulang", value: s.sedangPulang }, { label: "Terlambat", value: s.terlambat },
          ].map((k) => (
            <Card key={k.label}><CardContent className="pt-4 text-center">
              <div className={`text-2xl font-bold ${k.label === "Terlambat" && k.value > 0 ? "text-red-600" : ""}`}>{k.value}</div>
              <div className="text-xs text-gray-500">{k.label}</div>
            </CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Santri Sedang Izin ({monitoring.sedangIzin.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {monitoring.sedangIzin.map((sn) => (
              <div key={sn.id} className="flex flex-wrap items-center justify-between gap-2 text-sm border-b pb-2 last:border-0">
                <div>{sn.nama} <span className="text-xs text-gray-400">({sn.nisNo ?? "-"})</span></div>
                <div className="flex items-center gap-2">
                  <BadgeKeberadaan keberadaan={sn.keberadaan} />
                  {sn.izins[0] && <span className="text-xs text-gray-500">Batas kembali: {fmtTanggal(sn.izins[0].rencanaKembali)}</span>}
                </div>
              </div>
            ))}
            {monitoring.sedangIzin.length === 0 && <p className="text-sm text-gray-500">Tidak ada santri sedang izin.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base text-red-600">Terlambat Kembali ({monitoring.terlambat.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {monitoring.terlambat.map((sn) => (
              <div key={sn.id} className="flex flex-wrap items-center justify-between gap-2 text-sm border-b pb-2 last:border-0">
                <div className="text-red-700">{sn.nama} <span className="text-xs">({sn.nisNo ?? "-"})</span></div>
                {sn.izins[0] && <span className="text-xs text-red-600">Batas kembali: {fmtTanggal(sn.izins[0].rencanaKembali)}</span>}
              </div>
            ))}
            {monitoring.terlambat.length === 0 && <p className="text-sm text-gray-500">Tidak ada keterlambatan. Alhamdulillah.</p>}
          </CardContent>
        </Card>
      </TabsContent>

      {dialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDialog(null)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardContent className="pt-6 space-y-3">
              <p className="font-medium">{dialog.mode === "setuju" ? "Setujui sebagai Musyrif" : "Tolak Izin"}</p>
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
