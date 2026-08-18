import { prisma } from "@/lib/prisma"

const MASTERY_THRESHOLDS = {
  BEGINNER: 0,
  BASIC: 20,
  DEVELOPING: 40,
  PROFICIENT: 65,
  ADVANCED: 85,
} as const

function computeMasteryScore(params: {
  jumlahSoalBenar: number
  jumlahSoalSalah: number
  jumlahLatihan: number
  rataNilai: number
  jumlahMateri: number
}): number {
  const { jumlahSoalBenar, jumlahSoalSalah, jumlahLatihan, rataNilai, jumlahMateri } = params
  const totalSoal = jumlahSoalBenar + jumlahSoalSalah
  const akurasi = totalSoal > 0 ? (jumlahSoalBenar / totalSoal) * 100 : 0
  const nilaiComponent = rataNilai * 0.4
  const akurasiComponent = akurasi * 0.35
  const practiceComponent = Math.min(jumlahLatihan / 10, 1) * 100 * 0.15
  const materiComponent = Math.min(jumlahMateri / 5, 1) * 100 * 0.1
  return Math.round(nilaiComponent + akurasiComponent + practiceComponent + materiComponent)
}

function skorToKategori(skor: number): "BEGINNER" | "BASIC" | "DEVELOPING" | "PROFICIENT" | "ADVANCED" {
  if (skor >= MASTERY_THRESHOLDS.ADVANCED) return "ADVANCED"
  if (skor >= MASTERY_THRESHOLDS.PROFICIENT) return "PROFICIENT"
  if (skor >= MASTERY_THRESHOLDS.DEVELOPING) return "DEVELOPING"
  if (skor >= MASTERY_THRESHOLDS.BASIC) return "BASIC"
  return "BEGINNER"
}

export async function updatePenguasaanAfterUjian(siswaId: string, ujianId: string) {
  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    include: {
      ujianSoal: {
        include: { soal: { select: { kompetensiId: true, mataPelajaranId: true } } },
      },
    },
  })
  if (!ujian) return

  const kompetensiIds = [...new Set(ujian.ujianSoal.map((us) => us.soal.kompetensiId).filter(Boolean))] as string[]

  const jawabans = await prisma.jawabanUjian.findMany({
    where: { ujianId, siswaId },
    include: { soal: { select: { kompetensiId: true } } },
  })

  for (const kid of kompetensiIds) {
    const relevant = jawabans.filter((j) => j.soal.kompetensiId === kid)
    const benar = relevant.filter((j) => j.isCorrect === true).length
    const salah = relevant.filter((j) => j.isCorrect === false).length

    const existing = await prisma.penguasaanKompetensi.findUnique({
      where: { siswaId_kompetensiId: { siswaId, kompetensiId: kid } },
    })

    const prevBenar = existing?.jumlahSoalBenar ?? 0
    const prevSalah = existing?.jumlahSoalSalah ?? 0
    const prevLatihan = existing?.jumlahLatihan ?? 0
    const prevChat = existing?.jumlahChat ?? 0
    const prevMateri = existing?.jumlahMateri ?? 0
    const prevNilai = existing?.jumlahNilai ?? 0
    const prevRataNilai = existing?.rataNilaiMapel ?? 0

    const newNilaiCount = prevNilai + 1
    const nilai = await prisma.nilai.findFirst({
      where: { siswaId, ujianId, deletedAt: null },
      select: { nilai: true },
    })
    const newRataNilai = prevNilai === 0 ? (nilai?.nilai ?? 0) : (prevRataNilai * prevNilai + (nilai?.nilai ?? 0)) / newNilaiCount

    const skor = computeMasteryScore({
      jumlahSoalBenar: prevBenar + benar,
      jumlahSoalSalah: prevSalah + salah,
      jumlahLatihan: prevLatihan,
      rataNilai: newRataNilai,
      jumlahMateri: prevMateri,
    })
    const kategori = skorToKategori(skor)

    await prisma.penguasaanKompetensi.upsert({
      where: { siswaId_kompetensiId: { siswaId, kompetensiId: kid } },
      create: {
        siswaId,
        kompetensiId: kid,
        skor,
        kategori,
        jumlahSoalBenar: benar,
        jumlahSoalSalah: salah,
        jumlahNilai: 1,
        rataNilaiMapel: newRataNilai,
        terakhirDinilai: new Date(),
      },
      update: {
        skor,
        kategori,
        jumlahSoalBenar: prevBenar + benar,
        jumlahSoalSalah: prevSalah + salah,
        jumlahNilai: newNilaiCount,
        rataNilaiMapel: newRataNilai,
        terakhirDinilai: new Date(),
      },
    })
  }
}

export async function updatePenguasaanAfterChat(siswaId: string, kompetensiId: string | null) {
  if (!kompetensiId) return
  await prisma.penguasaanKompetensi.upsert({
    where: { siswaId_kompetensiId: { siswaId, kompetensiId } },
    create: { siswaId, kompetensiId, jumlahChat: 1 },
    update: { jumlahChat: { increment: 1 } },
  })
}

export async function updatePenguasaanAfterLatihan(siswaId: string, materiId: string, skor: number) {
  const materi = await prisma.materi.findUnique({
    where: { id: materiId },
    select: { kompetensiId: true },
  })
  if (!materi?.kompetensiId) return
  const benar = skor >= 75 ? 1 : 0
  const salah = skor < 75 ? 1 : 0
  await prisma.penguasaanKompetensi.upsert({
    where: { siswaId_kompetensiId: { siswaId, kompetensiId: materi.kompetensiId } },
    create: {
      siswaId,
      kompetensiId: materi.kompetensiId,
      jumlahLatihan: 1,
      jumlahSoalBenar: benar,
      jumlahSoalSalah: salah,
    },
    update: {
      jumlahLatihan: { increment: 1 },
      jumlahSoalBenar: { increment: benar },
      jumlahSoalSalah: { increment: salah },
    },
  })
}

export async function updatePenguasaanAfterMateri(siswaId: string, materiId: string) {
  const materi = await prisma.materi.findUnique({
    where: { id: materiId },
    select: { kompetensiId: true },
  })
  if (!materi?.kompetensiId) return
  await prisma.penguasaanKompetensi.upsert({
    where: { siswaId_kompetensiId: { siswaId, kompetensiId: materi.kompetensiId } },
    create: { siswaId, kompetensiId: materi.kompetensiId, jumlahMateri: 1 },
    update: { jumlahMateri: { increment: 1 } },
  })
}

export async function getPenguasaanOverview(siswaId: string) {
  const penguasaan = await prisma.penguasaanKompetensi.findMany({
    where: { siswaId },
    include: { kompetensi: { select: { kode: true, nama: true, mataPelajaran: { select: { nama: true } } } } },
    orderBy: { skor: "desc" },
  })

  const distribusi = { BEGINNER: 0, BASIC: 0, DEVELOPING: 0, PROFICIENT: 0, ADVANCED: 0 }
  for (const p of penguasaan) distribusi[p.kategori]++

  return {
    penguasaan: penguasaan.map((p) => ({
      id: p.id,
      kompetensi: p.kompetensi.nama,
      kode: p.kompetensi.kode,
      mapel: p.kompetensi.mataPelajaran?.nama ?? "-",
      skor: p.skor,
      kategori: p.kategori,
      benar: p.jumlahSoalBenar,
      salah: p.jumlahSoalSalah,
      terakhirDinilai: p.terakhirDinilai,
    })),
    distribusi,
    total: penguasaan.length,
    rataSkor: penguasaan.length > 0
      ? Math.round(penguasaan.reduce((s, p) => s + p.skor, 0) / penguasaan.length)
      : 0,
  }
}
