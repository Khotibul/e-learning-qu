"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Check, Clock, Loader2, RefreshCw, ScanFace, ShieldCheck, Smartphone } from "lucide-react"
import {
  bukaKamera,
  deskriptorRataRataVideo,
  deteksiWajah,
  hentikanKamera,
  potretFrame,
  type DeteksiWajah,
} from "@/lib/wajah-browser"

type Props = {
  token: string
  nama: string
  tipe: "SISWA" | "GURU" | "PEGAWAI"
  kelas: string | null
  status: "MENUNGGU" | "DITOLAK" | null
  catatan: string | null
}

/** Turunkan ukuran tangkapan kamera agar ringan dikirim sekali (data URL JPEG). */
async function blobKeDataUrl(blob: Blob, sisi = 360, kualitas = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  const skala = Math.min(1, sisi / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * skala))
  canvas.height = Math.max(1, Math.round(bitmap.height * skala))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Browser tidak mendukung pemrosesan gambar")
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas.toDataURL("image/jpeg", kualitas)
}

export function DaftarWajah({ token, nama, tipe, kelas, status: statusAwal, catatan }: Props) {
  const [status, setStatus] = useState<Props["status"]>(statusAwal)
  const [pesan, setPesan] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [kameraAktif, setKameraAktif] = useState(false)
  const [deteksi, setDeteksi] = useState<DeteksiWajah | null>(null)
  const [deskriptor, setDeskriptor] = useState<number[] | null>(null)
  const [foto, setFoto] = useState<string | null>(null)
  const [menangkap, setMenangkap] = useState(false)
  const [mengirim, setMengirim] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const matikan = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    hentikanKamera(streamRef.current)
    streamRef.current = null
    setKameraAktif(false)
    setDeteksi(null)
  }, [])

  const mulai = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    setGalat(null)
    try {
      streamRef.current = await bukaKamera(video)
      setKameraAktif(true)
      timerRef.current = setInterval(async () => {
        try {
          setDeteksi(await deteksiWajah(video))
        } catch {
          /* abaikan frame gagal */
        }
      }, 400)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal membuka kamera")
    }
  }, [])

  // Kamera dinyalakan lewat timeout agar tidak setState sinkron di dalam effect.
  useEffect(() => {
    if (status === "MENUNGGU") return
    const id = setTimeout(() => void mulai(), 50)
    return () => {
      clearTimeout(id)
      matikan()
    }
  }, [mulai, matikan, status])

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
      canvas.width = video.clientWidth || 480
      canvas.height = video.clientHeight || 360
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!deteksi || !video.videoWidth) return
    const sx = canvas.width / video.videoWidth
    const sy = canvas.height / video.videoHeight
    const { x, y, width, height } = deteksi.kotak
    ctx.lineWidth = 3
    ctx.strokeStyle = deteksi.skor >= 0.5 ? "#34d399" : "#fbbf24"
    ctx.strokeRect(x * sx, y * sy, width * sx, height * sy)
  }, [deteksi])

  const tangkap = async () => {
    const video = videoRef.current
    if (!video) return
    setMenangkap(true)
    setGalat(null)
    try {
      const d = await deskriptorRataRataVideo(video, 3, 220)
      const blob = await potretFrame(video)
      if (!blob) throw new Error("Gagal mengambil gambar wajah")
      setDeskriptor(d)
      setFoto(await blobKeDataUrl(blob))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menangkap wajah")
    } finally {
      setMenangkap(false)
    }
  }

  const kirim = async () => {
    if (!deskriptor) return
    setMengirim(true)
    setGalat(null)
    try {
      const res = await fetch("/api/wajah/pendaftaran", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ deskriptor, foto, sampel: 3 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(data?.error || "Pengajuan wajah gagal"))
      matikan()
      setStatus("MENUNGGU")
      setPesan(String(data?.pesan || "Pengajuan terkirim — menunggu persetujuan Admin."))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pengajuan wajah gagal")
    } finally {
      setMengirim(false)
    }
  }

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <header className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/20">
            <ScanFace className="h-6 w-6 text-indigo-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight">Daftarkan Wajah Anda</h1>
            <p className="text-xs text-slate-400">Sekali daftar, wajah dipakai untuk absensi masuk & pulang.</p>
          </div>
          <Smartphone className="h-5 w-5 shrink-0 text-slate-500" />
        </header>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs">
          <span className="font-semibold text-slate-100">{nama}</span>
          <span className="text-slate-400">
            • {tipe === "SISWA" ? "Siswa" : tipe === "GURU" ? "Guru" : "Pegawai"}
            {kelas ? ` • ${kelas}` : ""}
          </span>
        </div>

        {status === "MENUNGGU" ? (
          <div className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
              <Clock className="h-4 w-4" /> Menunggu persetujuan Admin
            </p>
            <p className="text-xs leading-relaxed text-amber-100/80">
              {pesan ?? "Pengajuan wajah Anda sudah diterima. Absensi wajah aktif setelah Admin memverifikasi foto Anda."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Cek status terbaru
            </button>
          </div>
        ) : (
          <>
            {status === "DITOLAK" && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                Pengajuan sebelumnya ditolak{catatan ? `: ${catatan}` : ""}. Silakan ambil ulang dengan pencahayaan lebih baik.
              </div>
            )}

            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-800 bg-black">
              <video ref={videoRef} className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} playsInline muted />
              <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" style={{ transform: "scaleX(-1)" }} />
              {!kameraAktif && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/85 text-slate-300">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs">Menyiapkan kamera depan…</span>
                  <button type="button" onClick={mulai} className="mt-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs">
                    Coba nyalakan lagi
                  </button>
                </div>
              )}
              {foto && (
                <div className="absolute bottom-2 right-2 h-20 w-16 overflow-hidden rounded-lg border-2 border-emerald-400">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={foto} alt="Tangkapan wajah" className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={tangkap}
                disabled={!kameraAktif || menangkap || !deteksi}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {menangkap ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {deskriptor ? "Ambil Ulang" : "Ambil Wajah"}
              </button>
              <button
                type="button"
                onClick={kirim}
                disabled={!deskriptor || mengirim}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40"
              >
                {mengirim ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Kirim Pendaftaran
              </button>
              <span className={`text-[11px] ${deteksi ? "text-emerald-300" : "text-slate-500"}`}>
                {deteksi ? "Wajah terdeteksi — siap diambil" : "Arahkan wajah ke kamera"}
              </span>
            </div>

            {galat && (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{galat}</p>
            )}

            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Wajah diproses di perangkat ini menjadi kode matematis (descriptor). Server menyimpan descriptor + satu foto
              tangkapan untuk diperiksa Admin — foto dihapus setelah pengajuan diputuskan.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
