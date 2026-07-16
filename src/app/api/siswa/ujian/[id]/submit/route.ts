import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { answers, raguRagu } = await req.json()

    const siswa = await prisma.siswa.findUnique({
      where: { userId: session.user.id },
    })

    if (!siswa) {
      return NextResponse.json({ error: "Siswa not found" }, { status: 404 })
    }

    const ujian = await prisma.ujian.findUnique({
      where: { id },
      include: {
        ujianSoal: {
          include: { soal: true },
        },
      },
    })

    if (!ujian) {
      return NextResponse.json({ error: "Ujian not found" }, { status: 404 })
    }

    if (answers && typeof answers === "object") {
      for (const [soalId, jawaban] of Object.entries(answers)) {
        await prisma.jawabanUjian.upsert({
          where: {
            ujianId_siswaId_soalId: {
              ujianId: id,
              siswaId: siswa.id,
              soalId,
            },
          },
          update: {
            jawaban: jawaban as string,
            raguRagu: Array.isArray(raguRagu) && raguRagu.includes(soalId),
          },
          create: {
            ujianId: id,
            siswaId: siswa.id,
            soalId,
            jawaban: jawaban as string,
            raguRagu: Array.isArray(raguRagu) && raguRagu.includes(soalId),
          },
        })
      }
    }

    const jawabans = await prisma.jawabanUjian.findMany({
      where: { ujianId: id, siswaId: siswa.id },
    })

    let totalPoin = 0
    let perolehPoin = 0
    const hasilSoal: {
      nomor: number
      jawaban: string | null
      jawabanBenar: string
      isCorrect: boolean
      poin: number
    }[] = []

    for (const us of ujian.ujianSoal) {
      const jawab = jawabans.find((j) => j.soalId === us.soal.id)
      const jawabanUser = jawab?.jawaban ?? ""
      const subSoal = us.soal.subSoal as { pertanyaan: string; jawaban: string; poin: number }[] | null
      const hasSub = subSoal && subSoal.length > 0 && subSoal.some((s) => s.pertanyaan.trim())

      if (hasSub) {
        let subUser: string[] = []
        try { const p = JSON.parse(jawabanUser); if (Array.isArray(p)) subUser = p } catch { subUser = [] }
        let subPoin = 0
        let subTotal = 0
        for (let i = 0; i < subSoal.length; i++) {
          const s = subSoal[i]
          const userAns = subUser[i]?.trim() ?? ""
          const correct = userAns.toLowerCase() === s.jawaban.toLowerCase().trim()
          subTotal += s.poin
          if (correct) subPoin += s.poin
        }
        totalPoin += subTotal
        perolehPoin += subPoin
        const allCorrect = subPoin === subTotal
        if (jawab) {
          await prisma.jawabanUjian.update({
            where: { id: jawab.id },
            data: { isCorrect: allCorrect, poin: subPoin },
          })
        }
        hasilSoal.push({
          nomor: us.nomor,
          jawaban: jawabanUser,
          jawabanBenar: JSON.stringify(subSoal.map((s) => s.jawaban)),
          isCorrect: allCorrect,
          poin: subPoin,
        })
      } else {
        const jawabanBenar = us.soal.jawaban
        const poin = us.soal.poin
        totalPoin += poin

        let isCorrect = false
        if (us.soal.jenisSoal === "PILIHAN_GANDA" || us.soal.jenisSoal === "TRUE_FALSE") {
          isCorrect = jawabanUser === jawabanBenar
        } else if (us.soal.jenisSoal === "ISIAN_SINGKAT") {
          isCorrect = jawabanUser.toLowerCase().trim() === jawabanBenar.toLowerCase().trim()
        } else {
          isCorrect = jawabanUser.trim() === jawabanBenar.trim()
        }

        if (isCorrect) {
          perolehPoin += poin
        }

        if (jawab) {
          await prisma.jawabanUjian.update({
            where: { id: jawab.id },
            data: { isCorrect, poin: isCorrect ? poin : 0 },
          })
        }

        hasilSoal.push({
          nomor: us.nomor,
          jawaban: jawabanUser,
          jawabanBenar,
          isCorrect,
          poin,
        })
      }
    }

    const nilaiAkhir = totalPoin > 0 ? Math.round((perolehPoin / totalPoin) * 100) : 0

    await prisma.nilai.create({
      data: {
        siswaId: siswa.id,
        ujianId: ujian.id,
        mataPelajaranId: ujian.mataPelajaranId,
        semesterId: ujian.semesterId,
        nilai: nilaiAkhir,
        jenis: ujian.isLatihan ? "LATIHAN" : "UJIAN",
        keterangan: `Nilai ${ujian.nama}`,
      },
    })

    return NextResponse.json({
      nilai: nilaiAkhir,
      totalPoin,
      perolehPoin,
      jumlahSoal: ujian.jumlahSoal,
      jumlahBenar: hasilSoal.filter((h) => h.isCorrect).length,
      hasilSoal,
    })
  } catch (error) {
    console.error("Error submitting ujian:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
