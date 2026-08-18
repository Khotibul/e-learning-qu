"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Brain, Target, AlertTriangle, BookOpen, TrendingUp,
  Shield, Loader2, Sparkles, Flame, BarChart3,
} from "lucide-react"
import {
  getStudentModelSummaryAction, getPenguasaanOverviewAction,
  getAdaptivePathAction, getStudentWarningsAction,
  runEarlyWarningAction, explainMasteryAction,
} from "../ai/actions"
import { cn } from "@/lib/utils"

/* ─── animation variants ─── */
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
}

/* ─── helpers ─── */
const gayaBadge: Record<string, string> = {
  VISUAL: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  AUDITORI: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200",
  READING: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
  Kinestetik: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
  CAMPURAN: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Menunggu", cls: "bg-slate-100 text-slate-600" },
  SEDANG: { label: "Sedang Dikerjakan", cls: "bg-blue-100 text-blue-700" },
  SELESAI: { label: "Selesai", cls: "bg-emerald-100 text-emerald-700" },
}

const severityBadge: Record<string, { label: string; cls: string; icon: string }> = {
  CRITICAL: { label: "Kritis", cls: "bg-red-100 text-red-700", icon: "🔴" },
  HIGH: { label: "Tinggi", cls: "bg-orange-100 text-orange-700", icon: "🟠" },
  MEDIUM: { label: "Sedang", cls: "bg-amber-100 text-amber-700", icon: "🟡" },
  LOW: { label: "Rendah", cls: "bg-slate-100 text-slate-600", icon: "⚪" },
}

const kategoriColor: Record<string, string> = {
  ADVANCED: "bg-emerald-500",
  PROFICIENT: "bg-blue-500",
  DEVELOPING: "bg-amber-500",
  BASIC: "bg-orange-500",
  BEGINNER: "bg-red-400",
}

/* ─── metric bar ─── */
function MetricBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon} {label}
        </span>
        <span className="font-semibold">{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  )
}

/* ─── PAGE ─── */
export default function ProfilBelajarPage() {
  const [model, setModel] = useState<any>(null)
  const [penguasaan, setPenguasaan] = useState<any>(null)
  const [jalur, setJalur] = useState<any>(null)
  const [warnings, setWarnings] = useState<any>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loadingExplain, setLoadingExplain] = useState<string | null>(null)
  const [init, setInit] = useState(true)
  const [runningWarning, setRunningWarning] = useState(false)

  useEffect(() => {
    Promise.all([
      getStudentModelSummaryAction(),
      getPenguasaanOverviewAction(),
      getAdaptivePathAction(),
      getStudentWarningsAction(),
    ])
      .then(([m, p, j, w]) => {
        setModel(m)
        setPenguasaan(p)
        setJalur(j)
        setWarnings(w)
      })
      .catch(() => toast.error("Gagal memuat profil belajar"))
      .finally(() => setInit(false))
  }, [])

  const handleRunWarning = async () => {
    setRunningWarning(true)
    try {
      const res = await runEarlyWarningAction()
      setWarnings(res)
      toast.success("Early warning selesai dijalankan")
    } catch {
      toast.error("Gagal menjalankan early warning")
    } finally {
      setRunningWarning(false)
    }
  }

  const handleExplain = async (kompetensiId: string) => {
    setLoadingExplain(kompetensiId)
    try {
      const res = await explainMasteryAction(kompetensiId)
      setExplanation(res.penjelasan || JSON.stringify(res))
    } catch {
      toast.error("Gagal memuat penjelasan")
    } finally {
      setLoadingExplain(null)
    }
  }

  if (init) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const gayaBelajar = model?.profile?.gayaBelajar ?? model?.gayaBelajar ?? "CAMPURAN"
  const motivasi = Math.round(((model?.profile?.motivasi ?? model?.motivasi ?? 0) as number) * 100)
  const engagement = Math.round(((model?.profile?.engagementScore ?? model?.engagementScore ?? 0) as number) * 100)
  const konsistensi = Math.round(((model?.profile?.konsistensi ?? model?.konsistensi ?? 0) as number) * 100)
  const streak = model?.profile?.streak ?? model?.streak ?? 0
  const rataNilai = model?.profile?.rataNilai ?? model?.rataNilai ?? 0

  return (
    <motion.div {...fadeUp} className="space-y-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 sm:h-7 sm:w-7 text-primary" /> Profil Belajar
          </h1>
          <p className="text-muted-foreground mt-1">
            Analisis profil belajarmu berdasarkan data aktivitas dan pencapaian
          </p>
        </div>
      </div>

      <Tabs defaultValue="profil" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="profil" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Profil Belajar
          </TabsTrigger>
          <TabsTrigger value="penguasaan" className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> Penguasaan
          </TabsTrigger>
          <TabsTrigger value="jalur" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Jalur Belajar
          </TabsTrigger>
          <TabsTrigger value="peringatan" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Peringatan
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Profil Belajar ─── */}
        <TabsContent value="profil">
          <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
            {/* Gaya Belajar + Streak */}
            <motion.div variants={fadeUp}>
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Gaya Belajar & Konsistensi
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-muted-foreground">Gaya Belajar Terdeteksi</p>
                      <Badge className={cn("text-sm px-3 py-1", gayaBadge[gayaBelajar] || gayaBadge.CAMPURAN)}>
                        {gayaBelajar}
                      </Badge>
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-muted-foreground">Rata-rata Nilai</p>
                      <p className="text-3xl font-bold text-primary">{rataNilai}<span className="text-base font-normal text-muted-foreground">/100</span></p>
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-muted-foreground">Streak Belajar</p>
                      <div className="flex items-center gap-2">
                        <Flame className="h-6 w-6 text-orange-500" />
                        <span className="text-3xl font-bold">{streak}</span>
                        <span className="text-sm text-muted-foreground">hari</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Metrics */}
            <motion.div variants={fadeUp}>
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Metrik Aktivitas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MetricBar label="Motivasi" value={motivasi} icon={<TrendingUp className="h-3.5 w-3.5" />} />
                  <MetricBar label="Engagement" value={engagement} icon={<BarChart3 className="h-3.5 w-3.5" />} />
                  <MetricBar label="Konsistensi" value={konsistensi} icon={<Shield className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>

        {/* ─── Tab: Penguasaan ─── */}
        <TabsContent value="penguasaan">
          <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
            {/* Distribution */}
            {penguasaan && penguasaan.total > 0 && (
              <motion.div variants={fadeUp}>
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" /> Distribusi Penguasaan
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Rata-rata skor: <span className="font-semibold text-foreground">{penguasaan.rataSkor}%</span> &middot;{" "}
                      {penguasaan.total} kompetensi terlacak
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(["ADVANCED", "PROFICIENT", "DEVELOPING", "BASIC", "BEGINNER"] as const).map((kat) => {
                      const count = penguasaan.distribusi[kat] ?? 0
                      const pct = penguasaan.total > 0 ? Math.round((count / penguasaan.total) * 100) : 0
                      return (
                        <div key={kat} className="flex items-center gap-3">
                          <span className="w-24 text-xs font-medium text-muted-foreground">{kat}</span>
                          <div className="flex-1 h-5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all duration-500", kategoriColor[kat])}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-14 text-right text-xs font-semibold">{count} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Detail Kompetensi */}
            {penguasaan && penguasaan.penguasaan?.length > 0 && (
              <motion.div variants={fadeUp}>
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" /> Detail Kompetensi
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {penguasaan.penguasaan.map((p: any, i: number) => (
                        <div key={p.kompetensiId || i} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border p-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="text-xs text-muted-foreground">{p.kode}</code>
                              <span className="text-sm font-medium truncate">{p.kompetensi}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <Badge variant="secondary" className="text-[10px]">{p.kategori}</Badge>
                            <span className="text-sm font-bold w-10 text-right">{p.skor}%</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleExplain(p.kompetensiId)}
                              disabled={loadingExplain === p.kompetensiId}
                            >
                              {loadingExplain === p.kompetensiId ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                              Explain
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {explanation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm"
                      >
                        <p className="font-semibold flex items-center gap-1.5 mb-2">
                          <Sparkles className="h-3.5 w-3.5 text-primary" /> Penjelasan AI
                        </p>
                        <p className="text-muted-foreground whitespace-pre-wrap">{explanation}</p>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {penguasaan && penguasaan.total === 0 && (
              <Card className="py-12 text-center text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Belum ada data penguasaan kompetensi. Kerjakan ujian atau latihan terlebih dahulu.</p>
              </Card>
            )}
          </motion.div>
        </TabsContent>

        {/* ─── Tab: Jalur Belajar ─── */}
        <TabsContent value="jalur">
          <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
            {jalur && (jalur.items?.length ?? 0) > 0 && (
              <motion.div variants={fadeUp}>
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" /> Jalur Belajar Adaptif
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Progres: <span className="font-semibold text-foreground">{Math.round(jalur.progres ?? 0)}%</span>
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Progress value={jalur.progres ?? 0} className="h-3" />

                    <div className="space-y-2">
                      {jalur.items.map((item: any, i: number) => {
                        const st = statusBadge[item.status] ?? statusBadge.PENDING
                        return (
                          <div
                            key={item.id || i}
                            className={cn(
                              "flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border p-3 transition-colors",
                              item.status === "SELESAI" && "bg-emerald-50/50 dark:bg-emerald-950/20",
                              item.status === "SEDANG" && "bg-blue-50/50 dark:bg-blue-950/20",
                            )}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">{i + 1}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {item.materi?.judul ?? item.kompetensi?.nama ?? item.jenis}
                                </p>
                                {item.materi?.mataPelajaran && (
                                  <p className="text-[10px] text-muted-foreground">{item.materi.mataPelajaran.nama}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={cn("text-[10px]", st.cls)}>{st.label}</Badge>
                              {item.status === "SELESAI" && (
                                <span className="text-emerald-600 text-xs font-semibold">✓</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {jalur && (jalur.items?.length ?? 0) === 0 && (
              <Card className="py-12 text-center text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Belum ada jalur belajar yang tersedia. Kerjakan beberapa ujian atau latihan terlebih dahulu.</p>
              </Card>
            )}

            {!jalur && (
              <Card className="py-12 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
                <p>Memuat jalur belajar...</p>
              </Card>
            )}
          </motion.div>
        </TabsContent>

        {/* ─── Tab: Peringatan ─── */}
        <TabsContent value="peringatan">
          <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
            <motion.div variants={fadeUp}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Early Warning System</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunWarning}
                  disabled={runningWarning}
                  className="gap-1.5"
                >
                  {runningWarning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                  Jalankan Ulang
                </Button>
              </div>
            </motion.div>

            {warnings && warnings.total > 0 && (
              <motion.div variants={fadeUp}>
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" /> Peringatan Aktif
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {warnings.total} peringatan aktif
                      {warnings.critical > 0 && <>, <span className="text-red-600 font-semibold">{warnings.critical} kritis</span></>}
                      {warnings.high > 0 && <>, <span className="text-orange-600 font-semibold">{warnings.high} tinggi</span></>}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {warnings.warnings.map((w: any, i: number) => {
                        const sv = severityBadge[w.severity] ?? severityBadge.LOW
                        return (
                          <div
                            key={w.id || i}
                            className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border p-3"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-sm">{sv.icon}</span>
                              <span className="text-sm">{w.message}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={cn("text-[10px]", sv.cls)}>{sv.label}</Badge>
                              {w.kompetensiId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => handleExplain(w.kompetensiId)}
                                  disabled={loadingExplain === w.kompetensiId}
                                >
                                  {loadingExplain === w.kompetensiId ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-3 w-3" />
                                  )}
                                  Explain
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {explanation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 rounded-lg border bg-muted/50 p-4 text-sm"
                      >
                        <p className="font-semibold flex items-center gap-1.5 mb-2">
                          <Sparkles className="h-3.5 w-3.5 text-primary" /> Penjelasan AI
                        </p>
                        <p className="text-muted-foreground whitespace-pre-wrap">{explanation}</p>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {warnings && warnings.total === 0 && (
              <Card className="py-12 text-center text-emerald-600">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-60" />
                <p className="font-medium">Tidak ada peringatan aktif</p>
                <p className="text-sm text-muted-foreground mt-1">Status belajar kamu aman</p>
              </Card>
            )}

            {/* Explanation Section */}
            <motion.div variants={fadeUp}>
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Tentang Early Warning & Penjelasan AI
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Early Warning System</strong> memantau pola belajarmu secara otomatis dan memberikan peringatan ketika terdeteksi penurunan motivasi, konsistensi, atau pencapaian.
                  </p>
                  <p>
                    <strong className="text-foreground">Severity Levels:</strong>{" "}
                    <span className="text-red-600 font-medium">CRITICAL</span> — membutuhkan intervensi segera;{" "}
                    <span className="text-orange-600 font-medium">HIGH</span> — perlu perhatian;{" "}
                    <span className="text-amber-600 font-medium">MEDIUM</span> — monitoring;{" "}
                    <span className="text-slate-600 font-medium">LOW</span> — informasi.
                  </p>
                  <p>
                    Tekan tombol <strong className="text-foreground">Explain</strong> pada kompetensi atau peringatan untuk melihat penjelasan AI tentang mengapa skor penguasaan dihitung demikian dan apa faktor yang memengaruhinya.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
