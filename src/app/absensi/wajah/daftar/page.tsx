import type { Metadata } from "next"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { verifyWajahToken } from "@/lib/wajah-token"
import { statusPendaftaranWajah } from "@/lib/wajah-pendaftaran"
import { DaftarWajah } from "./_components/daftar-wajah"

export const metadata: Metadata = {
  title: "Daftarkan Wajah",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function DaftarWajahPage({
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
        select: { id: true, email: true, isActive: true },
      })
    : null

  if (!payload || !user?.isActive) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 text-slate-200">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h1 className="text-lg font-bold">Tautan pendaftaran tidak valid</h1>
          <p className="text-sm text-slate-400">
            Token pendaftaran wajah tidak valid atau sudah kedaluwarsa (berlaku 20 menit). Buka kembali dari aplikasi
            Android atau minta Admin membuat tautan baru.
          </p>
          <Link href="/login" className="inline-block text-sm text-indigo-300 underline underline-offset-2">
            Masuk ke aplikasi
          </Link>
        </div>
      </main>
    )
  }

  const status = await statusPendaftaranWajah(user.id)
  if (!status) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 text-slate-200">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h1 className="text-lg font-bold">Akun belum terhubung</h1>
          <p className="text-sm text-slate-400">
            Akun ini belum memiliki data siswa/guru, jadi wajah tidak bisa didaftarkan mandiri. Hubungi Admin.
          </p>
        </div>
      </main>
    )
  }

  if (status.identitas.tipe === "PEGAWAI") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 text-slate-200">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-indigo-300" />
          <h1 className="text-lg font-bold">Pendaftaran lewat Admin</h1>
          <p className="text-sm text-slate-400">
            Akun pegawai tidak bisa mendaftarkan wajah sendiri. Mintalah Admin mendaftarkan foto wajah Anda.
          </p>
        </div>
      </main>
    )
  }

  if (status.status === "AKTIF") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 text-slate-200">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center">
          <ShieldCheck className="mx-auto h-9 w-9 text-emerald-300" />
          <h1 className="text-lg font-bold">Wajah sudah terdaftar</h1>
          <p className="text-sm text-emerald-100/80">
            {status.identitas.nama} — wajah Anda sudah aktif untuk absensi. Buka menu Absensi Wajah di aplikasi.
          </p>
          <Link href="/absensi/wajah" className="inline-block text-sm text-emerald-200 underline underline-offset-2">
            Buka halaman absensi
          </Link>
        </div>
      </main>
    )
  }

  return (
    <DaftarWajah
      token={token}
      nama={status.identitas.nama}
      tipe={status.identitas.tipe}
      kelas={status.identitas.kelas}
      status={status.status === "MENUNGGU" || status.status === "DITOLAK" ? status.status : null}
      catatan={status.catatan}
    />
  )
}
