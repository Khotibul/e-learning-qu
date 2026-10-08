"use client"

import { useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, MapPin, Camera, Fingerprint, ShieldQuestion, Check, X, Upload } from "lucide-react"
import {
  haversineMeter,
  wajibFoto,
  wajibGps,
  wajibSidikJari,
} from "@/lib/absensi-metode"
import { ajukanPengecualianAction } from "../actions"

export type LokasiConfig = {
  lat: number | null
  lng: number | null
  radiusMeter: number
  akurasiMaksMeter: number
  gpsWajib: boolean
  lokasiNama: string | null
}

export type VerifState = {
  fotoUrl?: string | null
  gps?: { lat: number; lng: number; akurasiMeter?: number | null; mock?: boolean | null } | null
  gpsHasil?: { jarakMeter: number | null; valid: boolean; alasan: string | null } | null
  sidik?: { verified: boolean; provider?: string | null } | null
}

function Chip({ ok, label, info }: { ok: boolean; label: string; info?: string | null }) {
  return (
    <Badge
      variant="outline"
      className={`text-[11px] font-semibold ${ok ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-600"}`}
    >
      {ok ? <Check className="mr-1 h-3 w-3" /> : <X className="mr-1 h-3 w-3" />}
      {label}
      {info ? ` • ${info}` : ""}
    </Badge>
  )
}

type Props = {
  metode: string
  lokasi: LokasiConfig
  tanggal: string
  jadwalPelajaranId: string
  tahap: "MASUK" | "SELESAI"
  value: VerifState
  onChange: (v: VerifState) => void
  disabled?: boolean
}

export function VerifikasiWidget({ metode, lokasi, tanggal, jadwalPelajaranId, tahap, value, onChange, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [fingerprinting, setFingerprinting] = useState(false)
  const [showPeng, setShowPeng] = useState(false)
  const [pengJenis, setPengJenis] = useState<"LOKASI" | "BIOMETRIK" | "FOTO">("LOKASI")
  const [pengAlasan, setPengAlasan] = useState("")
  const [pengSending, setPengSending] = useState(false)

  const butuhFoto = tahap === "MASUK" && wajibFoto(metode)
  const butuhGps = wajibGps(metode) || lokasi.gpsWajib
  const butuhSidik = wajibSidikJari(metode)
  if (!butuhFoto && !butuhGps && !butuhSidik) return null

  const handleFoto = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Upload gagal")
      onChange({ ...value, fotoUrl: data.url })
      toast.success("Foto selfie tersimpan")
    } catch (e: any) {
      toast.error(e?.message || "Upload foto gagal")
    } finally {
      setUploading(false)
    }
  }

  const handleGps = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Perangkat tidak mendukung GPS")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        let hasil: VerifState["gpsHasil"] = null
        if (lokasi.lat != null && lokasi.lng != null) {
          const jarak = haversineMeter(latitude, longitude, lokasi.lat, lokasi.lng)
          const jarakMeter = Math.round(jarak * 10) / 10
          const akurasiOke = accuracy <= lokasi.akurasiMaksMeter
          const radiusOke = jarak <= lokasi.radiusMeter
          hasil = {
            jarakMeter,
            valid: akurasiOke && radiusOke,
            alasan: !akurasiOke
              ? `Akurasi ${Math.round(accuracy)}m > batas ${lokasi.akurasiMaksMeter}m`
              : !radiusOke
                ? `Jarak ${jarakMeter}m > radius ${lokasi.radiusMeter}m`
                : null,
          }
        } else {
          hasil = { jarakMeter: null, valid: false, alasan: "Lokasi absensi belum dikonfigurasi Admin" }
        }
        onChange({
          ...value,
          gps: { lat: latitude, lng: longitude, akurasiMeter: accuracy ?? null, mock: null },
          gpsHasil: hasil,
        })
        if (hasil?.valid) toast.success(`Lokasi valid • ${hasil.jarakMeter}m dari titik absensi`)
        else toast.error(hasil?.alasan || "Lokasi tidak valid")
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        const pesan =
          err.code === err.PERMISSION_DENIED
            ? "Izin lokasi ditolak — aktifkan izin GPS pada peramban"
            : err.code === err.POSITION_UNAVAILABLE
              ? "GPS tidak tersedia (sinyal tidak ditemukan)"
              : "Timeout mengambil lokasi"
        toast.error(pesan)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )
  }

  const handleSidik = async () => {
    if (!window.PublicKeyCredential) {
      toast.error("Perangkat/browser tidak mendukung verifikasi biometrik")
      return
    }
    setFingerprinting(true)
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const cred = (await navigator.credentials.get({
        publicKey: { challenge: challenge as unknown as BufferSource, userVerification: "required" },
      })) as (PublicKeyCredential & { authenticatorAttachment?: string | null }) | null
      if (!cred) throw new Error("Verifikasi biometrik dibatalkan")
      onChange({
        ...value,
        sidik: { verified: true, provider: cred.authenticatorAttachment || "platform" },
      })
      toast.success("Biometrik perangkat terverifikasi")
    } catch (e: any) {
      toast.error(e?.name === "NotAllowedError" ? "Verifikasi biometrik dibatalkan/tidak tersedia" : e?.message || "Biometrik gagal")
    } finally {
      setFingerprinting(false)
    }
  }

  const kirimPengecualian = async () => {
    setPengSending(true)
    try {
      await ajukanPengecualianAction(pengJenis, pengAlasan, tanggal, jadwalPelajaranId)
      toast.success("Pengecualian diajukan — menunggu persetujuan Admin")
      setShowPeng(false)
      setPengAlasan("")
    } catch (e: any) {
      toast.error(e?.message || "Gagal mengajukan")
    } finally {
      setPengSending(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <ShieldQuestion className="h-3.5 w-3.5" /> Verifikasi wajib ({tahap === "MASUK" ? "absen masuk" : "absen selesai"})
        </span>
        <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={() => setShowPeng((v) => !v)}>
          Ajukan Pengecualian
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {butuhFoto && (
          <div className="space-y-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => handleFoto(e.target.files?.[0])}
              disabled={disabled || uploading}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled={disabled || uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : value.fotoUrl ? <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" /> : <Camera className="mr-1 h-3.5 w-3.5" />}
                {value.fotoUrl ? "Foto OK" : "Ambil Foto"}
              </Button>
              {value.fotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value.fotoUrl} alt="Selfie" className="h-8 w-8 rounded-md object-cover border" />
              )}
            </div>
            <div><Chip ok={!!value.fotoUrl} label="Foto" /></div>
          </div>
        )}

        {butuhGps && (
          <div className="space-y-1">
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={disabled || locating} onClick={handleGps}>
              {locating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <MapPin className="mr-1 h-3.5 w-3.5" />}
              {value.gps ? "Ulangi Cek Lokasi" : "Cek Lokasi"}
            </Button>
            <div className="flex flex-wrap gap-1">
              <Chip
                ok={!!value.gpsHasil?.valid}
                label="GPS"
                info={
                  value.gpsHasil?.jarakMeter != null
                    ? `${value.gpsHasil.jarakMeter}m${value.gpsHasil.valid ? "" : " — " + (value.gpsHasil.alasan || "tidak valid")}`
                    : value.gpsHasil?.alasan || (lokasi.radiusMeter ? `radius ${lokasi.radiusMeter}m` : null)
                }
              />
            </div>
          </div>
        )}

        {butuhSidik && (
          <div className="space-y-1">
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={disabled || fingerprinting} onClick={handleSidik}>
              {fingerprinting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="mr-1 h-3.5 w-3.5" />}
              {value.sidik?.verified ? "Ulangi Sidik Jari" : "Verifikasi Sidik Jari"}
            </Button>
            <div><Chip ok={!!value.sidik?.verified} label="Sidik Jari" info={value.sidik?.provider ?? null} /></div>
          </div>
        )}
      </div>

      {showPeng && (
        <div className="space-y-2 rounded-lg border bg-background p-3">
          <Label className="text-xs">Jenis pengecualian</Label>
          <div className="flex flex-wrap gap-1.5">
            {(["LOKASI", "BIOMETRIK", "FOTO"] as const).map((j) => (
              <Button
                key={j}
                size="sm"
                variant={pengJenis === j ? "default" : "outline"}
                className="h-7 text-[11px]"
                onClick={() => setPengJenis(j)}
              >
                {j}
              </Button>
            ))}
          </div>
          <Input
            value={pengAlasan}
            onChange={(e) => setPengAlasan(e.target.value)}
            placeholder="Alasan (min. 5 karakter) — mis. GPS perangkat rusak"
            className="h-8 text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowPeng(false)}>Batal</Button>
            <Button size="sm" className="h-8 text-xs" disabled={pengSending || pengAlasan.trim().length < 5} onClick={kirimPengecualian}>
              {pengSending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Ajukan
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Pengecualian hanya berlaku setelah disetujui Admin.</p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        {lokasi.lokasiNama ? `${lokasi.lokasiNama} • ` : ""}
        Titik absensi {lokasi.lat != null && lokasi.lng != null ? `${lokasi.lat.toFixed(6)}, ${lokasi.lng.toFixed(6)}` : "belum diatur"} •
        radius {lokasi.radiusMeter}m • akurasi maks {lokasi.akurasiMaksMeter}m
      </p>
    </div>
  )
}
