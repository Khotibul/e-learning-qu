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

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium">
          {answered}/{total} soaldijawab
        </span>
      </div>
      <Progress value={progress} className="h-2.5" />
      {raguRagu > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {raguRagu} soalditandai ragu-ragu
        </p>
      )}
    </div>
  )
}
