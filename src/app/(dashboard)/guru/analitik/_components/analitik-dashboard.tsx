"use client"

import {
  BarChart3, TrendingUp, TrendingDown, Target, CheckCircle, XCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface GrafikItem {
  label: string
  nilai: number
}

interface AnalyticsData {
  rataRata: number
  tertinggi: number
  terendah: number
  lulus: number
  tidakLulus: number
  totalSiswaDinilai: number
  grafikKelas: GrafikItem[]
  grafikMapel: GrafikItem[]
  essayCount: number
  pgCount: number
}

export function AnalitikDashboardClient({ data }: { data: AnalyticsData }) {
  const maxKelas = Math.max(...data.grafikKelas.map((g) => g.nilai), 100)
  const maxMapel = Math.max(...data.grafikMapel.map((g) => g.nilai), 100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" />
          Analitik Pembelajaran
        </h1>
        <p className="text-muted-foreground mt-1">
          Ringkasan hasil belajar siswa
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Nilai Rata-rata</CardTitle>
            <div className="rounded-xl p-2 text-blue-600 bg-blue-100">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.rataRata}</div>
            <p className="text-xs text-muted-foreground mt-1">Dari {data.totalSiswaDinilai} siswa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Nilai Tertinggi</CardTitle>
            <div className="rounded-xl p-2 text-green-600 bg-green-100">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{data.tertinggi}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Nilai Terendah</CardTitle>
            <div className="rounded-xl p-2 text-red-600 bg-red-100">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{data.terendah}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Kelulusan</CardTitle>
            <Target className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-1 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-600">{data.lulus}</span>
                </div>
                <div className="flex items-center gap-1 text-sm mt-1">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-600">{data.tidakLulus}</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{
                      width: `${data.lulus + data.tidakLulus > 0
                        ? (data.lulus / (data.lulus + data.tidakLulus)) * 100
                        : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.lulus + data.tidakLulus > 0
                    ? `${Math.round((data.lulus / (data.lulus + data.tidakLulus)) * 100)}% Lulus`
                    : "Belum ada data"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nilai Rata-rata per Kelas</CardTitle>
          </CardHeader>
          <CardContent>
            {data.grafikKelas.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Belum ada data</p>
            ) : (
              <div className="space-y-4">
                {data.grafikKelas.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="font-medium">{item.nilai}</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                        style={{ width: `${(item.nilai / maxKelas) * 100}%` }}
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
            <CardTitle className="text-lg">Nilai Rata-rata per Mata Pelajaran</CardTitle>
          </CardHeader>
          <CardContent>
            {data.grafikMapel.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Belum ada data</p>
            ) : (
              <div className="space-y-4">
                {data.grafikMapel.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="font-medium">{item.nilai}</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all"
                        style={{ width: `${(item.nilai / maxMapel) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Statistik Tambahan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border p-4 text-center">
              <p className="text-2xl font-bold">{data.totalSiswaDinilai}</p>
              <p className="text-sm text-muted-foreground">Total Siswa Dinilai</p>
            </div>
            <div className="rounded-xl border p-4 text-center">
              <p className="text-2xl font-bold">{data.pgCount}</p>
              <p className="text-sm text-muted-foreground">Jawaban PG Terkoreksi</p>
            </div>
            <div className="rounded-xl border p-4 text-center">
              <p className="text-2xl font-bold">{data.essayCount}</p>
              <p className="text-sm text-muted-foreground">Jawaban Essay Dinilai</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
