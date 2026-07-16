"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ListTree } from "lucide-react"

interface SubSoalItem {
  pertanyaan: string
  jenis: string
  pilihanGanda?: { label: string; text: string }[] | null
  trueFalse?: boolean | null
  jawaban: string
  poin: number
}

interface SoalData {
  id: string
  nomor: number
  pertanyaan: string
  subSoal?: SubSoalItem[] | null
  gambar?: string | null
  jenisSoal: string
  tingkatKesulitan: string
  pilihanGanda?: { label: string; value: string }[] | null
  poin: number
}

interface SoalDisplayProps {
  soal: SoalData
  jawaban: string
  onJawab: (jawaban: string) => void
  isRaguRagu: boolean
}

const tingkatWarna: Record<string, "default" | "secondary" | "destructive" | "warning"> = {
  MUDAH: "secondary",
  SEDANG: "warning",
  SULIT: "destructive",
}

const tingkatLabel: Record<string, string> = {
  MUDAH: "Mudah",
  SEDANG: "Sedang",
  SULIT: "Sulit",
}

const subJenisLabels: Record<string, string> = {
  PILIHAN_GANDA: "PG",
  ESSAY: "Essay",
  TRUE_FALSE: "B/S",
  ISIAN_SINGKAT: "Isian",
}

function parseSubJawaban(jawaban: string, count: number): string[] {
  try {
    const arr = JSON.parse(jawaban)
    if (Array.isArray(arr)) {
      while (arr.length < count) arr.push("")
      return arr.slice(0, count)
    }
  } catch {}
  return Array(count).fill("")
}

export function SoalDisplay({ soal, jawaban, onJawab, isRaguRagu }: SoalDisplayProps) {
  const hasSubSoal = soal.subSoal && soal.subSoal.length > 0 && soal.subSoal.some((s) => s.pertanyaan.trim())

  if (hasSubSoal && soal.subSoal) {
    const subJawabans = parseSubJawaban(jawaban, soal.subSoal.length)

    const updateSub = (idx: number, val: string) => {
      const updated = [...subJawabans]
      updated[idx] = val
      onJawab(JSON.stringify(updated))
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Soal Nomor {soal.nomor}
            </span>
            <Badge variant="outline">{soal.subSoal.length} sub soal</Badge>
            <Badge variant="outline">{soal.poin} poin</Badge>
          </div>
          {isRaguRagu && (
            <Badge variant="warning" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Ragu-ragu
            </Badge>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ListTree className="h-4 w-4" />
            {soal.pertanyaan}
          </div>

          {soal.subSoal.map((sub, idx) => {
            const isPG = sub.jenis === "PILIHAN_GANDA"
            const isTF = sub.jenis === "TRUE_FALSE"
            const isEssay = sub.jenis === "ESSAY"

            return (
              <div key={idx} className="space-y-2 pl-4 border-l-2 border-muted">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{idx + 1}. {sub.pertanyaan}</p>
                  <Badge variant="outline" className="text-[10px]">{subJenisLabels[sub.jenis] || sub.jenis}</Badge>
                  <span className="text-xs text-muted-foreground">{sub.poin} poin</span>
                </div>

                {isPG && sub.pilihanGanda && (
                  <RadioGroup
                    value={subJawabans[idx]}
                    onValueChange={(v) => updateSub(idx, v)}
                    className="space-y-1.5"
                  >
                    {sub.pilihanGanda.map((opt) => (
                      <div key={opt.label}>
                        <Label
                          htmlFor={`sub-${idx}-${opt.label}`}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-all hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5 ${
                            subJawabans[idx] === opt.label ? "border-primary bg-primary/5" : ""
                          }`}
                        >
                          <RadioGroupItem value={opt.label} id={`sub-${idx}-${opt.label}`} />
                          <span className="text-sm font-medium">{opt.label}. {opt.text}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {isTF && (
                  <RadioGroup
                    value={subJawabans[idx]}
                    onValueChange={(v) => updateSub(idx, v)}
                    className="flex gap-3"
                  >
                    {["true", "false"].map((val) => (
                      <div key={val}>
                        <Label
                          htmlFor={`sub-tf-${idx}-${val}`}
                          className={`flex items-center gap-2 rounded-lg border px-4 py-2 cursor-pointer transition-all hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5 ${
                            subJawabans[idx] === val ? "border-primary bg-primary/5" : ""
                          }`}
                        >
                          <RadioGroupItem value={val} id={`sub-tf-${idx}-${val}`} />
                          <span className="text-sm">{val === "true" ? "Benar" : "Salah"}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {isEssay && (
                  <Textarea
                    value={subJawabans[idx]}
                    onChange={(e) => updateSub(idx, e.target.value)}
                    placeholder="Tulis jawaban..."
                    className="min-h-[80px]"
                  />
                )}

                {!isPG && !isTF && !isEssay && (
                  <Input
                    value={subJawabans[idx]}
                    onChange={(e) => updateSub(idx, e.target.value)}
                    placeholder="Tulis jawaban..."
                    className="h-9"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Soal Nomor {soal.nomor}
            </span>
            <Badge variant={tingkatWarna[soal.tingkatKesulitan] ?? "secondary"}>
              {tingkatLabel[soal.tingkatKesulitan] ?? soal.tingkatKesulitan}
            </Badge>
            <Badge variant="outline">{soal.poin} poin</Badge>
          </div>
          {isRaguRagu && (
            <Badge variant="warning" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Ragu-ragu
            </Badge>
          )}
        </div>

        <p className="text-base font-medium leading-relaxed">{soal.pertanyaan}</p>

        {soal.gambar && (
          <div className="rounded-lg overflow-hidden border">
            <img
              src={soal.gambar}
              alt="Gambar soal"
              className="max-h-64 w-full object-contain bg-muted"
            />
          </div>
        )}
      </div>

      {soal.jenisSoal === "PILIHAN_GANDA" && soal.pilihanGanda && (
        <RadioGroup value={jawaban} onValueChange={onJawab} className="space-y-3">
          {soal.pilihanGanda.map((opt) => (
            <div key={opt.value}>
              <Label
                htmlFor={opt.value}
                className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-all hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5 ${
                  jawaban === opt.value ? "border-primary bg-primary/5" : ""
                }`}
              >
                <RadioGroupItem value={opt.value} id={opt.value} />
                <span className="text-sm font-medium">{opt.label}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {soal.jenisSoal === "TRUE_FALSE" && (
        <RadioGroup value={jawaban} onValueChange={onJawab} className="space-y-3">
          {[
            { label: "Benar", value: "true" },
            { label: "Salah", value: "false" },
          ].map((opt) => (
            <div key={opt.value}>
              <Label
                htmlFor={`tf-${opt.value}`}
                className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-all hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5 ${
                  jawaban === opt.value ? "border-primary bg-primary/5" : ""
                }`}
              >
                <RadioGroupItem value={opt.value} id={`tf-${opt.value}`} />
                <span className="text-sm font-medium">{opt.label}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {(soal.jenisSoal === "ESSAY" || soal.jenisSoal === "ISIAN_SINGKAT") && (
        <Textarea
          value={jawaban}
          onChange={(e) => onJawab(e.target.value)}
          placeholder={
            soal.jenisSoal === "ESSAY"
              ? "Tulis jawaban essay Anda di sini..."
              : "Tulis jawaban singkat Anda..."
          }
          className="min-h-[120px] resize-y"
        />
      )}

      {soal.jenisSoal === "MATCHING" && (
        <p className="text-sm text-muted-foreground italic">
          Soal menjodohkan akan ditampilkan di sini.
        </p>
      )}
    </div>
  )
}
