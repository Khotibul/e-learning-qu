"use client"

import { useState } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BadgeIzin, BadgeKeberadaan, fmtTanggal, fmtJam, JENIS_IZIN_LABEL } from "@/components/izin/izin-badges"
import { Loader2, Search, LogOut, LogIn, ScanLine, ShieldCheck } from "lucide-react"
import { cariIzinAktifAction, checkoutAction, checkinAction, getRiwayatGerbangAction } from "../actions"

interface IzinRow {
  id: string; jenis: string; status: string; alasan: string
  rencanaKeluar: string; rencanaKembali: string; alamatTujuan: string
  namaPenjemput: string; hubunganPenjemput: string; noTelpPenjemput: string
  suratNomor: string | null; suratToken: string | null; suratExpiresAt: string | null
  checkoutAt: string | null; checkinAt: string | null
  santri: { id: string; nama: string; nisNo: string | null; keberadaan: string; asrama: { nama: string } | null; kamar: { nama: string } | null }
}

export function GerbangUI() {
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState<IzinRow[]>([])
  const [riwayat, setRiwayat] = useState<IzinRow[]>([])
  const [loading, setLoading] = useState(false)
  const [verifikasiPenjemput, setVerifikasiPenjemput] = useState(false)

  const cari = async (q?: string) => {
    const nilai = (q ?? query).trim()
    if (nilai.length < 2) return toast.error("Minimal 2 karakter (NIS / nama / token / no. surat)")
    setLoading(true)
    try {
      const d = await cariIzinAktifAction(nilai)
      setRows(d.rows as never)
      if (d.rows.length === 0) toast("Izin tidak ditemukan", { icon: "⚠️" })
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const muatRiwayat = async () => {
    setLoading(true)
    try { const d = await getRiwayatGerbangAction(); setRiwayat(d.rows as never) }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const checkout = async (izinId: string) => {
    setLoading(true)
    try {
      await checkoutAction({ izinId }, verifikasiPenjemput)
      toast.success("Check-out tercatat — status keberadaan diperbarui")
      await cari()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const checkin = async (izinId: string) => {
    setLoading(true)
    try {
      await checkinAction(izinId)
      toast.success("Check-in tercatat — santri kembali DI PONDOK")
      await cari()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal") } finally { setLoading(false) }
  }

  const scanQR = async () => {
    const token = prompt("Tempel hasil scan QR atau masukkan token izin:")
    if (!token) return
    await cari(token.trim())
  }

  return (
    <Tabs defaultValue="gerbang" onValueChange={(v) => { if (v === "riwayat") void muatRiwayat() }}>
      <TabsList>
        <TabsTrigger value="gerbang">Gerbang</TabsTrigger>
        <TabsTrigger value="riwayat">Riwayat Keluar/Masuk</TabsTrigger>
      </TabsList>

      <TabsContent value="gerbang" className="mt-4 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Cari Izin Aktif</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="NIS / nama santri / token QR / no. surat" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && cari()} className="flex-1 min-w-[240px]" />
              <Button onClick={() => cari()} disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} className="mr-1" />}Cari</Button>
              <Button variant="outline" onClick={scanQR}><ScanLine size={16} className="mr-1" />Scan QR</Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={verifikasiPenjemput} onChange={(e) => setVerifikasiPenjemput(e.target.checked)} className="rounded" />
              <ShieldCheck size={14} /> Identitas penjemput sudah diverifikasi
            </label>
          </CardContent>
        </Card>

        {rows.map((r) => {
          const bolehCheckout = r.status === "DISETUJUI" && !r.checkoutAt
          const bolehCheckin = r.status === "DISETUJUI" && r.checkoutAt && !r.checkinAt
          const kedaluwarsa = r.suratExpiresAt && new Date(r.suratExpiresAt).getTime() < Date.now()
          return (
            <Card key={r.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-lg">{r.santri.nama}</div>
                    <div className="text-xs text-gray-400">{r.santri.nisNo ?? "-"} • {r.santri.asrama?.nama ?? "-"} / {r.santri.kamar?.nama ?? "-"}</div>
                    <div className="text-sm mt-1">{JENIS_IZIN_LABEL[r.jenis] ?? r.jenis}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <BadgeIzin status={r.status} />
                    <BadgeKeberadaan keberadaan={r.santri.keberadaan} />
                    {kedaluwarsa && <span className="text-xs text-red-600 font-medium">QR KEDALUWARSA</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500">
                  <div>Surat: {r.suratNomor ?? "-"}</div>
                  <div>Berlaku s/d: {fmtTanggal(r.suratExpiresAt)}</div>
                  <div>Kembali: {fmtTanggal(r.rencanaKembali)}</div>
                  <div>Penjemput: {r.namaPenjemput} ({r.hubunganPenjemput}) — {r.noTelpPenjemput}</div>
                </div>
                {r.checkoutAt && <p className="text-xs text-gray-600">Check-out: {fmtTanggal(r.checkoutAt)}</p>}
                {r.checkinAt && <p className="text-xs text-green-700">Check-in: {fmtTanggal(r.checkinAt)}</p>}
                <div className="flex gap-2">
                  {bolehCheckout && !kedaluwarsa && (
                    <Button size="sm" disabled={loading} onClick={() => checkout(r.id)}><LogOut size={14} className="mr-1" />Konfirmasi Keluar</Button>
                  )}
                  {bolehCheckin && (
                    <Button size="sm" variant="outline" disabled={loading} onClick={() => checkin(r.id)}><LogIn size={14} className="mr-1" />Konfirmasi Kembali</Button>
                  )}
                  {r.status === "DISETUJUI" && !r.checkoutAt && kedaluwarsa && (
                    <span className="text-xs text-red-600 self-center">Surat kedaluwarsa — hubungi admin pondok.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </TabsContent>

      <TabsContent value="riwayat" className="mt-4 space-y-3">
        {riwayat.length === 0 && !loading && <p className="text-sm text-gray-500 text-center py-8">Belum ada riwayat keluar/masuk.</p>}
        {riwayat.map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <span className="font-medium">{r.santri.nama}</span> ({r.santri.nisNo ?? "-"}) — {JENIS_IZIN_LABEL[r.jenis] ?? r.jenis}
                <div className="text-xs text-gray-500">Keluar: {fmtJam(r.checkoutAt)} {r.checkinAt ? `• Kembali: ${fmtJam(r.checkinAt)}` : "• Belum kembali"}</div>
              </div>
              <div className="flex items-center gap-2">
                <BadgeIzin status={r.status} />
                {r.checkinAt ? <span className="text-xs text-green-600">SELESAI</span> : r.checkoutAt ? <span className="text-xs text-amber-600">DI LUAR</span> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>
    </Tabs>
  )
}
