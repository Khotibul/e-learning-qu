"use client"

import Link from "next/link"
import { Monitor, ScanFace, Smartphone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { WajahVerifikator } from "@/components/absensi/wajah-verifikator"

type Props = {
  token: string
  nama: string
  role: string
  perangkat: "ANDROID" | "DESKTOP" | "WEB"
  terdaftar: boolean
  berlakuSampai: string
}

const labelRole: Record<string, string> = {
  ADMIN: "Administrator",
  GURU: "Guru",
  SISWA: "Siswa",
  KEPALA_PONDOK: "Kepala Pondok",
  PENGURUS_PONDOK: "Pengurus Pondok",
  USTADZ_PONDOK: "Ustadz Pondok",
}

export function KioskWajah({ token, nama, role, perangkat, terdaftar, berlakuSampai }: Props) {
  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <header className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/20">
            <ScanFace className="h-6 w-6 text-indigo-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight">Absensi Wajah</h1>
            <p className="text-xs text-slate-400">Hadapkan wajah ke kamera — waktu absensi mengikuti server.</p>
          </div>
          <Badge className="shrink-0 bg-slate-800 text-slate-200">
            {perangkat === "ANDROID" ? <Smartphone className="mr-1 h-3 w-3" /> : <Monitor className="mr-1 h-3 w-3" />}
            {perangkat}
          </Badge>
        </header>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs">
          <span className="font-semibold text-slate-100">{nama}</span>
          <span className="text-slate-400">• {labelRole[role] ?? role}</span>
          <span className="ml-auto text-slate-500">Sesi berlaku s.d. {berlakuSampai}</span>
        </div>

        {!terdaftar && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Wajah Anda belum didaftarkan Admin. Mintalah Admin mendaftarkan foto wajah Anda agar dapat absen sendiri.
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <WajahVerifikator
            token={token}
            perangkat={perangkat}
            autoMulai
            labelTombol="Absen Sekarang"
            petunjuk="Pastikan pencahayaan cukup dan hanya satu wajah di kamera. Tekan tombol setelah wajah terdeteksi."
          />
        </div>

        <p className="text-center text-[11px] leading-relaxed text-slate-500">
          Deteksi wajah berjalan di perangkat ini (model dimuat lokal). Jangan tutup halaman saat proses berlangsung.
          <br />
          <Link href="/" className="text-slate-400 underline underline-offset-2">
            Kembali ke aplikasi
          </Link>
        </p>
      </div>
    </main>
  )
}
