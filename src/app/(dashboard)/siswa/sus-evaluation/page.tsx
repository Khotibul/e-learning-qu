"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClipboardCheck, Loader2, Send, Star, BarChart3 } from "lucide-react"
import { submitSUSSurveyAction, getSUSResultsAction } from "../ai/actions"
import { cn } from "@/lib/utils"

const SUS_QUESTIONS = [
  "Saya berpikir ingin menggunakan sistem ini secara sering",
  "Saya menemukan sistem ini tidak perlu rumit",
  "Saya berpikir sistem ini mudah digunakan",
  "Saya berpikir saya akan membutuhkan bantuan teknis untuk menggunakan sistem ini",
  "Saya menemukan berbagai fungsi dalam sistem ini terintegrasi dengan baik",
  "Saya menemukan terlalu banyak ketidaksesuaian dalam sistem ini",
  "Sebagian besar orang akan belajar menggunakan sistem ini dengan cepat",
  "Saya menemukan sistem ini sangat rumit untuk digunakan",
  "Saya merasa sangat percaya diri menggunakan sistem ini",
  "Saya harus belajar banyak hal sebelum menggunakan sistem ini",
]

const LABELS = [
  "Sangat Tidak Setuju",
  "Tidak Setuju",
  "Netral",
  "Setuju",
  "Sangat Setuju",
]

const INVERTED = [3, 5, 7, 10]

function getInterpretation(skor: number) {
  if (skor >= 80) return { label: "Excellent", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" }
  if (skor >= 68) return { label: "Good", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" }
  if (skor >= 50) return { label: "OK", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" }
  if (skor >= 25) return { label: "Poor", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" }
  return { label: "Terrible", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" }
}

function calcLocalScore(jawaban: number[]) {
  if (jawaban.filter((v) => v > 0).length < 10) return null
  const oddCorrected = [1, 3, 5, 7, 9].map((i) => (jawaban[i] || 0) - 1)
  const evenCorrected = [2, 4, 6, 8].map((i) => 5 - (jawaban[i] || 0))
  const rawScore = oddCorrected.reduce((a, b) => a + b, 0) + evenCorrected.reduce((a, b) => a + b, 0)
  return rawScore * 2.5
}

export default function SUSEvaluationPage() {
  const [jawaban, setJawaban] = useState<number[]>(Array(10).fill(0))
  const [komentar, setKomentar] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [loadingResults, setLoadingResults] = useState(true)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    getSUSResultsAction()
      .then(setResults)
      .catch(() => toast.error("Gagal memuat hasil SUS"))
      .finally(() => setLoadingResults(false))
  }, [])

  const answeredCount = jawaban.filter((v) => v > 0).length
  const localScore = calcLocalScore(jawaban)
  const allAnswered = answeredCount === 10

  const handleSubmit = async () => {
    if (!allAnswered) { toast.error("Semua 10 pertanyaan harus dijawab"); return }
    setSubmitting(true)
    try {
      await submitSUSSurveyAction(jawaban, komentar || undefined)
      toast.success("Survei SUS berhasil dikirim!")
      setSubmitted(true)
      const updated = await getSUSResultsAction()
      setResults(updated)
    } catch (e: any) {
      toast.error(e?.message || "Gagal mengirim survei")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 sm:h-7 sm:w-7 text-primary" /> Evaluasi SUS
        </h1>
        <p className="text-muted-foreground mt-1">System Usability Scale — Survei kegunaan sistem e-learning</p>
      </div>

      <Tabs defaultValue="survey">
        <TabsList>
          <TabsTrigger value="survey"><ClipboardCheck className="h-4 w-4 mr-1.5" /> Isi Survei</TabsTrigger>
          <TabsTrigger value="results"><BarChart3 className="h-4 w-4 mr-1.5" /> Hasil SUS</TabsTrigger>
        </TabsList>

        <TabsContent value="survey">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Survei Kegunaan Sistem</CardTitle>
              <p className="text-sm text-muted-foreground">
                Beri penilaian terhadap 10 pernyataan berikut menggunakan skala 1-5.
                Skor SUS dihitung otomatis (0-100) berdasarkan jawaban Anda.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {submitted && (
                <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300">
                  Anda sudah mengisi survei ini. Mengisi ulang akan membuat catatan baru.
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progres</span>
                  <span className="font-medium">{answeredCount}/10 pertanyaan</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(answeredCount / 10) * 100}%` }} />
                </div>
              </div>

              {SUS_QUESTIONS.map((q, idx) => {
                const isInverted = INVERTED.includes(idx + 1)
                return (
                  <div key={idx} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary" className="shrink-0 text-xs">{idx + 1}</Badge>
                      <div>
                        <Label className="text-sm leading-relaxed">{q}</Label>
                        {isInverted && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">(Pertanyaan terbalik)</p>
                        )}
                      </div>
                    </div>
                    <RadioGroup
                      value={jawaban[idx] > 0 ? String(jawaban[idx]) : ""}
                      onValueChange={(v) => {
                        const next = [...jawaban]
                        next[idx] = Number(v)
                        setJawaban(next)
                      }}
                      className="grid grid-cols-5 gap-2"
                    >
                      {LABELS.map((label, li) => (
                        <label
                          key={li}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center text-xs transition-colors cursor-pointer",
                            jawaban[idx] === li + 1 ? "border-primary bg-primary/5" : "hover:bg-accent"
                          )}
                        >
                          <RadioGroupItem value={String(li + 1)} />
                          <span className="font-medium">{li + 1}</span>
                          <span className="text-muted-foreground leading-tight text-[10px]">{label}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                )
              })}

              <div className="space-y-2">
                <Label>Komentar (opsional)</Label>
                <Textarea
                  value={komentar}
                  onChange={(e) => setKomentar(e.target.value)}
                  placeholder="Tulis komentar atau saran Anda tentang sistem ini..."
                  rows={3}
                />
              </div>

              {localScore !== null && (
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <Star className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">Skor SUS Anda (preview)</p>
                    <p className="text-2xl font-bold">{localScore.toFixed(1)}</p>
                    <Badge className={cn("mt-1 text-[10px]", getInterpretation(localScore).color)}>
                      {getInterpretation(localScore).label}
                    </Badge>
                  </div>
                </div>
              )}

              <Button onClick={handleSubmit} disabled={submitting || !allAnswered} className="w-full sm:w-auto">
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Kirim Survei
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          {loadingResults ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !results || results.total === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Belum ada hasil SUS yang tersedia.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2.5"><Star className="h-5 w-5 text-primary" /></div>
                      <div>
                        <p className="text-2xl font-bold">{results.average}</p>
                        <p className="text-xs text-muted-foreground">Skor Rata-rata SUS</p>
                        <Badge className={cn("mt-1 text-[10px]", getInterpretation(results.average).color)}>
                          {getInterpretation(results.average).label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/40"><ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
                      <div>
                        <p className="text-2xl font-bold">{results.total}</p>
                        <p className="text-xs text-muted-foreground">Total Responden</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium mb-3">Distribusi</p>
                    <div className="space-y-2">
                      {(["excellent", "good", "ok", "poor", "terrible"] as const).map((key) => {
                        const meta: Record<string, { label: string; color: string }> = {
                          excellent: { label: "Excellent (>=80)", color: "bg-green-500" },
                          good: { label: "Good (>=68)", color: "bg-blue-500" },
                          ok: { label: "OK (>=50)", color: "bg-amber-500" },
                          poor: { label: "Poor (>=25)", color: "bg-orange-500" },
                          terrible: { label: "Terrible (<25)", color: "bg-red-500" },
                        }
                        const m = meta[key]
                        const pct = results.total > 0 ? (results.distribusi[key] / results.total) * 100 : 0
                        return (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            <span className={cn("h-2 w-2 rounded-full shrink-0", m.color)} />
                            <span className="flex-1 text-muted-foreground">{m.label}</span>
                            <span className="font-medium w-6 text-right">{results.distribusi[key]}</span>
                            <span className="text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rincian Jawaban</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[400px] overflow-y-auto space-y-2">
                  {results.results.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <p className="font-medium">{r.siswa}</p>
                        <p className="text-xs text-muted-foreground">{r.kelas} &middot; {new Date(r.tanggal).toLocaleDateString("id-ID")}</p>
                        {r.komentar && <p className="text-xs text-muted-foreground mt-1 italic">"{r.komentar}"</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{r.skor}</p>
                        <Badge className={cn("text-[10px]", getInterpretation(r.skor).color)}>
                          {getInterpretation(r.skor).label}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
