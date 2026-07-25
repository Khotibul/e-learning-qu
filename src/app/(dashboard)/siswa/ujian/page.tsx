import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ExamCard } from "../_components/ExamCard"

export const metadata = {
  title: "Ujian",
}

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function UjianListPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { status } = await searchParams

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    select: { id: true, kelasId: true },
  })
  if (!siswa?.kelasId) redirect("/siswa")

  const now = new Date()

  // ── Auto‑transition otomatis exams that have reached their schedule ──
  await prisma.ujian.updateMany({
    where: {
      kelasId: siswa.kelasId, deletedAt: null,
      isLatihan: false,
      mode: "otomatis", status: "DRAFT",
      jamMulai: { lte: now },
    },
    data: { status: "AKTIF" },
  })
  await prisma.ujian.updateMany({
    where: {
      kelasId: siswa.kelasId, deletedAt: null,
      isLatihan: false,
      mode: "otomatis", status: "AKTIF",
      jamSelesai: { lte: now },
    },
    data: { status: "SELESAI" },
  })

  const where: any = {
    kelasId: siswa.kelasId,
    isLatihan: false,
    deletedAt: null,
  }
  if (status && status !== "SEMUA") {
    where.status = status
  }

  const ujians = await prisma.ujian.findMany({
    where,
    select: {
      id: true,
      nama: true,
      durasi: true,
      tanggal: true,
      jumlahSoal: true,
      status: true,
      nilaiMinimum: true,
      bisaRetake: true,
      mataPelajaran: { select: { nama: true } },
      kelas: { select: { nama: true } },
      semester: { select: { nama: true } },
    },
    orderBy: { tanggal: "desc" },
  })

  const sudahDikerjakanSet = new Set(
    (
      await prisma.jawabanUjian.findMany({
        where: { ujianId: { in: ujians.map((u) => u.id) }, siswaId: siswa.id },
        select: { ujianId: true },
        distinct: ["ujianId"],
      })
    ).map((j) => j.ujianId)
  )

  const filterOptions = ["SEMUA", "AKTIF", "DRAFT", "SELESAI"]
  const statusLabels: Record<string, string> = {
    SEMUA: "Semua",
    AKTIF: "Aktif",
    DRAFT: "Draft",
    SELESAI: "Selesai",
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ujian</h1>
          <p className="text-muted-foreground">Daftar ujian yang tersedia</p>
        </div>
        <div className="flex gap-2">
          {filterOptions.map((opt) => (
            <a
              key={opt}
              href={opt === "SEMUA" ? "/siswa/ujian" : `/siswa/ujian?status=${opt}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                (status ?? "SEMUA") === opt
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {statusLabels[opt]}
            </a>
          ))}
        </div>
      </div>

      {ujians.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Ujian belum dimulai</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ujians.map((ujian) => (
            <ExamCard
              key={ujian.id}
              id={ujian.id}
              nama={ujian.nama}
              mapel={ujian.mataPelajaran.nama}
              kelas={ujian.kelas.nama}
              tanggal={ujian.tanggal.toISOString()}
              durasi={ujian.durasi}
              status={ujian.status}
              sudahDikerjakan={sudahDikerjakanSet.has(ujian.id)}
              jumlahSoal={ujian.jumlahSoal}
              nilaiMinimum={ujian.nilaiMinimum}
              bisaRetake={ujian.bisaRetake}
            />
          ))}
        </div>
      )}
    </div>
  )
}
