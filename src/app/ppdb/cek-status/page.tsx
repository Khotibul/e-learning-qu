"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, ArrowLeft, ClipboardList } from "lucide-react"
import { cekStatusPpdb } from "../actions"

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", TERKIRIM: "Terkirim", MENUNGGU_VERIFIKASI: "Menunggu Verifikasi",
  PERLU_PERBAIKAN: "Perlu Perbaikan", DIVERIFIKASI: "Terverifikasi", SELEKSI: "Seleksi",
  DITERIMA: "Diterima", CADANGAN: "Cadangan", TIDAK_DITERIMA: "Tidak Diterima", MENGUNDURKAN_DIRI: "Mengundurkan Diri",
}
const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  TERKIRIM: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  MENUNGGU_VERIFIKASI: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  PERLU_PERBAIKAN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  DIVERIFIKASI: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  SELEKSI: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  DITERIMA: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  CADANGAN: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  TIDAK_DITERIMA: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  MENGUNDURKAN_DIRI: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
}
const JENIS_LABEL: Record<string, string> = {
  SISWA_REGULER: "Siswa Reguler", SISWA_SANTRI: "Siswa Sekaligus Santri", SANTRI_PONDOK: "Santri Pondok",
}
const DOMAIN_LABEL: Record<string, string> = { FORMAL: "Sekolah Formal", PONDOK: "Program Pondok" }
const HASIL_LABEL: Record<string, string> = {
  DALAM_PROSES: "Dalam Proses", DITERIMA: "Diterima", CADANGAN: "Cadangan",
  TIDAK_DITERIMA: "Tidak Diterima", MENGUNDURKAN_DIRI: "Mengundurkan Diri",
}

interface Hasil {
  noPendaftaran: string | null
  jenis: string
  status: string
  gelombang: { nama: string; unit: string | null; jenjang: string | null; program: string | null }
  jalur: string | null
  submittedAt: string | null
  keputusan: { domain: string; hasil: string; decidedAt: string | null }[]
}

export default function CekStatusPage() {
  const [no, setNo] = useState("")
  const [loading, setLoading] = useState(false)
  const [hasil, setHasil] = useState<Hasil | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!no.trim()) return
    setLoading(true)
    setHasil(null)
    try {
      setHasil((await cekStatusPpdb(no)) as Hasil)
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengecek status")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/ppdb" className="flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="h-4 w-4" /> Kembali ke PPDB
          </Link>
          <Link href="/login" className="text-sm font-medium hover:underline">Masuk</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <ClipboardList className="mx-auto h-10 w-10 text-primary mb-3" />
          <h1 className="text-2xl sm:text-3xl font-bold">Cek Status Pendaftaran</h1>
          <p className="mt-2 text-muted-foreground text-sm">Masukkan nomor pendaftaran yang Anda terima setelah submit formulir.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
          <Input
            placeholder="Contoh: PPDB-2026-0001"
            value={no}
            onChange={(e) => setNo(e.target.value.toUpperCase())}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !no.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Cek</span>
          </Button>
        </form>

        {hasil && (
          <div className="mt-8 rounded-2xl border p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Nomor Pendaftaran</p>
                <p className="font-mono font-semibold text-lg">{hasil.noPendaftaran || "-"}</p>
              </div>
              <Badge className={STATUS_CLASS[hasil.status] || ""}>{STATUS_LABEL[hasil.status] || hasil.status}</Badge>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Jenis</dt><dd className="font-medium">{JENIS_LABEL[hasil.jenis] || hasil.jenis}</dd></div>
              <div><dt className="text-muted-foreground">Gelombang</dt><dd className="font-medium">{hasil.gelombang.nama}</dd></div>
              <div><dt className="text-muted-foreground">Unit/Jenjang</dt><dd>{[hasil.gelombang.unit, hasil.gelombang.jenjang].filter(Boolean).join(" · ") || "-"}</dd></div>
              <div><dt className="text-muted-foreground">Jalur</dt><dd>{hasil.jalur || "-"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted-foreground">Tanggal Submit</dt>
                <dd>{hasil.submittedAt ? new Date(hasil.submittedAt).toLocaleString("id-ID") : "Belum disubmit"}</dd></div>
            </dl>
            {hasil.keputusan.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Keputusan Seleksi</p>
                <div className="space-y-2">
                  {hasil.keputusan.map((k) => (
                    <div key={k.domain} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <span>{DOMAIN_LABEL[k.domain] || k.domain}</span>
                      <Badge className={k.hasil === "DITERIMA" ? STATUS_CLASS.DITERIMA : k.hasil === "TIDAK_DITERIMA" ? STATUS_CLASS.TIDAK_DITERIMA : STATUS_CLASS.CADANGAN}>
                        {HASIL_LABEL[k.hasil] || k.hasil}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
