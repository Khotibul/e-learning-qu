"use client"

import { useEffect, useState, useMemo } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Save, Loader2, Calendar, Check, TrendingUp,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { getGuruJadwalByDate, getAbsensiByKelasAndDate, saveAbsensi } from "../actions"

interface SiswaItem {
  id: string; nis: string | null; nama: string
}

interface JadwalItem {
  _key: string; id: string
  mataPelajaran: { id: string; nama: string; kode: string }
  kelas: { id: string; nama: string }
  jamMulai: string | null; jamSelesai: string | null
}

interface AbsensiSiswaRecord {
  siswaId: string; status: string
}

interface AbsensiRecord {
  mataPelajaranId: string
  siswa: AbsensiSiswaRecord[]
}

export function AbsensiClient({ kelasList }: { kelasList: { id: string; nama: string; siswas: SiswaItem[] }[] }) {
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10))
  const [jadwalList, setJadwalList] = useState<JadwalItem[]>([])
  const [absensiData, setAbsensiData] = useState<AbsensiRecord[]>([])
  const [absensiForm, setAbsensiForm] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [savedAt, setSavedAt] = useState<Map<string, string>>(new Map())
  const [loadingJadwal, setLoadingJadwal] = useState(false)
  const [savingKelas, setSavingKelas] = useState<string | null>(null)

  const kelasMap = useMemo(() => {
    const m: Record<string, { nama: string; siswas: SiswaItem[] }> = {}
    kelasList.forEach((k) => { m[k.id] = { nama: k.nama, siswas: k.siswas } })
    return m
  }, [kelasList])

  const groupedJadwal = useMemo(() => {
    const groups: Record<string, JadwalItem[]> = {}
    jadwalList.forEach((j) => {
      if (!groups[j.kelas.id]) groups[j.kelas.id] = []
      groups[j.kelas.id].push(j)
    })
    return groups
  }, [jadwalList])

  useEffect(() => {
    loadJadwal()
  }, [tanggal])

  const loadJadwal = async () => {
    setLoadingJadwal(true)
    setSaved(new Set())
    setSavedAt(new Map())
    try {
      const jadwal = await getGuruJadwalByDate(tanggal)
      setJadwalList(jadwal as any)

      const absensiMap: Record<string, AbsensiRecord[]> = {}
      const allAbsensi: AbsensiRecord[] = []
      for (const j of jadwal as any[]) {
        const key = `${j.kelas.id}-${j.mataPelajaran.id}`
        if (!absensiMap[key]) {
          const data = await getAbsensiByKelasAndDate(j.kelas.id, tanggal)
          absensiMap[key] = data as any
          allAbsensi.push(...(data as any))
        }
      }
      setAbsensiData(allAbsensi)
      // Tandai yang sudah tersimpan di DB agar tombol langsung "Tersimpan" (1x simpan)
      const initialSaved = new Set<string>()
      const initialSavedAt = new Map<string, string>()
      for (const jd of jadwal as any as JadwalItem[]) {
        const exists = (allAbsensi as any).find((a: any) => a.mataPelajaranId === jd.mataPelajaran.id && a.kelasId === jd.kelas.id)
        if (exists) {
          initialSaved.add(jd._key)
          const ts = exists.updatedAt || exists.createdAt
          if (ts) initialSavedAt.set(jd._key, new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }))
        }
      }
      setSaved(initialSaved)
      setSavedAt(initialSavedAt)
    } catch {
      toast.error("Gagal memuat jadwal")
    } finally {
      setLoadingJadwal(false)
    }
  }

  useEffect(() => {
    if (jadwalList.length === 0 || Object.keys(kelasMap).length === 0) return
    const newForm: Record<string, Record<string, string>> = {}
    jadwalList.forEach((jd) => {
      const kelasInfo = kelasMap[jd.kelas.id]
      if (!kelasInfo) return
      const existingAbsensi = absensiData.find((a: any) => a.mataPelajaranId === jd.mataPelajaran.id && a.kelasId === jd.kelas.id)
      const lessonForm: Record<string, string> = {}
      kelasInfo.siswas.forEach((s) => {
        const record = existingAbsensi?.siswa?.find((as: any) => as.siswaId === s.id)
        lessonForm[s.id] = record?.status || "HADIR"
      })
      newForm[jd._key] = lessonForm
    })
    setAbsensiForm((prev) => {
      const merged = { ...prev }
      Object.keys(newForm).forEach((k) => { if (!merged[k]) merged[k] = newForm[k] })
      return merged
    })
  }, [absensiData, jadwalList, kelasMap])

  const clearSaved = (key: string) => {
    setSaved((prev) => { const next = new Set(prev); next.delete(key); return next })
    setSavedAt((prev) => { const next = new Map(prev); next.delete(key); return next })
  }

  const handleStatusChange = (jadwalKey: string, siswaId: string, status: string) => {
    clearSaved(jadwalKey)
    setAbsensiForm((prev) => ({
      ...prev,
      [jadwalKey]: { ...(prev[jadwalKey] || {}), [siswaId]: status },
    }))
  }

  const handleMarkAll = (jadwalKey: string, status: string, siswas: SiswaItem[]) => {
    clearSaved(jadwalKey)
    const form: Record<string, string> = {}
    siswas.forEach((s) => { form[s.id] = status })
    setAbsensiForm((prev) => ({ ...prev, [jadwalKey]: form }))
  }

  const handleSave = async (jd: JadwalItem) => {
    if (saved.has(jd._key)) {
      toast.success("Absensi sudah tersimpan")
      return
    }
    setSaving(jd._key)
    try {
      const form = absensiForm[jd._key] || {}
      const siswaStatus = Object.entries(form).map(([siswaId, status]) => ({ siswaId, status }))
      await saveAbsensi(jd.kelas.id, jd.mataPelajaran.id, tanggal, siswaStatus)
      const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
      setSaved((prev) => new Set(prev).add(jd._key))
      setSavedAt((prev) => { const next = new Map(prev); next.set(jd._key, now); return next })
      toast.success(`Absensi ${jd.kelas.nama} - ${jd.mataPelajaran.nama} tersimpan`)
    } catch {
      toast.error("Gagal menyimpan")
    } finally {
      setSaving(null)
    }
  }

  const handleSaveAllKelas = async (kelasId: string, items: JadwalItem[]) => {
    const toSave = items.filter((jd) => !saved.has(jd._key))
    if (toSave.length === 0) {
      toast.success("Semua mapel kelas ini sudah tersimpan")
      return
    }
    setSavingKelas(kelasId)
    try {
      for (const jd of toSave) {
        const form = absensiForm[jd._key] || {}
        const siswaStatus = Object.entries(form).map(([siswaId, status]) => ({ siswaId, status }))
        await saveAbsensi(jd.kelas.id, jd.mataPelajaran.id, tanggal, siswaStatus)
      }
      const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
      setSaved((prev) => {
        const next = new Set(prev)
        toSave.forEach((jd) => next.add(jd._key))
        return next
      })
      setSavedAt((prev) => {
        const next = new Map(prev)
        toSave.forEach((jd) => next.set(jd._key, now))
        return next
      })
      toast.success(`Absensi ${kelasList.find((k) => k.id === kelasId)?.nama ?? ""} tersimpan (${toSave.length} mapel)`)
    } catch {
      toast.error("Gagal menyimpan semua")
    } finally {
      setSavingKelas(null)
    }
  }

  if (loadingJadwal) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Absensi</h1>
          <p className="text-muted-foreground mt-1">Catat kehadiran siswa per jam pelajaran</p>
        </div>
        <div className="w-full sm:w-56">
          <Label className="text-xs text-muted-foreground mb-1 block">Pilih Tanggal</Label>
          <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="w-full" />
        </div>
      </div>

      {jadwalList.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Tidak ada jadwal pelajaran hari ini</p>
          <p className="text-sm mt-1">Pilih tanggal lain atau hubungi admin jika ada jadwal yang belum terdaftar.</p>
        </CardContent></Card>
      ) : (
        Object.entries(groupedJadwal).map(([kelasId, items]) => {
          const kelasInfo = kelasMap[kelasId]
          if (!kelasInfo) return null
          const totalMapelHari = items.length
          const rekapHarian = kelasInfo.siswas.map((s) => {
            let hadir = 0
            for (const jd of items) {
              const st = absensiForm[jd._key]?.[s.id] || "HADIR"
              if (st === "HADIR") hadir++
            }
            const persentase = totalMapelHari > 0 ? Math.round((hadir / totalMapelHari) * 100) : 0
            return { siswa: s, hadir, total: totalMapelHari, persentase }
          })
          const rataHarian = rekapHarian.length > 0 ? Math.round(rekapHarian.reduce((a, b) => a + b.persentase, 0) / rekapHarian.length) : 0
          return (
            <div key={kelasId} className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {kelasInfo.nama}
                  <Badge variant="secondary" className="text-xs">{kelasInfo.siswas.length} siswa</Badge>
                  <Badge variant="outline" className="text-xs">{totalMapelHari} mapel hari ini</Badge>
                  {items.every((jd) => saved.has(jd._key)) && items.length > 0 && (
                    <Badge className="bg-emerald-600 text-white text-xs gap-1"><Check className="h-3 w-3" /> Tersimpan</Badge>
                  )}
                </h2>
                {items.length > 1 && (
                  <Button
                    size="sm"
                    variant={items.every((jd) => saved.has(jd._key)) ? "secondary" : "default"}
                    className={`h-8 text-xs ${items.every((jd) => saved.has(jd._key)) ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                    onClick={() => handleSaveAllKelas(kelasId, items)}
                    disabled={savingKelas === kelasId || items.every((jd) => saved.has(jd._key))}
                  >
                    {savingKelas === kelasId ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : items.every((jd) => saved.has(jd._key)) ? <Check className="h-3 w-3 mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                    {items.every((jd) => saved.has(jd._key)) ? "Semua Tersimpan" : `Simpan Semua (${items.filter((jd) => !saved.has(jd._key)).length})`}
                  </Button>
                )}
              </div>
              <Card className="border-primary/20 bg-primary/[0.02]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Rekap Harian — {new Date(tanggal).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Persentase = (pelajaran HADIR ÷ total pelajaran yang diikuti hari ini) × 100%</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">Rata-rata kelas:</span>
                    <span className="font-bold">{rataHarian}%</span>
                    <Progress value={rataHarian} className="h-1.5 flex-1 max-w-[120px]" />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b text-muted-foreground">
                        <th className="text-left py-1.5 px-2 font-medium">Nama</th>
                        <th className="text-center py-1.5 px-2 font-medium">Hadir</th>
                        <th className="text-center py-1.5 px-2 font-medium">Persentase</th>
                        <th className="text-left py-1.5 px-2 font-medium w-24">Progress</th>
                      </tr></thead>
                      <tbody>
                        {rekapHarian.map((r) => (
                          <tr key={r.siswa.id} className="border-t">
                            <td className="py-1.5 px-2 font-medium truncate max-w-[140px]">{r.siswa.nama}</td>
                            <td className="py-1.5 px-2 text-center">{r.hadir}/{r.total}</td>
                            <td className="py-1.5 px-2 text-center font-bold">{r.persentase}%</td>
                            <td className="py-1.5 px-2"><Progress value={r.persentase} className="h-1.5" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              {items.map((jd) => {
                const form = absensiForm[jd._key] || {}
                const activeSiswa = kelasInfo.siswas || []
                const values = Object.values(form)
                const statusCount = {
                  HADIR: values.filter((s) => s === "HADIR").length,
                  SAKIT: values.filter((s) => s === "SAKIT").length,
                  IZIN: values.filter((s) => s === "IZIN").length,
                  ALPA: values.filter((s) => s === "ALPA").length,
                }
                return (
                  <Card key={jd._key}>
                    <CardHeader className="pb-2 sm:pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-sm sm:text-base">{jd.mataPelajaran.nama}</CardTitle>
                          {jd.jamMulai && jd.jamSelesai && (
                            <p className="text-xs text-muted-foreground">{jd.jamMulai.slice(0, 5)} - {jd.jamSelesai.slice(0, 5)}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700">{statusCount.HADIR} Hadir</Badge>
                            <Badge className="text-[10px] bg-yellow-100 text-yellow-700">{statusCount.SAKIT} Sakit</Badge>
                            <Badge className="text-[10px] bg-blue-100 text-blue-700">{statusCount.IZIN} Izin</Badge>
                            <Badge className="text-[10px] bg-red-100 text-red-700">{statusCount.ALPA} Alpa</Badge>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleMarkAll(jd._key, "HADIR", activeSiswa)} disabled={saved.has(jd._key)}>
                              Semua Hadir
                            </Button>
                            <Button
                              size="sm"
                              className={`h-8 text-xs sm:text-sm ${saved.has(jd._key) ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                              onClick={() => handleSave(jd)}
                              disabled={saving === jd._key || saved.has(jd._key)}
                            >
                              {saving === jd._key ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : saved.has(jd._key) ? <Check className="h-3 w-3 mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                              {saved.has(jd._key) ? "Tersimpan" : "Simpan 1x"}
                            </Button>
                          </div>
                          {saved.has(jd._key) && (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Tersimpan {savedAt.get(jd._key) ? `• ${savedAt.get(jd._key)}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-muted/50">
                            <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm w-8 sm:w-12">No</th>
                            <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm">Nama</th>
                            <th className="text-center p-2 sm:p-3 font-medium text-xs sm:text-sm w-28 sm:w-32">Status</th>
                          </tr></thead>
                          <tbody>
                            {activeSiswa.length === 0 ? (
                              <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Tidak ada siswa</td></tr>
                            ) : (
                              activeSiswa.map((s, i) => (
                                <tr key={s.id} className="border-t">
                                  <td className="p-2 sm:p-3 text-xs text-muted-foreground">{i + 1}</td>
                                  <td className="p-2 sm:p-3 text-xs sm:text-sm font-medium truncate max-w-[140px] sm:max-w-none">{s.nama}</td>
                                  <td className="p-2 sm:p-3 text-center">
                                    <Select
                                      value={form[s.id] || "HADIR"}
                                      onValueChange={(v) => handleStatusChange(jd._key, s.id, v)}
                                    >
                                      <SelectTrigger className="h-9 sm:h-8 w-full min-w-[80px] sm:w-28 text-xs mx-auto">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="HADIR" className="text-emerald-600 font-medium">HADIR</SelectItem>
                                        <SelectItem value="SAKIT" className="text-yellow-600 font-medium">SAKIT</SelectItem>
                                        <SelectItem value="IZIN" className="text-blue-600 font-medium">IZIN</SelectItem>
                                        <SelectItem value="ALPA" className="text-red-600 font-medium">ALPA</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}