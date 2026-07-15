import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { NilaiContent } from "./_components/NilaiContent"

export const metadata = {
  title: "Nilai",
}

interface PageProps {
  searchParams: Promise<{ semester?: string }>
}

export default async function NilaiPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { semester } = await searchParams

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!siswa) redirect("/siswa")

  const where: any = { siswaId: siswa.id }
  if (semester) where.semesterId = semester

  const nilais = await prisma.nilai.findMany({
    where,
    include: {
      mataPelajaran: { select: { nama: true } },
      semester: { select: { nama: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const semesters = await prisma.semester.findMany({
    where: { deletedAt: null },
    include: { tahunAjaran: { select: { nama: true } } },
    orderBy: { createdAt: "desc" },
  })

  const semesterOptions = semesters.map((s) => ({
    id: s.id,
    nama: `${s.nama} (${s.tahunAjaran.nama})`,
  }))

  const nilaiData = nilais.map((n) => ({
    id: n.id,
    mapel: n.mataPelajaran.nama,
    semester: n.semester.nama,
    jenis: n.jenis,
    nilai: n.nilai,
    keterangan: n.keterangan,
    tanggal: n.createdAt.toISOString(),
  }))

  const chartData = Object.values(
    nilaiData.reduce(
      (acc, n) => {
        const key = `${n.mapel}-${n.jenis}`
        if (!acc[key]) {
          acc[key] = { label: `${n.mapel} (${n.jenis})`, total: 0, count: 0 }
        }
        acc[key].total += n.nilai
        acc[key].count += 1
        return acc
      },
      {} as Record<string, { label: string; total: number; count: number }>
    )
  ).map((item) => ({ label: item.label, nilai: Math.round(item.total / item.count) }))

  return (
    <NilaiContent
      nilaiData={nilaiData}
      chartData={chartData}
      semesterOptions={semesterOptions}
      selectedSemester={semester ?? ""}
    />
  )
}
