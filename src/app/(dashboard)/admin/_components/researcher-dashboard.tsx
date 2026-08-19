"use client"

import Link from "next/link"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Users,
  FileText,
  BookOpen,
  Activity,
  AlertTriangle,
  ExternalLink,
} from "lucide-react"

interface Overview {
  totalStudents: number
  totalExams: number
  totalQuestions: number
  avgScore: number
  totalActivities: number
  activeStudentCount: number
  completionRates: { id: string; _count: { jawabanUjian: number } }[]
  masteryDistribution: { kategori: any; count: number }[]
}

interface ScoreDist {
  label: string
  count: number
}

interface MasteryItem {
  mapel: string
  kompetensi: string
  avgSkor: number
  jumlahSiswa: number
}

interface TrendPoint {
  date: string
  count: number
}

interface AgentPerf {
  agent: string
  totalCalls: number
  successRate: number
  avgDuration: number
}

interface WarningStats {
  breakdown: { severity: string; tipe: string; count: number }[]
  bySeverity: { severity: string; count: number }[]
}

interface AtRisk {
  id: string
  nama: string
  nis: string | null
  kelas: string
  warningCount: number
}

interface Props {
  overview: Overview
  scoreDistribution: ScoreDist[]
  masteryByMapel: MasteryItem[]
  learningTrend: TrendPoint[]
  agentPerformance: AgentPerf[]
  warningStats: WarningStats
  dropoutRisk: AtRisk[]
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BarChart({ data, title }: { data: { label: string; value: number }[]; title: string }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-rose-500"]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3 h-[200px]">
          {data.map((d, i) => {
            const height = (d.value / maxVal) * 180
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end min-w-0">
                <span className="text-xs font-medium">{d.value}</span>
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 ${colors[i % colors.length]}`}
                  style={{ height: `${Math.max(height, 4)}px` }}
                />
                <span className="text-xs text-muted-foreground text-center truncate w-full" title={d.label}>
                  {d.label}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const maxVal = Math.max(...data.map((d) => d.count), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Learning Activity (30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-[2px] h-[180px]">
          {data.map((d, i) => {
            const height = (d.count / maxVal) * 160
            return (
              <div
                key={i}
                className="flex-1 bg-primary/80 rounded-t-sm transition-all duration-300 hover:bg-primary min-w-[3px]"
                style={{ height: `${Math.max(height, 2)}px` }}
                title={`${d.date}: ${d.count} aktivitas`}
              />
            )
          })}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-muted-foreground">30 hari lalu</span>
          <span className="text-xs text-muted-foreground">Hari ini</span>
        </div>
      </CardContent>
    </Card>
  )
}

const severityColors: Record<string, string> = {
  LOW: "bg-blue-100 text-blue-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
}

export function ResearcherDashboard({
  overview,
  scoreDistribution,
  masteryByMapel,
  learningTrend,
  agentPerformance,
  warningStats,
  dropoutRisk,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Researcher Analytics</h1>
        <p className="text-muted-foreground mt-1">Dashboard analitik dan riset pembelajaran</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total Siswa"
          value={overview.totalStudents}
          icon={<Users className="h-5 w-5 text-white" />}
          color="bg-blue-500"
        />
        <StatCard
          label="Rata-rata Nilai"
          value={overview.avgScore.toFixed(1)}
          icon={<FileText className="h-5 w-5 text-white" />}
          color="bg-green-500"
        />
        <StatCard
          label="Total Soal"
          value={overview.totalQuestions}
          icon={<BookOpen className="h-5 w-5 text-white" />}
          color="bg-purple-500"
        />
        <StatCard
          label="Aktivitas (30d)"
          value={overview.totalActivities}
          icon={<Activity className="h-5 w-5 text-white" />}
          color="bg-orange-500"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BarChart
          title="Distribusi Skor"
          data={scoreDistribution.map((s) => ({ label: s.label, value: s.count }))}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Distribusi Mastery</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.masteryDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
            ) : (
              <div className="space-y-3">
                {overview.masteryDistribution.map((m) => {
                  const total = overview.masteryDistribution.reduce((s, x) => s + x.count, 0)
                  const pct = total > 0 ? Math.round((m.count / total) * 100) : 0
                  return (
                    <div key={m.kategori}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{m.kategori}</span>
                        <span className="text-muted-foreground">{m.count} ({pct}%)</span>
                      </div>
                      <Progress value={pct} />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TrendChart data={learningTrend} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Agent Performance (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {agentPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Agent</th>
                      <th className="pb-2 font-medium text-right">Calls</th>
                      <th className="pb-2 font-medium text-right">Success</th>
                      <th className="pb-2 font-medium text-right">Avg (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentPerformance.map((a) => (
                      <tr key={a.agent} className="border-b last:border-0">
                        <td className="py-2 font-medium">{a.agent}</td>
                        <td className="py-2 text-right">{a.totalCalls}</td>
                        <td className="py-2 text-right">
                          <Badge variant={a.successRate >= 90 ? "success" : a.successRate >= 70 ? "warning" : "destructive"}>
                            {a.successRate}%
                          </Badge>
                        </td>
                        <td className="py-2 text-right">{a.avgDuration.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Warning Stats</CardTitle>
          </CardHeader>
          <CardContent>
            {warningStats.bySeverity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada warning</p>
            ) : (
              <div className="space-y-3">
                {warningStats.bySeverity.map((w) => (
                  <div key={w.severity} className="flex items-center justify-between">
                    <Badge className={severityColors[w.severity] ?? "bg-gray-100 text-gray-800"}>
                      {w.severity}
                    </Badge>
                    <span className="text-sm font-medium">{w.count}</span>
                  </div>
                ))}
                {warningStats.breakdown.length > 0 && (
                  <div className="mt-4 pt-3 border-t space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Per Tipe</p>
                    {warningStats.breakdown.map((w) => (
                      <div key={`${w.severity}-${w.tipe}`} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{w.tipe} ({w.severity})</span>
                        <span className="font-medium">{w.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Siswa Berisiko Dropout ({dropoutRisk.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dropoutRisk.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Tidak ada siswa berisiko</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Nama</th>
                    <th className="pb-2 font-medium">NIS</th>
                    <th className="pb-2 font-medium">Kelas</th>
                    <th className="pb-2 font-medium text-right">Warnings</th>
                    <th className="pb-2 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {dropoutRisk.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{s.nama}</td>
                      <td className="py-2 text-muted-foreground">{s.nis ?? "-"}</td>
                      <td className="py-2">{s.kelas}</td>
                      <td className="py-2 text-right">
                        <Badge variant="destructive">{s.warningCount}</Badge>
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          href={`/guru/murid/${s.id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                        >
                          Lihat <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
