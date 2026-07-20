"use client"

import { useState, useCallback, useEffect } from "react"
import { Search, Download, FileSpreadsheet, FileText, GraduationCap, CheckCircle, XCircle } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { getNilaiUjians, getNilaiByUjian, gradeEssay } from "../../actions"

const jenisSoalLabels: Record<string, string> = {
  PILIHAN_GANDA: "PG",
  ESSAY: "Essay",
  TRUE_FALSE: "B/S",
  MATCHING: "Menjodohkan",
  ISIAN_SINGKAT: "Isian",
}

interface UjianRef {
  id: string
  nama: string
  status: string
}

interface JawabanItem {
  id: string
  jawaban: string | null
  esaiJawaban: string | null
  isCorrect: boolean | null
  poin: number | null
  siswa: { id: string; nama: string; nis: string | null }
  soal: { id: string; jenisSoal: string; pertanyaan: string; poin: number; jawaban: string }
  penilaianEssay: { nilai: number; komentar: string | null } | null
}

export function NilaiGradingClient() {
  const [ujians, setUjians] = useState<UjianRef[]>([])
  const [selectedUjianId, setSelectedUjianId] = useState("")
  const [ujianDetail, setUjianDetail] = useState<{ nama: string; mataPelajaran: { nama: string }; kelas: { nama: string } } | null>(null)
  const [jawabans, setJawabans] = useState<JawabanItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingUjians, setLoadingUjians] = useState(true)

  const [essayValues, setEssayValues] = useState<Record<string, { nilai: string; komentar: string }>>({})
  const [searchSiswa, setSearchSiswa] = useState("")

  useEffect(() => {
    getNilaiUjians()
      .then((data) => setUjians(data as any))
      .catch(() => toast.error("Gagal memuat daftar ujian"))
      .finally(() => setLoadingUjians(false))
  }, [])

  const fetchNilai = useCallback(async () => {
    if (!selectedUjianId) return
    setLoading(true)
    try {
      const result = await getNilaiByUjian(selectedUjianId)
      setUjianDetail(result.ujian as any)
      setJawabans(result.jawabans as any)

      const ev: Record<string, { nilai: string; komentar: string }> = {}
      result.jawabans.forEach((j: any) => {
        if (j.soal.jenisSoal === "ESSAY") {
          ev[j.id] = {
            nilai: j.penilaianEssay?.nilai?.toString() ?? "",
            komentar: j.penilaianEssay?.komentar ?? "",
          }
        }
      })
      setEssayValues(ev)
    } catch {
      toast.error("Gagal memuat data nilai")
    } finally {
      setLoading(false)
    }
  }, [selectedUjianId])

  useEffect(() => { fetchNilai() }, [fetchNilai])

  const handleGrade = async (jawabanUjianId: string) => {
    const val = essayValues[jawabanUjianId]
    if (!val || !val.nilai) { toast.error("Nilai harus diisi"); return }
    const nilaiNum = Number(val.nilai)
    if (isNaN(nilaiNum) || nilaiNum < 0) { toast.error("Nilai tidak valid"); return }
    try {
      await gradeEssay(jawabanUjianId, { nilai: nilaiNum, komentar: val.komentar })
      toast.success("Nilai disimpan")
    } catch {
      toast.error("Gagal menyimpan nilai")
    }
  }

  const groupedBySiswa: Record<string, { siswa: JawabanItem["siswa"]; jawabans: JawabanItem[] }> = {}
  jawabans.forEach((j) => {
    if (!groupedBySiswa[j.siswa.id]) {
      groupedBySiswa[j.siswa.id] = { siswa: j.siswa, jawabans: [] }
    }
    groupedBySiswa[j.siswa.id].jawabans.push(j)
  })

  const siswaEntries = Object.entries(groupedBySiswa).filter(([_, g]) =>
    g.siswa.nama.toLowerCase().includes(searchSiswa.toLowerCase())
  )

  const handleExport = async (format: string) => {
    try {
      const res = await fetch(`/api/export?type=nilai&ujianId=${selectedUjianId}&format=${format.toLowerCase()}`)
      if (!res.ok) throw new Error("Gagal mengekspor data")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const ext = format === "Excel" ? "xlsx" : format.toLowerCase()
      const a = document.createElement("a")
      a.href = url
      a.download = `nilai_${selectedUjianId.slice(0, 8)}_${new Date().toISOString().split("T")[0]}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Ekspor ${format} berhasil`)
    } catch {
      toast.error(`Gagal mengekspor ${format}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            Penilaian
          </h1>
          <p className="text-muted-foreground mt-1">Nilai ujian siswa</p>
        </div>
        {selectedUjianId && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("Excel")} className="sm:hidden p-2" title="Excel">
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("Excel")} className="hidden sm:inline-flex">
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("PDF")} className="sm:hidden p-2" title="PDF">
              <FileText className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("PDF")} className="hidden sm:inline-flex">
              <FileText className="h-4 w-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("CSV")} className="sm:hidden p-2" title="CSV">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("CSV")} className="hidden sm:inline-flex">
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Pilih Ujian</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUjians ? (
            <Skeleton className="h-10 w-64" />
          ) : ujians.length === 0 ? (
            <p className="text-muted-foreground">Belum ada ujian yang tersedia</p>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <Select value={selectedUjianId} onValueChange={setSelectedUjianId}>
                <SelectTrigger><SelectValue placeholder="Pilih ujian untuk dinilai" /></SelectTrigger>
                <SelectContent>
                  {ujians.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nama} - {u.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {searchSiswa !== undefined && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari siswa..."
                    value={searchSiswa}
                    onChange={(e) => setSearchSiswa(e.target.value)}
                    className="pl-9"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {ujianDetail && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{ujianDetail.nama}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-sm">
              <span>Mapel: <strong>{ujianDetail.mataPelajaran.nama}</strong></span>
              <span>Kelas: <strong>{ujianDetail.kelas.nama}</strong></span>
              <span>Siswa: <strong>{siswaEntries.length}</strong></span>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedUjianId && (
        <>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : siswaEntries.length === 0 ? (
            <div className="p-12 text-center">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Belum ada jawaban</p>
              <p className="text-muted-foreground mt-1">Siswa belum mengerjakan ujian ini.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {siswaEntries.map(([siswaId, group]) => (
                <Card key={siswaId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{group.siswa.nama}</CardTitle>
                        <p className="text-sm text-muted-foreground">NIS: {group.siswa.nis || "-"}</p>
                      </div>
                      <div className="flex gap-2">
                        {(() => {
                          const essayJawabans = group.jawabans.filter((j) => j.soal.jenisSoal === "ESSAY")
                          const ungraded = essayJawabans.filter((j) => !j.penilaianEssay?.nilai && j.penilaianEssay?.nilai !== 0)
                          const autoGraded = group.jawabans.filter((j) => j.soal.jenisSoal !== "ESSAY")
                          const correct = autoGraded.filter((j) => j.isCorrect === true).length
                          const totalSoal = group.jawabans.length
                          return (
                            <div className="text-right">
                              <p className="text-sm">
                                PG: {correct}/{autoGraded.length} benar
                              </p>
                              {ungraded.length > 0 && (
                                <Badge variant="warning">{ungraded.length} essay belum dinilai</Badge>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {group.jawabans.map((jawaban) => {
                        const isEssay = jawaban.soal.jenisSoal === "ESSAY"
                        const isAutoGraded = !isEssay
                        return (
                          <div key={jawaban.id} className="rounded-xl border p-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="secondary" className="text-[10px]">
                                    {jenisSoalLabels[jawaban.soal.jenisSoal] || jawaban.soal.jenisSoal}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{jawaban.soal.poin} poin</span>
                                  {isAutoGraded && (
                                    jawaban.isCorrect === true
                                      ? <CheckCircle className="h-4 w-4 text-green-600" />
                                      : jawaban.isCorrect === false
                                        ? <XCircle className="h-4 w-4 text-red-600" />
                                        : null
                                  )}
                                </div>
                                <p className="text-sm line-clamp-2">{jawaban.soal.pertanyaan}</p>
                                <div className="mt-2 text-sm">
                                  <span className="text-muted-foreground">Jawaban siswa: </span>
                                  <span className="font-medium">
                                    {isEssay ? (jawaban.esaiJawaban || "-") : (jawaban.jawaban || "-")}
                                  </span>
                                </div>
                                {isAutoGraded && (
                                  <div className="text-sm mt-1">
                                    <span className="text-muted-foreground">Kunci: </span>
                                    <span className="font-medium">{jawaban.soal.jawaban}</span>
                                  </div>
                                )}
                              </div>
                              {isEssay && (
                                <div className="shrink-0 w-48 space-y-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Nilai</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={jawaban.soal.poin}
                                      placeholder={`0-${jawaban.soal.poin}`}
                                      value={essayValues[jawaban.id]?.nilai ?? ""}
                                      onChange={(e) =>
                                        setEssayValues((prev) => ({
                                          ...prev,
                                          [jawaban.id]: {
                                            ...prev[jawaban.id],
                                            nilai: e.target.value,
                                            komentar: prev[jawaban.id]?.komentar ?? "",
                                          },
                                        }))
                                      }
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Komentar</Label>
                                    <Input
                                      placeholder="Komentar..."
                                      value={essayValues[jawaban.id]?.komentar ?? ""}
                                      onChange={(e) =>
                                        setEssayValues((prev) => ({
                                          ...prev,
                                          [jawaban.id]: {
                                            ...prev[jawaban.id],
                                            nilai: prev[jawaban.id]?.nilai ?? "",
                                            komentar: e.target.value,
                                          },
                                        }))
                                      }
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full h-8 text-xs"
                                    onClick={() => handleGrade(jawaban.id)}
                                  >
                                    {jawaban.penilaianEssay?.nilai != null ? "Update" : "Simpan"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
