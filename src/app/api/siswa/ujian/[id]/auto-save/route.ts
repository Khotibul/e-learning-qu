import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { isAssessmentLocked } from "@/lib/assessment-guard"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

const SUB_RE = /^(.+)::sub::(\d+)$/

function subSoalItem(s: any) {
  if (!s) return []
  const arr = Array.isArray(s) ? s : []
  return arr.filter((a: any) => a.pertanyaan?.trim())
}

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

    const rl = rateLimit(`autosave:${getClientIp(req)}:${siswa.id}:${id}`, 120, 60000)
    if (!rl.success) {
      return NextResponse.json({ error: "Terlalu banyak permintaan" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    // Regroup flattened sub-answers into parent soal JSON arrays
    const subBuckets: Record<string, Record<number, string>> = {}
    const directAnswers: Record<string, string> = {}

    if (answers && typeof answers === "object") {
      for (const [key, val] of Object.entries(answers)) {
        const m = key.match(SUB_RE)
        if (m) {
          const parentId = m[1]
          const subIdx = parseInt(m[2])
          if (!subBuckets[parentId]) subBuckets[parentId] = {}
          subBuckets[parentId][subIdx] = val as string
        } else {
          directAnswers[key] = val as string
        }
      }
    }

    const ujian = await prisma.ujian.findUnique({
      where: { id },
      include: {
        ujianSoal: {
          include: { soal: true },
        },
      },
    })

    if (!ujian || ujian.kelasId !== siswa.kelasId) {
      return NextResponse.json({ error: "Ujian not found" }, { status: 404 })
    }

    if (await isAssessmentLocked(id, siswa.id)) {
      return NextResponse.json({ error: "Ujian ini sudah dinilai dan tidak dapat diubah" }, { status: 403 })
    }

    const parentRagu = (soalId: string) => {
      if (!Array.isArray(raguRagu)) return false
      const subs = subSoalItem(ujian.ujianSoal.find((us) => us.soal.id === soalId)?.soal.subSoal)
      if (subs.length === 0) return raguRagu.includes(soalId)
      return subs.some((_: any, i: number) => raguRagu.includes(`${soalId}::sub::${i}`))
    }

    const ops = ujian.ujianSoal.map((us) => {
      const subs = subSoalItem(us.soal.subSoal)
      let jawabanJson: string
      if (subs.length > 0 && subBuckets[us.soal.id]) {
        const arr: string[] = []
        const bucket = subBuckets[us.soal.id]
        for (let i = 0; i < subs.length; i++) {
          arr.push(bucket[i] || "")
        }
        jawabanJson = JSON.stringify(arr)
      } else {
        jawabanJson = directAnswers[us.soal.id] ?? ""
      }

      return prisma.jawabanUjian.upsert({
        where: {
          ujianId_siswaId_soalId: {
            ujianId: id,
            siswaId: siswa.id,
            soalId: us.soal.id,
          },
        },
        update: {
          jawaban: jawabanJson,
          raguRagu: parentRagu(us.soal.id),
        },
        create: {
          ujianId: id,
          siswaId: siswa.id,
          soalId: us.soal.id,
          jawaban: jawabanJson,
          raguRagu: parentRagu(us.soal.id),
        },
      })
    })

    if (ops.length > 0) await prisma.$transaction(ops as never)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error auto-saving:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
