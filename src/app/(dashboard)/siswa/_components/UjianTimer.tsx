"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { AlertTriangle, Clock } from "lucide-react"

interface UjianTimerProps {
  durasiMenit: number
  onTimeUp: () => void
  isPaused?: boolean
}

export function UjianTimer({ durasiMenit, onTimeUp, isPaused }: UjianTimerProps) {
  const [waktuTersisa, setWaktuTersisa] = useState(durasiMenit * 60)
  const [warning, setWarning] = useState(false)

  const formatTime = (detik: number) => {
    const jam = Math.floor(detik / 3600)
    const menit = Math.floor((detik % 3600) / 60)
    const s = detik % 60
    if (jam > 0) {
      return `${jam.toString().padStart(2, "0")}:${menit.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    }
    return `${menit.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const handleTimeUp = useCallback(() => {
    onTimeUp()
  }, [onTimeUp])

  useEffect(() => {
    if (isPaused) return

    const interval = setInterval(() => {
      setWaktuTersisa((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          handleTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isPaused, handleTimeUp])

  useEffect(() => {
    if (waktuTersisa <= 300 && waktuTersisa > 0) {
      setWarning(true)
    } else {
      setWarning(false)
    }
  }, [waktuTersisa])

  const progress = (waktuTersisa / (durasiMenit * 60)) * 100

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {warning ? (
          <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
        ) : (
          <Clock className="h-5 w-5 text-primary" />
        )}
        <span
          className={cn(
            "font-mono text-xl font-bold tabular-nums",
            warning ? "text-red-500" : "text-foreground"
          )}
        >
          {formatTime(waktuTersisa)}
        </span>
      </div>
      <div className="hidden sm:block w-32 h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            warning ? "bg-red-500" : "bg-primary"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
