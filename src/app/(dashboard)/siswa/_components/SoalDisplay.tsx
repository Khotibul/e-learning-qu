"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"

interface SoalData {
  id: string
  nomor: number
  pertanyaan: string
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

export function SoalDisplay({ soal, jawaban, onJawab, isRaguRagu }: SoalDisplayProps) {
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
