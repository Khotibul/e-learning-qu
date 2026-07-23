"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useUjianStore } from "@/store/useUjianStore"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Eye,
  Send,
  Loader2,
  Monitor,
  ShieldCheck,
  BookOpen,
} from "lucide-react"
import { UjianTimer } from "../../_components/UjianTimer"
import { SoalNavigation } from "../../_components/SoalNavigation"
import { SoalDisplay } from "../../_components/SoalDisplay"
import { ProgressBar } from "../../_components/ProgressBar"
import { ReviewModal } from "../../_components/ReviewModal"
import { KonfirmasiStartDialog } from "../../_components/KonfirmasiStartDialog"
import { HasilUjian } from "../../_components/HasilUjian"
import { cn } from "@/lib/utils"

interface SoalData {
  id: string
  nomor: number
  pertanyaan: string
  jenisSoal: string
  tingkatKesulitan: string
  pilihanGanda?: { label: string; text: string }[] | null
  trueFalse?: boolean | null
  poin: number
  soalInduk?: string | null
}

interface HasilSoal {
  nomor: number
  jawaban: string | null
  jawabanBenar: string
  isCorrect: boolean
  poin: number
}

interface HasilData {
  nilai: number
  totalPoin: number
  perolehPoin: number
  jumlahSoal: number
  jumlahBenar: number
  hasilSoal: HasilSoal[]
}

export default function UjianPengerjaanPage() {
  const params = useParams()
  const router = useRouter()
  const ujianId = params.id as string

  const {
    answers,
    raguRagu,
    currentNomor,
    setCurrentNomor,
    setAnswer,
    toggleRaguRagu,
    setWaktuTersisa,
    isSubmitting,
    setIsSubmitting,
    reset,
  } = useUjianStore()

  const [ujianData, setUjianData] = useState<{
    id: string
    nama: string
    mapel: string
    durasi: number
    jumlahSoal: number
    fullscreen: boolean
    disableCopy: boolean
    disablePaste: boolean
    randomSoal: boolean
    randomJawaban: boolean
    nilaiMinimum: number
    status: string
    soal: SoalData[]
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  const [showKonfirmasi, setShowKonfirmasi] = useState(true)
  const [showReview, setShowReview] = useState(false)
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false)
  const [hasil, setHasil] = useState<HasilData | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const [showAntiCheatWarning, setShowAntiCheatWarning] = useState(false)
  const [showFullscreenExitWarning, setShowFullscreenExitWarning] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const autoSaveRef = useRef<NodeJS.Timeout | null>(null)
  const fullscreenCheckRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/siswa/ujian/${ujianId}`)
        if (!res.ok) {
          if (res.status === 404) {
            toast.error("Ujian tidak ditemukan")
            router.push("/siswa/ujian")
            return
          }
          throw new Error("Gagal memuat data ujian")
        }
        const data = await res.json()
        setUjianData(data)
      } catch (err) {
        toast.error("Gagal memuat data ujian")
        router.push("/siswa/ujian")
      } finally {
        setLoading(false)
      }
    }
    fetchData()

    return () => {
      reset()
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
      if (fullscreenCheckRef.current) clearInterval(fullscreenCheckRef.current)
    }
  }, [ujianId, router, reset])

  const startUjian = useCallback(async () => {
    try {
      const res = await fetch(`/api/siswa/ujian/${ujianId}/start`, { method: "POST" })
      if (!res.ok) throw new Error("Gagal memulai ujian")
      const data = await res.json()

      setShowKonfirmasi(false)
      setHasStarted(true)

      if (ujianData?.fullscreen && typeof document !== "undefined") {
        try {
          await document.documentElement.requestFullscreen()
          setIsFullscreen(true)
        } catch {
          toast.error("Gagal masuk mode layar penuh. Silakan aktifkan manual.")
        }
      }

      setWaktuTersisa((ujianData?.durasi ?? 0) * 60)
      toast.success("Ujian dimulai! Selamat mengerjakan.")
    } catch {
      toast.error("Gagal memulai ujian")
    }
  }, [ujianId, ujianData, setWaktuTersisa])

  const autoSave = useCallback(async () => {
    if (!ujianId || Object.keys(answers).length === 0) return
    try {
      await fetch(`/api/siswa/ujian/${ujianId}/auto-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, raguRagu }),
      })
    } catch {
      // silent fail for auto-save
    }
  }, [ujianId, answers, raguRagu])

  useEffect(() => {
    if (!hasStarted || submitted) return

    autoSaveRef.current = setInterval(autoSave, 30000)
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [hasStarted, submitted, autoSave])

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await autoSave()

      const res = await fetch(`/api/siswa/ujian/${ujianId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, raguRagu }),
      })

      if (!res.ok) throw new Error("Gagal mengumpulkan ujian")

      const result: HasilData = await res.json()
      setHasil(result)
      setSubmitted(true)
      setShowReview(false)
      setShowConfirmSubmit(false)

      if (typeof document !== "undefined" && document.fullscreenElement) {
        try {
          await document.exitFullscreen()
        } catch {}
      }

      toast.success("Ujian berhasil dikumpulkan!")
    } catch {
      toast.error("Gagal mengumpulkan ujian. Silakan coba lagi.")
    } finally {
      setIsSubmitting(false)
    }
  }, [ujianId, answers, raguRagu, autoSave, setIsSubmitting])

  const handleTimeUp = useCallback(() => {
    toast.error("Waktu habis! Jawaban akan dikumpulkan secara otomatis.")
    handleSubmit()
  }, [handleSubmit])

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      setIsFullscreen(false)
    } else {
      await document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    }
  }, [])

  const handleRetryFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen()
      setIsFullscreen(true)
      setShowFullscreenExitWarning(false)
      toast.success("Kembali ke mode layar penuh")
    } catch {
      toast.error("Gagal masuk layar penuh. Klik tombol untuk mencoba lagi atau kumpulkan ujian.")
    }
  }, [])

  useEffect(() => {
    if (!hasStarted || submitted) return

    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => {
          const newCount = prev + 1
          if (newCount >= 3) {
            toast.error("Anda telah berpindah tab sebanyak 3 kali. Ujian akan dikumpulkan.")
            handleSubmit()
          } else {
            setShowAntiCheatWarning(true)
            toast.error(`Peringatan! Jangan tinggalkan halaman ujian. (${newCount}x)`)
            setTimeout(() => setShowAntiCheatWarning(false), 5000)
          }
          return newCount
        })
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [hasStarted, submitted, handleSubmit])

  useEffect(() => {
    if (!hasStarted || submitted) return

    const handleCopy = (e: ClipboardEvent) => {
      if (ujianData?.disableCopy) {
        e.preventDefault()
        toast.error("Copy tidak diizinkan selama ujian")
      }
    }

    const handlePaste = (e: ClipboardEvent) => {
      if (ujianData?.disablePaste) {
        e.preventDefault()
        toast.error("Paste tidak diizinkan selama ujian")
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "v", "x", "a", "u", "s", "p"].includes(e.key.toLowerCase())
      ) {
        if (ujianData?.disableCopy || ujianData?.disablePaste) {
          e.preventDefault()
        }
      }
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key === "I")) {
        e.preventDefault()
      }
      if (e.key === "Escape" && ujianData?.fullscreen && isFullscreen) {
        e.preventDefault()
        toast.error("Anda tidak bisa keluar dari mode layar penuh selama ujian")
      }
    }

    const handleFullscreenChange = () => {
      if (ujianData?.fullscreen && hasStarted && !submitted && !document.fullscreenElement) {
        setShowFullscreenExitWarning(true)
      }
    }

    document.addEventListener("copy", handleCopy)
    document.addEventListener("paste", handlePaste)
    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      document.removeEventListener("copy", handleCopy)
      document.removeEventListener("paste", handlePaste)
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [hasStarted, submitted, ujianData, isFullscreen])

  useEffect(() => {
    if (!hasStarted || submitted) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = "Anda akan meninggalkan halaman ujian! Jawaban yang belum disimpan akan hilang."
      return e.returnValue
    }

    const handlePopState = () => {
      if (!submitted) {
        router.push(`/siswa/ujian/${ujianId}`)
        toast.error("Dilarang kembali selama ujian berlangsung!")
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [hasStarted, submitted, ujianId, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Memuat data ujian...</p>
        </div>
      </div>
    )
  }

  if (hasil) {
    return <HasilUjian {...hasil} />
  }

  if (!ujianData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-semibold">Ujian tidak ditemukan</p>
        <Button onClick={() => router.push("/siswa/ujian")}>Kembali</Button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg font-semibold">Memproses hasil ujian...</p>
      </div>
    )
  }

  const currentSoal = ujianData.soal.find((s) => s.nomor === currentNomor)
  const soalIds = ujianData.soal.map((s) => s.id)
  const answeredCount = soalIds.filter((id) => answers[id] && answers[id].trim() !== "").length

  const handleNavigate = (nomor: number) => {
    if (nomor >= 1 && nomor <= ujianData.jumlahSoal) {
      setCurrentNomor(nomor)
    }
  }

  const reviewItems = ujianData.soal.map((s) => ({
    nomor: s.nomor,
    soalId: s.id,
    pertanyaan: s.pertanyaan,
    jawaban: answers[s.id] || "",
    isRagu: raguRagu.includes(s.id),
    isAnswered: !!answers[s.id] && answers[s.id].trim() !== "",
  }))

  return (
    <div className="min-h-screen bg-background">
      {showKonfirmasi && (
        <KonfirmasiStartDialog
          nama={ujianData.nama}
          mapel={ujianData.mapel}
          jumlahSoal={ujianData.jumlahSoal}
          durasi={ujianData.durasi}
          onStart={startUjian}
          onCancel={() => router.push("/siswa/ujian")}
        />
      )}

      {showReview && (
        <ReviewModal
          items={reviewItems}
          onClose={() => setShowReview(false)}
          onConfirm={() => setShowConfirmSubmit(true)}
          isSubmitting={isSubmitting}
        />
      )}

      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-destructive/10 p-3">
                <Send className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Konfirmasi Pengumpulan</h3>
                <p className="text-sm text-muted-foreground">
                  Anda akan mengumpulkan jawaban ujian. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p>Soal terjawab: {answeredCount}/{ujianData.jumlahSoal}</p>
              <p>Soal ditandai ragu-ragu: {raguRagu.length}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowConfirmSubmit(false)}>
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mengumpulkan...
                  </>
                ) : (
                  "Ya, Kumpulkan"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showAntiCheatWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <Card className="px-4 py-2 border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 shadow-lg">
            <p className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Jangan tinggalkan halaman ujian!
            </p>
          </Card>
        </div>
      )}

      {showFullscreenExitWarning && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-destructive/10 p-3 shrink-0">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Mode Layar Penuh Diaktifkan</h3>
                <p className="text-sm text-muted-foreground">
                  Anda telah keluar dari mode layar penuh. Ujian ini mewajibkan mode layar penuh.
                  Kembali ke layar penuh untuk melanjutkan, atau kumpulkan ujian sekarang.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="default"
                className="flex-1"
                onClick={handleRetryFullscreen}
              >
                <Monitor className="h-4 w-4 mr-2" />
                Kembali ke Fullscreen
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  setShowFullscreenExitWarning(false)
                  setShowConfirmSubmit(true)
                }}
                disabled={isSubmitting}
              >
                <Send className="h-4 w-4 mr-2" />
                Kumpulkan Ujian
              </Button>
            </div>
          </Card>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate">{ujianData.nama}</h1>
              <p className="text-xs text-muted-foreground truncate">{ujianData.mapel}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {ujianData.fullscreen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="hidden md:flex gap-1.5"
              >
                <Monitor className="h-4 w-4" />
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </Button>
            )}

            <UjianTimer
              durasiMenit={ujianData.durasi}
              onTimeUp={handleTimeUp}
              isPaused={showReview || showConfirmSubmit}
            />
          </div>
        </div>
      </header>

      <div className="flex">
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl space-y-6">
            <ProgressBar
              answered={answeredCount}
              total={ujianData.jumlahSoal}
              raguRagu={raguRagu.length}
            />

            <Card className="p-6">
              {currentSoal ? (
                <SoalDisplay
                  soal={currentSoal}
                  jawaban={answers[currentSoal.id] || ""}
                  onJawab={(jawaban) => setAnswer(currentSoal.id, jawaban)}
                  isRaguRagu={raguRagu.includes(currentSoal.id)}
                />
              ) : (
                <p className="text-center text-muted-foreground py-12">Soal tidak ditemukan</p>
              )}
            </Card>

            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                onClick={() => handleNavigate(currentNomor - 1)}
                disabled={currentNomor <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Sebelumnya
              </Button>

              <div className="flex items-center gap-2">
                {currentSoal && (
                  <Button
                    variant={raguRagu.includes(currentSoal.id) ? "warning" : "outline"}
                    size="sm"
                    onClick={() => toggleRaguRagu(currentSoal.id)}
                    className={cn(
                      "gap-1.5",
                      raguRagu.includes(currentSoal.id) &&
                        "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700"
                    )}
                  >
                    <Flag className="h-4 w-4" />
                    {raguRagu.includes(currentSoal.id) ? "Tandai Sudah" : "Ragu-ragu"}
                  </Button>
                )}

                <Separator orientation="vertical" className="h-8" />

                <Button
                  variant="outline"
                  onClick={() => setShowReview(true)}
                  className="gap-1.5"
                >
                  <Eye className="h-4 w-4" />
                  Review
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={() => handleNavigate(currentNomor + 1)}
                disabled={currentNomor >= ujianData.jumlahSoal}
              >
                Selanjutnya
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={() => setShowReview(true)}
                className="min-w-[200px] gap-2"
              >
                <Send className="h-4 w-4" />
                Kumpulkan Jawaban
              </Button>
            </div>
          </div>
        </main>

        <aside className="hidden lg:block w-72 border-l p-4 space-y-6">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="text-xs">
              {answeredCount}/{ujianData.jumlahSoal} Terjawab
            </Badge>
            {raguRagu.length > 0 && (
              <Badge variant="warning" className="text-xs">
                {raguRagu.length} Ragu-ragu
              </Badge>
            )}
          </div>

          <SoalNavigation
            jumlahSoal={ujianData.jumlahSoal}
            currentNomor={currentNomor}
            answers={answers}
            raguRagu={raguRagu}
            soalIds={soalIds}
            onSelect={handleNavigate}
          />

          <Separator />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowReview(true)}
            >
              <Eye className="h-4 w-4" />
              Review
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setShowReview(true)}
            >
              <Send className="h-4 w-4" />
              Kumpul
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
