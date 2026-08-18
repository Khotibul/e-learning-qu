"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  BarChart3, Users, GraduationCap, AlertTriangle, TrendingUp,
  CheckCircle, Brain, Shield, Loader2, RefreshCw,
} from "lucide-react"
import { getTeacherAnalytics, getAtRiskStudents, resolveWarning } from "./actions"

interface Overview {
  totalSiswa: number
  totalKelas: number
  totalMapel: number
  totalUjian: number
  rataRataGlobal: number
}

interface PerMapel {
  nama: string
  rataRata: number
  jumlahSiswa: number
  lulusRate: number
  topikLemah: string[]
}

interface PerKelas {
  nama: string
  rataRata: number
  jumlahSiswa: number
  distribusi: Record<string, number>
}

interface AtRiskSiswa {
  siswaId: string
  nama: string
  kelas: string
  rataNilai: number
  warnings: number
  kategori: string
}

interface NGain {
  mapel: string
  pretest: number
  posttest: number
  nGain: number
  efektivitas: string
}

interface EarlyWarningEntry {
  id: string
  siswaId: string
  tipe: string
  severity: string
  message: string
  skor: number
  isResolved: boolean
  createdAt: Date
  siswa: {
    nama: string
    nis: string
    kelas: { nama: string } | null
  } | null
}

interface AnalyticsData {
  overview: Overview
  perMapel: PerMapel[]
  perKelas: PerKelas[]
  topAtRisk: AtRiskSiswa[]
  nGainSummary: NGain[]
}

const severityColor: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  LOW: "bg-blue-100 text-blue-700 border-blue-200",
}

const kategoriColor: Record<string, string> = {
  "Risiko Tinggi": "bg-red-100 text-red-700",
  "Perlu Perhatian": "bg-yellow-100 text-yellow-700",
  "Aman": "bg-green-100 text-green-700",
}

const gradeColors: Record<string, string> = {
  A: "bg-green-500",
  B: "bg-blue-500",
  C: "bg-yellow-500",
  D: "bg-orange-500",
  E: "bg-red-500",
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
}

export default function TeacherAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [atRiskData, setAtRiskData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const [analytics, warnings] = await Promise.all([
        getTeacherAnalytics(),
        getAtRiskStudents(),
      ])
      setData(analytics as AnalyticsData)
      setAtRiskData(warnings as any[])
    } catch {
      toast.error("Gagal memuat data analitik")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleResolveWarning = async (warningId: string) => {
    setResolvingId(warningId)
    try {
      await resolveWarning(warningId)
      toast.success("Warning ditandai selesai")
      setAtRiskData((prev) =>
        prev
          .map((entry) => ({
            ...entry,
            warnings: entry.warnings.filter((w: any) => w.id !== warningId),
          }))
          .filter((entry) => entry.warnings.length > 0)
      )
    } catch {
      toast.error("Gagal resolve warning")
    } finally {
      setResolvingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Gagal memuat data</p>
            <Button variant="outline" className="mt-4" onClick={() => fetchData()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { overview, perMapel, perKelas, topAtRisk, nGainSummary } = data
  const maxMapelRata = Math.max(...perMapel.map((m) => m.rataRata), 100)
  const maxKelasRata = Math.max(...perKelas.map((k) => k.rataRata), 100)

  return (
    <motion.div {...fadeUp} className="space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Teacher Analytics Agent
          </h1>
          <p className="text-muted-foreground mt-1">
            Analitik lengkap untuk pengajar
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <div className="sticky top-0 z-10 bg-background pb-px -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
          <TabsList className="flex-nowrap w-max min-w-full">
            <TabsTrigger value="overview" className="px-3 py-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="mapel" className="px-3 py-1.5 text-xs sm:text-sm">
              <GraduationCap className="h-3.5 w-3.5 mr-1.5" /> Per Mapel
            </TabsTrigger>
            <TabsTrigger value="kelas" className="px-3 py-1.5 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5 mr-1.5" /> Per Kelas
            </TabsTrigger>
            <TabsTrigger value="risiko" className="px-3 py-1.5 text-xs sm:text-sm">
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Siswa Berisiko
            </TabsTrigger>
            <TabsTrigger value="ngain" className="px-3 py-1.5 text-xs sm:text-sm">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> N-Gain
            </TabsTrigger>
            <TabsTrigger value="warning" className="px-3 py-1.5 text-xs sm:text-sm">
              <Shield className="h-3.5 w-3.5 mr-1.5" /> Early Warning
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══ OVERVIEW ═══ */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Siswa</CardTitle>
                <div className="rounded-xl p-2 text-blue-600 bg-blue-100">
                  <Users className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{overview.totalSiswa}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Kelas</CardTitle>
                <div className="rounded-xl p-2 text-indigo-600 bg-indigo-100">
                  <Users className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{overview.totalKelas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Mapel</CardTitle>
                <div className="rounded-xl p-2 text-purple-600 bg-purple-100">
                  <GraduationCap className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{overview.totalMapel}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Ujian</CardTitle>
                <div className="rounded-xl p-2 text-amber-600 bg-amber-100">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{overview.totalUjian}</div>
              </CardContent>
            </Card>
            <Card className="col-span-2 lg:col-span-1 border-primary">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Rata-rata Global</CardTitle>
                <div className="rounded-xl p-2 text-emerald-600 bg-emerald-100">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600">
                  {overview.rataRataGlobal}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Skor 0-100</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ringkasan Per Mapel</CardTitle>
              </CardHeader>
              <CardContent>
                {perMapel.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Belum ada data</p>
                ) : (
                  <div className="space-y-4">
                    {perMapel.map((item) => (
                      <div key={item.nama} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{item.nama}</span>
                          <span className="font-medium">{item.rataRata}</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all"
                            style={{ width: `${(item.rataRata / maxMapelRata) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ringkasan Per Kelas</CardTitle>
              </CardHeader>
              <CardContent>
                {perKelas.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Belum ada data</p>
                ) : (
                  <div className="space-y-4">
                    {perKelas.map((item) => (
                      <div key={item.nama} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{item.nama}</span>
                          <span className="font-medium">{item.rataRata}</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                            style={{ width: `${(item.rataRata / maxKelasRata) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ PER MAPEL ═══ */}
        <TabsContent value="mapel" className="space-y-4 mt-4">
          {perMapel.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Belum ada data mata pelajaran
              </CardContent>
            </Card>
          ) : (
            perMapel.map((m) => (
              <motion.div key={m.nama} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <GraduationCap className="h-5 w-5 text-purple-600" />
                          {m.nama}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {m.jumlahSiswa} siswa
                        </p>
                      </div>
                      <Badge variant="outline" className="text-sm font-bold">
                        {m.rataRata}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>Rata-rata Nilai</span>
                        <span className="font-medium">{m.rataRata}</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all"
                          style={{ width: `${(m.rataRata / maxMapelRata) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>Lulus Rate</span>
                        <span className="font-medium">{m.lulusRate}%</span>
                      </div>
                      <Progress value={m.lulusRate} className="h-2" />
                    </div>

                    {m.topikLemah.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          Topik Lemah
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.topikLemah.map((topik) => (
                            <Badge key={topik} variant="secondary" className="text-xs">
                              {topik}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </TabsContent>

        {/* ═══ PER KELAS ═══ */}
        <TabsContent value="kelas" className="space-y-4 mt-4">
          {perKelas.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Belum ada data kelas
              </CardContent>
            </Card>
          ) : (
            perKelas.map((k) => {
              const totalNilai = Object.values(k.distribusi).reduce((a, b) => a + b, 0)
              return (
                <motion.div key={k.nama} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            {k.nama}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {k.jumlahSiswa} siswa
                          </p>
                        </div>
                        <Badge variant="outline" className="text-sm font-bold">
                          {k.rataRata}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>Rata-rata Nilai</span>
                          <span className="font-medium">{k.rataRata}</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                            style={{ width: `${(k.rataRata / maxKelasRata) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Distribusi Nilai</p>
                        <div className="flex gap-2 h-4 rounded-full overflow-hidden">
                          {(["A", "B", "C", "D", "E"] as const).map((grade) => {
                            const count = k.distribusi[grade] || 0
                            const pct = totalNilai > 0 ? (count / totalNilai) * 100 : 0
                            return pct > 0 ? (
                              <div
                                key={grade}
                                className={`${gradeColors[grade]} transition-all`}
                                style={{ width: `${pct}%` }}
                                title={`${grade}: ${count}`}
                              />
                            ) : null
                          })}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {(["A", "B", "C", "D", "E"] as const).map((grade) => (
                            <div key={grade} className="flex items-center gap-1 text-xs">
                              <div className={`w-2.5 h-2.5 rounded-full ${gradeColors[grade]}`} />
                              <span>
                                {grade}: {k.distribusi[grade] || 0}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })
          )}
        </TabsContent>

        {/* ═══ SISWA BERISIKO ═══ */}
        <TabsContent value="risiko" className="space-y-4 mt-4">
          {topAtRisk.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Tidak ada siswa berisiko
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Siswa Berisiko
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Top {topAtRisk.length} siswa dengan nilai rendah atau warning aktif
                </p>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead className="text-center">Rata-rata</TableHead>
                      <TableHead className="text-center">Warnings</TableHead>
                      <TableHead className="text-center">Kategori</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topAtRisk.map((s) => (
                      <TableRow key={s.siswaId}>
                        <TableCell className="font-medium">{s.nama}</TableCell>
                        <TableCell>{s.kelas}</TableCell>
                        <TableCell className="text-center">
                          <span className={s.rataNilai < 65 ? "text-red-600 font-bold" : ""}>
                            {s.rataNilai}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {s.warnings > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              {s.warnings}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={`text-xs ${kategoriColor[s.kategori] || ""}`}
                          >
                            {s.kategori}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ N-GAIN ═══ */}
        <TabsContent value="ngain" className="space-y-4 mt-4">
          {nGainSummary.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Belum ada data pretest/posttest
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    Ringkasan N-Gain (Pretest vs Posttest)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mata Pelajaran</TableHead>
                        <TableHead className="text-center">Pretest</TableHead>
                        <TableHead className="text-center">Posttest</TableHead>
                        <TableHead className="text-center">N-Gain</TableHead>
                        <TableHead className="text-center">Efektivitas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nGainSummary.map((ng) => (
                        <TableRow key={ng.mapel}>
                          <TableCell className="font-medium">{ng.mapel}</TableCell>
                          <TableCell className="text-center">{ng.pretest}</TableCell>
                          <TableCell className="text-center">{ng.posttest}</TableCell>
                          <TableCell className="text-center font-bold">
                            {ng.nGain.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={`text-xs ${
                                ng.efektivitas === "Efektif"
                                  ? "bg-green-100 text-green-700"
                                  : ng.efektivitas === "Cukup Efektif"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {ng.efektivitas}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {nGainSummary.map((ng) => (
                  <motion.div
                    key={ng.mapel}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{ng.mapel}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Pretest: {ng.pretest}</span>
                            <span>Posttest: {ng.posttest}</span>
                          </div>
                          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                            <div
                              className="absolute left-0 top-0 h-full rounded-full bg-blue-400 transition-all"
                              style={{ width: `${ng.pretest}%` }}
                            />
                            <div
                              className="absolute left-0 top-0 h-full rounded-full bg-green-500 opacity-60 transition-all"
                              style={{ width: `${ng.posttest}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">N-Gain</span>
                          <span className="font-bold text-sm">
                            {ng.nGain.toFixed(2)}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`w-full justify-center text-xs ${
                            ng.efektivitas === "Efektif"
                              ? "border-green-300 text-green-700"
                              : ng.efektivitas === "Cukup Efektif"
                              ? "border-yellow-300 text-yellow-700"
                              : "border-red-300 text-red-700"
                          }`}
                        >
                          {ng.efektivitas}
                        </Badge>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ═══ EARLY WARNING ═══ */}
        <TabsContent value="warning" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Early Warning Management
              </h2>
              <p className="text-sm text-muted-foreground">
                Kelola peringatan dini untuk siswa bermasalah
              </p>
            </div>
          </div>

          {atRiskData.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-lg font-medium">Tidak ada warning aktif</p>
                <p className="text-muted-foreground mt-1">Semua siswa dalam kondisi aman</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {atRiskData.map((entry: any) => (
                <motion.div
                  key={entry.siswa?.id || Math.random()}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {entry.siswa?.nama ?? "Siswa"}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {entry.siswa?.kelas?.nama ?? "-"} &middot; NIS: {entry.siswa?.nis ?? "-"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">
                            {entry.totalWarnings} Warning
                          </Badge>
                          <Badge
                            className={`text-xs ${severityColor[entry.highestSeverity] || ""}`}
                          >
                            {entry.highestSeverity}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {entry.warnings.map((w: any) => (
                          <div
                            key={w.id}
                            className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                              w.isResolved ? "opacity-50" : ""
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${severityColor[w.severity] || ""}`}
                                >
                                  {w.severity}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {w.tipe}
                                </span>
                              </div>
                              <p className="text-sm">{w.message}</p>
                            </div>
                            {!w.isResolved && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                                disabled={resolvingId === w.id}
                                onClick={() => handleResolveWarning(w.id)}
                              >
                                {resolvingId === w.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                    Resolve
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
