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

export function ExamCard({ id, nama, mapel, kelas, tanggal, durasi, status, sudahDikerjakan, jumlahSoal, nilaiMinimum }: ExamCardProps) {
  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{nama}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              {mapel}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sudahDikerjakan && (
              <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Selesai
              </Badge>
            )}
            <Badge variant={statusColor[status] ?? "secondary"}>{statusLabel[status] ?? status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>{formatDateOnly(tanggal)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{durasi} menit</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{jumlahSoal} soal</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Kelas: {kelas}</span>
          </div>
        </div>
        {nilaiMinimum != null && nilaiMinimum > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Nilai minimum: {nilaiMinimum}
          </p>
        )}
      </CardContent>
      <CardFooter>
        {sudahDikerjakan ? (
          <Button variant="outline" className="w-full" disabled>
            Sudah Dikerjakan
          </Button>
        ) : status === "AKTIF" ? (
          <Link href={`/siswa/ujian/${id}`}>
            <Button className="w-full">Kerjakan</Button>
          </Link>
        ) : (
          <Button variant="outline" className="w-full" disabled>
            {status === "DRAFT" ? "Belum Tersedia" : "Selesai"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
