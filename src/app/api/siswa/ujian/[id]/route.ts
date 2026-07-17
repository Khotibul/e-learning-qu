import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const ujian = await prisma.ujian.findUnique({
      where: { id },
      include: {
        mataPelajaran: { select: { nama: true } },
        ujianSoal: {
          orderBy: { nomor: "asc" },
          include: {
            soal: true,
          },
        },
      },
    })

    if (!ujian) {
      return NextResponse.json({ error: "Ujian not found" }, { status: 404 })
    }

    const subSoalItem = (s: any) => {
      if (!s) return []
      const arr = Array.isArray(s) ? s : []
      return arr.filter((a: any) => a.pertanyaan?.trim())
    }

    let flatNomor = 0
    const soal: any[] = []
    const parentMap: Record<number, { soalId: string; subIdx: number }> = {}

    for (const us of ujian.ujianSoal) {
      const subs = subSoalItem(us.soal.subSoal)
      if (subs.length > 0) {
        for (let i = 0; i < subs.length; i++) {
          flatNomor++
          const sub = subs[i]
          soal.push({
            id: `${us.soal.id}::sub::${i}`,
            nomor: flatNomor,
            pertanyaan: sub.pertanyaan,
            jenisSoal: sub.jenis || "ISIAN_SINGKAT",
            tingkatKesulitan: us.soal.tingkatKesulitan,
            poin: sub.poin || 1,
            pilihanGanda: sub.pilihanGanda || null,
            trueFalse: sub.trueFalse ?? null,
            soalInduk: us.soal.pertanyaan,
          })
          parentMap[flatNomor] = { soalId: us.soal.id, subIdx: i }
        }
      } else {
        flatNomor++
        soal.push({
          id: us.soal.id,
          nomor: flatNomor,
          pertanyaan: us.soal.pertanyaan,
          jenisSoal: us.soal.jenisSoal,
          tingkatKesulitan: us.soal.tingkatKesulitan,
          poin: us.soal.poin,
          pilihanGanda: us.soal.pilihanGanda as { label: string; text: string }[] | null,
          trueFalse: us.soal.trueFalse ?? null,
        })
      }
    }

    const data = {
      id: ujian.id,
      nama: ujian.nama,
      mapel: ujian.mataPelajaran.nama,
      durasi: ujian.durasi,
      jumlahSoal: flatNomor,
      fullscreen: ujian.fullscreen,
      disableCopy: ujian.disableCopy,
      disablePaste: ujian.disablePaste,
      randomSoal: ujian.randomSoal,
      randomJawaban: ujian.randomJawaban,
      nilaiMinimum: ujian.nilaiMinimum,
      status: ujian.status,
      soal,
      parentMap,
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching ujian:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
