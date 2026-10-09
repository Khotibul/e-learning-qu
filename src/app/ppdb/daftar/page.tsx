"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react"
import { daftarAkunPpdb, kirimUlangVerifikasi } from "../actions"

function DaftarForm() {
  const sp = useSearchParams()
  const tokenPrefill = sp.get("token") || ""

  const [step, setStep] = useState<"form" | "terkirim" | "verifikasi">(tokenPrefill ? "verifikasi" : "form")
  const [email, setEmail] = useState("")
  const [nama, setNama] = useState("")
  const [setuju, setSetuju] = useState(false)
  const [loading, setLoading] = useState(false)
  const [devToken, setDevToken] = useState(tokenPrefill)

  const handleDaftar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!setuju) { toast.error("Centang persetujuan privasi"); return }
    setLoading(true)
    try {
      const res = await daftarAkunPpdb({ email, nama, setujuPrivasi: setuju }) as any
      toast.success(res.message || "Pendaftaran berhasil")
      if (res.devToken) setDevToken(res.devToken)
      setStep("terkirim")
    } catch (err: any) {
      toast.error(err?.message || "Gagal mendaftar")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setLoading(true)
    try {
      const res = await kirimUlangVerifikasi(email) as any
      toast.success(res.message || "Tautan verifikasi dikirim ulang")
      if (res.devToken) setDevToken(res.devToken)
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengirim ulang")
    } finally {
      setLoading(false)
    }
  }

  if (step === "terkirim") {
    return (
      <div className="rounded-2xl border p-8 text-center space-y-4">
        <Mail className="mx-auto h-12 w-12 text-primary" />
        <h2 className="text-xl font-bold">Cek Email Anda</h2>
        <p className="text-sm text-muted-foreground">
          Tautan verifikasi telah dikirim ke <span className="font-medium text-foreground">{email}</span>.
          Buka tautan tersebut untuk menyelesaikan pendaftaran.
        </p>
        {devToken && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-left">
            <p className="font-semibold mb-1">Mode Pengembangan (RESEND_API_KEY belum diisi):</p>
            <p>Buka: <Link className="underline break-all" href={`/ppdb/verifikasi?token=${devToken}`}>/ppdb/verifikasi?token={devToken.slice(0, 12)}…</Link></p>
          </div>
        )}
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={handleResend} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Kirim Ulang
          </Button>
          <Link href="/login"><Button size="sm" variant="ghost">Ke Halaman Login</Button></Link>
        </div>
        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setEmail("")}>Ganti email</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleDaftar} className="rounded-2xl border p-6 sm:p-8 space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Email Aktif *</label>
        <Input type="email" required placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Nama Lengkap *</label>
        <Input required placeholder="Sesuai dokumen resmi" value={nama} onChange={(e) => setNama(e.target.value)} minLength={3} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} className="mt-0.5" />
        <span>Saya menyetujui pemrosesan data pendaftaran saya sesuai kebijakan privasi yang berlaku.</span>
      </label>
      <Button type="submit" className="w-full" disabled={loading || !email || !nama || !setuju}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Daftar Sekarang
      </Button>
    </form>
  )
}

export default function DaftarPage() {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/ppdb" className="flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="h-4 w-4" /> Kembali ke PPDB
          </Link>
          <Link href="/login" className="text-sm font-medium hover:underline">Sudah punya akun? Masuk</Link>
        </div>
      </nav>
      <main className="mx-auto max-w-xl px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary mb-3" />
          <h1 className="text-2xl sm:text-3xl font-bold">Daftar Akun Pendaftar</h1>
          <p className="mt-2 text-muted-foreground text-sm">Langkah 1 dari pendaftaran — buat akun, verifikasi email, lalu isi formulir.</p>
        </div>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border" />}>
          <DaftarForm />
        </Suspense>
      </main>
    </div>
  )
}
