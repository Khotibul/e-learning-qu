"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateOnly } from "@/lib/utils"
import { CalendarDays, Clock, FileText, BookOpen, CheckCircle } from "lucide-react"
import Link from "next/link"

interface ExamCardProps {
  id: string
  nama: string
  mapel: string
  kelas: string
  tanggal: string
  durasi: number
  status: string
  sudahDikerjakan: boolean
  jumlahSoal: number
  nilaiMinimum?: number
  bisaRetake?: boolean
}

const statusColor: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  AKTIF: "success",
  DRAFT: "secondary",
  SELESAI: "warning",
}

const statusLabel: Record<string, string> = {
  AKTIF: "Aktif",
  DRAFT: "Draft",
  SELESAI: "Selesai",
}

export function ExamCard({ id, nama, mapel, kelas, tanggal, durasi, status, sudahDikerjakan, jumlahSoal, nilaiMinimum, bisaRetake }: ExamCardProps) {
  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base truncate">{nama}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{mapel}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sudahDikerjakan && (
              <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Selesai
              </Badge>
            )}
            <Badge variant={statusColor[status] ?? "secondary"}>{statusLabel[status] ?? status}</Badge>
            {bisaRetake && (
              <Badge variant="secondary" className="text-[10px]">Retake</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="truncate">{formatDateOnly(tanggal)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>{durasi} menit</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4 shrink-0" />
            <span>{jumlahSoal} soal</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="truncate">Kelas: {kelas}</span>
          </div>
        </div>
        {nilaiMinimum != null && nilaiMinimum > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Nilai minimum: {nilaiMinimum}
          </p>
        )}
      </CardContent>
      <CardFooter className="pt-2">
        {sudahDikerjakan && !bisaRetake ? (
          <Button variant="outline" className="w-full py-3 active:scale-[0.98] transition-transform" disabled>
            Sudah Dikerjakan
          </Button>
        ) : sudahDikerjakan && bisaRetake ? (
          <Link href={`/siswa/ujian/${id}`} className="w-full">
            <Button className="w-full py-3 active:scale-[0.98] transition-transform" variant={status === "AKTIF" ? "default" : "outline"}>
              Kerjakan Lagi
            </Button>
          </Link>
        ) : status === "AKTIF" ? (
          <Link href={`/siswa/ujian/${id}`} className="w-full">
            <Button className="w-full py-3 active:scale-[0.98] transition-transform">Kerjakan</Button>
          </Link>
        ) : (
          <Button variant="outline" className="w-full py-3 active:scale-[0.98] transition-transform" disabled>
            {status === "DRAFT" ? "Belum Tersedia" : "Selesai"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

