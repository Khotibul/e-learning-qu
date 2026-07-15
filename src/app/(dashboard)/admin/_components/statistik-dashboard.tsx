"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BarChart3, Users, UserCheck, BookOpen, School } from "lucide-react"

interface BarChartProps {
  data: { label: string; nilai: number; color?: string }[]
  title: string
  icon?: React.ReactNode
  maxBarHeight?: number
}

function SimpleBarChart({ data, title, maxBarHeight = 200 }: BarChartProps) {
  const maxVal = Math.max(...data.map((d) => d.nilai), 1)
  const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500", "bg-rose-500", "bg-yellow-500"]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
        ) : (
          <div className="flex items-end gap-3 h-[200px]">
            {data.map((d, i) => {
              const height = (d.nilai / maxVal) * 180
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-xs font-medium">{d.nilai}</span>
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
        )}
      </CardContent>
    </Card>
  )
}

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <div className={`rounded-xl p-2 ${color}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

interface Props {
  guruMurid: { guru: number; murid: number }
  perKelas: { label: string; nilai: number; tingkat: number }[]
  perMapel: { label: string; nilai: number; soalCount: number }[]
}

export function StatistikDashboard({ guruMurid, perKelas, perMapel }: Props) {
  const guruMuridData = [
    { label: "Guru", nilai: guruMurid.guru, color: "bg-blue-500" },
    { label: "Murid", nilai: guruMurid.murid, color: "bg-green-500" },
  ]

  const total = guruMurid.guru + guruMurid.murid

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Statistik</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Guru" value={guruMurid.guru} icon={<UserCheck className="h-5 w-5 text-blue-600" />} color="bg-blue-100" />
        <StatCard label="Total Murid" value={guruMurid.murid} icon={<Users className="h-5 w-5 text-green-600" />} color="bg-green-100" />
        <StatCard label="Total Kelas" value={perKelas.length} icon={<School className="h-5 w-5 text-purple-600" />} color="bg-purple-100" />
        <StatCard label="Total Mapel" value={perMapel.length} icon={<BookOpen className="h-5 w-5 text-orange-600" />} color="bg-orange-100" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SimpleBarChart
          data={guruMuridData}
          title="Grafik Jumlah Guru & Murid"
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Distribusi Guru & Murid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Guru</span>
                  <span className="font-medium">{guruMurid.guru} ({total ? Math.round((guruMurid.guru / total) * 100) : 0}%)</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${total ? (guruMurid.guru / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Murid</span>
                  <span className="font-medium">{guruMurid.murid} ({total ? Math.round((guruMurid.murid / total) * 100) : 0}%)</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-500"
                    style={{ width: `${total ? (guruMurid.murid / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <SimpleBarChart
        data={perKelas.map((k) => ({ label: k.label, nilai: k.nilai }))}
        title="Grafik Jumlah Murid Per Kelas"
      />

      <SimpleBarChart
        data={perMapel.map((m) => ({ label: m.label, nilai: m.soalCount }))}
        title="Grafik Jumlah Soal Per Mata Pelajaran"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Distribusi Nilai Per Mapel</CardTitle>
          </CardHeader>
          <CardContent>
            {perMapel.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada data</p>
            ) : (
              <div className="space-y-3">
                {perMapel.slice(0, 10).map((m, i) => {
                  const maxNilai = Math.max(...perMapel.map((p) => p.nilai), 1)
                  const pct = (m.nilai / maxNilai) * 100
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="truncate">{m.label}</span>
                        <span className="font-medium">{m.nilai} nilai</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Distribusi Soal Per Mapel</CardTitle>
          </CardHeader>
          <CardContent>
            {perMapel.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada data</p>
            ) : (
              <div className="space-y-3">
                {perMapel.slice(0, 10).map((m, i) => {
                  const maxSoal = Math.max(...perMapel.map((p) => p.soalCount), 1)
                  const pct = (m.soalCount / maxSoal) * 100
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="truncate">{m.label}</span>
                        <span className="font-medium">{m.soalCount} soal</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

