import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { RankingContent } from "./_components/RankingContent"

export const metadata = {
  title: "Ranking",
}

interface PageProps {
  searchParams: Promise<{ kelas?: string; semester?: string }>
}

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
  const whereKelas: any = {
    kelasId: kelasId,
    deletedAt: null,
  }

  const semuaSiswa = await prisma.siswa.findMany({
    where: whereKelas,
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
    ...new Set(semuaSiswa.flatMap((s) => s.nilai.map((n) => n.ujianId).filter((id): id is string => id !== null))),
  ]

  let waktuMap: Record<string, number> = {}
  if (completedUjianIds.length > 0) {
    const jawabanTiming = await prisma.jawabanUjian.groupBy({
      by: ["siswaId", "ujianId"],
      _min: { createdAt: true },
      _max: { updatedAt: true },
      where: { siswaId: { in: siswaIds }, ujianId: { in: completedUjianIds } },
    })
    for (const jt of jawabanTiming) {
      if (jt._min.createdAt && jt._max.updatedAt) {
        const diffMs = jt._max.updatedAt.getTime() - jt._min.createdAt.getTime()
        waktuMap[jt.siswaId] = (waktuMap[jt.siswaId] ?? 0) + diffMs
      }
    }
  }

  const kelasList = await prisma.kelas.findMany({
    where: { deletedAt: null },
    select: { id: true, nama: true },
  })

  const semesters = await prisma.semester.findMany({
    where: { deletedAt: null },
    include: { tahunAjaran: { select: { nama: true } } },
    orderBy: { createdAt: "desc" },
  })

  const ranking = semuaSiswa
    .map((s) => ({
      id: s.id,
      nama: s.nama,
      kelas: s.kelas?.nama ?? "-",
      nilaiCount: s.nilai.length,
      rataRata:
        s.nilai.length > 0
          ? s.nilai.reduce((sum, n) => sum + n.nilai, 0) / s.nilai.length
          : 0,
      totalWaktu: waktuMap[s.id] ?? 0,
    }))
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
