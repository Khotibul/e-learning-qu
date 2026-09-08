"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, CheckCircle2, XCircle, Calendar, Clock, TrendingUp, GraduationCap } from "lucide-react"

interface AbsensiItem {
  id: string
  tanggal: string
  status: string
  mataPelajaran: string
}

interface HarianGroup {
  dateKey: string
  tanggal: string
  items: AbsensiItem[]
  total: number
  hadir: number
  sakit: number
  izin: number
  alpa: number
  tidakHadir: number
  persentase: number
}

const statusBadge: Record<string, { label: string; class: string }> = {
  HADIR: { label: "Hadir", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  TIDAK_HADIR: { label: "Tidak Hadir", class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  IZIN: { label: "Izin", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  SAKIT: { label: "Sakit", class: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  ALPA: { label: "Alpa", class: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300" },
}

function getHarianStatus(persentase: number, total: number, hadir: number) {
  if (persentase === 100) return { label: "Hadir Penuh", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" }
  if (persentase === 0) return { label: "Tidak Hadir", class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" }
  if (persentase >= 75) return { label: "Hadir Sebagian", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" }
  return { label: "Kurang Hadir", class: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" }
}

export function AbsensiSiswaClient() {
  const [data, setData] = useState<AbsensiItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"harian" | "pelajaran">("harian")
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/siswa/absensi?start=${startDate}&end=${endDate}`)
      .then((r) => r.json())
      .then((res) => { if (Array.isArray(res)) setData(res) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [startDate, endDate])

  const hadirCount = data.filter((d) => d.status === "HADIR").length
  const tidakHadirCount = data.filter((d) => d.status !== "HADIR").length
  const persentaseKeseluruhan = data.length > 0 ? Math.round((hadirCount / data.length) * 100) : 0

  const harianData: HarianGroup[] = useMemo(() => {
    const map = new Map<string, AbsensiItem[]>()
    for (const item of data) {
      const key = new Date(item.tanggal).toISOString().slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    const groups: HarianGroup[] = []
    for (const [dateKey, items] of map.entries()) {
      const total = items.length
      const hadir = items.filter((i) => i.status === "HADIR").length
      const sakit = items.filter((i) => i.status === "SAKIT").length
      const izin = items.filter((i) => i.status === "IZIN").length
      const alpa = items.filter((i) => i.status === "ALPA").length
      const tidakHadir = total - hadir
      const persentase = total > 0 ? Math.round((hadir / total) * 100) : 0
      groups.push({
        dateKey,
        tanggal: items[0].tanggal,
        items,
        total,
        hadir,
        sakit,
        izin,
        alpa,
        tidakHadir,
        persentase,
      })
    }
    return groups.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
  }, [data])

  const totalHari = harianData.length
  const hariHadirPenuh = harianData.filter((h) => h.persentase === 100).length
  const hariTidakHadir = harianData.filter((h) => h.persentase === 0).length
  const rataHarian = totalHari > 0 ? Math.round(harianData.reduce((s, h) => s + h.persentase, 0) / totalHari) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Riwayat Absensi</h1>
        <p className="text-muted-foreground mt-1">Lihat riwayat kehadiran — per pelajaran dan rekap harian</p>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList>
          <TabsTrigger value="harian" className="gap-1.5"><Calendar className="h-4 w-4" /> Harian</TabsTrigger>
          <TabsTrigger value="pelajaran" className="gap-1.5"><GraduationCap className="h-4 w-4" /> Per Pelajaran</TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap gap-4 items-end mt-4">
          <div className="space-y-1">
            <Label>Dari Tanggal</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label>Sampai Tanggal</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          </div>
        </div>

        <TabsContent value="harian" className="space-y-4 mt-4">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Hari</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalHari}</p>
                <p className="text-xs text-muted-foreground">hari dengan jadwal</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Hadir Penuh</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">{hariHadirPenuh}</p>
                <p className="text-xs text-muted-foreground">dari {totalHari} hari</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Tidak Hadir</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-red-600">{hariTidakHadir}</p><p className="text-xs text-muted-foreground">hari 0% hadir</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Rata Harian</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{rataHarian}%</p>
                <Progress value={rataHarian} className="h-1.5 mt-2" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Rekap Harian</CardTitle>
              <span className="text-xs text-muted-foreground">{harianData.length} hari</span>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Memuat data...</p>
              ) : harianData.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8" />
                  <p className="text-sm">Belum ada data absensi</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {harianData.map((h) => {
                    const status = getHarianStatus(h.persentase, h.total, h.hadir)
                    return (
                      <div key={h.dateKey} className="rounded-xl border overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-muted/30">
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-primary/10 p-2">
                              <Calendar className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">
                                {new Date(h.tanggal).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                              </p>
                              <p className="text-xs text-muted-foreground">{h.total} pelajaran • {h.hadir} hadir {h.sakit > 0 ? `• ${h.sakit} sakit` : ""} {h.izin > 0 ? `• ${h.izin} izin` : ""} {h.alpa > 0 ? `• ${h.alpa} alpa` : ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-start sm:self-center">
                            <div className="text-right">
                              <p className="text-lg font-bold leading-none">{h.persentase}%</p>
                              <p className="text-[10px] text-muted-foreground">{h.hadir}/{h.total} hadir</p>
                            </div>
                            <Badge className={status.class}>{status.label}</Badge>
                          </div>
                        </div>
                        <div className="px-4 pb-3 pt-2">
                          <Progress value={h.persentase} className="h-1.5 mb-3" />
                          <div className="grid gap-1.5">
                            {h.items.map((it) => {
                              const st = statusBadge[it.status] || { label: it.status, class: "" }
                              return (
                                <div key={it.id} className="flex items-center justify-between text-xs rounded-lg border px-3 py-1.5">
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    {it.mataPelajaran}
                                  </span>
                                  <Badge className={`${st.class} text-[10px] px-1.5 py-0`}>{st.label}</Badge>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900">
            <CardContent className="py-3 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span><b>Cara hitung harian:</b> Persentase = (pelajaran dengan status HADIR ÷ total pelajaran yang diikuti hari itu) × 100%. Izin/Sakit/Alpa dihitung tidak hadir untuk persentase kehadiran. Total pelajaran mengikuti jadwal yang tercatat di absensi.</span>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pelajaran" className="space-y-4 mt-4">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{data.length}</p><p className="text-xs text-muted-foreground">pelajaran</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Hadir</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-emerald-600">{hadirCount}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Tidak Hadir</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-red-600">{tidakHadirCount}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Kehadiran</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{persentaseKeseluruhan}%</p>
                <Progress value={persentaseKeseluruhan} className="h-1.5 mt-2" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Riwayat Per Pelajaran</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Memuat data...</p>
              ) : data.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8" />
                  <p className="text-sm">Belum ada data absensi</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.map((item) => {
                    const st = statusBadge[item.status] || { label: item.status, class: "" }
                    const isHadir = item.status === "HADIR"
                    return (
                      <div key={item.id} className="flex items-center justify-between rounded-xl border px-4 py-3">
                        <div className="flex items-center gap-3">
                          {isHadir ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {new Date(item.tanggal).toLocaleDateString("id-ID", {
                                weekday: "long", year: "numeric", month: "long", day: "numeric",
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">{item.mataPelajaran}</p>
                          </div>
                        </div>
                        <Badge className={st.class}>{st.label}</Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
