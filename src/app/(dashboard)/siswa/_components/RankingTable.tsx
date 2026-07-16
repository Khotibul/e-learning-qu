"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Crown, Medal, Award } from "lucide-react"

interface RankingItem {
  id: string
  peringkat: number
  nama: string
  kelas: string
  rataRata: number
  totalWaktu: number
  nilaiCount: number
  isCurrentUser: boolean
}

interface RankingTableProps {
  data: RankingItem[]
}

const medalIcons = [
  <Crown key="1" className="h-5 w-5 text-yellow-500" />,
  <Medal key="2" className="h-5 w-5 text-gray-400" />,
  <Award key="3" className="h-5 w-5 text-amber-600" />,
]

export function RankingTable({ data }: RankingTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Belum ada data ranking
      </div>
    )
  }

  function formatWaktu(ms: number) {
    if (ms <= 0) return "-"
    const menit = Math.floor(ms / 60000)
    const detik = Math.floor((ms % 60000) / 1000)
    return menit > 0 ? `${menit}m ${detik}s` : `${detik}s`
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14 text-center">Peringkat</TableHead>
            <TableHead>Nama Siswa</TableHead>
            <TableHead>Kelas</TableHead>
            <TableHead className="text-right">Nilai Rata-rata</TableHead>
            <TableHead className="text-right">Total Waktu</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow
              key={item.id}
              className={cn(
                "transition-colors",
                item.isCurrentUser && "bg-primary/5 border-primary/30 font-medium"
              )}
            >
              <TableCell className="text-center">
                <div className="flex items-center justify-center">
                  {item.peringkat <= 3 ? (
                    <span className="flex items-center gap-1">
                      {medalIcons[item.peringkat - 1]}
                      <span className="text-sm font-bold">{item.peringkat}</span>
                    </span>
                  ) : (
                    <span className="text-sm">{item.peringkat}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{item.nama}</span>
                  {item.isCurrentUser && (
                    <span className="text-xs text-primary font-medium">(Anda)</span>
                  )}
                </div>
              </TableCell>
              <TableCell>{item.kelas}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">
                {item.rataRata.toFixed(1)}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                {formatWaktu(item.totalWaktu)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
