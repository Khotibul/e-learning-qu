import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { BookOpen, Brain, FileText, Megaphone, Trophy, Target, Clock, Flame, TrendingUp, TrendingDown, Lightbulb, GraduationCap } from "lucide-react"
import { StatCard } from "./_components/StatCard"
import { PengumumanList } from "./_components/PengumumanList"
import RekomendasiAI from "./_components/RekomendasiAI"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

export const metadata = {
  title: "Dashboard Siswa",
}

async function getDashboardData() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    include: { kelas: true, jurusan: true },
  })
  if (!siswa) redirect("/login")

  const activeSemester = await prisma.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  })

  const [avgNilai, ujianAktif, tugasAktif, pengumuman, penguasaanList, latihanStats, learningActivities, nextUjian, learningPaths] = await Promise.all([
    prisma.nilai.aggregate({ where: { siswaId: siswa.id }, _avg: { nilai: true } }),
    siswa.kelasId ? prisma.ujian.count({ where: { kelasId: siswa.kelasId, isLatihan: false, status: "AKTIF", deletedAt: null } }) : Promise.resolve(0),
    siswa.kelasId ? prisma.ujian.count({ where: { kelasId: siswa.kelasId, isLatihan: true, status: "AKTIF", deletedAt: null } }) : Promise.resolve(0),
    prisma.pengumuman.findMany({
      where: { OR: [{ kelasId: siswa.kelasId }, { tipe: "UMUM" }], deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } } },
    }),
    prisma.penguasaanKompetensi.findMany({
      where: { siswaId: siswa.id },
      include: { kompetensi: { select: { nama: true, mataPelajaran: { select: { nama: true } } } } },
    }),
    prisma.latihanAI.aggregate({ where: { siswaId: siswa.id }, _avg: { skor: true }, _count: { _all: true } }),
    prisma.learningActivity.findMany({ where: { siswaId: siswa.id }, select: { jenis: true, createdAt: true, durationMs: true }, orderBy: { createdAt: "desc" } }),
    siswa.kelasId ? prisma.ujian.findFirst({
      where: { kelasId: siswa.kelasId, isLatihan: false, status: "AKTIF", deletedAt: null },
      select: { id: true, nama: true, mataPelajaran: { select: { nama: true } }, jamSelesai: true },
      orderBy: { jamSelesai: "asc" },
    }) : Promise.resolve(null),
    prisma.learningPath.findMany({ where: { siswaId: siswa.id }, select: { progres: true } }),
  ])

  const nilaiRataRata = avgNilai._avg.nilai ?? 0

  const rataMastery = penguasaanList.length > 0
    ? Math.round(penguasaanList.reduce((sum, p) => sum + p.skor, 0) / penguasaanList.length)
    : 0

  const kompetensiTerkuat = penguasaanList.length > 0
    ? penguasaanList.reduce((best, p) => p.skor > best.skor ? p : best)
    : null

  const kompetensiTerlemah = penguasaanList.length > 0
    ? penguasaanList.reduce((worst, p) => p.skor < worst.skor ? p : worst)
    : null

  const totalDurationMs = learningActivities.reduce((sum, a) => sum + (a.durationMs ?? 0), 0)
  const jamBelajar = Math.round(totalDurationMs / (1000 * 60 * 60) * 10) / 10

  const today = new Date()
  const activityDates = new Set(
    learningActivities
      .filter((a) => a.jenis !== "LOGIN" && a.jenis !== "LOGOUT")
      .map((a) => a.createdAt.toISOString().slice(0, 10))
  )
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (activityDates.has(key)) {
      streak++
    } else if (i > 0) {
      break
    }
  }

  const progresBelajar = learningPaths.length > 0
    ? Math.round(learningPaths.reduce((sum, lp) => sum + (lp.progres ?? 0), 0) / learningPaths.length)
    : 0

  const jurusanNama = (siswa as any).jurusan?.nama ?? "-"

  const totalMateri = siswa.kelasId
    ? await prisma.materi.count({ where: { deletedAt: null, mataPelajaran: { pengajaran: { some: { kelasId: siswa.kelasId } } } } })
    : await prisma.materi.count({ where: { deletedAt: null } })

  let aiInsight = "Mulai belajar untuk melihat insight AI."
  if (streak >= 7) aiInsight = `Kamu sudah aktif ${streak} hari berturut-turut. Pertahankan!`
  else if (rataMastery < 40) aiInsight = "Mastery masih rendah. Fokus ke materi dasar dan sering latihan."
  else if (nilaiRataRata >= 80) aiInsight = "Nilaimu bagus! Coba tantang diri dengan materi lebih lanjut."
  else if (kompetensiTerlemah && kompetensiTerlemah.skor < 40) aiInsight = `Perlu perhatian pada "${kompetensiTerlemah.kompetensi.nama}" (mastery ${kompetensiTerlemah.skor}%).`

  return {
    nama: siswa.nama,
    kelas: siswa.kelas?.nama ?? "-",
    jurusan: jurusanNama,
    semester: activeSemester ? `${activeSemester.nama} (${activeSemester.tahunAjaran.nama})` : "-",
    nilaiRataRata,
    rataMastery,
    ujianAktif,
    tugasAktif,
    streak,
    jamBelajar,
    progresBelajar,
    totalMateri,
    kompetensiTerkuat: kompetensiTerkuat ? { nama: kompetensiTerkuat.kompetensi.nama, skor: kompetensiTerkuat.skor, mapel: kompetensiTerkuat.kompetensi.mataPelajaran?.nama ?? "" } : null,
    kompetensiTerlemah: kompetensiTerlemah ? { nama: kompetensiTerlemah.kompetensi.nama, skor: kompetensiTerlemah.skor, mapel: kompetensiTerlemah.kompetensi.mataPelajaran?.nama ?? "" } : null,
    nextUjian: nextUjian ? { nama: nextUjian.nama, mapel: nextUjian.mataPelajaran?.nama ?? "", berakhir: nextUjian.jamSelesai?.toISOString() ?? null } : null,
    aiInsight,
    pengumuman: pengumuman.map((p) => ({
      id: p.id,
      judul: p.judul,
      isi: p.isi,
      createdAt: p.createdAt.toISOString(),
      author: p.user.name ?? "-",
    })),
  }
}

export default async function SiswaDashboardPage() {
  const data = await getDashboardData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Hallo, {data.nama}!
        </h1>
        <p className="text-muted-foreground">
          {data.kelas} &middot; {data.jurusan} &middot; {data.semester}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Nilai Rata-rata" value={data.nilaiRataRata.toFixed(1)} icon={<Brain className="h-6 w-6" />} trend={data.nilaiRataRata >= 75 ? "up" : "down"} description="Rata-rata semua nilai" />
        <StatCard title="Mastery Rata-rata" value={`${data.rataMastery}%`} icon={<Target className="h-6 w-6" />} trend={data.rataMastery >= 60 ? "up" : "down"} description="Penguasaan kompetensi" />
        <StatCard title="Learning Streak" value={`${data.streak} hari`} icon={<Flame className="h-6 w-6" />} trend={data.streak >= 7 ? "up" : data.streak >= 3 ? "neutral" : "down"} description="Belajar berturut-turut" />
        <StatCard title="Waktu Belajar" value={`${data.jamBelajar}j`} icon={<Clock className="h-6 w-6" />} description="Total jam belajar" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Ujian Aktif" value={data.ujianAktif} icon={<FileText className="h-6 w-6" />} trend={data.ujianAktif > 0 ? "up" : "neutral"} description="Ujian tersedia" />
        <StatCard title="Latihan Aktif" value={data.tugasAktif} icon={<BookOpen className="h-6 w-6" />} trend={data.tugasAktif > 0 ? "up" : "neutral"} description="Latihan tersedia" />
        <StatCard title="Progres Belajar" value={`${data.progresBelajar}%`} icon={<GraduationCap className="h-6 w-6" />} description="Progres learning path" />
        <StatCard title="Materi Tersedia" value={data.totalMateri} icon={<BookOpen className="h-6 w-6" />} description="Total materi di kelas" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PengumumanList items={data.pengumuman} />
          <RekomendasiAI />

          {data.nextUjian && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Ujian Berikutnya
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <p className="font-medium">{data.nextUjian.nama}</p>
                    <p className="text-sm text-muted-foreground">{data.nextUjian.mapel}</p>
                  </div>
                  {data.nextUjian.berakhir && (
                    <Badge variant="outline">{new Date(data.nextUjian.berakhir).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                AI Learning Insight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{data.aiInsight}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Kompetensi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.kompetensiTerkuat ? (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Terkuat
                  </div>
                  <p className="font-medium mt-1">{data.kompetensiTerkuat.nama}</p>
                  <p className="text-xs text-muted-foreground">{data.kompetensiTerkuat.mapel} &middot; {data.kompetensiTerkuat.skor}%</p>
                </div>
              ) : (
                <div className="rounded-lg border p-3 text-sm text-muted-foreground">Belum ada data kompetensi</div>
              )}
              {data.kompetensiTerlemah && data.kompetensiTerlemah.nama !== data.kompetensiTerkuat?.nama && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    Perlu Diperhatikan
                  </div>
                  <p className="font-medium mt-1">{data.kompetensiTerlemah.nama}</p>
                  <p className="text-xs text-muted-foreground">{data.kompetensiTerlemah.mapel} &middot; {data.kompetensiTerlemah.skor}%</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Ringkasan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Kelas</span><span className="font-medium">{data.kelas}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Jurusan</span><span className="font-medium">{data.jurusan}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Nilai Rata-rata</span><span className="font-medium">{data.nilaiRataRata.toFixed(1)}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Mastery Rata-rata</span><span className="font-medium">{data.rataMastery}%</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Streak</span><span className="font-medium">{data.streak} hari</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Waktu Belajar</span><span className="font-medium">{data.jamBelajar} jam</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
