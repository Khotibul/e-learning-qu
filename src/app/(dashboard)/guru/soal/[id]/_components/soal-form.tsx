"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Save, ArrowLeft, Plus, Trash2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { createSoal, updateSoal } from "../../../actions"

const jenisSoalOptions = [
  { value: "PILIHAN_GANDA", label: "Pilihan Ganda" },
  { value: "ESSAY", label: "Essay" },
  { value: "TRUE_FALSE", label: "Benar/Salah" },
  { value: "MATCHING", label: "Menjodohkan" },
  { value: "ISIAN_SINGKAT", label: "Isian Singkat" },
]

const tingkatOptions = [
  { value: "MUDAH", label: "Mudah" },
  { value: "SEDANG", label: "Sedang" },
  { value: "SULIT", label: "Sulit" },
]

interface PilihanGanda {
  label: string
  text: string
}

interface MapelRef {
  id: string
  nama: string
  kode: string
  kelas: { id: string; nama: string }
}

export function SoalFormClient({
  soal,
  mapels,
  isNew,
}: {
  soal: {
    id: string
    pertanyaan: string
    jenisSoal: string
    tingkatKesulitan: string
    pilihanGanda: any
    trueFalse: boolean | null
    jawaban: string
    poin: number
    bab: string | null
    tags: string | null
    mataPelajaranId: string
    mataPelajaran: { id: string; nama: string }
  } | null
  mapels: MapelRef[]
  isNew: boolean
}) {
  const router = useRouter()
  const [pertanyaan, setPertanyaan] = useState(soal?.pertanyaan ?? "")
  const [jenisSoal, setJenisSoal] = useState(soal?.jenisSoal ?? "PILIHAN_GANDA")
  const [tingkatKesulitan, setTingkatKesulitan] = useState(soal?.tingkatKesulitan ?? "SEDANG")
  const [pilihanGanda, setPilihanGanda] = useState<PilihanGanda[]>(
    soal?.pilihanGanda ? (soal.pilihanGanda as PilihanGanda[]) : [
      { label: "A", text: "" },
      { label: "B", text: "" },
      { label: "C", text: "" },
      { label: "D", text: "" },
    ]
  )
  const [trueFalse, setTrueFalse] = useState<boolean | null>(soal?.trueFalse ?? null)
  const [jawaban, setJawaban] = useState(soal?.jawaban ?? "")
  const [poin, setPoin] = useState(soal?.poin ?? 1)
  const [bab, setBab] = useState(soal?.bab ?? "")
  const [tags, setTags] = useState(soal?.tags ?? "")
  const [mataPelajaranId, setMataPelajaranId] = useState(soal?.mataPelajaranId ?? "")
  const [saving, setSaving] = useState(false)

  const isPG = jenisSoal === "PILIHAN_GANDA"
  const isTF = jenisSoal === "TRUE_FALSE"

  const addOption = () => {
    const nextLabel = String.fromCharCode(65 + pilihanGanda.length)
    setPilihanGanda([...pilihanGanda, { label: nextLabel, text: "" }])
  }

  const removeOption = (idx: number) => {
    if (pilihanGanda.length <= 2) return
    const updated = pilihanGanda.filter((_, i) => i !== idx).map((opt, i) => ({
      ...opt,
      label: String.fromCharCode(65 + i),
    }))
    setPilihanGanda(updated)
  }

  const updateOption = (idx: number, text: string) => {
    const updated = [...pilihanGanda]
    updated[idx] = { ...updated[idx], text }
    setPilihanGanda(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pertanyaan.trim()) { toast.error("Pertanyaan harus diisi"); return }
    if (!mataPelajaranId) { toast.error("Mata pelajaran harus dipilih"); return }

    if (isPG) {
      const emptyOption = pilihanGanda.find((o) => !o.text.trim())
      if (emptyOption) { toast.error(`Opsi ${emptyOption.label} belum diisi`); return }
      if (!jawaban.trim()) { toast.error("Jawaban benar harus dipilih"); return }
    }
    if (isTF && trueFalse === null) { toast.error("Jawaban benar harus dipilih"); return }
    if (!jawaban.trim() && !isTF) { toast.error("Jawaban harus diisi"); return }

    setSaving(true)
    try {
      const payload = {
        pertanyaan,
        jenisSoal,
        tingkatKesulitan,
        pilihanGanda: isPG ? pilihanGanda : undefined,
        trueFalse: isTF && trueFalse !== null ? trueFalse : undefined,
        jawaban: isTF ? String(trueFalse) : jawaban,
        poin,
        bab: bab || undefined,
        tags: tags || undefined,
        mataPelajaranId,
      }

      if (isNew) {
        await createSoal(payload)
        toast.success("Soal berhasil dibuat")
      } else {
        await updateSoal(soal!.id, payload)
        toast.success("Soal berhasil diperbarui")
      }
      router.push("/guru/soal")
      router.refresh()
    } catch {
      toast.error("Gagal menyimpan soal")
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
            <h1 className="text-3xl font-bold tracking-tight">
              {isNew ? "Buat Soal Baru" : "Edit Soal"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isNew ? "Tambahkan soal baru ke bank soal" : "Perbarui detail soal"}
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Informasi Soal</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mapel">Mata Pelajaran</Label>
              <Select value={mataPelajaranId} onValueChange={setMataPelajaranId}>
                <SelectTrigger id="mapel"><SelectValue placeholder="Pilih Mapel" /></SelectTrigger>
                <SelectContent>
                  {mapels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nama} ({m.kelas.nama})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jenis">Jenis Soal</Label>
                <Select value={jenisSoal} onValueChange={setJenisSoal}>
                  <SelectTrigger id="jenis"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {jenisSoalOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tingkat">Tingkat Kesulitan</Label>
                <Select value={tingkatKesulitan} onValueChange={setTingkatKesulitan}>
                  <SelectTrigger id="tingkat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tingkatOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="poin">Poin</Label>
                <Input id="poin" type="number" min={1} value={poin} onChange={(e) => setPoin(Number(e.target.value))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bab">Bab</Label>
                <Input id="bab" placeholder="Contoh: Bab 1" value={bab} onChange={(e) => setBab(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (pisahkan dengan koma)</Label>
                <Input id="tags" placeholder="algebra, trigonometri" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pertanyaan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pertanyaan">Teks Pertanyaan</Label>
              <textarea
                id="pertanyaan"
                className="flex min-h-[120px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Masukkan teks pertanyaan..."
                value={pertanyaan}
                onChange={(e) => setPertanyaan(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {isPG && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pilihan Ganda</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addOption}>
                <Plus className="h-4 w-4 mr-1" /> Tambah Opsi
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {pilihanGanda.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="jawaban"
                      value={opt.label}
                      checked={jawaban === opt.label}
                      onChange={(e) => setJawaban(e.target.value)}
                      className="h-4 w-4"
                    />
                    <span className="font-medium w-6 text-sm">{opt.label}.</span>
                  </div>
                  <Input
                    value={opt.text}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    placeholder={`Teks opsi ${opt.label}`}
                    className="flex-1"
                  />
                  {pilihanGanda.length > 2 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Pilih radio button untuk jawaban yang benar</p>
            </CardContent>
          </Card>
        )}

        {isTF && (
          <Card>
            <CardHeader><CardTitle>Jawaban Benar/Salah</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={trueFalse === true ? "default" : "outline"}
                  onClick={() => setTrueFalse(true)}
                  className="flex-1"
                >
                  Benar
                </Button>
                <Button
                  type="button"
                  variant={trueFalse === false ? "default" : "outline"}
                  onClick={() => setTrueFalse(false)}
                  className="flex-1"
                >
                  Salah
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isPG && !isTF && (
          <Card>
            <CardHeader><CardTitle>Jawaban</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="jawaban">Kunci Jawaban</Label>
                <textarea
                  id="jawaban"
                  className="flex min-h-[80px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Masukkan kunci jawaban..."
                  value={jawaban}
                  onChange={(e) => setJawaban(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Preview Soal</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-xl border p-4 space-y-3 bg-muted/30">
              <p className="font-medium">Soal:</p>
              <p className="whitespace-pre-wrap">{pertanyaan || <span className="text-muted-foreground italic">Belum ada pertanyaan</span>}</p>
              {isPG && (
                <div className="space-y-2 mt-3">
                  {pilihanGanda.map((opt, idx) => (
                    <div key={idx} className={`p-2 rounded-lg border ${jawaban === opt.label ? "border-primary bg-primary/5" : ""}`}>
                      <span className="font-medium">{opt.label}.</span> {opt.text || <span className="text-muted-foreground italic">Kosong</span>}
                      {jawaban === opt.label && <span className="text-xs text-primary ml-2">(Jawaban Benar)</span>}
                    </div>
                  ))}
                </div>
              )}
              {isTF && trueFalse !== null && (
                <p className="mt-2 text-sm">Jawaban: <span className="font-semibold">{trueFalse ? "Benar" : "Salah"}</span></p>
              )}
              {!isPG && !isTF && jawaban && (
                <p className="mt-2 text-sm">Jawaban: <span className="font-semibold">{jawaban}</span></p>
              )}
              <div className="flex gap-2 mt-3">
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  {jenisSoalOptions.find((o) => o.value === jenisSoal)?.label}
                </span>
                <span className="text-xs bg-muted px-2 py-1 rounded-full">
                  {tingkatOptions.find((o) => o.value === tingkatKesulitan)?.label}
                </span>
                <span className="text-xs bg-muted px-2 py-1 rounded-full">
                  {poin} poin
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
