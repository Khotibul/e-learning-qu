"use client"

import { useState, useRef } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2, XCircle, Camera, Save, Calendar, RotateCcw, Loader2,
} from "lucide-react"
import { saveAbsensi } from "../actions"

interface SiswaItem {
  id: string
  nis: string | null
  nama: string
}

interface KelasWithSiswa {
  id: string
  nama: string
  siswas: SiswaItem[]
}

interface MapelRef {
  id: string
  nama: string
  kode: string
  kelas: { nama: string }
}

interface AbsensiClientProps {
  kelasList: KelasWithSiswa[]
  mapels: MapelRef[]
}

type StatusSiswa = "HADIR" | "TIDAK_HADIR" | "IZIN" | "SAKIT" | "ALPA"

const statusColors: Record<StatusSiswa, string> = {
  HADIR: "bg-emerald-500 hover:bg-emerald-600",
  TIDAK_HADIR: "bg-red-500 hover:bg-red-600",
  IZIN: "bg-amber-500 hover:bg-amber-600",
  SAKIT: "bg-orange-500 hover:bg-orange-600",
  ALPA: "bg-gray-500 hover:bg-gray-600",
}

export function AbsensiClient({ kelasList, mapels }: AbsensiClientProps) {
  const [kelasId, setKelasId] = useState("")
  const [mataPelajaranId, setMataPelajaranId] = useState("")
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0])
  const [siswaStatus, setSiswaStatus] = useState<Record<string, StatusSiswa>>({})
  const [saving, setSaving] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrDialog, setOcrDialog] = useState(false)
  const [ocrResult, setOcrResult] = useState<{ nama: string; hadir: boolean }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedKelas = kelasList.find((k) => k.id === kelasId)
  const siswas = selectedKelas?.siswas ?? []

  const resetKelas = () => {
    setKelasId("")
    setMataPelajaranId("")
    setSiswaStatus({})
  }

  const selectAll = (status: StatusSiswa) => {
    const newStatus: Record<string, StatusSiswa> = {}
    siswas.forEach((s) => { newStatus[s.id] = status })
    setSiswaStatus(newStatus)
  }

  const toggleSiswa = (id: string) => {
    setSiswaStatus((prev) => ({
      ...prev,
      [id]: prev[id] === "HADIR" ? "TIDAK_HADIR" : "HADIR",
    }))
  }

  const setSiswa = (id: string, status: StatusSiswa) => {
    setSiswaStatus((prev) => ({ ...prev, [id]: status }))
  }

  const hadirCount = Object.values(siswaStatus).filter((s) => s === "HADIR").length
  const tidakHadirCount = Object.values(siswaStatus).filter(
    (s) => s !== "HADIR"
  ).length
  const totalSet = Object.keys(siswaStatus).length

  const handleOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setOcrLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/absensi/ocr", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("OCR gagal")

      const data = await res.json()
      setOcrResult(data.siswa || [])

      // Auto-match names
      const matched: Record<string, StatusSiswa> = {}
      for (const item of data.siswa || []) {
        const found = siswas.find(
          (s) => s.nama.toLowerCase().includes(item.nama.toLowerCase()) ||
                 item.nama.toLowerCase().includes(s.nama.toLowerCase())
        )
        if (found) {
          matched[found.id] = item.hadir ? "HADIR" : "TIDAK_HADIR"
        }
      }
      if (Object.keys(matched).length > 0) {
        setSiswaStatus((prev) => ({ ...prev, ...matched }))
        toast.success(`${Object.keys(matched).length} siswa dicocokkan dari OCR`)
      } else {
        toast.error("Tidak ada nama yang cocok dengan daftar siswa")
      }
      setOcrDialog(true)
    } catch {
      toast.error("Gagal memproses OCR")
    } finally {
      setOcrLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSave = async () => {
    if (!kelasId) { toast.error("Pilih kelas"); return }
    if (!mataPelajaranId) { toast.error("Pilih mata pelajaran"); return }
    if (!tanggal) { toast.error("Pilih tanggal"); return }

    const entries = Object.entries(siswaStatus)
    if (entries.length === 0) { toast.error("Belum ada siswa diisi"); return }

    setSaving(true)
    try {
      const result = await saveAbsensi(
        kelasId,
        mataPelajaranId,
        tanggal,
        entries.map(([siswaId, status]) => ({ siswaId, status }))
      )
      if (result.success) {
        toast.success("Absensi berhasil disimpan")
      }
    } catch {
      toast.error("Gagal menyimpan absensi")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Absensi</h1>
          <p className="text-muted-foreground mt-1">
            Catat kehadiran siswa setiap pertemuan
          </p>
        </div>
        <div className="flex items-center gap-2">
          {kelasId && (
            <Button variant="ghost" size="sm" onClick={resetKelas}>
              <RotateCcw className="h-4 w-4 mr-1" /> Ganti Kelas
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !kelasId}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Menyimpan..." : "Simpan Absensi"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Informasi</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Kelas</Label>
              <Select value={kelasId} onValueChange={setKelasId}>
                <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                <SelectContent>
                  {kelasList.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.nama} ({k.siswas.length} siswa)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mata Pelajaran</Label>
              <Select value={mataPelajaranId} onValueChange={setMataPelajaranId}>
                <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
                <SelectContent>
                  {mapels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nama} ({m.kelas.nama})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {kelasId && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Daftar Siswa
                {totalSet > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {hadirCount} hadir / {tidakHadirCount} tidak hadir
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {kelasId && (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleOcr}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={ocrLoading}
                    >
                      {ocrLoading ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4 mr-1" />
                      )}
                      {ocrLoading ? "Memproses..." : "Foto Absensi"}
                    </Button>
                    <Separator orientation="vertical" className="h-6" />
                    <Button variant="ghost" size="sm" onClick={() => selectAll("HADIR")}>
                      Semua Hadir
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => selectAll("TIDAK_HADIR")}>
                      Semua Tidak Hadir
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {siswas.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Tidak ada siswa di kelas ini
                </p>
              ) : (
                <div className="space-y-1">
                  {siswas.map((siswa) => {
                    const status = siswaStatus[siswa.id] || "HADIR"
                    const isHadir = status === "HADIR"
                    return (
                      <div
                        key={siswa.id}
                        className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleSiswa(siswa.id)}
                            className="shrink-0"
                          >
                            {isHadir ? (
                              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                            ) : (
                              <XCircle className="h-6 w-6 text-red-500" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{siswa.nama}</p>
                            {siswa.nis && (
                              <p className="text-xs text-muted-foreground">NIS: {siswa.nis}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {(["HADIR", "IZIN", "SAKIT", "ALPA", "TIDAK_HADIR"] as StatusSiswa[]).map(
                            (s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSiswa(siswa.id, s)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-medium text-white transition-opacity ${
                                  statusColors[s]
                                } ${status === s ? "opacity-100 ring-2 ring-offset-1 ring-black/20" : "opacity-40"}`}
                              >
                                {s === "HADIR" ? "H" : s === "TIDAK_HADIR" ? "TH" : s === "IZIN" ? "I" : s === "SAKIT" ? "S" : "A"}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
