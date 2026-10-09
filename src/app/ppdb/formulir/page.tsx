"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, ArrowRight, Check, Save, ClipboardList } from "lucide-react"
import {
  getDraftPendaftaran, simpanDraftBiodata, createPendaftaran, getGelombangPublik,
  LANGKAH_BIODATA,
} from "../actions"

type Langkah = (typeof LANGKAH_BIODATA)[number]

const JUDUL: Record<Langkah, string> = {
  identitas: "Identitas Calon Peserta",
  alamat: "Alamat",
  orangTua: "Data Orang Tua",
  wali: "Data Wali",
  asalSekolah: "Asal Sekolah",
  tambahan: "Informasi Tambahan",
}

const FIELD: Record<Langkah, { key: string; label: string; type?: string; wajib?: boolean; options?: string[] }[]> = {
  identitas: [
    { key: "namaLengkap", label: "Nama Lengkap (sesuai dokumen)", wajib: true },
    { key: "nisn", label: "NISN (jika ada)" },
    { key: "nik", label: "NIK" },
    { key: "noKk", label: "Nomor KK" },
    { key: "tempatLahir", label: "Tempat Lahir", wajib: true },
    { key: "tanggalLahir", label: "Tanggal Lahir", type: "date", wajib: true },
    { key: "jenisKelamin", label: "Jenis Kelamin", type: "select", options: ["Laki-laki", "Perempuan"], wajib: true },
    { key: "agama", label: "Agama", type: "select", options: ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Lainnya"] },
    { key: "kewarganegaraan", label: "Kewarganegaraan", options: undefined },
    { key: "anakKe", label: "Anak ke-", type: "number" },
    { key: "jumlahSaudara", label: "Jumlah saudara", type: "number" },
  ],
  alamat: [
    { key: "provinsi", label: "Provinsi", wajib: true },
    { key: "kabupaten", label: "Kabupaten/Kota", wajib: true },
    { key: "kecamatan", label: "Kecamatan" },
    { key: "desa", label: "Desa/Kelurahan" },
    { key: "rtRw", label: "RT/RW" },
    { key: "kodePos", label: "Kode Pos" },
    { key: "alamatLengkap", label: "Alamat Lengkap", wajib: true },
    { key: "alamatDomisili", label: "Alamat Domisili (jika berbeda)" },
  ],
  orangTua: [
    { key: "namaAyah", label: "Nama Ayah", wajib: true },
    { key: "nikAyah", label: "NIK Ayah" },
    { key: "pekerjaanAyah", label: "Pekerjaan Ayah" },
    { key: "telpAyah", label: "No. HP Ayah" },
    { key: "namaIbu", label: "Nama Ibu", wajib: true },
    { key: "nikIbu", label: "NIK Ibu" },
    { key: "pekerjaanIbu", label: "Pekerjaan Ibu" },
    { key: "telpIbu", label: "No. HP Ibu" },
    { key: "statusHubungan", label: "Status hubungan keluarga", type: "select", options: ["Kandung", "Tiri", "Wali", "Lainnya"] },
  ],
  wali: [
    { key: "nama", label: "Nama Wali", wajib: true },
    { key: "hubungan", label: "Hubungan dengan siswa", type: "select", options: ["Ayah", "Ibu", "Wali", "Lainnya"] },
    { key: "noTelp", label: "Nomor HP" },
    { key: "email", label: "Email", type: "email" },
    { key: "alamat", label: "Alamat" },
  ],
  asalSekolah: [
    { key: "namaSekolah", label: "Nama Sekolah Asal", wajib: true },
    { key: "npsn", label: "NPSN" },
    { key: "jenjang", label: "Jenjang" },
    { key: "tahunLulus", label: "Tahun Lulus", type: "number" },
    { key: "noIjazah", label: "No. Ijazah/SKL" },
  ],
  tambahan: [
    { key: "kebutuhanDukungan", label: "Kebutuhan dukungan pembelajaran/aksesibilitas (opsional)" },
    { key: "riwayatNonformal", label: "Riwayat pendidikan nonformal (opsional)" },
    { key: "infoPenting", label: "Informasi penting untuk layanan sekolah (opsional)" },
  ],
}

interface PendaftaranDraft {
  id: string
  jenis: string
  status: string
  data: Record<string, Record<string, string>> | null
  gelombang: { id: string; nama: string; status: string; tanggalTutup: string }
  pilihan: { jalur: { id: string; nama: string } }[]
}

export default function FormulirPage() {
  const router = useRouter()
  const [pendaftaran, setPendaftaran] = useState<PendaftaranDraft | null>(null)
  const [gelombangOpts, setGelombangOpts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [langkah, setLangkah] = useState<Langkah>("identitas")
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pilihGelombang, setPilihGelombang] = useState({ gelombangId: "", jenis: "SISWA_REGULER" })

  // load draft + opsi gelombang
  useEffect(() => {
    Promise.all([getDraftPendaftaran(), getGelombangPublik()])
      .then(([draft, gols]) => {
        setPendaftaran(draft as any)
        setGelombangOpts(gols as any[])
        if (draft) {
          setForm(((draft as any).data?.[ "identitas" ]) || {})
        }
      })
      .catch(() => toast.error("Gagal memuat data"))
      .finally(() => setLoading(false))
  }, [])

  const muatLangkah = useCallback((l: Langkah) => {
    setLangkah(l)
    setForm(pendaftaran?.data?.[l] || {})
  }, [pendaftaran])

  // autosave debounce 1.5s setelah perubahan
  const simpanOtomatis = useCallback(async (l: Langkah, data: Record<string, string>) => {
    if (!pendaftaran) return
    setSaving(true)
    try {
      const res = await simpanDraftBiodata(pendaftaran.id, l, data) as any
      setLastSaved(new Date(res.updatedAt))
    } catch (err: any) {
      // diamkan error autosave berulang — tampilkan sekali
    } finally {
      setSaving(false)
    }
  }, [pendaftaran])

  const handleChange = (key: string, value: string) => {
    const baru = { ...form, [key]: value }
    setForm(baru)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => simpanOtomatis(langkah, baru), 1500)
  }

  const handleSimpanManual = async () => {
    if (!pendaftaran) return
    setSaving(true)
    try {
      await simpanDraftBiodata(pendaftaran.id, langkah, form)
      setLastSaved(new Date())
      toast.success("Draft tersimpan")
      // refresh pendaftaran agar data langkah lain ter-update
      const fresh = await getDraftPendaftaran() as any
      setPendaftaran(fresh)
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  const handleLanjut = async () => {
    if (!pendaftaran) return
    // validasi wajib langkah ini
    const kurang = FIELD[langkah].filter((f) => f.wajib && !form[f.key]?.trim())
    if (kurang.length > 0) {
      toast.error(`Lengkapi: ${kurang.map((f) => f.label).join(", ")}`)
      return
    }
    setSaving(true)
    try {
      await simpanDraftBiodata(pendaftaran.id, langkah, form)
      const fresh = await getDraftPendaftaran() as any
      setPendaftaran(fresh)
      const idx = LANGKAH_BIODATA.indexOf(langkah)
      if (idx < LANGKAH_BIODATA.length - 1) {
        const next = LANGKAH_BIODATA[idx + 1]
        setLangkah(next)
        setForm(fresh?.data?.[next] || {})
      } else {
        toast.success("Semua langkah biodata selesai — lanjutkan ke unggah berkas")
        router.push("/ppdb/berkas")
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  const handleMundur = () => {
    const idx = LANGKAH_BIODATA.indexOf(langkah)
    if (idx > 0) {
      const prev = LANGKAH_BIODATA[idx - 1]
      setLangkah(prev)
      setForm(pendaftaran?.data?.[prev] || {})
    }
  }

  const handleBuatPendaftaran = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pilihGelombang.gelombangId) { toast.error("Pilih gelombang"); return }
    try {
      const p = await createPendaftaran(pilihGelombang.gelombangId, pilihGelombang.jenis as any) as any
      toast.success("Pendaftaran draft dibuat — lengkapi formulir")
      const fresh = await getDraftPendaftaran() as any
      setPendaftaran(fresh || { ...p, data: null, gelombang: gelombangOpts.find((g) => g.id === pilihGelombang.gelombangId), pilihan: [] })
    } catch (err: any) {
      toast.error(err?.message || "Gagal membuat pendaftaran")
    }
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  // belum punya draft → pilih gelombang & jenis
  if (!pendaftaran) {
    const dibuka = gelombangOpts.filter((g) => g.status === "DIBUKA")
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="text-center mb-8">
          <ClipboardList className="mx-auto h-10 w-10 text-primary mb-3" />
          <h1 className="text-2xl sm:text-3xl font-bold">Mulai Pendaftaran</h1>
          <p className="mt-2 text-muted-foreground text-sm">Pilih gelombang dan jenis pendaftaran untuk memulai.</p>
        </div>
        {dibuka.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center space-y-3">
            <p className="font-medium">Belum ada gelombang pendaftaran yang dibuka</p>
            <p className="text-sm text-muted-foreground">Silakan tunggu pengumuman pembukaan gelombang.</p>
            <Link href="/ppdb"><Button variant="outline" size="sm">Kembali ke PPDB</Button></Link>
          </div>
        ) : (
          <form onSubmit={handleBuatPendaftaran} className="rounded-2xl border p-6 sm:p-8 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Gelombang *</label>
              <select
                required
                value={pilihGelombang.gelombangId}
                onChange={(e) => setPilihGelombang((p) => ({ ...p, gelombangId: e.target.value }))}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm"
              >
                <option value="">— Pilih gelombang —</option>
                {dibuka.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama} ({[g.unit, g.jenjang, g.program].filter(Boolean).join(" · ")})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Jenis Pendaftaran *</label>
              <div className="space-y-2">
                {[
                  { v: "SISWA_REGULER", t: "Siswa Reguler", d: "Sekolah formal tanpa pondok" },
                  { v: "SISWA_SANTRI", t: "Siswa Sekaligus Santri", d: "Sekolah formal + program pondok" },
                  { v: "SANTRI_PONDOK", t: "Santri Pondok", d: "Program kepesantrenan saja" },
                ].map((j) => (
                  <label key={j.v} className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                    <input
                      type="radio"
                      name="jenis"
                      checked={pilihGelombang.jenis === j.v}
                      onChange={() => setPilihGelombang((p) => ({ ...p, jenis: j.v }))}
                      className="mt-1"
                    />
                    <span>
                      <span className="text-sm font-medium">{j.t}</span>
                      <span className="block text-xs text-muted-foreground">{j.d}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full">Mulai Isi Formulir</Button>
          </form>
        )}
      </div>
    )
  }

  const idxLangkah = LANGKAH_BIODATA.indexOf(langkah)
  const progres = Math.round(((idxLangkah + 1) / LANGKAH_BIODATA.length) * 100)

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link href="/ppdb" className="text-sm text-muted-foreground hover:underline flex items-center gap-1 w-fit">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali
        </Link>
        <h1 className="text-2xl font-bold mt-2">Formulir Pendaftaran</h1>
        <p className="text-sm text-muted-foreground">
          {pendaftaran.gelombang.nama} · {pendaftaran.jenis.replace(/_/g, " ")}
          {pendaftaran.pilihan[0]?.jalur ? ` · Jalur: ${pendaftaran.pilihan[0].jalur.nama}` : ""}
        </p>
      </div>

      {/* stepper */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Langkah {idxLangkah + 1}/{LANGKAH_BIODATA.length}: {JUDUL[langkah]}</span>
          <span>{progres}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progres}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LANGKAH_BIODATA.map((l, i) => (
            <button
              key={l}
              type="button"
              onClick={() => muatLangkah(l)}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                l === langkah ? "bg-primary text-primary-foreground" :
                pendaftaran.data?.[l] ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                "bg-muted text-muted-foreground"
              }`}
            >
              {pendaftaran.data?.[l] ? <Check className="inline h-3 w-3 mr-0.5" /> : null}
              {i + 1}. {JUDUL[l]}
            </button>
          ))}
        </div>
      </div>

      {/* form langkah */}
      <div className="rounded-2xl border p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{JUDUL[langkah]}</h2>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {saving ? <><Loader2 className="h-3 w-3 animate-spin" /> Menyimpan…</> :
             lastSaved ? <><Save className="h-3 w-3" /> Tersimpan {lastSaved.toLocaleTimeString("id-ID")}</> : "Autosave aktif"}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELD[langkah].map((f) => (
            <div key={f.key} className={`space-y-1.5 ${f.key === "alamatLengkap" || f.key === "alamatDomisili" || f.key === "kebutuhanDukungan" || f.key === "riwayatNonformal" || f.key === "infoPenting" ? "sm:col-span-2" : ""}`}>
              <label className="text-sm font-medium">
                {f.label} {f.wajib && <span className="text-red-500">*</span>}
              </label>
              {f.type === "select" ? (
                <select
                  value={form[f.key] || ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm"
                >
                  <option value="">— Pilih —</option>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.key.includes("alamat") || f.key.includes("Dukungan") || f.key.includes("riwayat") || f.key.includes("infoPenting") ? (
                <textarea
                  rows={2}
                  value={form[f.key] || ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm"
                />
              ) : (
                <Input
                  type={f.type === "number" ? "number" : f.type || "text"}
                  value={form[f.key] || ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* navigasi */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={handleMundur} disabled={idxLangkah === 0 || saving}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Mundur
        </Button>
        <Button variant="ghost" onClick={handleSimpanManual} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Simpan Draft
        </Button>
        <Button onClick={handleLanjut} disabled={saving}>
          {idxLangkah === LANGKAH_BIODATA.length - 1 ? "Selesai" : "Lanjut"} <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Setelah seluruh langkah selesai, lanjutkan ke unggah berkas persyaratan.
      </p>
    </div>
  )
}
