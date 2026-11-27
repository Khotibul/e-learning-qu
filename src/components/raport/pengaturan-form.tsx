"use client"

import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { Save, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { getPengaturanRaport, simpanPengaturanRaport } from "@/app/(dashboard)/raport/actions"
import type { RaportRefs } from "./types"

interface FormPengaturan {
  bobotFormatif: string
  bobotSumatif: string
  bobotProyek: string
  bobotPraktik: string
  kktp: string
  ambangA: string
  ambangB: string
  ambangC: string
  tampilkanPeringkat: boolean
  namaKepalaSekolah: string
  nipKepalaSekolah: string
  catatanKepala: string
}

const KOSONG: FormPengaturan = {
  bobotFormatif: "30",
  bobotSumatif: "50",
  bobotProyek: "10",
  bobotPraktik: "10",
  kktp: "70",
  ambangA: "90",
  ambangB: "80",
  ambangC: "70",
  tampilkanPeringkat: true,
  namaKepalaSekolah: "",
  nipKepalaSekolah: "",
  catatanKepala: "",
}

export function PengaturanForm({ refs }: { refs: RaportRefs }) {
  const [semesterId, setSemesterId] = useState(refs.semesters.find((s) => s.isAktif)?.id ?? refs.semesters[0]?.id ?? "")
  const [form, setForm] = useState<FormPengaturan>(KOSONG)
  const [loading, setLoading] = useState(true)
  const [menyimpan, setMenyimpan] = useState(false)

  useEffect(() => {
    if (!semesterId) return
    let batal = false
    getPengaturanRaport(semesterId)
      .then((p) => {
        if (batal) return
        const row = p as Record<string, unknown>
        setForm({
          bobotFormatif: String(row.bobotFormatif ?? 30),
          bobotSumatif: String(row.bobotSumatif ?? 50),
          bobotProyek: String(row.bobotProyek ?? 10),
          bobotPraktik: String(row.bobotPraktik ?? 10),
          kktp: String(row.kktp ?? 70),
          ambangA: String(row.ambangA ?? 90),
          ambangB: String(row.ambangB ?? 80),
          ambangC: String(row.ambangC ?? 70),
          tampilkanPeringkat: row.tampilkanPeringkat !== false,
          namaKepalaSekolah: String(row.namaKepalaSekolah ?? ""),
          nipKepalaSekolah: String(row.nipKepalaSekolah ?? ""),
          catatanKepala: String(row.catatanKepala ?? ""),
        })
      })
      .catch((e) => { if (!batal) toast.error(e instanceof Error ? e.message : "Gagal memuat pengaturan") })
      .finally(() => { if (!batal) setLoading(false) })
    return () => { batal = true }
  }, [semesterId])

  const gantiSemester = (v: string) => {
    setSemesterId(v)
    setLoading(true)
  }

  const set = (key: keyof FormPengaturan, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))

  const totalBobot = ["bobotFormatif", "bobotSumatif", "bobotProyek", "bobotPraktik"].reduce(
    (total, key) => total + (Number(form[key as keyof FormPengaturan]) || 0),
    0,
  )

  const simpan = async () => {
    setMenyimpan(true)
    try {
      await simpanPengaturanRaport({
        semesterId,
        bobotFormatif: Number(form.bobotFormatif),
        bobotSumatif: Number(form.bobotSumatif),
        bobotProyek: Number(form.bobotProyek),
        bobotPraktik: Number(form.bobotPraktik),
        kktp: Number(form.kktp),
        ambangA: Number(form.ambangA),
        ambangB: Number(form.ambangB),
        ambangC: Number(form.ambangC),
        tampilkanPeringkat: form.tampilkanPeringkat,
        namaKepalaSekolah: form.namaKepalaSekolah,
        nipKepalaSekolah: form.nipKepalaSekolah,
        catatanKepala: form.catatanKepala,
      })
      toast.success("Pengaturan raport disimpan")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan pengaturan")
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" /> Pengaturan penilaian & raport
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 max-w-md">
          <Label>Semester</Label>
          <Select value={semesterId} onValueChange={gantiSemester}>
            <SelectTrigger><SelectValue placeholder="Pilih semester" /></SelectTrigger>
            <SelectContent>
              {refs.semesters.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nama} — {s.tahunAjaran.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Bobot dan ambang predikat berlaku untuk semester ini.</p>
        </div>

        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <>
            <div>
              <p className="text-sm font-medium mb-2">Bobot jenis penilaian (%)</p>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                {([
                  ["bobotFormatif", "Formatif"],
                  ["bobotSumatif", "Sumatif"],
                  ["bobotProyek", "Proyek / P5"],
                  ["bobotPraktik", "Praktik"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input type="number" min={0} max={100} value={form[key]} onChange={(e) => set(key, e.target.value)} />
                  </div>
                ))}
              </div>
              <p className={`text-xs mt-2 ${totalBobot === 0 ? "text-destructive" : "text-muted-foreground"}`}>
                Total bobot: {totalBobot}%{totalBobot !== 100 ? " — sistem menormalisasi otomatis" : ""}
              </p>
            </div>

            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>KKTP</Label>
                <Input type="number" min={0} max={100} value={form.kktp} onChange={(e) => set("kktp", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Ambang A (≥)</Label>
                <Input type="number" min={0} max={100} value={form.ambangA} onChange={(e) => set("ambangA", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Ambang B (≥)</Label>
                <Input type="number" min={0} max={100} value={form.ambangB} onChange={(e) => set("ambangB", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Ambang C (≥)</Label>
                <Input type="number" min={0} max={100} value={form.ambangC} onChange={(e) => set("ambangC", e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Tampilkan peringkat di raport</p>
                <p className="text-xs text-muted-foreground">Peringkat dihitung otomatis saat raport diterbitkan.</p>
              </div>
              <Switch
                checked={form.tampilkanPeringkat}
                onCheckedChange={(v) => set("tampilkanPeringkat", v)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nama kepala sekolah</Label>
                <Input value={form.namaKepalaSekolah} onChange={(e) => set("namaKepalaSekolah", e.target.value)} placeholder="Untuk tanda tangan raport" />
              </div>
              <div className="space-y-1.5">
                <Label>NIP kepala sekolah</Label>
                <Input value={form.nipKepalaSekolah} onChange={(e) => set("nipKepalaSekolah", e.target.value)} placeholder="Opsional" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Catatan kepala sekolah</Label>
              <textarea
                className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.catatanKepala}
                onChange={(e) => set("catatanKepala", e.target.value)}
                placeholder="Catatan umum pada raport, opsional"
              />
            </div>

            <Button onClick={simpan} disabled={menyimpan || totalBobot === 0}>
              <Save className="h-4 w-4 mr-1.5" /> {menyimpan ? "Menyimpan..." : "Simpan pengaturan"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
