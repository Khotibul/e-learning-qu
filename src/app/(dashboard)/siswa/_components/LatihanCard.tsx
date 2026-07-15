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
}

export function LatihanCard({ id, nama, mapel, jumlahSoal, durasi, sudahDikerjakan }: LatihanCardProps) {
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
          {sudahDikerjakan && (
            <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Selesai
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>{jumlahSoal} soal</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{durasi} menit</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        {sudahDikerjakan ? (
          <Button variant="outline" className="w-full" disabled>
            Sudah Dikerjakan
          </Button>
        ) : (
          <Link href={`/siswa/ujian/${id}`}>
            <Button className="w-full">
              Kerjakan
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  )
}
