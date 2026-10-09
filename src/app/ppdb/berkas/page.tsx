"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, Upload, Trash2, FileText, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react"
import { getBerkasSaya, sinkronBerkas, unggahBerkas, hapusBerkas, cekKelengkapanBerkas } from "../actions"

const STATUS_LABEL: Record<string, string> = {
  DIUNGGAH: "Terunggah",
  MENUNGGU_VERIFIKASI: "Menunggu Verifikasi",
  DIVERIFIKASI: "Terverifikasi",
  DITOLAK: "Ditolak",
  TIDAK_LENGKAP: "Belum Lengkap",
}

const STATUS_CLASS: Record<string, string> = {
  DIUNGGAH: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  MENUNGGU_VERIFIKASI: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  DIVERIFIKASI: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DITOLAK: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  TIDAK_LENGKAP: "bg-muted text-muted-foreground",
}

interface Berkas {
  id: string
  namaDokumen: string
  wajib: boolean
  status: string
  catatanPenolakan: string | null
  upload: { id: string; filename: string; mime: string; size: number } | null
}

export default function BerkasPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [cek, setCek] = useState<{ lengkap: boolean; kurang: string[] } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const muat = useCallback(async () => {
    const d = await getBerkasSaya() as any
    if (d) {
      await sinkronBerkas(d.gelombang.id).catch(() => {})
      const segar = (await getBerkasSaya()) as any
      setData(segar)
    }
    setLoading(false)
  }, [])

  useEffect(() => { muat() }, [muat])

  const handleUpload = async (berkasId: string, file: File) => {
    setUploading(berkasId)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("akses", "PRIVAT")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Upload gagal")
      await unggahBerkas(berkasId, json.url.split("/").pop()!)
      toast.success("Berkas terunggah")
      await muat()
    } catch (err: any) {
      toast.error(err?.message || "Upload gagal")
    } finally {
      setUploading(null)
    }
  }

  const handleHapus = async (berkasId: string) => {
    setDeleting(berkasId)
    try {
      await hapusBerkas(berkasId)
      toast.success("Berkas dihapus")
      await muat()
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus")
    } finally {
      setDeleting(null)
    }
  }

  const handleCek = async () => {
    if (!data) return
    const res = (await cekKelengkapanBerkas(data.pendaftaranId)) as any
    setCek(res)
    if (res.lengkap) toast.success("Semua berkas wajib lengkap — lanjutkan ke review")
    else toast.error(`Masih kurang: ${res.kurang.join(", ")}`)
  }

  const handleLanjut = () => {
    router.push("/ppdb/review")
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">Belum ada pendaftaran aktif.</p>
        <Link href="/ppdb/formulir"><Button size="sm">Mulai Formulir</Button></Link>
      </div>
    )
  }

  const wajibSelesai = data.berkas.filter((b: Berkas) => b.wajib && b.upload).length
  const totalWajib = data.berkas.filter((b: Berkas) => b.wajib).length

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link href="/ppdb/formulir" className="text-sm text-muted-foreground hover:underline flex items-center gap-1 w-fit">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Formulir
        </Link>
        <h1 className="text-2xl font-bold mt-2">Unggah Berkas Persyaratan</h1>
        <p className="text-sm text-muted-foreground">{data.gelombang.nama}</p>
      </div>

      {/* progress */}
      <div className="rounded-2xl border p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Berkas wajib</span>
          <span>{wajibSelesai}/{totalWajib} terunggah</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: totalWajib > 0 ? `${Math.round((wajibSelesai / totalWajib) * 100)}%` : "0%" }}
          />
        </div>
        {cek && !cek.lengkap && (
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 mt-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Kurang: {cek.kurang.join(", ")}</span>
          </div>
        )}
        {cek?.lengkap && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mt-2">
            <CheckCircle2 className="h-4 w-4" /> Semua berkas wajib lengkap
          </div>
        )}
      </div>

      {/* daftar berkas */}
      <div className="space-y-3">
        {data.berkas.length === 0 && (
          <div className="rounded-2xl border p-6 text-center text-muted-foreground text-sm">
            Tidak ada persyaratan dokumen untuk gelombang ini.
          </div>
        )}
        {data.berkas.map((b: Berkas) => (
          <div key={b.id} className="rounded-2xl border p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-sm">
                    {b.namaDokumen}
                    {b.wajib && <span className="text-red-500 ml-1">*</span>}
                  </p>
                  {b.upload && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.upload.filename} · {(b.upload.size / 1024).toFixed(0)} KB
                    </p>
                  )}
                  {b.catatanPenolakan && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Alasan ditolak: {b.catatanPenolakan}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="outline" className={STATUS_CLASS[b.status]}>
                  {STATUS_LABEL[b.status] || b.status}
                </Badge>
                <div className="flex gap-1">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*,application/pdf,.doc,.docx"
                      className="sr-only"
                      disabled={uploading === b.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleUpload(b.id, f)
                        e.target.value = ""
                      }}
                    />
                    {uploading === b.id ? (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </span>
                    ) : (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted">
                        <Upload className="h-4 w-4" />
                      </span>
                    )}
                  </label>
                  {b.upload && (
                    <button
                      onClick={() => handleHapus(b.id)}
                      disabled={deleting === b.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      {deleting === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* aksi */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={handleCek}>
          <RefreshCw className="h-4 w-4 mr-1" /> Cek Kelengkapan
        </Button>
        <Button onClick={handleLanjut} disabled={cek !== null && !cek.lengkap}>
          Lanjut ke Review →
        </Button>
      </div>
    </div>
  )
}
