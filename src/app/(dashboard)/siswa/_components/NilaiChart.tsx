"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface NilaiChartItem {
  label: string
  nilai: number
}

interface NilaiChartProps {
  data: NilaiChartItem[]
  className?: string
}

export function NilaiChart({ data, className }: NilaiChartProps) {
  const maxNilai = Math.max(...data.map((d) => d.nilai), 100)

  const getBarColor = (nilai: number) => {
    if (nilai >= 90) return "bg-emerald-500"
    if (nilai >= 75) return "bg-blue-500"
    if (nilai >= 60) return "bg-amber-500"
    return "bg-red-500"
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Grafik Perkembangan Nilai</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Belum ada data nilai
          </p>
        ) : (
          <div className="space-y-4">
            {data.map((item) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className={cn(
                    "font-bold tabular-nums",
                    item.nilai >= 90 && "text-emerald-600 dark:text-emerald-400",
                    item.nilai >= 75 && item.nilai < 90 && "text-blue-600 dark:text-blue-400",
                    item.nilai >= 60 && item.nilai < 75 && "text-amber-600 dark:text-amber-400",
                    item.nilai < 60 && "text-red-600 dark:text-red-400"
                  )}>
                    {item.nilai}
                  </span>
                </div>
                <div className="relative h-3 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      getBarColor(item.nilai)
                    )}
                    style={{
                      width: `${Math.min((item.nilai / maxNilai) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
