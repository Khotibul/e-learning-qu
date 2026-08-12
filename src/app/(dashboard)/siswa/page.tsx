import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { BookOpen, Brain, FileText, Megaphone } from "lucide-react"
import { StatCard } from "./_components/StatCard"
import { PengumumanList } from "./_components/PengumumanList"
import RekomendasiAI from "./_components/RekomendasiAI"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const metadata = {
  title: "Dashboard Siswa",
}

async function getDashboardData() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    include: { kelas: true },
  })
  if (!siswa) redirect("/login")

  const activeSemester = await prisma.semester.findFirst({
    where: { isAktif: true },
    include: { tahunAjaran: true },
  })

  const avgNilai = await prisma.nilai.aggregate({
    where: { siswaId: siswa.id },
    _avg: { nilai: true },
  })

  const [ujianAktif, tugasAktif] = !siswa.kelasId
    ? [0, 0]
    : await Promise.all([
        prisma.ujian.count({
          where: { kelasId: siswa.kelasId, isLatihan: false, status: "AKTIF", deletedAt: null },
        }),
        prisma.ujian.count({
          where: { kelasId: siswa.kelasId, isLatihan: true, status: "AKTIF", deletedAt: null },
        }),
      ])

  const pengumuman = await prisma.pengumuman.findMany({
    where: {
      OR: [{ kelasId: siswa.kelasId }, { tipe: "UMUM" }],
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { user: { select: { name: true } } },
  })

  return {
    nama: siswa.nama,
    kelas: siswa.kelas?.nama ?? "-",
    semester: activeSemester
      ? `${activeSemester.nama} (${activeSemester.tahunAjaran.nama})`
      : "-",
    nilaiRataRata: avgNilai._avg.nilai ?? 0,
    ujianAktif,
    tugasAktif,
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
          {data.kelas} &middot; {data.semester}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Nilai Rata-rata"
          value={data.nilaiRataRata.toFixed(1)}
          icon={<Brain className="h-6 w-6" />}
          trend={data.nilaiRataRata >= 75 ? "up" : "down"}
          description="Rata-rata semua nilai"
        />
        <StatCard
          title="Ujian Aktif"
          value={data.ujianAktif}
          icon={<FileText className="h-6 w-6" />}
          trend={data.ujianAktif > 0 ? "up" : "neutral"}
          description="Ujian yang tersedia"
        />
        <StatCard
          title="Tugas Aktif"
          value={data.tugasAktif}
          icon={<BookOpen className="h-6 w-6" />}
          trend={data.tugasAktif > 0 ? "up" : "neutral"}
          description="Latihan yang tersedia"
        />
        <StatCard
          title="Pengumuman"
          value={data.pengumuman.length}
          icon={<Megaphone className="h-6 w-6" />}
          description="Pengumuman terbaru"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <PengumumanList items={data.pengumuman} />
          <RekomendasiAI />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informasi Akademik</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Kelas</p>
                <p className="text-lg font-bold">{data.kelas}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Semester</p>
                <p className="text-lg font-bold">{data.semester}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Nilai Rata-rata</p>
                <p className="text-lg font-bold">{data.nilaiRataRata.toFixed(1)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total Ujian & Tugas</p>
                <p className="text-lg font-bold">{data.ujianAktif + data.tugasAktif}</p>
              </div>
            </div>
            <Separator />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Selamat datang di portal E-Learning. Anda dapat mengakses ujian, latihan, dan melihat nilai Anda di sini.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
