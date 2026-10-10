"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BadgeIzin, BadgeKeberadaan, fmtTanggal, JENIS_IZIN_LABEL } from "@/components/izin/izin-badges"
import { Loader2, Plus, FileDown, XCircle, MapPin, Clock, UserCheck } from "lucide-react"
import {
  getIzinSayaAction, ajukanIzinAction, batalkanIzinAction, konfirmasiPerjalananAction, getJenisIzinOpts,
} from "../actions"

interface IzinRow {
  id: string; jenis: string; alasan: string; status: string
  rencanaKeluar: string; rencanaKembali: string; alamatTujuan: string
  namaPenjemput: string; hubunganPenjemput: string; noTelpPenjemput: string
  suratNomor: string | null; suratToken: string | null
  checkoutAt: string | null; checkinAt: string | null; perjalananConfirmedAt: string | null
  alasanKeputusan: string | null; createdAt: string
}

interface SantriInfo {
  nama: string; nisNo: string | null; status: string; keberadaan: string
  asrama: { nama: string } | null; kamar: { nama: string } | null
}

const HUBUNGAN = [
  { value: "AYAH", label: "Ayah" }, { value: "IBU", label: "Ibu" },
  { value: "WALI", label: "Wali" }, { value: "LAINNYA", label: "Lainnya" },
]

const kosong = {
  jenis: "", alasan: "", rencanaKeluar: "", rencanaKembali: "",
  alamatTujuan: "", namaPenjemput: "", hubunganPenjemput: "AYAH", noTelpPenjemput: "",
}

export function IzinSantriUI({ initialSantri, initialRows }: { initialSantri: SantriInfo; initialRows: IzinRow[] }) {
  const [santri] = useState(initialSantri)
  const [rows, setRows] = useState(initialRows)
  const [form, setForm] = useState(kosong)
  const [jenisOpts, setJenisOpts] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogBatal, setDialogBatal] = useState<{ id: string; alasan: string } | null>(null)

  useEffect(() => {
    getJenisIzinOpts().then((o: { value: string; label: string }[]) => {
      setJenisOpts(o)
      if (o.length > 0 && !form.jenis) setForm((f) => ({ ...f, jenis: o[0].value }))
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = useCallback(async () => {
    try {
      const d = await getIzinSayaAction()
      setRows(d.rows as unknown as IzinRow[])
    } catch { /* diam */ }
  }, [])

  const set = (k: keyof typeof kosong) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (mode: "draft" | "ajukan") => {
    if (!form.jenis) return toast.error("Pilih jenis izin")
    if (form.alasan.trim().length < 10) return toast.error("Alasan minimal 10 karakter")
    if (!form.rencanaKeluar || !form.rencanaKembali) return toast.error("Isi waktu keluar & kembali")
    if (new Date(form.rencanaKembali) <= new Date(form.rencanaKeluar)) return toast.error("Waktu kembali harus setelah keluar")
    if (form.alamatTujuan.trim().length < 5) return toast.error("Alamat tujuan minimal 5 karakter")
    if (form.namaPenjemput.trim().length < 3) return toast.error("Nama penjemput minimal 3 karakter")
    if (!/^\d{9,15}$/.test(form.noTelpPenjemput.replace(/[\s-]/g, ""))) return toast.error("No. HP penjemput tidak valid")

    setLoading(true)
    try {
      if (mode === "draft") {
        await ajukanIzinAction({ ...form } as never, undefined)
        toast.success("Draft izin tersimpan")
      } else {
        await ajukanIzinAction({ ...form } as never)
        toast.success("Izin berhasil diajukan — menunggu persetujuan wali")
        setForm(kosong)
      }
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengajukan izin")
    } finally { setLoading(false) }
  }

  const batalkan = async () => {
    if (!dialogBatal) return
    if (dialogBatal.alasan.trim().length < 5) return toast.error("Alasan pembatalan minimal 5 karakter")
    setLoading(true)
    try {
      await batalkanIzinAction(dialogBatal.id, dialogBatal.alasan)
      toast.success("Izin dibatalkan")
      setDialogBatal(null)
      await refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const konfirmasi = async (id: string) => {
    setLoading(true)
    try {
      await konfirmasiPerjalananAction(id)
      toast.success("Konfirmasi tiba di tujuan tercatat")
      await refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const izinAktif = rows.find((r) => ["DISETUJUI", "MENUNGGU_WALI", "MENUNGGU_MUSYRIF", "MENUNGGU_ADMIN", "DIAJUKU"].includes(r.status))
  const adaIzinAktif = Boolean(izinAktif && ["DIAJUKU", "MENUNGGU_WALI", "MENUNGGU_MUSYRIF", "MENUNGGU_ADMIN", "DISETUJUI"].includes(izinAktif.status))

  return (
    <div className="space-y-6">
      {/* Status singkat */}
      <Card>
        <CardHeader><CardTitle className="text-base">Status Saat Ini</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2"><span className="text-sm text-gray-500">Keberadaan:</span><BadgeKeberadaan keberadaan={santri.keberadaan} /></div>
          <div className="flex items-center gap-2"><span className="text-sm text-gray-500">Izin aktif:</span>{izinAktif ? <BadgeIzin status={izinAktif.status} /> : <span className="text-sm text-gray-400">Tidak ada</span>}</div>
          {izinAktif?.status === "DISETUJUI" && !izinAktif.checkoutAt && (
            <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full">Izin Pulang Disetujui — masih di pondok sampai check-out petugas</span>
          )}
          {izinAktif?.checkoutAt && !izinAktif.checkinAt && (
            <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full">Sedang keluar pondok — batas kembali {fmtTanggal(izinAktif.rencanaKembali)}</span>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-500"><MapPin size={14} />{santri.asrama?.nama ?? "-"} / {santri.kamar?.nama ?? "-"}</div>
        </CardContent>
      </Card>

      <Tabs defaultValue="riwayat">
        <TabsList>
          <TabsTrigger value="riwayat">Riwayat Izin</TabsTrigger>
          <TabsTrigger value="ajukan" disabled={adaIzinAktif}>Ajukan Izin Baru</TabsTrigger>
        </TabsList>

        <TabsContent value="riwayat" className="space-y-4">
          {rows.length === 0 && <p className="text-sm text-gray-500 text-center py-8">Belum ada riwayat izin.</p>}
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{JENIS_IZIN_LABEL[r.jenis] ?? r.jenis}</div>
                  <BadgeIzin status={r.status} />
                </div>
                <p className="text-sm text-gray-600">{r.alasan}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1"><Clock size={12} />Keluar: {fmtTanggal(r.rencanaKeluar)}</div>
                  <div className="flex items-center gap-1"><Clock size={12} />Kembali: {fmtTanggal(r.rencanaKembali)}</div>
                  <div className="flex items-center gap-1"><MapPin size={12} />{r.alamatTujuan}</div>
                  <div className="flex items-center gap-1"><UserCheck size={12} />Penjemput: {r.namaPenjemput} ({r.hubunganPenjemput})</div>
                </div>
                {r.alasanKeputusan && <p className="text-xs text-red-600">Alasan: {r.alasanKeputusan}</p>}
                {r.suratNomor && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Surat: {r.suratNomor}</span>
                    <a href={`/api/izin/surat/${r.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                      <FileDown size={12} /> Unduh PDF
                    </a>
                  </div>
                )}
                {r.checkoutAt && <p className="text-xs text-gray-500">Check-out: {fmtTanggal(r.checkoutAt)}{r.checkinAt ? ` • Check-in: ${fmtTanggal(r.checkinAt)}` : ""}</p>}
                <div className="flex gap-2">
                  {r.status === "DISETUJUI" && r.checkoutAt && !r.checkinAt && !r.perjalananConfirmedAt && (
                    <Button size="sm" variant="outline" disabled={loading} onClick={() => konfirmasi(r.id)}>Konfirmasi Tiba di Tujuan</Button>
                  )}
                  {["DRAFT", "DIAJUKU", "MENUNGGU_WALI", "MENUNGGU_MUSYRIF", "MENUNGGU_ADMIN", "DISETUJUI"].includes(r.status) && !r.checkoutAt && (
                    <Button size="sm" variant="destructive" onClick={() => setDialogBatal({ id: r.id, alasan: "" })}><XCircle size={14} className="mr-1" />Batalkan</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="ajukan">
          <Card>
            <CardHeader><CardTitle className="text-base">Formulir Pengajuan Izin</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Nama / NIS</Label><Input value={`${santri.nama} (${santri.nisNo ?? "-"})`} disabled /></div>
                <div className="space-y-1"><Label>Jenis Izin</Label>
                  <select value={form.jenis} onChange={set("jenis")} className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm">
                    {jenisOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1"><Label>Alasan Izin</Label><Textarea value={form.alasan} onChange={set("alasan")} placeholder="Jelaskan alasan izin (min. 10 karakter)" rows={2} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Rencana Keluar</Label><Input type="datetime-local" value={form.rencanaKeluar} onChange={set("rencanaKeluar")} /></div>
                <div className="space-y-1"><Label>Rencana Kembali</Label><Input type="datetime-local" value={form.rencanaKembali} onChange={set("rencanaKembali")} /></div>
              </div>
              <div className="space-y-1"><Label>Alamat Tujuan</Label><Input value={form.alamatTujuan} onChange={set("alamatTujuan")} placeholder="Alamat lengkap tujuan" /></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1"><Label>Nama Penjemput</Label><Input value={form.namaPenjemput} onChange={set("namaPenjemput")} /></div>
                <div className="space-y-1"><Label>Hubungan</Label>
                  <select value={form.hubunganPenjemput} onChange={set("hubunganPenjemput")} className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm">
                    {HUBUNGAN.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><Label>No. HP Penjemput</Label><Input value={form.noTelpPenjemput} onChange={set("noTelpPenjemput")} placeholder="08xxxxxxxxxx" /></div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => submit("ajukan")} disabled={loading}>
                  {loading && <Loader2 size={16} className="mr-2 animate-spin" />}Ajukan Izin
                </Button>
                <Button variant="outline" onClick={() => submit("draft")} disabled={loading}>Simpan Draft</Button>
              </div>
              <p className="text-xs text-gray-400">Setelah diajukan, izin memerlukan persetujuan wali, musyrif, dan admin pondok (sesuai pengaturan). Surat izin digital terbit otomatis bila seluruh tahap disetujui.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog batalkan */}
      {dialogBatal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDialogBatal(null)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle className="text-base">Batalkan Izin</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>Alasan Pembatalan</Label>
              <Textarea value={dialogBatal.alasan} onChange={(e) => setDialogBatal({ ...dialogBatal, alasan: e.target.value })} rows={3} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDialogBatal(null)}>Kembali</Button>
                <Button variant="destructive" onClick={batalkan} disabled={loading}>{loading && <Loader2 size={14} className="mr-1 animate-spin" />}Batalkan Izin</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
