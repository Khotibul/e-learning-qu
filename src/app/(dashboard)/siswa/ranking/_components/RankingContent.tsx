"use client"

import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { RankingTable } from "../../_components/RankingTable"
import { TrendingUp, Users } from "lucide-react"

interface RankingItem {
  peringkat: number
  id: string
  nama: string
  kelas: string
  rataRata: number
  totalWaktu: number
  nilaiCount: number
  isCurrentUser: boolean
}

interface RankingContentProps {
  ranking: RankingItem[]
  kelasList: { id: string; nama: string }[]
  semesterOptions: { id: string; nama: string }[]
  selectedKelas: string
  selectedSemester: string
}

export function RankingContent({
  ranking,
  kelasList,
  semesterOptions,
  selectedKelas,
  selectedSemester,
}: RankingContentProps) {
  const router = useRouter()

  const handleKelasChange = (value: string) => {
    const params = new URLSearchParams()
    if (value) params.set("kelas", value)
    if (selectedSemester) params.set("semester", selectedSemester)
    router.push(`/siswa/ranking${params.toString() ? `?${params.toString()}` : ""}`)
  }

  const handleSemesterChange = (value: string) => {
    const params = new URLSearchParams()
    if (selectedKelas) params.set("kelas", selectedKelas)
    if (value) params.set("semester", value)
    router.push(`/siswa/ranking${params.toString() ? `?${params.toString()}` : ""}`)
  }

  const currentUserRank = ranking.find((r) => r.isCurrentUser)
  const topScore = ranking.length > 0 ? ranking[0].rataRata : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ranking</h1>
          <p className="text-muted-foreground">Peringkat siswa berdasarkan nilai</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedKelas} onValueChange={handleKelasChange}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Semua Kelas" />
            </SelectTrigger>
            <SelectContent>
              {kelasList.map((k) => (
                <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSemester} onValueChange={handleSemesterChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Semua Semester" />
            </SelectTrigger>
            <SelectContent>
              {semesterOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {currentUserRank && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Peringkat Anda</p>
                <p className="text-xl font-bold">
                  {currentUserRank.peringkat === 1
                    ? "🏆 1"
                    : currentUserRank.peringkat === 2
                    ? "🥈 2"
                    : currentUserRank.peringkat === 3
                    ? "🥉 3"
                    : `#${currentUserRank.peringkat}`}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-2.5">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nilai Rata-rata</p>
                <p className="text-xl font-bold">{currentUserRank.rataRata.toFixed(1)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2.5">
                <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Siswa</p>
                <p className="text-xl font-bold">{ranking.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <RankingTable data={ranking} />
    </div>
  )
}
