"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Save, ArrowLeft, Plus, Trash2, ListTree, FileText, Layers } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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

interface SubSoalItem {
  pertanyaan: string
  jenis: string
  pilihanGanda?: PilihanGanda[]
  trueFalse?: boolean
  jawaban: string
  poin: number
}

const subJenisOptions = [
  { value: "ISIAN_SINGKAT", label: "Isian Singkat" },
  { value: "ESSAY", label: "Essay" },
  { value: "PILIHAN_GANDA", label: "Pilihan Ganda" },
  { value: "TRUE_FALSE", label: "Benar/Salah" },
]

const nextLabel = (arr: PilihanGanda[]) => String.fromCharCode(65 + arr.length)

interface MapelRef {
  id: string
  nama: string
  kode: string
  kelas: { id: string; nama: string }
}

interface SoalData {
  id: string
  pertanyaan: string
  subSoal: any
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
}

export function SoalFormClient({
  soal,
  mapels,
  isNew,
}: {
  soal: SoalData | null
  mapels: MapelRef[]
  isNew: boolean
}) {
  const router = useRouter()

  const parseSubSoal = (val: any): SubSoalItem[] => {
    if (Array.isArray(val)) return val as SubSoalItem[]
    return []
  }

  const initialSub = parseSubSoal(soal?.subSoal)
  const hasExistingSub = initialSub.length > 0

  const [soalMode, setSoalMode] = useState<"single" | "sub">(hasExistingSub ? "sub" : "single")

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
  const [subSoal, setSubSoal] = useState<SubSoalItem[]>(
    initialSub.length > 0 ? initialSub : []
  )
  const [saving, setSaving] = useState(false)

  const isSubMode = soalMode === "sub"
  const hasSubSoal = isSubMode && subSoal.length > 0 && subSoal.some((s) => s.pertanyaan.trim())

  const computedPoin = hasSubSoal
    ? subSoal.reduce((sum, s) => sum + (s.poin || 0), 0)
    : poin

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

  const addSubSoal = () => {
    setSubSoal([...subSoal, { pertanyaan: "", jenis: "ISIAN_SINGKAT", jawaban: "", poin: 1 }])
  }

  const updateSubSoal = (idx: number, field: keyof SubSoalItem, value: any) => {
    const updated = [...subSoal]
    updated[idx] = { ...updated[idx], [field]: value }
    if (field === "jenis") {
      if (value === "PILIHAN_GANDA" && !updated[idx].pilihanGanda) {
        updated[idx].pilihanGanda = [
          { label: "A", text: "" },
          { label: "B", text: "" },
          { label: "C", text: "" },
          { label: "D", text: "" },
        ]
        updated[idx].jawaban = ""
      } else if (value === "TRUE_FALSE") {
        updated[idx].trueFalse = null as any
        updated[idx].jawaban = ""
      } else {
        updated[idx].pilihanGanda = undefined
        updated[idx].trueFalse = undefined
        updated[idx].jawaban = updated[idx].jawaban || ""
      }
    }
    setSubSoal(updated)
  }

  const addSubOption = (idx: number) => {
    const updated = [...subSoal]
    const opts = updated[idx].pilihanGanda || []
    updated[idx] = { ...updated[idx], pilihanGanda: [...opts, { label: nextLabel(opts), text: "" }] }
    setSubSoal(updated)
  }

  const removeSubOption = (sIdx: number, oIdx: number) => {
    const updated = [...subSoal]
    let opts = updated[sIdx].pilihanGanda || []
    if (opts.length <= 2) return
    opts = opts.filter((_, i) => i !== oIdx).map((opt, i) => ({ ...opt, label: String.fromCharCode(65 + i) }))
    updated[sIdx] = { ...updated[sIdx], pilihanGanda: opts }
    setSubSoal(updated)
  }

  const updateSubOption = (sIdx: number, oIdx: number, text: string) => {
    const updated = [...subSoal]
    const opts = [...(updated[sIdx].pilihanGanda || [])]
    opts[oIdx] = { ...opts[oIdx], text }
    updated[sIdx] = { ...updated[sIdx], pilihanGanda: opts }
    setSubSoal(updated)
  }

  const removeSubSoal = (idx: number) => {
    if (subSoal.length <= 1) return
    setSubSoal(subSoal.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pertanyaan.trim()) { toast.error(isSubMode ? "Judul/instruksi soal harus diisi" : "Pertanyaan harus diisi"); return }
    if (!mataPelajaranId) { toast.error("Mata pelajaran harus dipilih"); return }

    if (isSubMode) {
      if (subSoal.length === 0) { toast.error("Tambahkan minimal satu sub pertanyaan"); return }
      const emptySub = subSoal.find((s) => !s.pertanyaan.trim())
      if (emptySub) { toast.error("Semua sub pertanyaan harus diisi"); return }
      for (const s of subSoal) {
        if (s.jenis === "PILIHAN_GANDA") {
          const emptyOpt = (s.pilihanGanda || []).find((o) => !o.text.trim())
          if (emptyOpt) { toast.error(`Opsi ${emptyOpt.label} pada sub pertanyaan belum diisi`); return }
          if (!s.jawaban.trim()) { toast.error("Jawaban benar harus dipilih pada setiap sub pertanyaan PG"); return }
        }
      }
    } else {
      if (isPG) {
        const emptyOption = pilihanGanda.find((o) => !o.text.trim())
        if (emptyOption) { toast.error(`Opsi ${emptyOption.label} belum diisi`); return }
        if (!jawaban.trim()) { toast.error("Jawaban benar harus dipilih"); return }
      }
      if (isTF && trueFalse === null) { toast.error("Jawaban benar harus dipilih"); return }
      if (!jawaban.trim() && !isTF) { toast.error("Jawaban harus diisi"); return }
    }

    setSaving(true)
    try {
      const payload = isSubMode ? {
        pertanyaan,
        jenisSoal: "ESSAY",
        tingkatKesulitan,
        jawaban: "",
        poin: computedPoin,
        bab: bab || undefined,
        tags: tags || undefined,
        mataPelajaranId,
        subSoal,
      } : {
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
        subSoal: undefined,
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
            <div className="flex gap-4 mb-2">
              <Button
                type="button"
                variant={soalMode === "single" ? "default" : "outline"}
                onClick={() => { setSoalMode("single"); setSubSoal([]) }}
                className="flex-1 sm:flex-none"
              >
                <FileText className="h-4 w-4 mr-2" /> Soal Tunggal
              </Button>
              <Button
                type="button"
                variant={soalMode === "sub" ? "default" : "outline"}
                onClick={() => { setSoalMode("sub"); if (subSoal.length === 0) addSubSoal() }}
                className="flex-1 sm:flex-none"
              >
                <Layers className="h-4 w-4 mr-2" /> Sub Pertanyaan
              </Button>
            </div>

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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {!isSubMode && (
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
              )}
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
                <Label htmlFor="poin">Poin {isSubMode && <span className="text-xs text-muted-foreground">(otomatis)</span>}</Label>
                <Input id="poin" type="number" min={1} value={isSubMode ? computedPoin : poin} onChange={(e) => setPoin(Number(e.target.value))} disabled={isSubMode} />
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

        {isSubMode ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListTree className="h-5 w-5" />
                  Judul / Instruksi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="pertanyaan">Judul / Instruksi</Label>
                  <Textarea
                    id="pertanyaan"
                    placeholder="Contoh: Jawablah pertanyaan-pertanyaan berikut dengan benar"
                    value={pertanyaan}
                    onChange={(e) => setPertanyaan(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Sub Pertanyaan
                  {hasSubSoal && (
                    <Badge variant="secondary" className="ml-2">{subSoal.length} pertanyaan</Badge>
                  )}
                </CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addSubSoal}>
                  <Plus className="h-4 w-4 mr-1" /> Tambah
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {subSoal.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm">Belum ada sub pertanyaan</p>
                    <p className="text-xs mt-1">Klik "Tambah" untuk menambahkan pertanyaan</p>
                  </div>
                ) : (
                  subSoal.map((item, idx) => {
                    const isSubPG = item.jenis === "PILIHAN_GANDA"
                    const isSubTF = item.jenis === "TRUE_FALSE"
                    return (
                      <div key={idx} className="rounded-xl border p-4 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Soal {idx + 1}</Badge>
                            <Select
                              value={item.jenis}
                              onValueChange={(v) => updateSubSoal(idx, "jenis", v)}
                            >
                              <SelectTrigger className="h-7 w-auto text-xs gap-1 border-0 bg-muted/50 shadow-none">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {subJenisOptions.map((o) => (
                                  <SelectItem key={o.value} value={o.value} className="text-xs">
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {subSoal.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSubSoal(idx)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Teks Pertanyaan</Label>
                          <Textarea
                            value={item.pertanyaan}
                            onChange={(e) => updateSubSoal(idx, "pertanyaan", e.target.value)}
                            placeholder="Masukkan teks sub pertanyaan..."
                            className="min-h-[60px]"
                          />
                        </div>

                        {isSubPG && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Opsi Jawaban</Label>
                              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addSubOption(idx)}>
                                <Plus className="h-3 w-3 mr-1" /> Tambah
                              </Button>
                            </div>
                            {(item.pilihanGanda || []).map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`sub-pg-${idx}`}
                                  value={opt.label}
                                  checked={item.jawaban === opt.label}
                                  onChange={(e) => updateSubSoal(idx, "jawaban", e.target.value)}
                                  className="h-4 w-4 shrink-0"
                                />
                                <span className="font-medium text-xs w-5 shrink-0">{opt.label}.</span>
                                <Input
                                  value={opt.text}
                                  onChange={(e) => updateSubOption(idx, oi, e.target.value)}
                                  placeholder={`Teks ${opt.label}`}
                                  className="h-8 text-sm flex-1 min-w-0"
                                />
                                {(item.pilihanGanda || []).length > 2 && (
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeSubOption(idx, oi)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {isSubTF && (
                          <div className="flex gap-3">
                            <Button
                              type="button"
                              variant={item.trueFalse === true ? "default" : "outline"}
                              onClick={() => { const u = [...subSoal]; u[idx] = { ...u[idx], trueFalse: true, jawaban: "true" }; setSubSoal(u) }}
                              size="sm"
                              className="flex-1 h-8 text-xs"
                            >
                              Benar
                            </Button>
                            <Button
                              type="button"
                              variant={item.trueFalse === false ? "default" : "outline"}
                              onClick={() => { const u = [...subSoal]; u[idx] = { ...u[idx], trueFalse: false, jawaban: "false" }; setSubSoal(u) }}
                              size="sm"
                              className="flex-1 h-8 text-xs"
                            >
                              Salah
                            </Button>
                          </div>
                        )}

                        {!isSubPG && !isSubTF && (
                          <div className="space-y-1">
                            <Label className="text-xs">Kunci Jawaban</Label>
                            <Input
                              value={item.jawaban}
                              onChange={(e) => updateSubSoal(idx, "jawaban", e.target.value)}
                              placeholder="Jawaban benar"
                              className="h-8 text-sm"
                            />
                          </div>
                        )}

                        <div className="flex justify-end">
                          <div className="w-24">
                            <Label className="text-xs">Poin</Label>
                            <Input
                              type="number"
                              min={1}
                              value={item.poin}
                              onChange={(e) => updateSubSoal(idx, "poin", Number(e.target.value) || 1)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                {hasSubSoal && (
                  <div className="text-sm text-muted-foreground text-right">
                    Total Poin: <span className="font-semibold text-foreground">{computedPoin}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Pertanyaan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="pertanyaan">Teks Pertanyaan</Label>
                  <Textarea
                    id="pertanyaan"
                    placeholder="Masukkan teks pertanyaan..."
                    value={pertanyaan}
                    onChange={(e) => setPertanyaan(e.target.value)}
                    className="min-h-[80px]"
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
          </>
        )}

        <Card>
          <CardHeader><CardTitle>Preview Soal</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-xl border p-4 space-y-3 bg-muted/30">
              {isSubMode && hasSubSoal ? (
                <>
                  <p className="font-medium">Judul:</p>
                  <p className="whitespace-pre-wrap">{pertanyaan || <span className="text-muted-foreground italic">Belum ada judul</span>}</p>
                  <div className="space-y-3 mt-3">
                    {subSoal.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-lg border bg-background">
                        <p className="text-sm font-medium">{idx + 1}. {item.pertanyaan || <span className="text-muted-foreground italic">Kosong</span>}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px]">
                            {subJenisOptions.find((o) => o.value === item.jenis)?.label || item.jenis}
                          </Badge>
                          {item.jenis === "PILIHAN_GANDA" && item.pilihanGanda && (
                            <span className="text-xs text-muted-foreground">
                              {item.pilihanGanda.filter((o) => o.text.trim()).length} opsi
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{item.poin} poin</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Kunci: {item.jenis === "TRUE_FALSE" ? (item.trueFalse ? "Benar" : "Salah") : (item.jawaban || "-")}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Sub Soal</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded-full">
                      {tingkatOptions.find((o) => o.value === tingkatKesulitan)?.label}
                    </span>
                    <span className="text-xs bg-muted px-2 py-1 rounded-full">{computedPoin} poin</span>
                    <span className="text-xs bg-muted px-2 py-1 rounded-full">{subSoal.length} sub soal</span>
                  </div>
                </>
              ) : (
                <>
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
                    <span className="text-xs bg-muted px-2 py-1 rounded-full">{poin} poin</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
