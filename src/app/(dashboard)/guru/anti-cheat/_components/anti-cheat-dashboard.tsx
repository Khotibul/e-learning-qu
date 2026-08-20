"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Shield, ShieldAlert, ShieldCheck, Loader2, ArrowLeft, Eye,
  Clock, Monitor, MousePointer, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronRight, FileText, Search,
} from "lucide-react"
import {
  getExamsWithStats, getCheatingReport, getEventTimeline,
  clearCheatingFlag, getExamAuditLogs,
} from "../actions"

interface ExamStat {
  id: string; nama: string; mataPelajaran: string; kelas: string;
  tanggal: string; status: string; totalSessions: number;
  flaggedCount: number; avgCheatingScore: number; avgTabSwitch: number;
}

interface SessionReport {
  id: string; siswa: { id: string; nama: string; nis: string };
  startedAt: string; submittedAt: string | null; totalDurationMs: number | null;
  tabSwitchCount: number; totalBlurMs: number; cheatingScore: number;
  isFlagged: boolean; flagReason: string | null; status: string;
  events: { id: string; type: string; severity: string; message: string; timestamp: string }[];
}

interface AuditLog {
  id: string; action: string; actorRole: string; siswaName: string | null;
  detail: unknown; createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

const TYPE_LABELS: Record<string, string> = {
  TAB_SWITCH: "Tab Switch",
  WINDOW_BLUR: "Window Blur",
  COPY_ATTEMPT: "Copy Attempt",
  PASTE_ATTEMPT: "Paste Attempt",
  PASTE_DETECTED: "Paste Detected",
  RIGHT_CLICK: "Right Click",
  DEVTOOLS: "DevTools",
  FULLSCREEN_EXIT: "Fullscreen Exit",
  KEYBOARD_SHORTCUT: "Keyboard Shortcut",
  SCREENSHOT: "Screenshot",
  MULTI_DEVICE: "Multi Device",
  TIME_ANOMALY: "Time Anomaly",
}

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "Berlangsung",
  SUBMITTED: "Selesai",
  TIMED_OUT: "Habis Waktu",
  FLAGGED: "Ditandai",
}

function formatDuration(ms: number | null): string {
  if (!ms) return "-"
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec}s`
}

function formatDurationMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function cheatingScoreColor(score: number): string {
  if (score >= 80) return "text-red-600"
  if (score >= 50) return "text-orange-500"
  if (score >= 20) return "text-yellow-600"
  return "text-green-600"
}

export function AntiCheatDashboard() {
  const [exams, setExams] = useState<ExamStat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExam, setSelectedExam] = useState<string | null>(null)
  const [report, setReport] = useState<SessionReport[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<Record<string, any[]>>({})
  const [timelineLoading, setTimelineLoading] = useState<string | null>(null)
  const [clearDialog, setClearDialog] = useState<{ open: boolean; sessionId: string | null }>({ open: false, sessionId: null })
  const [clearReason, setClearReason] = useState("")
  const [clearing, setClearing] = useState(false)
  const [activeTab, setActiveTab] = useState<"sessions" | "audit">("sessions")
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditLoading, setAuditLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const loadExams = async () => {
    try {
      const data = await getExamsWithStats()
      setExams(data as any)
    } catch {
      toast.error("Gagal memuat data ujian")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadExams() }, [])

  const loadReport = async (ujianId: string) => {
    setReportLoading(true)
    try {
      const data = await getCheatingReport(ujianId)
      setReport(data as any)
      setSelectedExam(ujianId)
      setActiveTab("sessions")
      setSearchQuery("")
    } catch {
      toast.error("Gagal memuat laporan")
    } finally {
      setReportLoading(false)
    }
  }

  const loadAuditLogs = async (ujianId: string, page: number) => {
    setAuditLoading(true)
    try {
      const data = await getExamAuditLogs(ujianId, page)
      setAuditLogs(data.logs as any)
      setAuditTotal(data.total)
      setAuditPage(data.page)
    } catch {
      toast.error("Gagal memuat audit log")
    } finally {
      setAuditLoading(false)
    }
  }

  const loadTimeline = async (sessionId: string) => {
    if (timeline[sessionId]) { setExpandedSession(expandedSession === sessionId ? null : sessionId); return }
    setTimelineLoading(sessionId)
    try {
      const data = await getEventTimeline(sessionId)
      setTimeline((prev) => ({ ...prev, [sessionId]: data as any }))
      setExpandedSession(sessionId)
    } catch {
      toast.error("Gagal memuat timeline")
    } finally {
      setTimelineLoading(null)
    }
  }

  const handleClearFlag = async () => {
    if (!clearDialog.sessionId || !clearReason.trim()) return
    setClearing(true)
    try {
      await clearCheatingFlag(clearDialog.sessionId, clearReason.trim())
      toast.success("Flag cheating dibatalkan")
      setClearDialog({ open: false, sessionId: null })
      setClearReason("")
      if (selectedExam) {
        const data = await getCheatingReport(selectedExam)
        setReport(data as any)
      }
    } catch {
      toast.error("Gagal membatalkan flag")
    } finally {
      setClearing(false)
    }
  }

  const filteredReport = searchQuery
    ? report.filter((s) => s.siswa.nama.toLowerCase().includes(searchQuery.toLowerCase()) || s.siswa.nis.includes(searchQuery))
    : report

  const examDetail = exams.find((e) => e.id === selectedExam)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 p-4 sm:p-6">
      {selectedExam ? (
        <>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedExam(null); setReport([]); setTimeline({}); setSearchQuery("") }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <ShieldAlert className="h-6 w-6 text-primary" /> {examDetail?.nama}
              </h1>
              <p className="text-sm text-muted-foreground">
                {examDetail?.mataPelajaran} - {examDetail?.kelas}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant={activeTab === "sessions" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("sessions")}>
              <Eye className="h-4 w-4 mr-1" /> Sesi Ujian
              <Badge variant="secondary" className="ml-1 text-xs">{report.length}</Badge>
            </Button>
            <Button variant={activeTab === "audit" ? "default" : "outline"} size="sm" onClick={() => { setActiveTab("audit"); if (selectedExam) loadAuditLogs(selectedExam, 1) }}>
              <FileText className="h-4 w-4 mr-1" /> Audit Log
              <Badge variant="secondary" className="ml-1 text-xs">{auditTotal}</Badge>
            </Button>
          </div>

          {activeTab === "sessions" && (
            <>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari siswa..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-sm" />
              </div>

              {reportLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredReport.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Tidak ada data sesi ujian</CardContent></Card>
              ) : (
                <Card>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Siswa</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Durasi</TableHead>
                          <TableHead className="text-center">Tab Switch</TableHead>
                          <TableHead className="text-center">Blur Time</TableHead>
                          <TableHead className="text-center">Skor</TableHead>
                          <TableHead className="text-center">Events</TableHead>
                          <TableHead className="text-center">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReport.map((s) => (
                          <>
                            <TableRow key={s.id} className={s.isFlagged ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{s.siswa.nama}</p>
                                  <p className="text-xs text-muted-foreground">{s.siswa.nis}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="outline" className="text-[10px]">{STATUS_LABELS[s.status] || s.status}</Badge>
                                  {s.isFlagged && (
                                    <Badge className="text-[10px] bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">
                                      <AlertTriangle className="h-3 w-3 mr-0.5" /> Flagged
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-sm">{formatDuration(s.totalDurationMs)}</TableCell>
                              <TableCell className="text-center text-sm">{s.tabSwitchCount}</TableCell>
                              <TableCell className="text-center text-sm">{formatDurationMs(s.totalBlurMs)}</TableCell>
                              <TableCell className={`text-center font-bold ${cheatingScoreColor(s.cheatingScore)}`}>{s.cheatingScore}</TableCell>
                              <TableCell className="text-center text-sm">{s.events.length}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => loadTimeline(s.id)} title="Timeline">
                                    {timelineLoading === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                  </Button>
                                  {s.isFlagged && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setClearDialog({ open: true, sessionId: s.id })} title="Clear Flag">
                                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            {expandedSession === s.id && timeline[s.id] && (
                              <TableRow key={`${s.id}-timeline`}>
                                <TableCell colSpan={8} className="p-0">
                                  <div className="bg-muted/30 p-4 space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Timeline Kejadian:</p>
                                    {timeline[s.id].length === 0 ? (
                                      <p className="text-xs text-muted-foreground">Tidak ada event tercatat</p>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {timeline[s.id].map((ev) => (
                                          <div key={ev.id} className="flex items-start gap-2 text-xs">
                                            <span className="text-muted-foreground shrink-0 w-28">{new Date(ev.timestamp).toLocaleString("id-ID")}</span>
                                            <Badge className={`${SEVERITY_COLORS[ev.severity]} text-[10px] shrink-0`} variant="secondary">{ev.severity}</Badge>
                                            <span className="font-medium shrink-0 w-28">{TYPE_LABELS[ev.type] || ev.type}</span>
                                            <span className="text-muted-foreground">{ev.message}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {activeTab === "audit" && (
            auditLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : auditLogs.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Tidak ada log audit</CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Waktu</TableHead>
                        <TableHead>Aksi</TableHead>
                        <TableHead>Siswa</TableHead>
                        <TableHead>Aktor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-sm">{new Date(l.createdAt).toLocaleString("id-ID")}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{l.action}</Badge></TableCell>
                          <TableCell className="text-sm">{l.siswaName || "-"}</TableCell>
                          <TableCell className="text-sm">{l.actorRole}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          )}
        </>
      ) : (
        <>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6 sm:h-7 sm:w-7 text-primary" /> Anti-Cheat Report
            </h1>
            <p className="text-muted-foreground mt-1">Monitoring dan pelaporan kecurangan saat ujian berlangsung</p>
          </div>

          {exams.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada data ujian</CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {exams.map((exam) => (
                <Card key={exam.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => loadReport(exam.id)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm">{exam.nama}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{exam.mataPelajaran} - {exam.kelas}</p>
                      </div>
                      {exam.flaggedCount > 0 && (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 text-[10px]">
                          <AlertTriangle className="h-3 w-3 mr-0.5" /> {exam.flaggedCount}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(exam.tanggal).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted p-2">
                        <p className="text-lg font-bold">{exam.totalSessions}</p>
                        <p className="text-[10px] text-muted-foreground">Sesi</p>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <p className={`text-lg font-bold ${cheatingScoreColor(exam.avgCheatingScore)}`}>{exam.avgCheatingScore}</p>
                        <p className="text-[10px] text-muted-foreground">Avg Skor</p>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <p className="text-lg font-bold">{exam.avgTabSwitch}</p>
                        <p className="text-[10px] text-muted-foreground">Avg Tab</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={clearDialog.open} onOpenChange={(open) => { setClearDialog({ open, sessionId: clearDialog.sessionId }); if (!open) setClearReason("") }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Batalkan Flag Cheating</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">Masukkan alasan pembatalan flag (false positive)</p>
            <Input placeholder="Alasan..." value={clearReason} onChange={(e) => setClearReason(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setClearDialog({ open: false, sessionId: null }); setClearReason("") }}>Batal</Button>
              <Button onClick={handleClearFlag} disabled={clearing || !clearReason.trim()}>
                {clearing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Konfirmasi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
