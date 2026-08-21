"use client"

import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  BookOpen, ClipboardList, FileText, GraduationCap, School, Users,
  Plus, TestTube, AlertTriangle, Sparkles, TrendingDown,
} from "lucide-react"
import Link from "next/link"
import type { GuruDashboardStats } from "@/types"

const statCards: {
  label: string
  value: "kelasCount" | "mapelCount" | "siswaCount" | "ujianAktif" | "latihanAktif" | "totalSoal"
  icon: React.ElementType
  color: string
}[] = [
  { label: "Kelas Diajar", value: "kelasCount", icon: School, color: "text-blue-600 bg-blue-100" },
  { label: "Mata Pelajaran", value: "mapelCount", icon: BookOpen, color: "text-cyan-600 bg-cyan-100" },
  { label: "Total Murid", value: "siswaCount", icon: Users, color: "text-green-600 bg-green-100" },
  { label: "Ujian Aktif", value: "ujianAktif", icon: ClipboardList, color: "text-orange-600 bg-orange-100" },
  { label: "Latihan Aktif", value: "latihanAktif", icon: TestTube, color: "text-purple-600 bg-purple-100" },
  { label: "Total Soal", value: "totalSoal", icon: FileText, color: "text-rose-600 bg-rose-100" },
]

const quickActions = [
  { label: "Buat Soal", href: "/guru/soal", icon: Plus, color: "bg-blue-500 hover:bg-blue-600" },
  { label: "Buat Ujian", href: "/guru/ujian", icon: ClipboardList, color: "bg-green-500 hover:bg-green-600" },
  { label: "Bank Soal", href: "/guru/bank-soal", icon: FileText, color: "bg-purple-500 hover:bg-purple-600" },
  { label: "Nilai", href: "/guru/nilai", icon: GraduationCap, color: "bg-orange-500 hover:bg-orange-600" },
  { label: "Analitik", href: "/guru/analitik", icon: TestTube, color: "bg-cyan-500 hover:bg-cyan-600" },
]

export function GuruDashboardClient({ stats }: { stats: GuruDashboardStats }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard Guru</h1>
        <p className="text-muted-foreground mt-1">
          Selamat datang di dashboard guru. Kelola soal, ujian, dan nilai di sini.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon
          const value = stats[card.value]
          return (
            <Card key={card.value}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <div className={`rounded-xl p-2 ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.label === "Ujian Aktif" || card.label === "Latihan Aktif"
                    ? "Sedang berlangsung"
                    : "Total keseluruhan"}
                </p>
              </CardContent>
            </Card>
          )
        })}
        {/* Rata-rata Nilai */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rata-rata Nilai</CardTitle>
            <div className="rounded-xl p-2 bg-emerald-100 text-emerald-600">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.rataNilai > 0 ? stats.rataNilai : "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">Dari ujian yang Anda buat</p>
          </CardContent>
        </Card>
        {/* Rata-rata Mastery */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rata-rata Mastery</CardTitle>
            <div className="rounded-xl p-2 bg-violet-100 text-violet-600">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.rataMastery > 0 ? `${stats.rataMastery}%` : "—"}</div>
            <Progress value={stats.rataMastery} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* P1: Early Warning + Siswa Perlu Perhatian */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={stats.riskHigh > 0 ? "border-red-200 dark:border-red-900" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${stats.riskHigh > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              Early Warning
            </CardTitle>
            <Link href="/guru/teacher-analytics">
              <Button variant="ghost" size="sm">Detail</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stats.riskHigh === 0 && stats.riskMedium === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Tidak ada peringatan aktif. Semua siswa dalam kondisi aman.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{stats.riskHigh}</p>
                    <p className="text-xs text-muted-foreground">Risiko Tinggi</p>
                  </div>
                  <div className="flex-1 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{stats.riskMedium}</p>
                    <p className="text-xs text-muted-foreground">Perlu Perhatian</p>
                  </div>
                </div>
                {stats.topAtRisk.length > 0 && (
                  <div className="space-y-2">
                    {stats.topAtRisk.map((s) => (
                      <Link
                        key={s.id}
                        href={`/guru/murid/${s.id}`}
                        className="flex items-start justify-between gap-2 rounded-lg border p-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.nama}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.kelas} — {s.message}</p>
                        </div>
                        <Badge variant={s.severity === "CRITICAL" ? "destructive" : "warning"} className="text-[10px] shrink-0">
                          {s.severity === "CRITICAL" ? "Intervensi" : "Risiko"}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* P4: AI Insight */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Insight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {stats.aiInsight.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <TrendingDown className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
            <Link href="/guru/analitik" className="block mt-4">
              <Button variant="outline" size="sm" className="w-full">Lihat Analitik Lengkap</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aksi Cepat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link key={action.href} href={action.href}>
                  <Button className={`text-white gap-2 ${action.color}`}>
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </Button>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
