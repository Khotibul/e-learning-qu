import { ScanFace } from "lucide-react"
import { auth } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AktivasiKlien } from "./_components/aktivasi-klien"

/**
 * Aktivasi kiosk absensi desktop lewat browser.
 *
 * Dipakai tombol "Aktivasi lewat Google" di aplikasi desktop: browser dibuka ke
 * halaman ini dengan ?port=<listener desktop>&state=<nonce>, Admin masuk dengan
 * Google, lalu token kiosk diserahkan ke listener loopback desktop.
 *
 * Google menolak redirect loopback untuk client ID tipe Web, jadi halaman ini
 * menjadi perantara agar Admin tanpa kata sandi tetap bisa mengaktifkan kiosk.
 */
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ port?: string; state?: string }> }

export default async function AktivasiKioskDesktopPage({ searchParams }: Props) {
  const sp = await searchParams
  const port = Number(sp.port)
  const state = String(sp.state ?? "")
  const permintaanValid =
    Number.isInteger(port) && port >= 1024 && port <= 65535 && /^[A-Za-z0-9_-]{8,64}$/.test(state)

  const session = permintaanValid ? await auth() : null
  const admin = session?.user?.role === "ADMIN"
  const mode = !permintaanValid ? null : !session?.user ? "masuk" : admin ? "aktifkan" : "bukan-admin"

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ScanFace className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg">Aktivasi Kiosk Absensi</CardTitle>
          <CardDescription>
            {mode === "aktifkan"
              ? "Meneruskan izin kiosk ke aplikasi desktop di komputer ini."
              : "Absensi wajah & sidik jari guru/siswa tanpa login di komputer ini."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          {mode === null && (
            <p className="text-center text-sm text-destructive">
              Tautan aktivasi tidak valid. Buka ulang dari aplikasi desktop (tombol “Absensi Wajah &amp;
              Sidik Jari”).
            </p>
          )}
          {mode !== null && <AktivasiKlien mode={mode} port={port} state={state} />}
        </CardContent>
      </Card>
    </div>
  )
}
