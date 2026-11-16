import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { unstable_cache } from "next/cache"
import { redirect } from "next/navigation"
import { RankingContent } from "./_components/RankingContent"

export const metadata = {
  title: "Ranking",
}

interface PageProps {
  searchParams: Promise<{ kelas?: string; semester?: string }>
}

type BarisRanking = {
  id: string
  nama: string
  kelas: string
  nilaiCount: number
  rataRata: number
  totalWaktu: number
}

/**
 * Ranking satu kelas dihitung ulang untuk SETIAP siswa yang membuka halaman ini.
 * Saat satu kelas membuka bersamaan (pergantian jam), query agregat yang sama
 * menumpuk dan rawan timeout -> galat render. Hasil di-cache 60 detik per
 * (kelas, semester), jadi lonjakan itu hanya memicu satu rangkaian query.
 */
const ambilRankingKelas = unstable_cache(
  async (kelasId: string, semester: string | null): Promise<BarisRanking[]> => {
    const whereKelas: { deletedAt: null; kelasId?: string } = { deletedAt: null }
    if (kelasId) whereKelas.kelasId = kelasId

    const semuaSiswa = await prisma.siswa.findMany({
      where: whereKelas,
      take: 500,
      include: {
        kelas: { select: { nama: true } },
        nilai: {
          where: semester ? { semesterId: semester } : {},
          select: { nilai: true, ujianId: true },
        },
      },
    })

    const siswaIds = semuaSiswa.map((s) => s.id)
    const completedUjianIds = [
      ...new Set(
        semuaSiswa.flatMap((s) => s.nilai.map((n) => n.ujianId).filter((id): id is string => id !== null))
      ),
    ]

    const waktuMap: Record<string, number> = {}
    if (siswaIds.length > 0 && completedUjianIds.length > 0) {
      const jawabanTiming = await prisma.jawabanUjian.groupBy({
        by: ["siswaId", "ujianId"],
        _min: { createdAt: true },
        _max: { updatedAt: true },
        where: { siswaId: { in: siswaIds }, ujianId: { in: completedUjianIds } },
      })
      for (const jt of jawabanTiming) {
        if (jt._min.createdAt && jt._max.updatedAt) {
          waktuMap[jt.siswaId] =
            (waktuMap[jt.siswaId] ?? 0) + (jt._max.updatedAt.getTime() - jt._min.createdAt.getTime())
        }
      }
    }

    return semuaSiswa.map((s) => ({
      id: s.id,
      nama: s.nama,
      kelas: s.kelas?.nama ?? "-",
      nilaiCount: s.nilai.length,
      rataRata: s.nilai.length > 0 ? s.nilai.reduce((sum, n) => sum + n.nilai, 0) / s.nilai.length : 0,
      totalWaktu: waktuMap[s.id] ?? 0,
    }))
  },
  ["ranking-kelas"],
  { revalidate: 60, tags: ["ranking"] }
)

export default async function RankingPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { kelas, semester } = await searchParams

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    include: { kelas: true },
  })
  if (!siswa) redirect("/siswa")

  const kelasId = kelas || siswa.kelasId || ""

  const [dataRanking, kelasList, semesters] = await Promise.all([
    ambilRankingKelas(kelasId, semester ?? null),
    prisma.kelas.findMany({
      where: { deletedAt: null },
      select: { id: true, nama: true },
    }),
    prisma.semester.findMany({
      where: { deletedAt: null },
      include: { tahunAjaran: { select: { nama: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const ranking = dataRanking
    .slice()
    .sort((a, b) => b.rataRata - a.rataRata || a.totalWaktu - b.totalWaktu)
    .map((item, index) => ({
      ...item,
      peringkat: index + 1,
      isCurrentUser: item.id === siswa.id,
    }))

  return (
    <RankingContent
      ranking={ranking}
      kelasList={kelasList}
      semesterOptions={semesters.map((s) => ({
        id: s.id,
        nama: `${s.nama} (${s.tahunAjaran.nama})`,
      }))}
      selectedKelas={kelas ?? ""}
      selectedSemester={semester ?? ""}
    />
  )
}
