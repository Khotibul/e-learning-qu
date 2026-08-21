"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, FileText, BookOpen, CheckCircle, ArrowRight } from "lucide-react"
import Link from "next/link"

interface LatihanCardProps {
  id: string
  nama: string
  mapel: string
  jumlahSoal: number
  durasi: number
  sudahDikerjakan: boolean
  bisaRetake?: boolean
}

export function LatihanCard({ id, nama, mapel, jumlahSoal, durasi, sudahDikerjakan, bisaRetake }: LatihanCardProps) {
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
              <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Selesai
              </Badge>
            )}
            {bisaRetake && (
              <Badge variant="secondary" className="text-[10px]">Retake</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex flex-col sm:flex-row gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0" />
            <span>{jumlahSoal} soal</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" />
            <span>{durasi} menit</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        {sudahDikerjakan && !bisaRetake ? (
          <Button variant="outline" className="w-full py-3 active:scale-[0.98] transition-transform" disabled>
            Sudah Dikerjakan
          </Button>
        ) : (
          <Link href={`/siswa/ujian/${id}`}>
            <Button className="w-full py-3 active:scale-[0.98] transition-transform">
              {sudahDikerjakan ? "Kerjakan Lagi" : "Kerjakan"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  )
}

