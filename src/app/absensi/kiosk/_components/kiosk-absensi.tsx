"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Fingerprint,
  Loader2,
  Monitor,
  ScanFace,
  School,
  UserX,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WajahVerifikator, type HasilVerifikasi } from "@/components/absensi/wajah-verifikator"
import type { KartuIdentitas, MetodeKiosk } from "@/lib/kiosk-absensi"

type Props = {
  admin: string
  berlakuSampai: string
  perangkat: "ANDROID" | "DESKTOP" | "WEB"
}

type HasilKiosk = {
  status: "SUKSES" | "DUPLIKAT" | "TIDAK_DIKENAL" | "DITOLAK" | "GAGAL"
  pesan: string
  metode: MetodeKiosk
  kartu: KartuIdentitas | null
  tipe: "MASUK" | "PULANG" | null
  jam: string | null
}

const METODE_LABEL: Record<MetodeKiosk, string> = {
  WAJAH: "Wajah",
  SIDIK_JARI: "Sidik jari",
  NIS_NIP: "Cadangan NIS/NIP",
}

export function KioskAbsensi({ admin, berlakuSampai, perangkat }: Props) {
  const [jam, setJam] = useState("--:--:--")
  const [tab, setTab] = useState("wajah")
  const [hasil, setHasil] = useState<HasilKiosk | null>(null)
  const [sesi, setSesi] = useState(0)

  useEffect(() => {
    const tick = () =>
      setJam(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Kiosk dipakai bergantian — kartu identitas hilang sendiri setelah 25 detik.
  useEffect(() => {
    if (!hasil) return
    const id = setTimeout(() => {
      setHasil(null)
      setSesi((s) => s + 1)
    }, 25000)
    return () => clearTimeout(id)
  }, [hasil])

  const reset = () => {
    setHasil(null)
    setSesi((s) => s + 1)
  }

  const dariWajah = (h: HasilVerifikasi) => {
    setHasil({
      status: h.status,
      pesan: h.pesan,
      metode: "WAJAH",
      kartu: h.kartu ?? null,
      tipe: h.absensi?.tipe === "PULANG" ? "PULANG" : h.absensi?.tipe === "MASUK" ? "MASUK" : null,
      jam: h.absensi?.jam ?? null,
    })
  }

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/20">
            <ScanFace className="h-6 w-6 text-indigo-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight">Kiosk Absensi</h1>
            <p className="text-xs text-slate-400">
              Tanpa login — guru dan siswa cukup memakai wajah atau sidik jari. Waktu mengikuti server.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800 text-slate-200">
              <Monitor className="mr-1 h-3 w-3" />
              {perangkat}
            </Badge>
            <span className="tabular-nums text-sm font-semibold text-slate-200">{jam}</span>
          </div>
        </header>

        {hasil?.kartu ? (
          <KartuOrang hasil={hasil} onLanjut={reset} />
        ) : (
          <>
            {hasil && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                <UserX className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Identitas tidak ditemukan</p>
                  <p className="text-xs">{hasil.pesan}</p>
                </div>
              </div>
            )}

            <Tabs value={tab} onValueChange={setTab} className="space-y-3">
              <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                <TabsTrigger value="wajah">
                  <ScanFace className="mr-1.5 h-4 w-4" /> Wajah
                </TabsTrigger>
                <TabsTrigger value="sidik">
                  <Fingerprint className="mr-1.5 h-4 w-4" /> Sidik Jari
                </TabsTrigger>
              </TabsList>

              <TabsContent value="wajah">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                  <WajahVerifikator
                    key={sesi}
                    perangkat={perangkat}
                    autoMulai
                    sembunyikanHasil
                    labelTombol="Absen Sekarang"
                    petunjuk="Hadapkan wajah ke kamera. Setelah kotak hijau muncul, tekan Absen Sekarang."
                    onHasil={dariWajah}
                  />
                </div>
              </TabsContent>

              <TabsContent value="sidik">
                <PanelSidikJari onHasil={setHasil} />
              </TabsContent>
            </Tabs>
          </>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            Kiosk diaktifkan oleh {admin} · berlaku s.d. {berlakuSampai}
          </span>
          <Link href="/login" className="inline-flex items-center gap-1 text-slate-400 underline underline-offset-2">
            <ArrowLeft className="h-3 w-3" /> Kembali ke login
          </Link>
        </footer>
      </div>
    </main>
  )
}

function PanelSidikJari({ onHasil }: { onHasil: (h: HasilKiosk) => void }) {
  const [kode, setKode] = useState("")
  const [metode, setMetode] = useState<"SIDIK_JARI" | "NIS_NIP">("NIS_NIP")
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sibuk) return
    setSibuk(true)
    setGalat(null)
    try {
      const res = await fetch("/api/absensi/kiosk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode, metode }),
      })
      const data = (await res.json()) as HasilKiosk & { error?: string }
      if (!res.ok) throw new Error(data?.error || "Absensi gagal")
      onHasil(data)
      setKode("")
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Absensi gagal")
    } finally {
      setSibuk(false)
    }
  }

  return (
    <form onSubmit={kirim} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Fingerprint className="h-5 w-5 text-indigo-300" /> Absensi Sidik Jari
      </div>
      <p className="text-xs leading-relaxed text-slate-400">
        Sensor sidik jari belum terpasang di kiosk ini. Alur sidik jari sudah aktif di server: setelah mesin fingerprint
        dipetakan Admin, scan sidik jari langsung tercatat. Sementara gunakan <b className="text-slate-200">cadangan NIS/NIP</b>.
      </p>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          value={kode}
          onChange={(e) => setKode(e.target.value)}
          placeholder="NIS / NISN / NIP"
          autoComplete="off"
          className="h-11 border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500"
        />
        <Button type="submit" disabled={sibuk || kode.trim().length < 3} className="h-11">
          {sibuk ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-1.5 h-4 w-4" />}
          Absen
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <label className="inline-flex items-center gap-1.5">
          <input
            type="radio"
            name="metode"
            checked={metode === "NIS_NIP"}
            onChange={() => setMetode("NIS_NIP")}
            className="accent-indigo-500"
          />
          Cadangan NIS/NIP
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="radio"
            name="metode"
            checked={metode === "SIDIK_JARI"}
            onChange={() => setMetode("SIDIK_JARI")}
            className="accent-indigo-500"
          />
          Sidik jari (sensor)
        </label>
      </div>

      {galat && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {galat}
        </div>
      )}
    </form>
  )
}

function KartuOrang({ hasil, onLanjut }: { hasil: HasilKiosk; onLanjut: () => void }) {
  const k = hasil.kartu as KartuIdentitas
  const sukses = hasil.status === "SUKSES"
  const duplikat = hasil.status === "DUPLIKAT"

  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-slate-900 ${
        sukses ? "border-emerald-500/50" : duplikat ? "border-amber-500/50" : "border-rose-500/50"
      }`}
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row">
        {k.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={k.fotoUrl}
            alt={k.nama}
            className="h-28 w-28 shrink-0 rounded-xl object-cover ring-2 ring-slate-700"
          />
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-3xl font-bold text-slate-400 ring-2 ring-slate-700">
            {k.nama.trim().slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-slate-800 text-slate-200">{k.tipe === "GURU" ? "Guru" : "Siswa"}</Badge>
            <Badge className="bg-indigo-500/20 text-indigo-200">
              {METODE_LABEL[hasil.metode]}
            </Badge>
          </div>
          <h2 className="text-2xl font-bold leading-tight text-white">{k.nama}</h2>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {k.tipe === "GURU" ? (
              <>
                <Baris label="Jabatan" nilai={k.jabatan} />
                <Baris label="NIP" nilai={k.nip} />
              </>
            ) : (
              <>
                <Baris label="Kelas" nilai={k.kelas} />
                <Baris label="Jurusan" nilai={k.jurusan} />
                <Baris label="NIS" nilai={k.nis} />
              </>
            )}
            <div className="col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Sekolah</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    k.sekolahFormal ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-500"
                  }`}
                >
                  <School className="h-3 w-3" /> Formal {k.sekolahFormal ? "✓" : "—"}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    k.sekolahNonFormal ? "bg-amber-500/15 text-amber-300" : "bg-slate-800 text-slate-500"
                  }`}
                >
                  Non Formal {k.sekolahNonFormal ? "✓" : "—"}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div
        className={`flex flex-wrap items-center gap-2 border-t px-5 py-3 text-sm ${
          sukses
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            : duplikat
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
        }`}
      >
        {sukses ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : duplikat ? (
          <Clock className="h-5 w-5" />
        ) : (
          <AlertTriangle className="h-5 w-5" />
        )}
        <span className="min-w-0 flex-1">{hasil.pesan}</span>
        <Button size="sm" variant="outline" onClick={onLanjut} className="border-current bg-transparent text-current">
          Absensi berikutnya
        </Button>
      </div>
    </section>
  )
}

function Baris({ label, nilai }: { label: string; nilai: string | null }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="truncate text-slate-100">{nilai && nilai.trim() ? nilai : "—"}</dd>
    </div>
  )
}
