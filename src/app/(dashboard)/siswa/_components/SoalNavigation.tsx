"use client"

import { cn } from "@/lib/utils"
import { HelpCircle, CheckCircle2, AlertCircle } from "lucide-react"

interface SoalNavigationProps {
  jumlahSoal: number
  currentNomor: number
  answers: Record<string, string>
  raguRagu: string[]
  soalIds: string[]
  onSelect: (nomor: number) => void
}

export function SoalNavigation({
  jumlahSoal,
  currentNomor,
  answers,
  raguRagu,
  soalIds,
  onSelect,
}: SoalNavigationProps) {
  const getStatus = (index: number) => {
    const soalId = soalIds[index]
    const isAnswered = answers[soalId] && answers[soalId].trim() !== ""
    const isRagu = raguRagu.includes(soalId)
    const isActive = currentNomor === index + 1

    if (isActive) return "active"
    if (isAnswered && isRagu) return "answered-ragu"
    if (isAnswered) return "answered"
    if (isRagu) return "ragu"
    return "unanswered"
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "answered":
        return <CheckCircle2 className="h-3 w-3" />
      case "answered-ragu":
        return <AlertCircle className="h-3 w-3" />
      case "ragu":
        return <HelpCircle className="h-3 w-3" />
      default:
        return null
    }
  }

  const statusStyles: Record<string, string> = {
    active: "ring-2 ring-primary bg-primary text-primary-foreground",
    answered: "bg-emerald-500 text-white",
    "answered-ragu": "bg-amber-500 text-white",
    ragu: "bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700",
    unanswered: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Navigasi Soal
      </h3>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: jumlahSoal }, (_, i) => {
          const status = getStatus(i)
          return (
            <button
              key={i}
              onClick={() => onSelect(i + 1)}
              className={cn(
                "relative h-10 w-full rounded-lg text-sm font-medium transition-all flex items-center justify-center",
                statusStyles[status]
              )}
            >
              {getStatusIcon(status)}
              <span className={status.includes("answered") || status === "active" ? "ml-0" : ""}>
                {i + 1}
              </span>
            </button>
          )
        })}
      </div>
      <div className="space-y-1.5 pt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-3 w-3 rounded bg-emerald-500" />
          <span>Dijawab</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-3 w-3 rounded bg-amber-500" />
          <span>Ragu-ragu</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-3 w-3 rounded bg-secondary ring-1 ring-primary" />
          <span>Aktif</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-3 w-3 rounded bg-secondary" />
          <span>Belum dijawab</span>
        </div>
      </div>
    </div>
  )
}
