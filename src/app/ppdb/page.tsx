import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar, Users, ClipboardList, HelpCircle, Phone, ArrowRight,
  GraduationCap, HeartHandshake, BookOpen, CheckCircle2, Sparkles,
} from "lucide-react"

export const metadata = { title: "PPDB — Penerimaan Siswa & Santri Baru" }

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DIBUKA: { label: "Pendaftaran Dibuka", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  DITUTUP: { label: "Pendaftaran Ditutup", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  SELEKSI: { label: "Sedang Seleksi", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  PENGUMUMAN: { label: "Pengumuman", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  DAFTAR_ULANG: { label: "Daftar Ulang", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  SELESAI: { label: "Selesai", cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
}

const ALUR = [
  { no: 1, title: "Buat Akun", desc: "Daftar akun pendaftar dengan email aktif" },
  { no: 2, title: "Pilih Gelombang & Jalur", desc: "Tentukan jenis pendaftaran dan jalur pilihan" },
  { no: 3, title: "Isi Formulir", desc: "Lengkapi biodata dan formulir khusus santri" },
  { no: 4, title: "Unggah Berkas", desc: "Upload dokumen persyaratan pendaftaran" },
  { no: 5, title: "Submit & Kartu Peserta", desc: "Kunci data, terima nomor pendaftaran & kartu" },
  { no: 6, title: "Seleksi & Pengumuman", desc: "Ikuti tes (jika ada) dan pantau hasil" },
  { no: 7, title: "Daftar Ulang", desc: "Konfirmasi diterima dan lengkapi administrasi" },
]

const FAQ = [
  { q: "Siapa yang dapat mendaftar PPDB?", a: "Calon siswa sekolah formal, calon santri pondok, atau keduanya (siswa sekaligus santri). Satu akun dapat digunakan untuk mendaftar." },
  { q: "Apakah pendaftar lama datanya hilang?", a: "Tidak. Seluruh data pendaftaran yang sudah tersimpan tetap aman dan tidak dihapus." },
  { q: "Bagaimana cara mengecek status pendaftaran?", a: "Gunakan menu Cek Status dengan nomor pendaftaran yang Anda terima setelah submit formulir." },
  { q: "Apakah pendaftaran dipungut biaya?", a: "Biaya pendaftaran (jika ada) ditentukan oleh masing-masing gelombang dan ditampilkan pada informasi gelombang." },
]

const JENIS = [
  { icon: GraduationCap, title: "Siswa Reguler", desc: "Mendaftar sekolah formal tanpa tinggal di asrama." },
  { icon: HeartHandshake, title: "Siswa Sekaligus Santri", desc: "Sekolah formal sekaligus program pondok/asrama — satu identitas." },
  { icon: BookOpen, title: "Santri Pondok", desc: "Program kepesantrenan tanpa wajib sekolah formal di unit yang sama." },
]

function fmt(iso: Date | string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
}

export default async function PpdbPage() {
  const [config, gelombangs] = await Promise.all([
    prisma.siteConfig.findFirst(),
    prisma.gelombangPpdb.findMany({
      where: {
        deletedAt: null,
        status: { in: ["DIBUKA", "DITUTUP", "SELEKSI", "PENGUMUMAN", "DAFTAR_ULANG"] },
      },
      include: {
        tahunAjaran: { select: { nama: true } },
        jalur: { where: { isActive: true }, orderBy: { nama: "asc" } },
      },
      orderBy: { tanggalBuka: "desc" },
      take: 12,
    }),
  ])
  const siteName = config?.siteName || "E-Learning QU"

  return (
    <div className="min-h-screen">
      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/ppdb" className="flex items-center gap-2 font-bold text-lg">
            {config?.logoUrl ? (
              <img src={config.logoUrl} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            )}
            <span>PPDB — {siteName}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/ppdb/cek-status">
              <Button variant="ghost" size="sm">Cek Status</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">Masuk</Button>
            </Link>
            <Link href="/ppdb/daftar" className="hidden sm:block">
              <Button size="sm">Daftar Sekarang</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-12 sm:pt-20 pb-12 sm:pb-16 text-center">
        <Badge className="mb-4" variant="secondary">Tahun Ajaran Baru</Badge>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-balance">
          Penerimaan Siswa &amp; Santri Baru
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground text-pretty">
          {config?.aboutText || `Sistem Penerimaan Peserta Didik & Santri baru ${siteName} — transparan, terintegrasi, dan dapat diakses kapan saja.`}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/ppdb/daftar">
            <Button size="lg" className="gap-2">Daftar Sekarang <ArrowRight className="h-4 w-4" /></Button>
          </Link>
          <Link href="/ppdb/cek-status">
            <Button size="lg" variant="outline" className="gap-2">Cek Status Pendaftaran</Button>
          </Link>
        </div>
      </section>

      {/* JENIS PENDAFTARAN */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">Jenis Pendaftaran</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {JENIS.map((j) => (
            <div key={j.title} className="rounded-2xl border p-6 text-center">
              <j.icon className="mx-auto h-10 w-10 text-primary mb-3" />
              <h3 className="font-semibold">{j.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{j.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* GELOMBANG */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">Jadwal Gelombang</h2>
        <p className="text-center text-muted-foreground mb-8">Pendaftaran hanya dapat dilakukan saat gelombang dibuka</p>
        {gelombangs.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Belum ada gelombang pendaftaran yang tersedia saat ini.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {gelombangs.map((g) => {
              const badge = STATUS_BADGE[g.status]
              const dibuka = g.status === "DIBUKA" && new Date() <= g.tanggalTutup
              return (
                <div key={g.id} className="rounded-2xl border p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-lg">{g.nama}</h3>
                      <p className="text-sm text-muted-foreground">
                        {[g.tahunAjaran.nama, g.unit, g.jenjang, g.program].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {badge && <Badge className={badge.cls}>{badge.label}</Badge>}
                  </div>
                  <dl className="mt-4 space-y-1.5 text-sm">
                    <div className="flex gap-2"><dt className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Periode:</dt><dd>{fmt(g.tanggalBuka)} – {fmt(g.tanggalTutup)}</dd></div>
                    <div className="flex gap-2"><dt className="text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" />Kuota:</dt><dd>{g.kuota != null ? `${g.kuota} peserta` : "Tanpa batas"}</dd></div>
                    <div className="flex gap-2"><dt className="text-muted-foreground flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" />Biaya:</dt><dd>{g.biayaDaftar != null ? (g.biayaDaftar === 0 ? "Gratis" : `Rp ${g.biayaDaftar.toLocaleString("id-ID")}`) : "—"} </dd></div>
                  </dl>
                  {g.jadwalSeleksi && <p className="mt-2 text-xs text-muted-foreground">Seleksi: {fmt(g.jadwalSeleksi)}{g.jadwalPengumuman ? ` · Pengumuman: ${fmt(g.jadwalPengumuman)}` : ""}</p>}
                  {g.jalur.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {g.jalur.map((j) => <Badge key={j.id} variant="outline">{j.nama}</Badge>)}
                    </div>
                  )}
                  {dibuka && (
                    <Link href="/ppdb/daftar" className="mt-4 block">
                      <Button className="w-full" size="sm">Daftar Gelombang Ini</Button>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ALUR */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">Alur Pendaftaran</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ALUR.map((a) => (
            <li key={a.no} className="rounded-2xl border p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">{a.no}</div>
              <h3 className="mt-3 font-semibold">{a.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 flex items-center justify-center gap-2">
          <HelpCircle className="h-6 w-6" /> Pertanyaan Umum
        </h2>
        <div className="mx-auto max-w-3xl space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border p-5">
              <summary className="cursor-pointer font-medium flex items-center justify-between">
                {f.q}
                <CheckCircle2 className="h-4 w-4 text-muted-foreground group-open:hidden" />
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* KONTAK */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 text-center">
        <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2"><Phone className="h-5 w-5" /> Kontak Panitia</h2>
        <p className="text-muted-foreground text-sm">Informasi lebih lanjut dapat menghubungi panitia PPDB melalui sekolah.</p>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} PPDB {siteName}</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link href="/" className="hover:underline">Beranda Utama</Link>
          <Link href="/login" className="hover:underline">Masuk</Link>
          <Link href="/ppdb/cek-status" className="hover:underline">Cek Status</Link>
        </div>
      </footer>
    </div>
  )
}
