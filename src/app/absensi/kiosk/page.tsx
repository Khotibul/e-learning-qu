import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import Link from "next/link"
import { Fingerprint, ScanFace, ShieldCheck } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { KIOSK_COOKIE, verifyKioskToken } from "@/lib/wajah-token"
import { KioskAbsensi } from "./_components/kiosk-absensi"

export const metadata: Metadata = {
  title: "Kiosk Absensi",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

function deteksiPerangkat(userAgent: string): "ANDROID" | "DESKTOP" | "WEB" {
  const ua = userAgent.toLowerCase()
  if (ua.includes("android")) return "ANDROID"
  if (ua.includes("windows") || ua.includes("macintosh") || ua.includes("linux")) return "DESKTOP"
  return "WEB"
}

export default async function KioskPage() {
  const [jar, hdr] = await Promise.all([cookies(), headers()])
  const token = jar.get(KIOSK_COOKIE)?.value ?? ""
  const payload = token ? await verifyKioskToken(token) : null

  const admin = payload
    ? await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { name: true, email: true, isActive: true },
      })
    : null

  if (!payload || !admin?.isActive) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 text-slate-200">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="h-5 w-5 text-indigo-300" /> Kiosk belum diaktifkan
          </div>
          <p className="text-sm leading-relaxed text-slate-400">
            Komputer ini belum terdaftar sebagai kiosk absensi. Kiosk memakai cookie perangkat berumur 30 hari supaya
            absensi wajah &amp; sidik jari bisa dipakai tanpa login.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-400">
            <li>Masuk sebagai Admin di komputer ini.</li>
            <li>Buka menu Admin → Absensi Wajah → tab Kiosk.</li>
            <li>
              Tekan <b className="text-slate-200">Aktifkan Kiosk Desktop</b>, lalu buka halaman ini lagi.
            </li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
            >
              <ScanFace className="h-4 w-4" /> Masuk sebagai Admin
            </Link>
            <Link
              href="/absensi/wajah"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              <Fingerprint className="h-4 w-4" /> Kiosk wajah berbasis token
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const berlakuSampai = payload.exp
    ? new Date(payload.exp * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
    : "-"

  return (
    <KioskAbsensi
      admin={admin.name || admin.email}
      berlakuSampai={berlakuSampai}
      perangkat={deteksiPerangkat(hdr.get("user-agent") ?? "")}
    />
  )
}
