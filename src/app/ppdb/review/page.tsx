"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, Send, CheckCircle2, AlertCircle, FileText } from "lucide-react"
import { getReviewPendaftaran, submitPendaftaran, cekKelengkapanBiodata, cekKelengkapanSantri, cekKelengkapanBerkas } from "../actions"

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  TERKIRIM: "Terkirim",
  MENUNGGU_VERIFIKASI: "Menunggu Verifikasi",
  PERLU_PERBAIKAN: "Perlu Perbaikan",
  DIVERIFIKASI: "Terverifikasi",
  SELEKSI: "Seleksi",
  DITERIMA: "Diterima",
  CADANGAN: "Cadangan",
  TIDAK_DITERIMA: "Tidak Diterima",
  MENGUNDURKAN_DIRI: "Mengundurkan Diri",
}

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  TERKIRIM: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5 space-y-3">
      <h2 className="font-semibold text-sm">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  )
}

export default function ReviewPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [konfirmasi, setKonfirmasi] = useState(false)
  const [hasil, setHasil] = useState<{ noPendaftaran: string; submittedAt: string } | null>(null)
  const [cek, setCek] = useState<{ bio: boolean; san: boolean; ber: boolean; kurang: string[] } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const d = (await getReviewPendaftaran()) as any
        setData(d)
        if (d && d.status === "DRAFT") {
          const [b, s, bk] = await Promise.all([
            cekKelengkapanBiodata(d.pendaftaranId) as any,
            d.jenis !== "SISWA_REGULER" ? cekKelengkapanSantri(d.pendaftaranId) as any : Promise.resolve({ lengkap: true, kurang: [] }),
            cekKelengkapanBerkas(d.pendaftaranId) as any,
          ])
          const kurang = [...b.kurang, ...s.kurang, ...bk.kurang.map((k: string) => `berkas:${k}`)]
          setCek({ bio: b.lengkap, san: s.lengkap, ber: bk.lengkap, kurang })
        }
      } catch {
        toast.error("Gagal memuat data review")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSubmit = async () => {
    if (!data) return
    setSubmitting(true)
    try {
      const res = (await submitPendaftaran(data.pendaftaranId)) as any
      setHasil({ noPendaftaran: res.noPendaftaran, submittedAt: res.submittedAt })
      toast.success("Pendaftaran berhasil dikirim!")
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengirim pendaftaran")
    } finally {
      setSubmitting(false)
    }
    setKonfirmasi(false)
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">Belum ada pendaftaran untuk direview.</p>
        <Link href="/ppdb/formulir"><Button size="sm">Mulai Formulir</Button></Link>
      </div>
    )
  }

  // sudah terkirim → layar sukses
  if (hasil || data.status !== "DRAFT") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center space-y-6">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
        <h1 className="text-2xl font-bold">Pendaftaran {hasil ? "Berhasil Dikirim" : `Sudah ${STATUS_LABEL[data.status] || data.status}`}</h1>
        {(hasil || data.noPendaftaran) && (
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm text-muted-foreground">Nomor Pendaftaran</p>
            <p className="text-2xl font-mono font-bold">{hasil?.noPendaftaran || data.noPendaftaran}</p>
            {(hasil?.submittedAt || data.submittedAt) && (
              <p className="text-xs text-muted-foreground">
                Dikirim {new Date(hasil?.submittedAt || data.submittedAt).toLocaleString("id-ID")}
              </p>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Simpan nomor pendaftaran untuk melacak status di halaman{" "}
          <Link href="/ppdb/cek-status" className="text-primary underline">Cek Status</Link>.
        </p>
        <Link href="/ppdb"><Button variant="outline" size="sm">Kembali ke PPDB</Button></Link>
      </div>
    )
  }

  const semuaLengkap = cek?.bio && cek?.san && cek?.ber

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link href="/ppdb/berkas" className="text-sm text-muted-foreground hover:underline flex items-center gap-1 w-fit">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Berkas
        </Link>
        <h1 className="text-2xl font-bold mt-2">Review Pendaftaran</h1>
        <p className="text-sm text-muted-foreground">
          {data.gelombang.nama} · {data.jenis.replace(/_/g, " ")}
        </p>
      </div>

      {/* status kelengkapan */}
      {cek && (
        <div className="rounded-2xl border p-4 space-y-2">
          {cek.kurang.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" /> Semua data lengkap — siap dikirim
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" /> Data belum lengkap:
              </div>
              <ul className="text-xs text-red-600 dark:text-red-400 list-disc pl-6">
                {cek.kurang.map((k) => <li key={k}>{k}</li>)}
              </ul>
              <div className="flex gap-2 pt-1">
                {!cek.bio && <Link href="/ppdb/formulir"><Button variant="outline" size="sm">Lengkapi Biodata</Button></Link>}
                {!cek.san && data.jenis !== "SISWA_REGULER" && <Link href="/ppdb/formulir"><Button variant="outline" size="sm">Lengkapi Data Santri</Button></Link>}
                {!cek.ber && <Link href="/ppdb/berkas"><Button variant="outline" size="sm">Lengkapi Berkas</Button></Link>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ringkasan gelombang & jalur */}
      <Section title="Gelombang & Jalur">
        <Row label="Gelombang" value={data.gelombang.nama} />
        <Row label="Unit" value={data.gelombang.unit} />
        <Row label="Jenjang" value={data.gelombang.jenjang} />
        <Row label="Program" value={data.gelombang.program} />
        <Row label="Jenis Pendaftaran" value={data.jenis.replace(/_/g, " ")} />
        {data.jalur.length > 0 && <Row label="Jalur" value={data.jalur.join(", ")} />}
        {data.gelombang.biayaDaftar != null && (
          <Row label="Biaya Pendaftaran" value={`Rp ${data.gelombang.biayaDaftar.toLocaleString("id-ID")}`} />
        )}
      </Section>

      {/* biodata */}
      <Section title="Biodata">
        {Object.entries(data.data as Record<string, Record<string, string>>).map(([langkah, isi]) => (
          <div key={langkah} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">{langkah}</p>
            {Object.entries(isi || {}).map(([k, v]) => (
              <Row key={k} label={k} value={v} />
            ))}
          </div>
        ))}
      </Section>

      {/* data santri */}
      {data.jenis !== "SISWA_REGULER" && Object.keys(data.dataSantri || {}).length > 0 && (
        <Section title="Data Santri">
          {Object.entries(data.dataSantri as Record<string, Record<string, string>>).map(([langkah, isi]) => (
            <div key={langkah} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase">{langkah}</p>
              {Object.entries(isi || {}).map(([k, v]) => (
                <Row key={k} label={k} value={v} />
              ))}
            </div>
          ))}
        </Section>
      )}

      {/* berkas */}
      <Section title="Berkas Persyaratan">
        {data.berkas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada persyaratan dokumen.</p>
        ) : (
          <div className="space-y-2">
            {data.berkas.map((b: any) => (
              <div key={b.namaDokumen} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {b.namaDokumen}
                  {b.wajib && <span className="text-red-500">*</span>}
                </span>
                <span className="flex items-center gap-2">
                  {b.filename && <span className="text-xs text-muted-foreground">{b.filename}</span>}
                  <Badge variant="outline" className={b.status === "DIUNGGAH" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                    {b.status === "DIUNGGAH" ? "Terunggah" : "Belum"}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* aksi submit */}
      <div className="rounded-2xl border p-5 space-y-3">
        <p className="text-sm text-muted-foreground">
          Dengan mengirim pendaftaran, Anda menyatakan seluruh data benar. Setelah dikirim, data tidak dapat diubah.
        </p>
        {konfirmasi ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setKonfirmasi(false)} disabled={submitting} className="flex-1">
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || (cek !== null && !semuaLengkap)} className="flex-1 bg-green-600 hover:bg-green-700">
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Ya, Kirim Sekarang
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setKonfirmasi(true)}
            disabled={cek !== null && !semuaLengkap}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-1" /> Kirim Pendaftaran
          </Button>
        )}
      </div>
    </div>
  )
}
