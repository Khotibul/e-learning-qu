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
  Save, Loader2, Calendar, Check,
} from "lucide-react"
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
  const [loadingJadwal, setLoadingJadwal] = useState(false)

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
    setSaving(jd._key)
    try {
      const form = absensiForm[jd._key] || {}
      const siswaStatus = Object.entries(form).map(([siswaId, status]) => ({ siswaId, status }))
      await saveAbsensi(jd.kelas.id, jd.mataPelajaran.id, tanggal, siswaStatus)
      setSaved((prev) => new Set(prev).add(jd._key))
      toast.success(`Absensi ${jd.kelas.nama} - ${jd.mataPelajaran.nama} tersimpan`)
    } catch {
      toast.error("Gagal menyimpan")
    } finally {
      setSaving(null)
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
          return (
            <div key={kelasId} className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {kelasInfo.nama}
                <Badge variant="secondary" className="text-xs">{kelasInfo.siswas.length} siswa</Badge>
              </h2>
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
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleMarkAll(jd._key, "HADIR", activeSiswa)}>
                            Semua Hadir
                          </Button>
                          <Button size="sm" className={`h-8 text-xs sm:text-sm ${saved.has(jd._key) ? "bg-green-600 hover:bg-green-700" : ""}`} onClick={() => handleSave(jd)} disabled={saving === jd._key}>
                            {saving === jd._key ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : saved.has(jd._key) && <Check className="h-3 w-3 mr-1" />}
                            {saved.has(jd._key) ? "Tersimpan" : "Simpan"}
                          </Button>
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