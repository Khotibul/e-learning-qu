"use client"

import { useState, useRef } from "react"
import { Sparkles, Upload, Loader2, Check, X } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { simpanSoalGenerate } from "../../actions"

interface MapelRef { id: string; nama: string; kode: string }

interface SoalAiItem {
  pertanyaan: string
  jenisSoal: string
  tingkatKesulitan?: string
  pilihanGanda?: { label: string; text: string }[]
  trueFalse?: boolean
  jawaban: string
  pembahasan?: string
  poin?: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mapels: MapelRef[]
  onSaved: () => void
}

const jenisOptions = [
  { value: "CAMPUR", label: "Campur (AI pilih)" },
  { value: "PILIHAN_GANDA", label: "Pilihan Ganda" },
  { value: "ESSAY", label: "Essay" },
  { value: "TRUE_FALSE", label: "Benar/Salah" },
  { value: "ISIAN_SINGKAT", label: "Isian Singkat" },
]

const tingkatOptions = [
  { value: "CAMPUR", label: "Campur" },
  { value: "MUDAH", label: "Mudah" },
  { value: "SEDANG", label: "Sedang" },
  { value: "SULIT", label: "Sulit" },
]

const jenisLabel: Record<string, string> = {
  PILIHAN_GANDA: "Pilihan Ganda",
  ESSAY: "Essay",
  TRUE_FALSE: "Benar/Salah",
  ISIAN_SINGKAT: "Isian Singkat",
  MATCHING: "Menjodohkan",
}

export function GenerateSoalDialog({ open, onOpenChange, mapels, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [topik, setTopik] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [mapelId, setMapelId] = useState(mapels[0]?.id || "")
  const [jumlah, setJumlah] = useState(5)
  const [jenisSoal, setJenisSoal] = useState("CAMPUR")
  const [tingkat, setTingkat] = useState("CAMPUR")
  const [poin, setPoin] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasil, setHasil] = useState<SoalAiItem[] | null>(null)
  const [terpilih, setTerpilih] = useState<boolean[]>([])

  const reset = () => {
    setTopik("")
    setFile(null)
    setHasil(null)
    setTerpilih([])
    if (fileRef.current) fileRef.current.value = ""
  }

  const handleGenerate = async () => {
    if (!topik.trim() && !file) {
      toast.error("Isi topik atau unggah file materi")
      return
    }
    if (!mapelId) {
      toast.error("Pilih mata pelajaran")
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      if (topik.trim()) fd.append("topik", topik.trim())
      if (file) fd.append("file", file)
      fd.append("jumlah", String(jumlah))
      fd.append("jenisSoal", jenisSoal)
      fd.append("tingkatKesulitan", tingkat)
      fd.append("poin", String(poin))
      const res = await fetch("/api/guru/soal/generate", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Generate gagal"); return }
      const list = (data.soal || []) as SoalAiItem[]
      setHasil(list)
      setTerpilih(list.map(() => true))
      toast.success(`${list.length} soal berhasil dibuat`)
    } catch {
      toast.error("Gagal generate soal")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!hasil) return
    const items = hasil
      .filter((_, i) => terpilih[i])
      .map((s) => ({
        pertanyaan: s.pertanyaan,
        jenisSoal: s.jenisSoal || "PILIHAN_GANDA",
        tingkatKesulitan: s.tingkatKesulitan || (tingkat !== "CAMPUR" ? tingkat : "SEDANG"),
        pilihanGanda: s.pilihanGanda,
        trueFalse: s.trueFalse,
        jawaban: s.jawaban || "",
        poin: s.poin || poin,
        mataPelajaranId: mapelId,
      }))
    if (items.length === 0) { toast.error("Pilih minimal satu soal"); return }
    setSaving(true)
    try {
      const r = await simpanSoalGenerate(items)
      toast.success(`${r.success} soal berhasil disimpan`)
      onSaved()
      onOpenChange(false)
      reset()
    } catch {
      toast.error("Gagal menyimpan soal")
    } finally {
      setSaving(false)
    }
  }

  const toggleAll = (val: boolean) => setTerpilih(terpilih.map(() => val))

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Generate Soal dengan AI
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Unggah foto/PDF materi atau ketik topik. AI akan membuat soal otomatis yang bisa diedit sebelum disimpan.
          </p>
        </DialogHeader>

        {!hasil ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mata Pelajaran</Label>
              <Select value={mapelId} onValueChange={setMapelId}>
                <SelectTrigger><SelectValue placeholder="Pilih mata pelajaran" /></SelectTrigger>
                <SelectContent>
                  {mapels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nama} ({m.kode})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Topik / Instruksi (opsional jika unggah file)</Label>
              <Textarea
                value={topik}
                onChange={(e) => setTopik(e.target.value)}
                placeholder="Contoh: Fotosintesis pada tumbuhan, materi kelas 5 SD"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>File Materi (foto JPG/PNG/WebP, PDF, atau teks .txt/.md/.csv)</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Pilih File
                </Button>
                {file && (
                  <span className="text-sm text-muted-foreground truncate">{file.name}</span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf,.txt,.md,.csv,.json"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label>Jumlah Soal</Label>
                <Input type="number" min={1} max={20} value={jumlah} onChange={(e) => setJumlah(Number(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label>Jenis Soal</Label>
                <Select value={jenisSoal} onValueChange={setJenisSoal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {jenisOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tingkat</Label>
                <Select value={tingkat} onValueChange={setTingkat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tingkatOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Poin/Soal</Label>
                <Input type="number" min={1} value={poin} onChange={(e) => setPoin(Number(e.target.value) || 1)} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate Soal
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{hasil.length} soal dibuat. Pilih yang ingin disimpan.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleAll(true)}>Pilih Semua</Button>
                <Button size="sm" variant="outline" onClick={() => toggleAll(false)}>Batal Pilih</Button>
              </div>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {hasil.map((s, i) => (
                <div key={i} className={`rounded-lg border p-3 ${terpilih[i] ? "" : "opacity-50"}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!terpilih[i]}
                      onChange={(e) => {
                        const c = [...terpilih]
                        c[i] = e.target.checked
                        setTerpilih(c)
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{i + 1}. {s.pertanyaan}</span>
                        <span className="text-xs text-muted-foreground">{jenisLabel[s.jenisSoal] || s.jenisSoal}</span>
                        {s.tingkatKesulitan && <span className="text-xs text-muted-foreground">• {s.tingkatKesulitan}</span>}
                      </div>
                      {s.pilihanGanda && s.pilihanGanda.length > 0 && (
                        <ul className="text-sm space-y-1 pl-4">
                          {s.pilihanGanda.map((o) => (
                            <li key={o.label}><span className="font-medium">{o.label}.</span> {o.text}</li>
                          ))}
                        </ul>
                      )}
                      {s.trueFalse !== undefined && (
                        <p className="text-sm">Kunci: {s.trueFalse ? "Benar" : "Salah"}</p>
                      )}
                      {(s.jenisSoal === "ISIAN_SINGKAT" || s.jenisSoal === "ESSAY") && s.jawaban && (
                        <p className="text-sm"><span className="font-medium">Kunci:</span> {s.jawaban}</p>
                      )}
                      {s.jenisSoal === "PILIHAN_GANDA" && s.jawaban && (
                        <p className="text-sm"><span className="font-medium">Kunci:</span> {s.jawaban}</p>
                      )}
                      {s.pembahasan && (
                        <p className="text-xs text-muted-foreground"><span className="font-medium">Pembahasan:</span> {s.pembahasan}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setHasil(null)} disabled={saving}>
                <X className="h-4 w-4 mr-2" /> Kembali
              </Button>
              <Button onClick={handleSave} disabled={saving || !terpilih.some(Boolean)}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Simpan {terpilih.filter(Boolean).length} Soal
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
