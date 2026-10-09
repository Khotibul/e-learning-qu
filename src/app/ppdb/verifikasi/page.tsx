"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react"
import { verifikasiAkunPpdb } from "../actions"

function VerifForm() {
  const sp = useSearchParams()
  const token = sp.get("token") || ""

  const [password, setPassword] = useState("")
  const [konfirmasi, setKonfirmasi] = useState("")
  const [loading, setLoading] = useState(false)
  const [selesai, setSelesai] = useState(false)

  const handleVerif = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== konfirmasi) { toast.error("Password dan konfirmasi tidak sama"); return }
    setLoading(true)
    try {
      const res = await verifikasiAkunPpdb(token, password) as any
      toast.success(res.message || "Verifikasi berhasil")
      setSelesai(true)
    } catch (err: any) {
      toast.error(err?.message || "Gagal verifikasi")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="rounded-2xl border p-8 text-center space-y-3">
        <p className="font-medium">Tautan verifikasi tidak valid</p>
        <p className="text-sm text-muted-foreground">Silakan gunakan tautan verifikasi dari email Anda.</p>
        <Link href="/ppdb/daftar"><Button variant="outline" size="sm">Daftar Ulang</Button></Link>
      </div>
    )
  }

  if (selesai) {
    return (
      <div className="rounded-2xl border p-8 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h2 className="text-xl font-bold">Verifikasi Berhasil!</h2>
        <p className="text-sm text-muted-foreground">Akun Anda sudah aktif. Silakan login untuk melanjutkan pendaftaran.</p>
        <Link href="/login"><Button>Ke Halaman Login</Button></Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleVerif} className="rounded-2xl border p-6 sm:p-8 space-y-4">
      <p className="text-sm text-muted-foreground">Buat password untuk mengaktifkan akun Anda.</p>
      <div className="space-y-2">
        <label className="text-sm font-medium">Password (min. 8 karakter) *</label>
        <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Konfirmasi Password *</label>
        <Input type="password" required minLength={8} value={konfirmasi} onChange={(e) => setKonfirmasi(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading || !password}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Verifikasi &amp; Aktifkan Akun
      </Button>
    </form>
  )
}

export default function VerifikasiPage() {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/ppdb" className="flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="h-4 w-4" /> Kembali ke PPDB
          </Link>
        </div>
      </nav>
      <main className="mx-auto max-w-md px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary mb-3" />
          <h1 className="text-2xl sm:text-3xl font-bold">Verifikasi Email</h1>
          <p className="mt-2 text-muted-foreground text-sm">Langkah 2 — buat password untuk mengaktifkan akun.</p>
        </div>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border" />}>
          <VerifForm />
        </Suspense>
      </main>
    </div>
  )
}
