import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { LatihanCard } from "../_components/LatihanCard"

export const metadata = {
  title: "Latihan",
}

export default async function LatihanListPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const siswa = await prisma.siswa.findUnique({
    where: { userId: session.user.id },
    select: { id: true, kelasId: true },
  })
  if (!siswa?.kelasId) redirect("/siswa")

  const latihans = await prisma.ujian.findMany({
    where: {
      kelasId: siswa.kelasId,
      isLatihan: true,
      status: "AKTIF",
      deletedAt: null,
    },
    include: {
      mataPelajaran: { select: { nama: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const sudahDikerjakanSet = new Set(
    (
      await prisma.jawabanUjian.findMany({
        where: { ujianId: { in: latihans.map((l) => l.id) }, siswaId: siswa.id },
        select: { ujianId: true },
        distinct: ["ujianId"],
      })
    ).map((j) => j.ujianId)
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Latihan</h1>
        <p className="text-muted-foreground">Latihan soal untuk meningkatkan pemahaman</p>
      </div>

      {latihans.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Latihan belum dimulai</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {latihans.map((latihan) => (
            <LatihanCard
              key={latihan.id}
              id={latihan.id}
              nama={latihan.nama}
              mapel={latihan.mataPelajaran.nama}
              jumlahSoal={latihan.jumlahSoal}
              durasi={latihan.durasi}
              sudahDikerjakan={sudahDikerjakanSet.has(latihan.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
