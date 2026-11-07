"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { Camera, Check, ImageUp, Loader2, Search, ScanFace, Upload, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { bukaKamera, deskriptorDariBerkas, deskriptorRataRataVideo, deteksiWajah, hentikanKamera, potretFrame, type DeteksiWajah } from "@/lib/wajah-browser"
import { cariOrangWajah, simpanProfilWajah, type OrangWajah } from "@/app/(dashboard)/admin/wajah/actions"

type Props = { onTersimpan?: () => void }

async function unggahFoto(blob: Blob, nama: string): Promise<string | null> {
  const fd = new FormData()
  fd.append("file", blob, nama)
  const res = await fetch("/api/upload", { method: "POST", body: fd })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || "Upload foto gagal")
  const url = String(data?.url ?? "")
  const id = url.split("/").filter(Boolean).pop() ?? ""
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null
}

export function WajahPendaftaran({ onTersimpan }: Props) {
  const [q, setQ] = useState("")
  const [mencari, setMencari] = useState(false)
  const [hasilCari, setHasilCari] = useState<OrangWajah[]>([])
  const [pilih, setPilih] = useState<OrangWajah | null>(null)
  const [mode, setMode] = useState<"UPLOAD" | "KAMERA">("UPLOAD")
  const [menyimpan, setMenyimpan] = useState(false)

  // upload
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [berkas, setBerkas] = useState<File | null>(null)
  const [pratinjau, setPratinjau] = useState<string | null>(null)
  const [deskriptorUpload, setDeskriptorUpload] = useState<number[] | null>(null)
  const [prosesFoto, setProsesFoto] = useState(false)

  // kamera
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [kameraAktif, setKameraAktif] = useState(false)
  const [deteksi, setDeteksi] = useState<DeteksiWajah | null>(null)
  const [deskriptorKamera, setDeskriptorKamera] = useState<number[] | null>(null)
  const [menangkap, setMenangkap] = useState(false)

  const cari = useCallback(async () => {
    if (q.trim().length < 2) return
    setMencari(true)
    try {
      setHasilCari(await cariOrangWajah(q))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pencarian gagal")
    } finally {
      setMencari(false)
    }
  }, [q])

  const hentikan = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    hentikanKamera(streamRef.current)
    streamRef.current = null
    setKameraAktif(false)
    setDeteksi(null)
  }, [])

  useEffect(() => () => {
    hentikan()
    if (pratinjau) URL.revokeObjectURL(pratinjau)
  }, [hentikan, pratinjau])

  const mulaiKamera = async () => {
    const video = videoRef.current
    if (!video) return
    try {
      const stream = await bukaKamera(video)
      streamRef.current = stream
      setKameraAktif(true)
      timerRef.current = setInterval(async () => {
        try {
          setDeteksi(await deteksiWajah(video))
        } catch {
          /* abaikan frame gagal */
        }
      }, 450)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuka kamera")
    }
  }

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const lebar = video.clientWidth || 480
    const tinggi = video.clientHeight || 360
    if (canvas.width !== lebar || canvas.height !== tinggi) {
      canvas.width = lebar
      canvas.height = tinggi
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!deteksi || !video.videoWidth) return
    const sx = canvas.width / video.videoWidth
    const sy = canvas.height / video.videoHeight
    const { x, y, width, height } = deteksi.kotak
    ctx.lineWidth = 3
    ctx.strokeStyle = deteksi.skor >= 0.5 ? "#10b981" : "#f59e0b"
    ctx.strokeRect(x * sx, y * sy, width * sx, height * sy)
  }, [deteksi, kameraAktif])

  const pilihBerkas = async (file: File | undefined) => {
    if (!file) return
    if (!/^image\//.test(file.type)) {
      toast.error("File harus berupa gambar")
      return
    }
    setProsesFoto(true)
    setBerkas(file)
    setDeskriptorUpload(null)
    if (pratinjau) URL.revokeObjectURL(pratinjau)
    setPratinjau(URL.createObjectURL(file))
    try {
      const hasil = await deskriptorDariBerkas(file)
      setDeskriptorUpload(hasil.deskriptor)
      toast.success(`Wajah terdeteksi (skor ${hasil.skor.toFixed(2)})`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deteksi wajah gagal")
    } finally {
      setProsesFoto(false)
    }
  }

  const tangkap = async () => {
    const video = videoRef.current
    if (!video) return
    setMenangkap(true)
    try {
      const d = await deskriptorRataRataVideo(video, 3, 200)
      setDeskriptorKamera(d)
      toast.success("Wajah tertangkap — simpan untuk mendaftarkan profil")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengambil wajah")
    } finally {
      setMenangkap(false)
    }
  }

  const simpan = async () => {
    if (!pilih) {
      toast.error("Pilih guru/siswa terlebih dahulu")
      return
    }
    const deskriptor = mode === "UPLOAD" ? deskriptorUpload : deskriptorKamera
    if (!deskriptor) {
      toast.error(mode === "UPLOAD" ? "Upload foto wajah yang jelas" : "Tangkap wajah lewat kamera dulu")
      return
    }
    setMenyimpan(true)
    try {
      let fotoId: string | null = null
      if (mode === "UPLOAD" && berkas) {
        fotoId = await unggahFoto(berkas, `wajah-${pilih.nama.replace(/\s+/g, "-")}.jpg`)
      } else if (mode === "KAMERA" && videoRef.current) {
        const blob = await potretFrame(videoRef.current)
        if (blob) fotoId = await unggahFoto(blob, `wajah-${pilih.nama.replace(/\s+/g, "-")}.jpg`)
      }

      await simpanProfilWajah({
        tipe: pilih.tipe,
        targetId: pilih.targetId,
        deskriptor,
        fotoId,
        sampel: mode === "KAMERA" ? 3 : 1,
        sumber: mode === "KAMERA" ? "WEBCAM" : "UPLOAD",
      })
      toast.success(`Profil wajah ${pilih.nama} tersimpan`)
      setPilih(null)
      setBerkas(null)
      setDeskriptorUpload(null)
      setDeskriptorKamera(null)
      setHasilCari((rows) => rows.map((r) => (r.targetId === pilih.targetId ? { ...r, sudahTerdaftar: true } : r)))
      onTersimpan?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan profil wajah")
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1. Pilih guru / siswa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama / NIS / NIP…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && cari()}
                className="w-72 pl-8"
              />
            </div>
            <Button size="sm" variant="outline" onClick={cari} disabled={mencari || q.trim().length < 2}>
              {mencari ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />} Cari
            </Button>
          </div>

          {hasilCari.length > 0 && (
            <div className="divide-y rounded-lg border">
              {hasilCari.map((o) => (
                <button
                  key={`${o.tipe}:${o.targetId}`}
                  type="button"
                  onClick={() => setPilih(o)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 ${
                    pilih?.targetId === o.targetId ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{o.nama}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {o.tipe === "GURU" ? "Guru" : "Siswa"} • {o.nis ?? "-"} {o.kelas ? `• ${o.kelas}` : ""}
                    </span>
                    {o.sudahTerdaftar ? (
                      <Badge className="bg-emerald-100 text-emerald-800">sudah terdaftar</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">belum</Badge>
                    )}
                  </span>
                  {pilih?.targetId === o.targetId && <UserCheck className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            2. Daftarkan wajah {pilih ? <span className="text-muted-foreground">— {pilih.nama}</span> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={mode === "UPLOAD" ? "default" : "outline"} onClick={() => setMode("UPLOAD")}>
              <ImageUp className="mr-1.5 h-4 w-4" /> Upload Foto
            </Button>
            <Button size="sm" variant={mode === "KAMERA" ? "default" : "outline"} onClick={() => setMode("KAMERA")}>
              <Camera className="mr-1.5 h-4 w-4" /> Webcam
            </Button>
          </div>

          {mode === "UPLOAD" ? (
            <div className="flex flex-wrap items-start gap-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pilihBerkas(e.target.files?.[0])}
              />
              <div className="flex flex-col gap-2">
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={prosesFoto}>
                  {prosesFoto ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                  Pilih Foto Wajah
                </Button>
                <span className="max-w-52 text-[11px] text-muted-foreground">
                  Foto menghadap kamera, wajah jelas & tidak tertutup. Deteksi wajah berjalan di browser ini.
                </span>
              </div>
              {pratinjau && (
                <div className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pratinjau} alt="Pratinjau wajah" className="h-36 w-36 rounded-lg border object-cover" />
                  <Badge
                    variant="outline"
                    className={deskriptorUpload ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}
                  >
                    {deskriptorUpload ? <><Check className="mr-1 h-3 w-3" /> wajah terdeteksi</> : prosesFoto ? "memproses…" : "wajah tidak terdeteksi"}
                  </Badge>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-xl border bg-slate-950">
                <video ref={videoRef} className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} playsInline muted />
                <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" style={{ transform: "scaleX(-1)" }} />
                {!kameraAktif && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-slate-300">
                    <ScanFace className="h-9 w-9" />
                    <Button size="sm" onClick={mulaiKamera}>Nyalakan Kamera</Button>
                  </div>
                )}
                {kameraAktif && (
                  <button
                    type="button"
                    onClick={hentikan}
                    className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white"
                  >
                    Matikan
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={tangkap} disabled={!kameraAktif || menangkap || !deteksi}>
                  {menangkap ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}
                  Tangkap Wajah
                </Button>
                <Badge variant="outline" className={deskriptorKamera ? "border-emerald-300 text-emerald-700" : "text-muted-foreground"}>
                  {deskriptorKamera ? "3 sampel siap disimpan" : "belum ada sampel"}
                </Badge>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={simpan} disabled={!pilih || menyimpan}>
              {menyimpan ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              Simpan Profil Wajah
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Hanya descriptor wajah (128 angka) + foto referensi yang disimpan. Descriptor tidak bisa diubah balik menjadi foto.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
