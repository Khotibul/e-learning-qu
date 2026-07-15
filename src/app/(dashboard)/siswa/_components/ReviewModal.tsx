"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { AlertTriangle, CheckCircle2, HelpCircle, X, FileText } from "lucide-react"

interface ReviewItem {
  nomor: number
  soalId: string
  pertanyaan: string
  jawaban: string
  isRagu: boolean
  isAnswered: boolean
}

interface ReviewModalProps {
  items: ReviewItem[]
  onClose: () => void
  onConfirm: () => void
  isSubmitting: boolean
}

export function ReviewModal({ items, onClose, onConfirm, isSubmitting }: ReviewModalProps) {
  const answered = items.filter((i) => i.isAnswered).length
  const unanswered = items.filter((i) => !i.isAnswered).length
  const raguCount = items.filter((i) => i.isRagu).length

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 md:inset-10 flex items-center justify-center">
        <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xl">Review Jawaban</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Periksa kembali jawaban Anda sebelum mengumpulkan
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>

          <div className="px-6 pb-4">
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Terjawab: {answered}
              </span>
              <span className="flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                Belum: {unanswered}
              </span>
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Ragu-ragu: {raguCount}
              </span>
            </div>
          </div>

          <Separator />

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.soalId}
                  className={cn(
                    "rounded-lg border p-4 transition-colors",
                    !item.isAnswered && "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800",
                    item.isAnswered && item.isRagu && "border-amber-200 dark:border-amber-800",
                    item.isAnswered && !item.isRagu && "border-emerald-200 dark:border-emerald-800"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Soal {item.nomor}
                        </span>
                        {!item.isAnswered && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Belum dijawab
                          </span>
                        )}
                        {item.isRagu && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Ragu-ragu
                          </span>
                        )}
                      </div>
                      <p className="text-sm line-clamp-2">{item.pertanyaan}</p>
                      {item.isAnswered && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Jawaban: <span className="font-medium text-foreground">{item.jawaban}</span>
                        </p>
                      )}
                    </div>
                    {item.isAnswered ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <HelpCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <Separator />

          <div className="flex items-center justify-between gap-4 p-6">
            <Button variant="outline" onClick={onClose}>
              Kembali
            </Button>
            <div className="flex items-center gap-2">
              {unanswered > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {unanswered} soalbelum dijawab
                </p>
              )}
              <Button
                onClick={onConfirm}
                disabled={isSubmitting}
                variant={unanswered > 0 ? "destructive" : "success"}
                className="min-w-[140px]"
              >
                {isSubmitting ? "Mengumpulkan..." : "Kumpulkan Jawaban"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
