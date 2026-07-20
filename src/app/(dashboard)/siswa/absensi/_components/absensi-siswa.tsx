"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle2, XCircle, Calendar } from "lucide-react"

interface AbsensiItem {
  id: string
  tanggal: string
  status: string
  mataPelajaran: string
}

const statusBadge: Record<string, { label: string; class: string }> = {
  HADIR: { label: "Hadir", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  TIDAK_HADIR: { label: "Tidak Hadir", class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  IZIN: { label: "Izin", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  SAKIT: { label: "Sakit", class: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  ALPA: { label: "Alpa", class: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300" },
}

export function AbsensiSiswaClient() {
  const [data, setData] = useState<AbsensiItem[]>([])
  const [loading, setLoading] = useState(true)
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Riwayat Absensi</h1>
        <p className="text-muted-foreground mt-1">Lihat riwayat kehadiran Anda</p>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data.length}</p></CardContent>
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
            <p className="text-2xl font-bold">
              {data.length > 0 ? Math.round((hadirCount / data.length) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label>Dari Tanggal</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label>Sampai Tanggal</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Riwayat</CardTitle></CardHeader>
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
    </div>
  )
}
