"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn, calculateGrade } from "@/lib/utils"
import { CheckCircle2, XCircle, BarChart3, Home, RotateCcw } from "lucide-react"
import Link from "next/link"

interface HasilSoal {
  nomor: number
  jawaban: string | null
  jawabanBenar: string
  isCorrect: boolean
  poin: number
}

interface HasilUjianProps {
  nilai: number
  totalPoin: number
  perolehPoin: number
  jumlahSoal: number
  jumlahBenar: number
  hasilSoal: HasilSoal[]
  bisaRetake?: boolean
  ujianId?: string
}

export function HasilUjian({ nilai, totalPoin, perolehPoin, jumlahSoal, jumlahBenar, hasilSoal, bisaRetake, ujianId }: HasilUjianProps) {
  const grade = calculateGrade(nilai)
  const warnaGrade = (() => {
    if (nilai >= 90) return "text-emerald-500"
    if (nilai >= 75) return "text-blue-500"
    if (nilai >= 60) return "text-amber-500"
    return "text-red-500"
  })()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Hasil Ujian</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className={cn("text-5xl sm:text-6xl font-bold", warnaGrade)}>
                {nilai}
              </div>
              <p className="text-base sm:text-lg text-muted-foreground">
                Grade: <span className={cn("font-bold", warnaGrade)}>{grade}</span>
              </p>
            </div>

            <Progress value={nilai} className="h-3 max-w-md mx-auto" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Benar</p>
                <p className="text-xl font-bold text-emerald-600">{jumlahBenar}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Salah</p>
                <p className="text-xl font-bold text-red-600">{jumlahSoal - jumlahBenar}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total Soal</p>
                <p className="text-xl font-bold">{jumlahSoal}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Poin</p>
                <p className="text-xl font-bold">{perolehPoin}/{totalPoin}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" />
              Detail Jawaban
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hasilSoal.map((soal) => (
              <div
                key={soal.nomor}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3",
                  soal.isCorrect
                    ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800"
                    : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800"
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {soal.isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Soal {soal.nomor}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {soal.isCorrect ? "Jawaban benar" : `Jawaban: ${soal.jawaban || "-"} | Benar: ${soal.jawabanBenar}`}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "text-sm font-bold tabular-nums shrink-0",
                  soal.isCorrect ? "text-emerald-600" : "text-red-600"
                )}>
                  {soal.isCorrect ? `+${soal.poin}` : "0"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
          <Link href="/siswa" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full py-3 sm:py-2">
              <Home className="h-4 w-4" />
              Kembali ke Dashboard
            </Button>
          </Link>
          <Link href="/siswa/nilai" className="w-full sm:w-auto">
            <Button className="w-full py-3 sm:py-2">
              <RotateCcw className="h-4 w-4" />
              Lihat Nilai
            </Button>
          </Link>
          {bisaRetake && ujianId && (
            <Link href={`/siswa/ujian/${ujianId}`} className="w-full sm:w-auto">
              <Button variant="default" className="w-full py-3 sm:py-2">
                <RotateCcw className="h-4 w-4 mr-2" />
                Kerjakan Lagi
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
