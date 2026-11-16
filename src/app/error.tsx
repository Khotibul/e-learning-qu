"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Batas galat seluruh aplikasi.
 *
 * Sebelumnya tidak ada error.tsx sama sekali, sehingga satu kegagalan di server
 * component (mis. query DB timeout saat ramai) membuat Next.js menampilkan
 * "An error occurred in the Server Components render" berupa layar putih tanpa
 * jalan keluar. Halaman ini memberi pesan yang jelas + tombol coba lagi, dan
 * kegagalan sementara tidak perlu reload seluruh aplikasi.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Gagal merender halaman:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border bg-background p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Halaman gagal dimuat</h1>
          <p className="text-sm text-muted-foreground">
            Server sedang sibuk atau koneksi ke database terputus sesaat. Coba lagi — data Anda tidak
            hilang.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>Coba lagi</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Muat ulang halaman
          </Button>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Kode kesalahan: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  )
}
