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

    const data = {
      id: ujian.id,
      nama: ujian.nama,
      mapel: ujian.mataPelajaran.nama,
      durasi: ujian.durasi,
      jumlahSoal: ujian.jumlahSoal,
      fullscreen: ujian.fullscreen,
      disableCopy: ujian.disableCopy,
      disablePaste: ujian.disablePaste,
      randomSoal: ujian.randomSoal,
      randomJawaban: ujian.randomJawaban,
      nilaiMinimum: ujian.nilaiMinimum,
      status: ujian.status,
      soal: ujian.ujianSoal.map((us) => ({
        id: us.soal.id,
        nomor: us.nomor,
        pertanyaan: us.soal.pertanyaan,
        subSoal: us.soal.subSoal as { pertanyaan: string; jawaban: string; poin: number }[] | null,
        gambar: us.soal.gambar,
        jenisSoal: us.soal.jenisSoal,
        tingkatKesulitan: us.soal.tingkatKesulitan,
        pilihanGanda: us.soal.pilihanGanda as { label: string; value: string }[] | null,
        poin: us.soal.poin,
      })),
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching ujian:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
