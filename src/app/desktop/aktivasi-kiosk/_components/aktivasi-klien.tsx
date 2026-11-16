"use client"

import { useEffect, useState } from "react"
import { signIn, signOut } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type Mode = "masuk" | "bukan-admin" | "aktifkan"

/**
 * Halaman perantara aktivasi kiosk desktop.
 * - "masuk": belum ada sesi → tombol Masuk dengan Google.
 * - "bukan-admin": sesi ada tapi bukan Admin → keluar lalu coba akun lain.
 * - "aktifkan": Admin → ambil token kiosk lalu serahkan ke aplikasi desktop
 *   lewat listener loopback (http://127.0.0.1:<port>/callback).
 */
export function AktivasiKlien({ mode, port, state }: { mode: Mode; port: number; state: string }) {
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== "aktifkan") return
    let batal = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/desktop/kiosk?port=${port}&state=${encodeURIComponent(state)}`,
          { cache: "no-store" }
        )
        const data = (await res.json().catch(() => null)) as
          | { token?: string; url?: string; admin?: string; expiresInDetik?: number; error?: string }
          | null
        if (!res.ok || !data?.token || !data?.url) {
          throw new Error(data?.error ?? "Gagal mengaktifkan kiosk absensi")
        }
        if (batal) return
        const q = new URLSearchParams({
          token: data.token,
          url: data.url,
          admin: data.admin ?? "",
          exp: String(data.expiresInDetik ?? 0),
          state,
        })
        // "localhost" (bukan 127.0.0.1) agar listener HttpListener di aplikasi desktop
        // bisa menerima tanpa hak admin.
        window.location.replace(`http://localhost:${port}/callback?${q.toString()}`)
      } catch (e) {
        if (!batal) setGalat(e instanceof Error ? e.message : "Gagal mengaktifkan kiosk absensi")
      }
    })()
    return () => {
      batal = true
    }
  }, [mode, port, state])

  if (mode === "aktifkan") {
    return (
      <div className="space-y-3 text-center">
        {galat ? (
          <>
            <p className="text-sm text-destructive">{galat}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Coba lagi
            </Button>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Mengaktifkan kiosk di aplikasi desktop…
          </p>
        )}
      </div>
    )
  }

  if (mode === "bukan-admin") {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          Akun yang sedang masuk bukan Admin. Kiosk hanya bisa diaktifkan oleh akun Admin.
        </p>
        <Button variant="outline" onClick={() => signOut({ callbackUrl: window.location.href })}>
          Keluar &amp; masuk dengan akun Admin
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Button
        className="w-full gap-3"
        size="lg"
        onClick={() => signIn("google", { callbackUrl: window.location.href })}
      >
        Masuk dengan Google
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Sudah punya kata sandi Admin? Aktifkan langsung dari aplikasi desktop dengan mengisi email dan
        kata sandi Admin, lalu tekan “Absensi Wajah &amp; Sidik Jari”.
      </p>
    </div>
  )
}
