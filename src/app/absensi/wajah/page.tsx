import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { verifyWajahToken } from "@/lib/wajah-token"
import { KioskWajah } from "./_components/kiosk-wajah"

export const metadata: Metadata = {
  title: "Absensi Wajah",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

function deteksiPerangkat(userAgent: string): "ANDROID" | "DESKTOP" | "WEB" {
  const ua = userAgent.toLowerCase()
  if (ua.includes("android")) return "ANDROID"
  if (ua.includes("windows") || ua.includes("macintosh") || ua.includes("linux")) return "DESKTOP"
  return "WEB"
}

export default async function KioskWajahPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>
}) {
  const params = await searchParams
  const token = (Array.isArray(params.t) ? params.t[0] : params.t)?.trim() ?? ""

  const payload = token ? await verifyWajahToken(token) : null
  const user = payload
    ? await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, role: true, isActive: true, email: true },
      })
    : null

  if (!payload || !user?.isActive) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 text-slate-200">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h1 className="text-lg font-bold">Tautan absensi tidak valid</h1>
          <p className="text-sm text-slate-400">
            Token kiosk wajah tidak valid atau sudah kedaluwarsa (berlaku 20 menit). Buka kembali dari aplikasi Android
            atau minta Admin membuat tautan baru.
          </p>
          <Link href="/login" className="inline-block text-sm text-indigo-300 underline underline-offset-2">
            Masuk ke aplikasi
          </Link>
        </div>
      </main>
    )
  }

  const [profil, hdr] = await Promise.all([
    prisma.profilWajah.findFirst({
      where: { aktif: true, OR: [{ userId: user.id }, { siswa: { userId: user.id } }] },
      select: { id: true },
    }),
    headers(),
  ])

  const berlakuSampai = payload.exp
    ? new Date(payload.exp * 1000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : "-"

  return (
    <KioskWajah
      token={token}
      nama={user.name || user.email}
      role={String(user.role)}
      perangkat={deteksiPerangkat(hdr.get("user-agent") ?? "")}
      terdaftar={!!profil}
      berlakuSampai={berlakuSampai}
    />
  )
}
