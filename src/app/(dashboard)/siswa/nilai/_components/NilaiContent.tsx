"use client"

import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NilaiChart } from "../../_components/NilaiChart"
import { formatDateOnly, calculateGrade } from "@/lib/utils"
import { Download } from "lucide-react"

interface NilaiItem {
  id: string
  mapel: string
  semester: string
  jenis: string
  nilai: number
  keterangan: string | null
  tanggal: string
}

interface NilaiContentProps {
  nilaiData: NilaiItem[]
  chartData: { label: string; nilai: number }[]
  semesterOptions: { id: string; nama: string }[]
  selectedSemester: string
}

const jenisWarna: Record<string, "default" | "secondary" | "warning" | "destructive" | "outline"> = {
  UJIAN: "default",
  LATIHAN: "secondary",
  UTS: "warning",
  UAS: "destructive",
  HARIAN: "outline",
}

export function NilaiContent({ nilaiData, chartData, semesterOptions, selectedSemester }: NilaiContentProps) {
  const router = useRouter()

  const handleSemesterChange = (value: string) => {
    const params = new URLSearchParams()
    if (value) params.set("semester", value)
    router.push(`/siswa/nilai${params.toString() ? `?${params.toString()}` : ""}`)
  }

  const handleDownload = () => {
    const header = "Mapel,Semester,Jenis,Nilai,Keterangan,Tanggal\n"
    const rows = nilaiData
      .map((n) => `"${n.mapel}","${n.semester}","${n.jenis}",${n.nilai},"${n.keterangan || ""}","${n.tanggal}"`)
      .join("\n")
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `nilai_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nilai</h1>
          <p className="text-muted-foreground">Daftar nilai dan perkembangan akademik</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={selectedSemester} onValueChange={handleSemesterChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Semua Semester" />
            </SelectTrigger>
            <SelectContent>
              {semesterOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>{opt.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={nilaiData.length === 0}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download CSV</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0"><NilaiChart data={chartData} /></div>
        <div className="flex-1 min-w-0"><Card>
          <CardHeader>
            <CardTitle className="text-lg">Ringkasan Nilai</CardTitle>
          </CardHeader>
          <CardContent>
            {nilaiData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada data nilai</p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const avg =
                    nilaiData.reduce((sum, n) => sum + n.nilai, 0) / nilaiData.length
                  const tertinggi = Math.max(...nilaiData.map((n) => n.nilai))
                  const terendah = Math.min(...nilaiData.map((n) => n.nilai))
                  return (
                    <>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm text-muted-foreground">Rata-rata</span>
                        <span className="text-lg font-bold">{avg.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm text-muted-foreground">Tertinggi</span>
                        <span className="text-lg font-bold text-emerald-600">{tertinggi}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm text-muted-foreground">Terendah</span>
                        <span className="text-lg font-bold text-red-600">{terendah}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm text-muted-foreground">Total Entry</span>
                        <span className="text-lg font-bold">{nilaiData.length}</span>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detail Nilai</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mata Pelajaran</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Nilai</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Tanggal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nilaiData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Belum ada data nilai
                  </TableCell>
                </TableRow>
              ) : (
                nilaiData.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.mapel}</TableCell>
                    <TableCell>{n.semester}</TableCell>
                    <TableCell>
                      <Badge variant={jenisWarna[n.jenis] ?? "outline"}>{n.jenis}</Badge>
                    </TableCell>
                    <TableCell className="font-bold tabular-nums">{n.nilai}</TableCell>
                    <TableCell>{calculateGrade(n.nilai)}</TableCell>
                    <TableCell className="text-muted-foreground">{n.keterangan ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateOnly(n.tanggal)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
