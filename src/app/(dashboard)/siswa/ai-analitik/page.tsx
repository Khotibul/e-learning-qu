"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Activity, CheckCircle2, XCircle, Clock, Bot, GraduationCap, Target, Sparkles } from "lucide-react"
import { aiAnalitikData } from "../ai/actions"
import { cn } from "@/lib/utils"

const agentColor: Record<string, string> = {
  orchestrator: "bg-slate-500",
  tutor: "bg-blue-500",
  assessor: "bg-amber-500",
  recommender: "bg-purple-500",
}
const agentLabel: Record<string, string> = {
  orchestrator: "Orchestrator",
  tutor: "Tutor Agent",
  assessor: "Assessor Agent",
  recommender: "Recommender Agent",
}

export default function AIAnalitikPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    aiAnalitikData()
      .then(setData)
      .catch(() => toast.error("Gagal memuat data analitik"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const total = data.statistik.totalRuns || 1
  const maxAgent = Math.max(1, ...data.perAgent.map((a: any) => a.total))

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6 sm:h-7 sm:w-7 text-primary" /> AI Analitik
        </h1>
        <p className="text-muted-foreground mt-1">Log eksekusi Multi-Agent Learning System</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2.5 text-blue-700 dark:bg-blue-900/40"><Activity className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{data.statistik.totalRuns}</p>
                <p className="text-xs text-muted-foreground">Total Eksekusi</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2.5 text-green-700 dark:bg-green-900/40"><CheckCircle2 className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{data.statistik.sukses}</p>
                <p className="text-xs text-muted-foreground">Berhasil ({((data.statistik.sukses / total) * 100).toFixed(1)}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2.5 text-red-700 dark:bg-red-900/40"><XCircle className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{data.statistik.gagal}</p>
                <p className="text-xs text-muted-foreground">Gagal</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2.5 text-slate-700 dark:bg-slate-800"><Clock className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{data.statistik.rataDurasi.toFixed(1)}s</p>
                <p className="text-xs text-muted-foreground">Rata-rata Durasi</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Eksekusi per Agent</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {data.perAgent.map((a: any) => (
              <div key={a.agent} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", agentColor[a.agent])} />
                    {agentLabel[a.agent] || a.agent}
                  </span>
                  <span className="text-muted-foreground text-xs">{a.total} eksekusi</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", agentColor[a.agent])}
                    style={{ width: `${(a.total / maxAgent) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Log Terbaru</CardTitle></CardHeader>
          <CardContent className="max-h-[420px] overflow-y-auto space-y-2">
            {data.logs.length === 0 && <p className="text-sm text-muted-foreground">Belum ada log.</p>}
            {data.logs.map((l: any) => (
              <div key={l.id} className="rounded-lg border p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    {l.agent === "tutor" ? <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                      : l.agent === "assessor" ? <Target className="h-3.5 w-3.5 text-amber-600" />
                      : l.agent === "recommender" ? <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      : <Bot className="h-3.5 w-3.5 text-slate-600" />}
                    {agentLabel[l.agent] || l.agent}
                  </span>
                  <Badge variant={l.sukses ? "secondary" : "destructive"} className="text-[10px]">
                    {l.sukses ? "Sukses" : "Gagal"}
                  </Badge>
                </div>
                <p className="text-muted-foreground">Query: {l.query || "-"}</p>
                {l.pesanError && <p className="text-red-600">Error: {l.pesanError}</p>}
                <p className="text-[10px] text-muted-foreground">
                  {new Date(l.createdAt).toLocaleString("id-ID")} &middot; {l.durasiMs}ms {l.model && `&middot; ${l.model}`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}