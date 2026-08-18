"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  ClipboardCheck, BarChart3, Users, Brain, Loader2, TrendingUp,
  Star, Activity,
} from "lucide-react"
import { getSUSResultsAction, getAIEvaluationSummaryAction } from "../../siswa/ai/actions"
import { cn } from "@/lib/utils"

function getSUSInterpretation(skor: number) {
  if (skor >= 80) return { label: "Excellent", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" }
  if (skor >= 68) return { label: "Good", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" }
  if (skor >= 50) return { label: "OK", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" }
  if (skor >= 25) return { label: "Poor", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" }
  return { label: "Terrible", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" }
}

const metrikIcon: Record<string, string> = {
  relevance: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  accuracy: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400",
  latency: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  completeness: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  helpfulness: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400",
}

export default function AIEvaluationPage() {
  const [susResults, setSusResults] = useState<any>(null)
  const [aiResults, setAiResults] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getSUSResultsAction(), getAIEvaluationSummaryAction()])
      .then(([s, a]) => { setSusResults(s); setAiResults(a) })
      .catch(() => toast.error("Gagal memuat data evaluasi"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="h-6 w-6 sm:h-7 sm:w-7 text-primary" /> Evaluasi AI
        </h1>
        <p className="text-muted-foreground mt-1">Hasil SUS dan metrik evaluasi sistem AI</p>
      </div>

      <Tabs defaultValue="sus">
        <TabsList>
          <TabsTrigger value="sus"><ClipboardCheck className="h-4 w-4 mr-1.5" /> Hasil SUS</TabsTrigger>
          <TabsTrigger value="ai"><Brain className="h-4 w-4 mr-1.5" /> Evaluasi AI</TabsTrigger>
        </TabsList>

        <TabsContent value="sus">
          {!susResults || susResults.total === 0 ? (
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
                        <p className="text-2xl font-bold">{susResults.average}</p>
                        <p className="text-xs text-muted-foreground">Skor Rata-rata SUS</p>
                        <Badge className={cn("mt-1 text-[10px]", getSUSInterpretation(susResults.average).color)}>
                          {getSUSInterpretation(susResults.average).label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/40"><Users className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
                      <div>
                        <p className="text-2xl font-bold">{susResults.total}</p>
                        <p className="text-xs text-muted-foreground">Total Responden</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium mb-3">Distribusi Skor</p>
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
                        const pct = susResults.total > 0 ? (susResults.distribusi[key] / susResults.total) * 100 : 0
                        return (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            <span className={cn("h-2 w-2 rounded-full shrink-0", m.color)} />
                            <span className="flex-1 text-muted-foreground">{m.label}</span>
                            <span className="font-medium w-6 text-right">{susResults.distribusi[key]}</span>
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
                  <CardTitle className="text-lg">Rincian Jawaban SUS</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead className="text-center">Skor</TableHead>
                        <TableHead className="text-center">Interpretasi</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Komentar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {susResults.results.map((r: any) => {
                        const interp = getSUSInterpretation(r.skor)
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.siswa}</TableCell>
                            <TableCell>{r.kelas}</TableCell>
                            <TableCell className="text-center font-bold">{r.skor}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={cn("text-[10px]", interp.color)}>{interp.label}</Badge>
                            </TableCell>
                            <TableCell>{new Date(r.tanggal).toLocaleDateString("id-ID")}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                              {r.komentar || "-"}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai">
          {!aiResults || aiResults.total === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Belum ada metrik evaluasi AI yang tersedia.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-purple-100 p-2.5 dark:bg-purple-900/40">
                        <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{aiResults.total}</p>
                        <p className="text-xs text-muted-foreground">Total Evaluasi</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-900/40">
                        <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{aiResults.summary.length}</p>
                        <p className="text-xs text-muted-foreground">Metrik Terpantau</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-900/40">
                        <Brain className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {aiResults.summary.length > 0
                            ? Math.round(aiResults.summary.reduce((a: number, s: any) => a + s.rataRata, 0) / aiResults.summary.length)
                            : 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Rata-rata Semua Metrik</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Metrik Evaluasi AI</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metrik</TableHead>
                        <TableHead className="text-center">Rata-rata</TableHead>
                        <TableHead className="text-center">Min</TableHead>
                        <TableHead className="text-center">Max</TableHead>
                        <TableHead className="text-center">Jumlah Sampel</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiResults.summary.map((s: any) => (
                        <TableRow key={s.metrik}>
                          <TableCell className="font-medium capitalize">
                            <span className="flex items-center gap-2">
                              <span className={cn("h-2.5 w-2.5 rounded-full", metrikIcon[s.metrik] || "bg-slate-300")} />
                              {s.metrik}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="font-mono">{s.rataRata}</Badge>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">{s.min}</TableCell>
                          <TableCell className="text-center text-muted-foreground">{s.max}</TableCell>
                          <TableCell className="text-center">{s.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {aiResults.summary.map((s: any) => {
                  const pct = Math.min(100, s.rataRata)
                  return (
                    <Card key={s.metrik}>
                      <CardContent className="pt-6 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">{s.metrik}</span>
                          <span className="text-lg font-bold">{s.rataRata}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {s.total} sampel &middot; rentang {s.min}-{s.max}
                        </p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
