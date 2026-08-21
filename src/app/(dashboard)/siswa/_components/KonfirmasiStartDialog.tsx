"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Clock, FileText, ShieldCheck, MonitorCheck } from "lucide-react"

interface KonfirmasiStartDialogProps {
  nama: string
  mapel: string
  jumlahSoal: number
  durasi: number
  fullscreen?: boolean
  disableCopy?: boolean
  onStart: () => void
  onCancel: () => void
}

export function KonfirmasiStartDialog({
  nama,
  mapel,
  jumlahSoal,
  durasi,
  fullscreen,
  disableCopy,
  onStart,
  onCancel,
}: KonfirmasiStartDialogProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">{nama}</CardTitle>
          <p className="text-sm text-muted-foreground">{mapel}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-lg border p-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Jumlah Soal</p>
                <p className="font-semibold">{jumlahSoal} soal</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Durasi</p>
                <p className="font-semibold">{durasi} menit</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Perhatian!
            </p>
            <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
              {fullscreen && (
                <li className="flex items-center gap-1.5">
                  <MonitorCheck className="h-3 w-3" />
                  Mode layar penuh otomatis aktif saat ujian dimulai
                </li>
              )}
              {disableCopy !== false && (
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3" />
                  Copy-paste akan dinonaktifkan
                </li>
              )}
              <li className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                Jangan keluar dari halaman ujian
              </li>
              <li className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Jawaban akan otomatis dikumpulkan saat waktu habis
              </li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Batal
          </Button>
          <Button className="flex-1" onClick={onStart}>
            Mulai Ujian
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
