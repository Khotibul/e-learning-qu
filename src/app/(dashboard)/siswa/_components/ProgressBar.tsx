"use client"

import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface ProgressBarProps {
  answered: number
  total: number
  raguRagu: number
  className?: string
}

export function ProgressBar({ answered, total, raguRagu, className }: ProgressBarProps) {
  const progress = total > 0 ? Math.round((answered / total) * 100) : 0
  const complete = answered === total && total > 0

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className={cn("font-medium tabular-nums", complete && "text-emerald-600 dark:text-emerald-400")}>
          {answered}/{total} soal dijawab
          <span className="text-muted-foreground font-normal"> ({progress}%)</span>
        </span>
      </div>
      <Progress
        value={progress}
        className={cn("h-2.5", complete && "[&>div]:bg-emerald-500")}
      />
      {raguRagu > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {raguRagu} soal ditandai ragu-ragu
        </p>
      )}
    </div>
  )
}