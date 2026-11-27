"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import {
  Award, CheckCircle2, FileText, Lock, LockOpen, Printer, Save, ShieldCheck, Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { predikatDari } from "@/lib/raport"
import {
  batalkanTerbitRaportKelas, getRaportKelas, simpanRaport, terbitkanRaportKelas,
} from "@/app/(dashboard)/raport/actions"
import type { RaportBaris, RaportRefs, RekapData } from "./types"

type WarnaBadge = "default" | "secondary" | "outline" | "destructive"

function predikatWarna(p: string): WarnaBadge {
  if (p === "A") return "default"
  if (p === "B") return "secondary"
  if (p === "C") return "outline"
  return "destructive"
}

export function PanelRaport({ refs, mode }: { refs: RaportRefs; mode: "admin" | "guru" }) {
  const kelasWali = useMemo(
    () => (mode === "guru" ? refs.kelas.filter((k) => refs.waliKelasIds.includes(k.id)) : refs.kelas),
    [refs, mode],
  )
  // Untuk admin, awali dari kelas yang sudah punya wali kelas karena raport
  // hanya bisa diterbitkan oleh wali kelas. Guru tetap memakai kelas walinya.
  const kelasAwal = useMemo(
    () => (mode === "guru" ? kelasWali[0] : kelasWali.find((k) => k.guruId) ?? kelasWali[0]),
    [kelasWali, mode],
  )
  const [semesterId, setSemesterId] = useState(refs.semesters.find((s) => s.isAktif)?.id ?? refs.semesters[0]?.id ?? "")
  const [kelasId, setKelasId] = useState(kelasAwal?.id ?? "")
  const [data, setData] = useState<RekapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<{ siswa: RekapData["siswas"][number]; raport: RaportBaris | null } | null>(null)
  const [form, setForm] = useState({ catatanWali: "", sikapPredikat: "", sikapDeskripsi: "", prestasi: "", sakit: "0", izin: "0", alpa: "0" })
  const [menyimpan, setMenyimpan] = useState(false)

  const muat = useCallback(async () => {
    if (!kelasId || !semesterId) return
    try {
      const res = await getRaportKelas(kelasId, semesterId)
      setData(res as unknown as RekapData)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat raport")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [kelasId, semesterId])

  useEffect(() => {
    if (!kelasId || !semesterId) return
    let batal = false
    getRaportKelas(kelasId, semesterId)
      .then((res) => { if (!batal) setData(res as unknown as RekapData) })
      .catch((e) => {
        if (batal) return
        toast.error(e instanceof Error ? e.message : "Gagal memuat raport")
        setData(null)
      })
      .finally(() => { if (!batal) setLoading(false) })
    return () => { batal = true }
  }, [kelasId, semesterId])

  const gantiSemester = (v: string) => {
    setSemesterId(v)
    setLoading(true)
  }

  const gantiKelas = (v: string) => {
    setKelasId(v)
    setLoading(true)
  }

  const raportBySiswa = useMemo(() => {
    const map = new Map<string, RaportBaris>()
    for (const r of data?.raports ?? []) map.set(r.siswaId, r)
    return map
  }, [data])

  const ringkasan = useMemo(() => {
    if (!data) return { total: 0, terbit: 0, draft: 0, rata: 0, belumLengkap: 0 }
    const total = data.siswas.length
    const terbit = data.raports.filter((r) => r.status === "TERBIT").length
    const nilaiSemua = data.siswas.flatMap((s) => data.mapels.map((m) => data.nilai[s.id]?.[m.id] ?? null))
    const isi = nilaiSemua.filter((n): n is number => n != null)
    const rata = isi.length ? Math.round((isi.reduce((a, b) => a + b, 0) / isi.length) * 100) / 100 : 0
    const belumLengkap = data.siswas.filter((s) => data.mapels.some((m) => data.nilai[s.id]?.[m.id] == null)).length
    return { total, terbit, draft: total - terbit, rata, belumLengkap }
  }, [data])

  const bukaDetail = (siswa: RekapData["siswas"][number]) => {
    const raport = raportBySiswa.get(siswa.id) ?? null
    setSelected({ siswa, raport })
    setForm({
      catatanWali: raport?.catatanWali ?? "",
      sikapPredikat: raport?.sikapPredikat ?? "",
      sikapDeskripsi: raport?.sikapDeskripsi ?? "",
      prestasi: raport?.prestasi ?? "",
      sakit: String(raport?.sakit ?? 0),
      izin: String(raport?.izin ?? 0),
      alpa: String(raport?.alpa ?? 0),
    })
  }

  const simpan = async () => {
    if (!selected) return
    setMenyimpan(true)
    try {
      await simpanRaport({
        siswaId: selected.siswa.id,
        semesterId,
        catatanWali: form.catatanWali,
        sikapPredikat: form.sikapPredikat,
        sikapDeskripsi: form.sikapDeskripsi,
        prestasi: form.prestasi,
        sakit: Number(form.sakit),
        izin: Number(form.izin),
        alpa: Number(form.alpa),
      })
      toast.success("Raport tersimpan")
      setSelected(null)
      await muat()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan raport")
    } finally {
      setMenyimpan(false)
    }
  }

  const terbitkan = async () => {
    if (!window.confirm("Terbitkan raport seluruh siswa di kelas ini? Raport yang terbit akan terkunci.")) return
    try {
      await terbitkanRaportKelas(kelasId, semesterId)
      toast.success("Raport kelas diterbitkan")
      await muat()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menerbitkan raport")
    }
  }

  const tarik = async () => {
    if (!window.confirm("Tarik kembali raport kelas ini? Wali kelas dapat mengubahnya lagi.")) return
    try {
      await batalkanTerbitRaportKelas(kelasId, semesterId)
      toast.success("Status raport dikembalikan ke draft")
      await muat()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menarik raport")
    }
  }

  if (mode === "guru" && kelasWali.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Anda belum menjadi wali kelas</p>
          <p className="text-sm text-muted-foreground mt-1">
            Admin menetapkan wali kelas di menu Kelas. Guru mapel tetap dapat menilai lewat tab Input Nilai.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> Kelas & semester
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Semester</Label>
            <Select value={semesterId} onValueChange={gantiSemester}>
              <SelectTrigger><SelectValue placeholder="Pilih semester" /></SelectTrigger>
              <SelectContent>
                {refs.semesters.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nama} — {s.tahunAjaran.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kelas</Label>
            <Select value={kelasId} onValueChange={gantiKelas}>
              <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
              <SelectContent>
                {kelasWali.map((k) => (
                  <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : !data ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Pilih kelas untuk melihat raport.</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Siswa</p>
              <p className="text-2xl font-bold mt-1">{ringkasan.total}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Terbit</p>
              <p className="text-2xl font-bold mt-1">{ringkasan.terbit}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Belum lengkap</p>
              <p className="text-2xl font-bold mt-1">{ringkasan.belumLengkap}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Rata-rata kelas</p>
              <p className="text-2xl font-bold mt-1">{ringkasan.rata || "-"}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base">Raport {data.kelas?.nama ?? ""}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Wali kelas: {data.kelas?.guru?.nama ?? "belum ditetapkan"} • {data.mapels.length} mata pelajaran • KKTP {data.pengaturan.kktp}
                </p>
              </div>
              <div className="flex gap-2">
                {ringkasan.terbit > 0 && (
                  <Button size="sm" variant="outline" onClick={tarik}>
                    <LockOpen className="h-4 w-4 mr-1.5" /> Tarik raport
                  </Button>
                )}
                <Button size="sm" onClick={terbitkan} disabled={data.mapels.length === 0}>
                  <Lock className="h-4 w-4 mr-1.5" /> Terbitkan
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {data.siswas.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Kelas ini belum memiliki siswa.</p>
              ) : data.mapels.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Belum ada mata pelajaran bernilai. Guru mapel perlu mengisi komponen nilai terlebih dahulu.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">No</TableHead>
                      <TableHead>Nama siswa</TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead className="text-center">Nilai terisi</TableHead>
                      <TableHead className="text-center">Rata-rata</TableHead>
                      <TableHead className="text-center">Peringkat</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.siswas.map((s, i) => {
                      const raport = raportBySiswa.get(s.id)
                      const isi = data.mapels.filter((m) => data.nilai[s.id]?.[m.id] != null).length
                      const nilaiList = data.mapels.map((m) => data.nilai[s.id]?.[m.id] ?? null)
                      const isiAngka = nilaiList.filter((n): n is number => n != null)
                      const rata = raport?.rataRata ?? (isiAngka.length ? Math.round((isiAngka.reduce((a, b) => a + b, 0) / isiAngka.length) * 100) / 100 : null)
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{s.nama}</TableCell>
                          <TableCell className="text-sm">{s.nis || "-"}</TableCell>
                          <TableCell className="text-center text-sm">{isi}/{data.mapels.length}</TableCell>
                          <TableCell className="text-center font-semibold">{rata ?? "-"}</TableCell>
                          <TableCell className="text-center">{raport?.peringkat ?? "-"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={raport?.status === "TERBIT" ? "default" : "outline"} className="text-[10px]">
                              {raport?.status === "TERBIT" ? "TERBIT" : "DRAFT"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" onClick={() => bukaDetail(s)}>
                                <FileText className="h-3.5 w-3.5 mr-1" /> Detail
                              </Button>
                              {raport?.status === "TERBIT" && (
                                <Button size="icon" variant="ghost" asChild aria-label="Cetak raport">
                                  <Link href={`/raport/cetak/${raport.id}`} target="_blank">
                                    <Printer className="h-4 w-4" />
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Raport — {selected?.siswa.nama}</DialogTitle>
          </DialogHeader>
          {selected && data && (
            <div className="space-y-4">
              {selected.raport?.status === "TERBIT" && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Raport sudah terbit dan terkunci. Tarik raport kelas untuk melakukan perubahan.
                </div>
              )}
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mata pelajaran</TableHead>
                      <TableHead className="text-center">Nilai</TableHead>
                      <TableHead className="text-center">Predikat</TableHead>
                      <TableHead>Deskripsi capaian</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.mapels.map((m) => {
                      const tersimpan = selected.raport?.nilais.find((n) => n.mapelId === m.id)
                      const nilai = tersimpan?.nilaiAkhir ?? data.nilai[selected.siswa.id]?.[m.id] ?? null
                      const predikat = tersimpan?.predikat ?? (nilai != null ? predikatDari(nilai, data.pengaturan) : "-")
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.nama}</TableCell>
                          <TableCell className="text-center">{nilai ?? "-"}</TableCell>
                          <TableCell className="text-center">
                            {predikat === "-" ? "-" : (
                              <Badge variant={predikatWarna(predikat)} className="text-[10px]">{predikat}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {tersimpan?.deskripsi ?? (data.sumber[selected.siswa.id]?.[m.id] === "UJIAN" ? "Dari rata-rata nilai ujian." : "Belum ada nilai.")}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Sikap — predikat</Label>
                  <Input
                    placeholder="Contoh: Baik / Sangat Baik"
                    value={form.sikapPredikat}
                    disabled={selected.raport?.status === "TERBIT"}
                    onChange={(e) => setForm((f) => ({ ...f, sikapPredikat: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Prestasi (opsional)</Label>
                  <Input
                    placeholder="Contoh: Juara 1 Olimpiade"
                    value={form.prestasi}
                    disabled={selected.raport?.status === "TERBIT"}
                    onChange={(e) => setForm((f) => ({ ...f, prestasi: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Deskripsi sikap</Label>
                <textarea
                  className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                  value={form.sikapDeskripsi}
                  disabled={selected.raport?.status === "TERBIT"}
                  onChange={(e) => setForm((f) => ({ ...f, sikapDeskripsi: e.target.value }))}
                  placeholder="Deskripsi sikap dan karakter siswa"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Catatan wali kelas</Label>
                <textarea
                  className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                  value={form.catatanWali}
                  disabled={selected.raport?.status === "TERBIT"}
                  onChange={(e) => setForm((f) => ({ ...f, catatanWali: e.target.value }))}
                  placeholder="Catatan untuk siswa dan orang tua"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(["sakit", "izin", "alpa"] as const).map((key) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="capitalize">{key}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form[key]}
                      disabled={selected.raport?.status === "TERBIT"}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {selected.raport?.status === "TERBIT" && (
                  <Button variant="outline" asChild>
                    <Link href={`/raport/cetak/${selected.raport.id}`} target="_blank">
                      <Printer className="h-4 w-4 mr-1.5" /> Cetak raport
                    </Link>
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelected(null)}>Tutup</Button>
                <Button onClick={simpan} disabled={menyimpan || selected.raport?.status === "TERBIT"}>
                  <Save className="h-4 w-4 mr-1.5" /> {menyimpan ? "Menyimpan..." : "Simpan raport"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
