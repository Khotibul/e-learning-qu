"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Save, ArrowLeft, Search, Plus, X } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { createUjian, updateUjian } from "../../../actions"

interface MapelRef {
  id: string
  nama: string
  kode: string
  kelas: { id: string; nama: string }
}

interface KelasRef {
  id: string
  nama: string
  tingkat: number
}

interface SemesterRef {
  id: string
  nama: string
  tahunAjaran: { nama: string }
}

interface TahunAjaranRef {
  id: string
  nama: string
}

interface BankSoalRef {
  id: string
  pertanyaan: string
  subSoal: any
  jenisSoal: string
  bab: string | null
  mataPelajaranId: string
}

const subCount = (s: BankSoalRef) => {
  if (!s.subSoal) return 0
  const arr = Array.isArray(s.subSoal) ? s.subSoal : []
  return arr.filter((a: any) => a.pertanyaan?.trim()).length
}

interface UjianData {
  id: string
  nama: string
  deskripsi: string | null
  mataPelajaranId: string
  kelasId: string
  semesterId: string
  tahunAjaranId: string
  jumlahSoal: number
  nilaiMinimum: number
  durasi: number
  tanggal: Date
  jamMulai: Date
  jamSelesai: Date
  mode: string
  isLatihan: boolean
  status: string
  randomSoal: boolean
  randomJawaban: boolean
  fullscreen: boolean
  disableCopy: boolean
  disablePaste: boolean
  bisaRetake: boolean
  ujianSoal: { soal: BankSoalRef & { mataPelajaran: { nama: string } }; nomor: number }[]
}

export function UjianFormClient({
  ujian,
  mapels,
  kelass,
  semesters,
  tahunAjarans,
  bankSoal,
  isNew,
}: {
  ujian: UjianData | null
  mapels: MapelRef[]
  kelass: KelasRef[]
  semesters: SemesterRef[]
  tahunAjarans: TahunAjaranRef[]
  bankSoal: (BankSoalRef & { mataPelajaran: { nama: string } })[]
  isNew: boolean
}) {
  const router = useRouter()

  const formatDateInput = (d: Date | string) => {
    const date = new Date(d)
    return date.toISOString().split("T")[0]
  }
  const formatTimeInput = (d: Date | string) => {
    const date = new Date(d)
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
  }

  const [nama, setNama] = useState(ujian?.nama ?? "")
  const [deskripsi, setDeskripsi] = useState(ujian?.deskripsi ?? "")
  const [mataPelajaranId, setMataPelajaranId] = useState(ujian?.mataPelajaranId ?? "")
  const [kelasId, setKelasId] = useState(ujian?.kelasId ?? "")
  const [semesterId, setSemesterId] = useState(ujian?.semesterId ?? "")
  const [tahunAjaranId, setTahunAjaranId] = useState(ujian?.tahunAjaranId ?? "")
  const [nilaiMinimum, setNilaiMinimum] = useState(ujian?.nilaiMinimum ?? 70)
  const [durasi, setDurasi] = useState(ujian?.durasi ?? 60)
  const [tanggal, setTanggal] = useState(ujian ? formatDateInput(ujian.tanggal) : "")
  const [jamMulai, setJamMulai] = useState(ujian ? formatTimeInput(ujian.jamMulai) : "")
  const [jamSelesai, setJamSelesai] = useState(ujian ? formatTimeInput(ujian.jamSelesai) : "")
  const [mode, setMode] = useState(ujian?.mode ?? "manual")
  const [isLatihan, setIsLatihan] = useState(ujian?.isLatihan ?? false)
  const [randomSoal, setRandomSoal] = useState(ujian?.randomSoal ?? true)
  const [randomJawaban, setRandomJawaban] = useState(ujian?.randomJawaban ?? true)
  const [fullscreen, setFullscreen] = useState(ujian?.fullscreen ?? true)
  const [disableCopy, setDisableCopy] = useState(ujian?.disableCopy ?? true)
  const [disablePaste, setDisablePaste] = useState(ujian?.disablePaste ?? true)
  const [bisaRetake, setBisaRetake] = useState(ujian?.bisaRetake ?? false)
  const [selectedSoalIds, setSelectedSoalIds] = useState<string[]>(
    ujian?.ujianSoal.map((us) => us.soal.id) ?? []
  )
  const [soalSearch, setSoalSearch] = useState("")
  const [saving, setSaving] = useState(false)

  const countSoalItems = (s: BankSoalRef) => {
    if (s.subSoal && Array.isArray(s.subSoal)) {
      const valid = s.subSoal.filter((a: any) => a.pertanyaan?.trim())
      if (valid.length > 0) return valid.length
    }
    return 1
  }

  const filteredBankSoal = bankSoal.filter(
    (s) =>
      s.pertanyaan.toLowerCase().includes(soalSearch.toLowerCase()) &&
      !selectedSoalIds.includes(s.id)
  )

  const selectedSoals = bankSoal.filter((s) => selectedSoalIds.includes(s.id))

  const toggleSoal = (id: string) => {
    setSelectedSoalIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    )
  }

  const subJenisList = (s: BankSoalRef) => {
    if (!s.subSoal || !Array.isArray(s.subSoal)) return []
    const jenisSet = new Set<string>()
    s.subSoal.forEach((sub: any) => {
      if (sub.jenis) jenisSet.add(sub.jenis)
    })
    return Array.from(jenisSet)
  }

  const subJenisLabels: Record<string, string> = {
    PILIHAN_GANDA: "PG",
    ESSAY: "Essay",
    TRUE_FALSE: "B/S",
    ISIAN_SINGKAT: "Isian",
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama.trim()) { toast.error("Nama ujian harus diisi"); return }
    if (!mataPelajaranId) { toast.error("Mata pelajaran harus dipilih"); return }
    if (!kelasId) { toast.error("Kelas harus dipilih"); return }
    if (!semesterId) { toast.error("Semester harus dipilih"); return }
    if (!tahunAjaranId) { toast.error("Tahun ajaran harus dipilih"); return }
    if (!tanggal) { toast.error("Tanggal harus diisi"); return }
    if (!jamMulai) { toast.error("Jam mulai harus diisi"); return }
    if (!jamSelesai) { toast.error("Jam selesai harus diisi"); return }
    if (selectedSoalIds.length === 0) { toast.error("Pilih minimal satu soal"); return }

    setSaving(true)
    try {
      const payload = {
        nama,
        deskripsi: deskripsi || undefined,
        mataPelajaranId,
        kelasId,
        semesterId,
        tahunAjaranId,
        jumlahSoal: selectedSoals.reduce((sum, s) => sum + countSoalItems(s), 0),
        nilaiMinimum,
        durasi,
        tanggal,
        jamMulai,
        jamSelesai,
        mode,
        isLatihan,
        randomSoal,
        randomJawaban,
        fullscreen,
        disableCopy,
        disablePaste,
        bisaRetake,
        soalIds: selectedSoalIds,
        status: isNew ? "DRAFT" : undefined,
      }

      if (isNew) {
        await createUjian(payload)
        toast.success("Ujian berhasil dibuat")
      } else {
        await updateUjian(ujian!.id, payload)
        toast.success("Ujian berhasil diperbarui")
      }
      router.push("/guru/ujian")
      router.refresh()
    } catch {
      toast.error("Gagal menyimpan ujian")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {isNew ? "Buat Ujian Baru" : "Edit Ujian"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isNew ? "Atur ujian atau latihan baru" : "Perbarui detail ujian"}
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Informasi Ujian</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nama">Nama Ujian</Label>
                <Input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="UH 1 Matematika" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deskripsi">Deskripsi</Label>
                <textarea
                  id="deskripsi"
                  className="flex min-h-[80px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder="Deskripsi ujian (opsional)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mode">Mode</Label>
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger id="mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="otomatis">Otomatis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipe</Label>
                  <div className="flex items-center gap-3 pt-2">
                    <Switch checked={isLatihan} onCheckedChange={setIsLatihan} />
                    <span className="text-sm">{isLatihan ? "Latihan" : "Ujian"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pengaturan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mapel">Mata Pelajaran</Label>
                  <Select value={mataPelajaranId} onValueChange={setMataPelajaranId}>
                    <SelectTrigger id="mapel"><SelectValue placeholder="Pilih" /></SelectTrigger>
                    <SelectContent>
                      {mapels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kelas">Kelas</Label>
                  <Select value={kelasId} onValueChange={setKelasId}>
                    <SelectTrigger id="kelas"><SelectValue placeholder="Pilih" /></SelectTrigger>
                    <SelectContent>
                      {kelass.map((k) => (
                        <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="semester">Semester</Label>
                  <Select value={semesterId} onValueChange={setSemesterId}>
                    <SelectTrigger id="semester"><SelectValue placeholder="Pilih" /></SelectTrigger>
                    <SelectContent>
                      {semesters.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.nama} - {s.tahunAjaran.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tahun">Tahun Ajaran</Label>
                  <Select value={tahunAjaranId} onValueChange={setTahunAjaranId}>
                    <SelectTrigger id="tahun"><SelectValue placeholder="Pilih" /></SelectTrigger>
                    <SelectContent>
                      {tahunAjarans.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Waktu & Nilai</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-2">
                <Label htmlFor="jumlahSoal">Jumlah Soal</Label>
                <Input id="jumlahSoal" type="number" min={1} value={selectedSoals.reduce((sum, s) => sum + countSoalItems(s), 0)} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nilaiMin">Nilai Minimum</Label>
                <Input id="nilaiMin" type="number" min={0} max={100} value={nilaiMinimum} onChange={(e) => setNilaiMinimum(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="durasi">Durasi (menit)</Label>
                <Input id="durasi" type="number" min={1} value={durasi} onChange={(e) => setDurasi(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tanggal">Tanggal</Label>
                <Input id="tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jamMulai">Jam Mulai</Label>
                <Input id="jamMulai" type="time" value={jamMulai} onChange={(e) => setJamMulai(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jamSelesai">Jam Selesai</Label>
                <Input id="jamSelesai" type="time" value={jamSelesai} onChange={(e) => setJamSelesai(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pengaturan Keamanan</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Acak Soal", value: randomSoal, set: setRandomSoal },
                { label: "Acak Jawaban", value: randomJawaban, set: setRandomJawaban },
                { label: "Fullscreen", value: fullscreen, set: setFullscreen },
                { label: "Nonaktifkan Copy", value: disableCopy, set: setDisableCopy },
                { label: "Nonaktifkan Paste", value: disablePaste, set: setDisablePaste },
                { label: "Bisa Retake", value: bisaRetake, set: setBisaRetake },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border p-3">
                  <span className="text-sm font-medium">{item.label}</span>
                  <Switch checked={item.value} onCheckedChange={item.set} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pilih Soal</CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Tambah Soal
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Pilih Soal dari Bank Soal</DialogTitle></DialogHeader>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari soal..."
                    value={soalSearch}
                    onChange={(e) => setSoalSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredBankSoal.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {soalSearch ? "Tidak ada soal yang cocok" : "Semua soal sudah dipilih"}
                    </p>
                  ) : (
                    filteredBankSoal.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleSoal(s.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSoalIds.includes(s.id)}
                          onChange={() => toggleSoal(s.id)}
                          className="mt-1 h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-2">{s.pertanyaan}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px]">{s.jenisSoal}</Badge>
                            {s.bab && <Badge variant="secondary" className="text-[10px]">{s.bab}</Badge>}
                            <Badge variant="outline" className="text-[10px]">{subCount(s) > 0 ? `${subCount(s)} sub` : "1 soal"}</Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {selectedSoals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Belum ada soal dipilih</p>
                <p className="text-sm mt-1">Klik "Tambah Soal" untuk memilih dari bank soal</p>
              </div>
            ) : (
              <div className="space-y-2">
                    {selectedSoals.map((s, idx) => (
                      <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border">
                        <span className="text-sm font-medium text-muted-foreground w-8 shrink-0">{idx + 1}.</span>
                        <p className="flex-1 text-sm line-clamp-1">{s.pertanyaan}</p>
                        {subCount(s) > 0 ? (
                          <div className="flex gap-1 shrink-0">
                            {subJenisList(s).map((j) => (
                              <Badge key={j} variant="outline" className="text-[10px]">
                                {subJenisLabels[j] ?? j}
                              </Badge>
                            ))}
                            <Badge variant="secondary" className="text-[10px]">{subCount(s)} item</Badge>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] shrink-0">1 item</Badge>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => toggleSoal(s.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
