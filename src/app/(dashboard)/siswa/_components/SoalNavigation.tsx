"use client"

import { cn } from "@/lib/utils"
import { HelpCircle, CheckCircle2, AlertCircle, LayoutGrid } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface SoalNavigationProps {
  jumlahSoal: number
  currentNomor: number
  answers: Record<string, string>
  raguRagu: string[]
  soalIds: string[]
  onSelect: (nomor: number) => void
  answeredCount: number
  variant?: "sidebar" | "compact"
}

export function SoalNavigation({
  jumlahSoal,
  currentNomor,
  answers,
  raguRagu,
  soalIds,
  onSelect,
  answeredCount,
  variant = "sidebar",
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

  const renderButtons = () => (
    <>
      {Array.from({ length: jumlahSoal }, (_, i) => {
        const status = getStatus(i)
        return (
          <button
            key={i}
            onClick={() => onSelect(i + 1)}
            className={cn(
              "relative h-10 w-full rounded-lg text-sm font-medium transition-all flex items-center justify-center active:scale-90",
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
    </>
  )

  const renderLegend = () => (
    <div className="space-y-1.5 pt-2 border-t">
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
  )

  if (variant === "compact") {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="h-10 px-3 rounded-lg border bg-secondary flex items-center justify-center gap-1.5 text-sm font-medium transition-all active:scale-95 hover:bg-secondary/80"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="tabular-nums">{currentNomor}/{jumlahSoal}</span>
          </button>
        </DialogTrigger>
        <DialogContent className="p-0 max-h-[80vh] sm:max-w-[90vw] fixed bottom-0 left-0 right-0 top-auto translate-y-0 rounded-t-2xl border-t-0 shadow-xl">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Navigasi Soal</DialogTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="text-xs">
                {answeredCount}/{jumlahSoal} Terjawab
              </Badge>
              {raguRagu.length > 0 && (
                <Badge variant="warning" className="text-xs">
                  {raguRagu.length} Ragu-ragu
                </Badge>
              )}
            </div>
          </DialogHeader>
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-5 gap-2">
              {renderButtons()}
            </div>
            {renderLegend()}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Navigasi Soal
      </h3>

      {/* Desktop: Grid 5 columns */}
      <div className="hidden lg:grid grid-cols-5 gap-2">
        {renderButtons()}
      </div>

      {/* Mobile: Dialog as bottom sheet */}
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="lg:hidden w-full rounded-lg border bg-secondary p-3 text-left text-sm font-medium transition-colors hover:bg-secondary/80"
          >
            Navigasi Soal ({answeredCount}/{jumlahSoal} terjawab)
          </button>
        </DialogTrigger>
        <DialogContent className="p-0 max-h-[80vh] sm:max-w-[90vw] fixed bottom-0 left-0 right-0 top-auto translate-y-0 rounded-t-2xl border-t-0 shadow-xl">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Navigasi Soal</DialogTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="text-xs">
                {answeredCount}/{jumlahSoal} Terjawab
              </Badge>
              {raguRagu.length > 0 && (
                <Badge variant="warning" className="text-xs">
                  {raguRagu.length} Ragu-ragu
                </Badge>
              )}
            </div>
          </DialogHeader>
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {renderButtons()}
            </div>
            {renderLegend()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}