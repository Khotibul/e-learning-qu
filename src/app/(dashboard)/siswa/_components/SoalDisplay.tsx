"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"

interface SoalData {
  id: string
  nomor: number
  pertanyaan: string
  jenisSoal: string
  tingkatKesulitan: string
  pilihanGanda?: { label: string; text: string }[] | null
  trueFalse?: boolean | null
  poin: number
  soalInduk?: string | null
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

const jenisLabel: Record<string, string> = {
  PILIHAN_GANDA: "PG",
  ESSAY: "Essay",
  TRUE_FALSE: "B/S",
  ISIAN_SINGKAT: "Isian",
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
            <Badge variant="outline">{jenisLabel[soal.jenisSoal] || soal.jenisSoal}</Badge>
            {soal.tingkatKesulitan && (
              <Badge variant={tingkatWarna[soal.tingkatKesulitan] ?? "secondary"}>
                {tingkatLabel[soal.tingkatKesulitan] ?? soal.tingkatKesulitan}
              </Badge>
            )}
            <Badge variant="outline">{soal.poin} poin</Badge>
          </div>
          {isRaguRagu && (
            <Badge variant="warning" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Ragu-ragu
            </Badge>
          )}
        </div>

        {soal.soalInduk && (
          <p className="text-xs text-muted-foreground italic">{soal.soalInduk}</p>
        )}

        <p className="text-base font-medium leading-relaxed">{soal.pertanyaan}</p>
      </div>

      {soal.jenisSoal === "PILIHAN_GANDA" && soal.pilihanGanda && (
        <RadioGroup value={jawaban} onValueChange={onJawab} className="space-y-3">
          {soal.pilihanGanda.map((opt) => (
            <div key={opt.label}>
              <Label
                htmlFor={opt.label}
                className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-all hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5 ${
                  jawaban === opt.label ? "border-primary bg-primary/5" : ""
                }`}
              >
                <RadioGroupItem value={opt.label} id={opt.label} />
                <span className="text-sm font-medium">{opt.label}. {opt.text}</span>
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

      {soal.jenisSoal === "ESSAY" && (
        <Textarea
          value={jawaban}
          onChange={(e) => onJawab(e.target.value)}
          placeholder="Tulis jawaban essay Anda di sini..."
          className="min-h-[120px] resize-y"
        />
      )}

      {soal.jenisSoal === "ISIAN_SINGKAT" && (
        <Input
          value={jawaban}
          onChange={(e) => onJawab(e.target.value)}
          placeholder="Tulis jawaban singkat Anda..."
          className="h-10"
        />
      )}
    </div>
  )
}
