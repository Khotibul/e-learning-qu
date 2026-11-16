"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Batas galat area dashboard: satu menu error tidak menggagalkan seluruh aplikasi. */
export default function DashboardRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Gagal merender halaman dashboard:", error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Menu ini gagal dimuat</h2>
          <p className="text-sm text-muted-foreground">
            Kemungkinan server atau database sedang sibuk. Menu lain tetap bisa dipakai.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button size="sm" onClick={reset}>
            Coba lagi
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Muat ulang
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
