"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react"
import { lupaPasswordPpdb, resetPasswordPpdb } from "../actions"

function ResetForm() {
  const sp = useSearchParams()
  const token = sp.get("token") || ""

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [konfirmasi, setKonfirmasi] = useState("")
  const [loading, setLoading] = useState(false)
  const [terkirim, setTerkirim] = useState(false)
  const [selesai, setSelesai] = useState(false)

  const handleLupa = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await lupaPasswordPpdb(email) as any
      toast.success(res.message || "Tautan reset dikirim")
      setTerkirim(true)
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengirim tautan")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== konfirmasi) { toast.error("Password dan konfirmasi tidak sama"); return }
    setLoading(true)
    try {
      const res = await resetPasswordPpdb(token, password) as any
      toast.success(res.message || "Password berhasil direset")
      setSelesai(true)
    } catch (err: any) {
      toast.error(err?.message || "Gagal reset password")
    } finally {
      setLoading(false)
    }
  }

  if (selesai) {
    return (
      <div className="rounded-2xl border p-8 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h2 className="text-xl font-bold">Password Berhasil Direset</h2>
        <Link href="/login"><Button>Silakan Login</Button></Link>
      </div>
    )
  }

  if (token) {
    return (
      <form onSubmit={handleReset} className="rounded-2xl border p-6 sm:p-8 space-y-4">
        <p className="text-sm text-muted-foreground">Masukkan password baru Anda.</p>
        <div className="space-y-2">
          <label className="text-sm font-medium">Password Baru (min. 8 karakter) *</label>
          <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Konfirmasi Password *</label>
          <Input type="password" required minLength={8} value={konfirmasi} onChange={(e) => setKonfirmasi(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading || !password}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Reset Password
        </Button>
      </form>
    )
  }

  if (terkirim) {
    return (
      <div className="rounded-2xl border p-8 text-center space-y-3">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h2 className="text-lg font-bold">Tautan Terkirim</h2>
        <p className="text-sm text-muted-foreground">Buka email Anda dan ikuti tautan reset password (berlaku 1 jam).</p>
        <Link href="/login"><Button variant="outline" size="sm">Ke Halaman Login</Button></Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleLupa} className="rounded-2xl border p-6 sm:p-8 space-y-4">
      <p className="text-sm text-muted-foreground">Masukkan email terdaftar — tautan reset akan dikirim ke email Anda.</p>
      <div className="space-y-2">
        <label className="text-sm font-medium">Email *</label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
      </div>
      <Button type="submit" className="w-full" disabled={loading || !email}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Kirim Tautan Reset
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/ppdb" className="flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="h-4 w-4" /> Kembali ke PPDB
          </Link>
          <Link href="/login" className="text-sm font-medium hover:underline">Ke Login</Link>
        </div>
      </nav>
      <main className="mx-auto max-w-md px-4 sm:px-6 py-12">
        <div className="text-center mb-8">
          <KeyRound className="mx-auto h-10 w-10 text-primary mb-3" />
          <h1 className="text-2xl sm:text-3xl font-bold">Lupa Password</h1>
          <p className="mt-2 text-muted-foreground text-sm">Reset password akun pendaftar PPDB Anda.</p>
        </div>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border" />}>
          <ResetForm />
        </Suspense>
      </main>
    </div>
  )
}
