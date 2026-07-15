"use client"

import { Suspense, useState, useRef, useEffect } from "react"
import { useSession, signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Sparkles, Mail, Lock, Loader2, ArrowLeft } from "lucide-react"
import { toast } from "react-hot-toast"

type LoginMode = "google" | "siswa" | "guru" | "admin"

function LoginForm() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const [mode, setMode] = useState<LoginMode>("google")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (error === "OAuthAccountNotLinked") {
      toast.error("Email sudah terdaftar dengan metode login lain")
    } else if (error === "Configuration") {
      toast.error("Konfigurasi server error. Hubungi administrator.")
    }
    if (status === "authenticated" && session?.user && !checkedRef.current) {
      checkedRef.current = true
      fetch("/api/auth/role")
        .then((res) => res.json())
        .then((data) => {
          if (data.profileComplete) {
            const role = data.role
            if (role === "ADMIN") router.push("/admin")
            else if (role === "GURU") router.push("/guru")
            else if (role === "SISWA") router.push("/siswa")
            else router.push("/register")
          } else {
            router.push("/register")
          }
        })
        .catch(() => router.push("/register"))
    }
  }, [session, status, router, error])

  async function handleCredentialsLogin(e: React.FormEvent, role: "ADMIN" | "GURU" | "SISWA") {
    e.preventDefault()
    if (!email || !password) {
      toast.error("Email dan password wajib diisi")
      return
    }
    setLoading(true)
    try {
      const result = await signIn("credentials", {
        email,
        password,
        role,
        redirect: false,
      })
      if (result?.error) {
        toast.error("Email atau password salah")
      } else {
        const target = role === "ADMIN" ? "/admin" : role === "GURU" ? "/guru" : "/siswa"
        router.push(target)
        router.refresh()
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.")
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === "authenticated") return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md"
    >
      <Card className="w-full border-none bg-background/60 backdrop-blur-xl shadow-2xl">
        <CardHeader className="items-center space-y-4 pb-6 pt-8 text-center">
          {mode !== "google" && (
            <Button variant="ghost" size="icon" className="absolute left-4 top-4" onClick={() => setMode("google")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-600 shadow-lg"
          >
            <Sparkles className="h-8 w-8 text-white" />
          </motion.div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">E-Learning QU</CardTitle>
            <CardDescription className="text-base">
              {mode === "google" && "Pilih metode masuk"}
              {mode === "siswa" && "Masuk sebagai Siswa"}
              {mode === "guru" && "Masuk sebagai Guru"}
              {mode === "admin" && "Masuk sebagai Admin"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-8 space-y-4">
          {mode === "google" && (
            <>
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-3 text-base"
                onClick={() => signIn("google", { callbackUrl: "/register" })}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Masuk dengan Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">atau</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="lg"
                className="w-full gap-3 text-base"
                onClick={() => setMode("siswa")}
              >
                <Mail className="h-5 w-5" />
                Login Siswa (Email)
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full gap-3 text-base"
                onClick={() => setMode("guru")}
              >
                <Mail className="h-5 w-5" />
                Login Guru (Email)
              </Button>

              <Button
                variant="ghost"
                className="w-full text-sm text-muted-foreground"
                onClick={() => setMode("admin")}
              >
                Login Admin
              </Button>
            </>
          )}

          {mode === "siswa" && (
            <form onSubmit={(e) => handleCredentialsLogin(e, "SISWA")} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="siswa-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="siswa-email"
                    type="email"
                    placeholder="email@sekolah.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="siswa-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="siswa-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Masuk sebagai Siswa
              </Button>
            </form>
          )}

          {mode === "guru" && (
            <form onSubmit={(e) => handleCredentialsLogin(e, "GURU")} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guru-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="guru-email"
                    type="email"
                    placeholder="guru@sekolah.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guru-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="guru-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Masuk sebagai Guru
              </Button>
            </form>
          )}

          {mode === "admin" && (
            <form onSubmit={(e) => handleCredentialsLogin(e, "ADMIN")} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@elearningqu.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Masuk sebagai Admin
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
