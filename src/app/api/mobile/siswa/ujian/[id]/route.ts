import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const { id } = await params

    const ujian = await prisma.ujian.findUnique({
      where: { id },
      include: {
        mataPelajaran: { select: { nama: true } },
        ujianSoal: { orderBy: { nomor: "asc" }, include: { soal: true } },
      },
    })

    if (!ujian) return NextResponse.json({ error: "Ujian not found" }, { status: 404, headers: corsHeaders })

    if (ujian.mode === "otomatis") {
      const now = new Date()
      if (ujian.status === "DRAFT" && now >= new Date(ujian.jamMulai)) {
        await prisma.ujian.update({ where: { id: ujian.id }, data: { status: "AKTIF" } })
        ujian.status = "AKTIF" as never
      }
      if (ujian.status === "AKTIF" && now >= new Date(ujian.jamSelesai)) {
        await prisma.ujian.update({ where: { id: ujian.id }, data: { status: "SELESAI" } })
        ujian.status = "SELESAI" as never
      }
    }

    const subSoalItem = (s: unknown) => {
      if (!s) return []
      const arr = Array.isArray(s) ? s as unknown[] : []
      return arr.filter((a: unknown) => (a as { pertanyaan?: string })?.pertanyaan?.trim())
    }

    let flatNomor = 0
    const soal: unknown[] = []
    const parentMap: Record<number, { soalId: string; subIdx: number }> = {}

    for (const us of ujian.ujianSoal) {
      const subs = subSoalItem((us.soal as unknown as { subSoal: unknown }).subSoal)
      if (subs.length > 0) {
        for (let i = 0; i < subs.length; i++) {
          flatNomor++
          const sub = subs[i] as { pertanyaan: string; jenis?: string; poin?: number; pilihanGanda?: unknown; trueFalse?: boolean | null }
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

    return NextResponse.json({
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
      bisaRetake: ujian.bisaRetake,
      maxTabSwitch: ujian.maxTabSwitch,
      maxCheatingScore: ujian.maxCheatingScore,
      soal,
      parentMap,
    }, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile ujian detail error:", e)
    return NextResponse.json({ error: "Gagal memuat ujian" }, { status: 500, headers: corsHeaders })
  }
}
