"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Camera, CheckCircle2, Loader2, ScanFace, UserX, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { bukaKamera, deskriptorRataRataVideo, deteksiWajah, hentikanKamera, type DeteksiWajah } from "@/lib/wajah-browser"
import { AMBANG_WAJAH, labelTipeWajah } from "@/lib/wajah-matematika"

export type HasilVerifikasi = {
  status: "SUKSES" | "DUPLIKAT" | "TIDAK_DIKENAL" | "DITOLAK" | "GAGAL"
  pesan: string
  nama: string | null
  tipe: string | null
  kelas: string | null
  nis: string | null
  jarak: number | null
  ambang: number
  perangkat: string
  profilId: string | null
  absensi?: { tipe: string; jam: string } | null
}

type Props = {
  /** Token kiosk wajah; tanpa token memakai sesi login web (admin). */
  token?: string | null
  perangkat?: "WEB" | "ANDROID" | "DESKTOP"
  tujuan?: "ABSEN" | "UJI"
  targetProfilId?: string | null
  onHasil?: (h: HasilVerifikasi) => void
  labelTombol?: string
  petunjuk?: string
  autoMulai?: boolean
  compact?: boolean
}

export function WajahVerifikator({
  token,
  perangkat = "WEB",
  tujuan = "ABSEN",
  targetProfilId,
  onHasil,
  labelTombol = "Absen dengan Wajah",
  petunjuk,
  autoMulai = false,
  compact = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sibukRef = useRef(false)

  const [kameraAktif, setKameraAktif] = useState(false)
  const [memuatMesin, setMemuatMesin] = useState(false)
  const [deteksi, setDeteksi] = useState<DeteksiWajah | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [hasil, setHasil] = useState<HasilVerifikasi | null>(null)

  const hentikan = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    hentikanKamera(streamRef.current)
    streamRef.current = null
    setKameraAktif(false)
    setDeteksi(null)
    const c = canvasRef.current
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height)
  }, [])

  const mulaiKamera = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    setGalat(null)
    setMemuatMesin(true)
    try {
      const stream = await bukaKamera(video)
      streamRef.current = stream
      setKameraAktif(true)
      timerRef.current = setInterval(async () => {
        if (sibukRef.current) return
        try {
          const d = await deteksiWajah(video)
          setDeteksi(d)
        } catch {
          /* deteksi sementara gagal — biarkan loop berikutnya */
        }
      }, 450)
    } catch (e) {
      setGalat(pesanKamera(e))
    } finally {
      setMemuatMesin(false)
    }
  }, [])

  useEffect(() => {
    // Mulai setelah render pertama selesai (hindari setState sinkron di effect).
    const id = autoMulai ? setTimeout(() => void mulaiKamera(), 0) : null
    return () => {
      if (id) clearTimeout(id)
      hentikan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Gambar kotak wajah di overlay.
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const lebar = video.clientWidth || 640
    const tinggi = video.clientHeight || 480
    if (canvas.width !== lebar || canvas.height !== tinggi) {
      canvas.width = lebar
      canvas.height = tinggi
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!deteksi || !video.videoWidth) return
    const sx = canvas.width / video.videoWidth
    const sy = canvas.height / video.videoHeight
    const { x, y, width, height } = deteksi.kotak
    const oke = deteksi.skor >= 0.5
    ctx.lineWidth = 3
    ctx.strokeStyle = oke ? "#10b981" : "#f59e0b"
    ctx.strokeRect(x * sx, y * sy, width * sx, height * sy)
  }, [deteksi, kameraAktif])

  const absen = useCallback(async () => {
    const video = videoRef.current
    if (!video || sibukRef.current) return
    sibukRef.current = true
    setSibuk(true)
    setGalat(null)
    try {
      const deskriptor = await deskriptorRataRataVideo(video, 3, 200)
      const res = await fetch("/api/wajah/verifikasi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ deskriptor, tujuan, targetProfilId, perangkat }),
      })
      const data = (await res.json()) as HasilVerifikasi & { error?: string }
      if (!res.ok) throw new Error(data?.error || "Verifikasi gagal")
      setHasil(data)
      onHasil?.(data)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Verifikasi wajah gagal")
    } finally {
      sibukRef.current = false
      setSibuk(false)
    }
  }, [token, tujuan, targetProfilId, perangkat, onHasil])

  const statusWarna =
    hasil?.status === "SUKSES"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : hasil?.status === "DUPLIKAT"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-rose-50 text-rose-700 border-rose-200"

  return (
    <div className="space-y-3">
      <div className={`relative overflow-hidden rounded-xl border bg-slate-950 ${compact ? "aspect-[4/3]" : "aspect-video"}`}>
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" style={{ transform: "scaleX(-1)" }} />

        {!kameraAktif && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 p-4 text-center text-slate-300">
            <ScanFace className="h-10 w-10 text-slate-400" />
            <p className="text-sm">Kamera belum aktif</p>
            <Button size="sm" onClick={mulaiKamera} disabled={memuatMesin}>
              {memuatMesin ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}
              Nyalakan Kamera
            </Button>
            <p className="max-w-xs text-[11px] text-slate-400">
              Wajah dideteksi langsung di perangkat ini; hanya kode wajah (descriptor) yang dikirim ke server.
            </p>
          </div>
        )}

        {kameraAktif && (
          <div className="absolute left-2 top-2 flex gap-1.5">
            <Badge className={deteksi ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-200"}>
              {deteksi ? "Wajah terdeteksi" : "Cari wajah…"}
            </Badge>
          </div>
        )}
        {kameraAktif && (
          <button
            type="button"
            onClick={hentikan}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white hover:bg-black/80"
          >
            Matikan
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={absen} disabled={!kameraAktif || sibuk || !deteksi}>
          {sibuk ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ScanFace className="mr-1.5 h-4 w-4" />}
          {sibuk ? "Memverifikasi…" : labelTombol}
        </Button>
        {hasil && (
          <Button variant="outline" size="sm" onClick={() => setHasil(null)}>
            Absensi Berikutnya
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground">Ambang kemiripan {AMBANG_WAJAH} (jarak euclidean)</span>
      </div>

      {petunjuk && !hasil && <p className="text-xs text-muted-foreground">{petunjuk}</p>}

      {galat && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {galat}
        </div>
      )}

      {hasil && (
        <div className={`rounded-xl border px-3 py-2.5 ${statusWarna}`}>
          <div className="flex items-center gap-2">
            {hasil.status === "SUKSES" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : hasil.status === "DUPLIKAT" ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <UserX className="h-5 w-5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {hasil.nama ?? "Wajah tidak dikenal"}
                {hasil.nama && (
                  <span className="ml-2 font-normal opacity-80">
                    {labelTipeWajah(hasil.tipe)}
                    {hasil.kelas ? ` • ${hasil.kelas}` : ""}
                    {hasil.nis ? ` • ${hasil.nis}` : ""}
                  </span>
                )}
              </p>
              <p className="text-xs">{hasil.pesan}</p>
            </div>
            {hasil.jarak != null && (
              <span className="shrink-0 rounded-full bg-white/60 px-2 py-0.5 font-mono text-[11px]">
                {hasil.jarak.toFixed(3)}
              </span>
            )}
          </div>
          {hasil.absensi && (
            <p className="mt-1 text-[11px] opacity-80">
              Tercatat: {hasil.absensi.tipe} pukul {hasil.absensi.jam} (waktu server)
            </p>
          )}
        </div>
      )}

      {!kameraAktif && galat && (
        <p className="flex items-center gap-1 text-[11px] text-rose-600">
          <XCircle className="h-3 w-3" /> Pastikan izin kamera diberikan dan halaman dibuka via HTTPS.
        </p>
      )}
    </div>
  )
}

function pesanKamera(e: unknown): string {
  const err = e as { name?: string; message?: string }
  if (err?.name === "NotAllowedError") return "Izin kamera ditolak — izinkan akses kamera pada browser/perangkat"
  if (err?.name === "NotFoundError") return "Kamera tidak ditemukan pada perangkat ini"
  if (err?.name === "NotReadableError") return "Kamera sedang dipakai aplikasi lain"
  if (err?.message?.includes("HTTPS")) return "Kamera hanya bisa dipakai lewat HTTPS atau localhost"
  return err?.message || "Gagal membuka kamera"
}
