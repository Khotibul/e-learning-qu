"use client"

import { useState } from "react"
import { toast } from "react-hot-toast"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BadgeIzin, fmtTanggal, JENIS_IZIN_LABEL } from "@/components/izin/izin-badges"
import { Loader2, CheckCircle, XCircle, FileDown } from "lucide-react"
import { setujuiIzinWaliAction, tolakIzinWaliAction } from "../actions"

interface IzinRow {
  id: string; jenis: string; alasan: string; status: string
  rencanaKeluar: string; rencanaKembali: string; alamatTujuan: string
  namaPenjemput: string; hubunganPenjemput: string; noTelpPenjemput: string
  suratNomor: string | null; checkoutAt: string | null; checkinAt: string | null
  alasanKeputusan: string | null; createdAt: string
  santri: { nama: string; nisNo: string | null }
}

export function IzinWaliUI({ initialRows }: { initialRows: IzinRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [loading, setLoading] = useState(false)
  const [dialog, setDialog] = useState<{ mode: "setuju" | "tolak"; id: string; teks: string } | null>(null)
  const router = useRouter()

  const aksi = async () => {
    if (!dialog) return
    if (dialog.mode === "tolak" && dialog.teks.trim().length < 5) return toast.error("Alasan penolakan minimal 5 karakter")
    setLoading(true)
    try {
      if (dialog.mode === "setuju") {
        await setujuiIzinWaliAction(dialog.id, dialog.teks || undefined)
        toast.success("Persetujuan wali tercatat")
      } else {
        await tolakIzinWaliAction(dialog.id, dialog.teks)
        toast.success("Izin ditolak")
      }
      setDialog(null)
      router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const menunggu = rows.filter((r) => r.status === "MENUNGGU_WALI")
  const lain = rows.filter((r) => r.status !== "MENUNGGU_WALI")

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-3">Menunggu Persetujuan Anda</h2>
        {menunggu.length === 0 && <p className="text-sm text-gray-500">Tidak ada izin yang menunggu persetujuan.</p>}
        <div className="space-y-4">
          {menunggu.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{r.santri.nama}</span>
                    <span className="text-xs text-gray-400 ml-2">({r.santri.nisNo ?? "-"})</span>
                    <div className="text-sm">{JENIS_IZIN_LABEL[r.jenis] ?? r.jenis}</div>
                  </div>
                  <BadgeIzin status={r.status} />
                </div>
                <p className="text-sm text-gray-600">{r.alasan}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500">
                  <div>Keluar: {fmtTanggal(r.rencanaKeluar)}</div>
                  <div>Kembali: {fmtTanggal(r.rencanaKembali)}</div>
                  <div>Tujuan: {r.alamatTujuan}</div>
                  <div>Penjemput: {r.namaPenjemput} ({r.hubunganPenjemput}) — {r.noTelpPenjemput}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={loading} onClick={() => setDialog({ mode: "setuju", id: r.id, teks: "" })}>
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} className="mr-1" />}Setujui (Tanda Tangan Elektronik)
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDialog({ mode: "tolak", id: r.id, teks: "" })}>
                    <XCircle size={14} className="mr-1" />Tolak
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Riwayat</h2>
        <div className="space-y-3">
          {lain.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <span className="font-medium">{r.santri.nama}</span> — {JENIS_IZIN_LABEL[r.jenis] ?? r.jenis}
                  <div className="text-xs text-gray-500">{fmtTanggal(r.rencanaKeluar)} → {fmtTanggal(r.rencanaKembali)}</div>
                  {r.alasanKeputusan && <div className="text-xs text-red-600 mt-1">{r.alasanKeputusan}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <BadgeIzin status={r.status} />
                  {r.suratNomor && (
                    <a href={`/api/izin/surat/${r.id}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs inline-flex items-center gap-1">
                      <FileDown size={12} />Surat
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {lain.length === 0 && <p className="text-sm text-gray-500">Belum ada riwayat.</p>}
        </div>
      </section>

      {dialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDialog(null)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardContent className="pt-6 space-y-3">
              <p className="font-medium">{dialog.mode === "setuju" ? "Persetujuan Wali (Tanda Tangan Elektronik)" : "Tolak Izin"}</p>
              {dialog.mode === "setuju" ? (
                <p className="text-sm text-gray-600">Dengan menyetujui, Anda memberikan persetujuan elektronik sebagai wali/wali murid. Persetujuan ini tercatat permanen dengan waktu dan identitas akun Anda.</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">Alasan penolakan:</p>
                  <textarea value={dialog.teks} onChange={(e) => setDialog({ ...dialog, teks: e.target.value })} rows={3} className="w-full rounded-md border border-gray-200 p-2 text-sm" />
                </>
              )}
              {dialog.mode === "setuju" && (
                <textarea value={dialog.teks} onChange={(e) => setDialog({ ...dialog, teks: e.target.value })} rows={2} placeholder="Catatan (opsional)" className="w-full rounded-md border border-gray-200 p-2 text-sm" />
              )}
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
    </div>
  )
}
