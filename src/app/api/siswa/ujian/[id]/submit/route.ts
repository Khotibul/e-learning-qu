import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { trackAssessmentSelesai } from "@/lib/agents/learning-analytics"
import { updatePenguasaanAfterUjian } from "@/lib/agents/knowledge-tracing"
import { isAssessmentLocked, lockAssessment } from "@/lib/assessment-guard"
import { submitExamSession, getActiveSession } from "@/lib/exam/session"
import { logExamAudit } from "@/lib/exam/audit"

const SUB_RE = /^(.+)::sub::(\d+)$/

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
          orderBy: { nomor: "asc" },
          include: { soal: true },
        },
      },
    })

    if (!ujian) {
      return NextResponse.json({ error: "Ujian not found" }, { status: 404 })
    }

    if (await isAssessmentLocked(id, siswa.id)) {
      return NextResponse.json({ error: "Ujian ini sudah dinilai dan tidak dapat dikerjakan ulang" }, { status: 403 })
    }

    const subSoalItem = (s: any) => {
      if (!s) return []
      const arr = Array.isArray(s) ? s : []
      return arr.filter((a: any) => a.pertanyaan?.trim())
    }

    // Regroup flattened sub-answers back into parent soal JSON arrays
    const regrouped: Record<string, string> = {}
    const subBuckets: Record<string, Record<number, string>> = {}

    if (answers && typeof answers === "object") {
      for (const [key, val] of Object.entries(answers)) {
        const m = key.match(SUB_RE)
        if (m) {
          const parentId = m[1]
          const subIdx = parseInt(m[2])
          if (!subBuckets[parentId]) subBuckets[parentId] = {}
          subBuckets[parentId][subIdx] = val as string
        } else {
          regrouped[key] = val as string
        }
      }
    }

    // Determine if any sub-item under a parent soal is flagged ragu-ragu
    const parentRagu = (soalId: string) => {
      if (!Array.isArray(raguRagu)) return false
      const subs = subSoalItem(ujian.ujianSoal.find((us) => us.soal.id === soalId)?.soal.subSoal)
      if (subs.length === 0) return raguRagu.includes(soalId)
      return subs.some((_: any, i: number) => raguRagu.includes(`${soalId}::sub::${i}`))
    }

    // Build JSON arrays for sub-question parents and store JawabanUjian
    for (const us of ujian.ujianSoal) {
      const subs = subSoalItem(us.soal.subSoal)
      if (subs.length > 0 && subBuckets[us.soal.id]) {
        const arr: string[] = []
        const bucket = subBuckets[us.soal.id]
        for (let i = 0; i < subs.length; i++) {
          arr.push(bucket[i] || "")
        }
        const jawabanJson = JSON.stringify(arr)
        regrouped[us.soal.id] = jawabanJson

        await prisma.jawabanUjian.upsert({
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
      } else {
        const jawabanStr = regrouped[us.soal.id] ?? ""

        await prisma.jawabanUjian.upsert({
          where: {
            ujianId_siswaId_soalId: {
              ujianId: id,
              siswaId: siswa.id,
              soalId: us.soal.id,
            },
          },
          update: {
            jawaban: jawabanStr,
            raguRagu: parentRagu(us.soal.id),
          },
          create: {
            ujianId: id,
            siswaId: siswa.id,
            soalId: us.soal.id,
            jawaban: jawabanStr,
            raguRagu: parentRagu(us.soal.id),
          },
        })
      }
    }

    // Grade and produce flattened hasilSoal (one entry per sub-question)
    let flatNomor = 0
    let totalPoin = 0
    let perolehPoin = 0
    const hasilSoal: {
      nomor: number
      jawaban: string | null
      jawabanBenar: string
      isCorrect: boolean
      poin: number
    }[] = []
    const jawabanDataForMastery: { kompetensiId?: string | null; isCorrect: boolean }[] = []

    for (const us of ujian.ujianSoal) {
      const jawab = regrouped[us.soal.id] ?? ""
      const subs = subSoalItem(us.soal.subSoal)

      if (subs.length > 0) {
        let subUser: string[] = []
        try { const p = JSON.parse(jawab); if (Array.isArray(p)) subUser = p } catch { subUser = [] }

        for (let i = 0; i < subs.length; i++) {
          flatNomor++
          const item = subs[i] as any
          const userAns = (subUser[i]?.trim() ?? "").toLowerCase()
          const jenis = item.jenis || "ISIAN_SINGKAT"
          const jawabanBenar = item.jawaban || ""
          const poin = item.poin || 1

          let isCorrect = false
          if (jenis === "PILIHAN_GANDA" || jenis === "TRUE_FALSE") {
            isCorrect = userAns === jawabanBenar.toLowerCase().trim()
          } else {
            isCorrect = userAns === jawabanBenar.toLowerCase().trim()
          }

          totalPoin += poin
          if (isCorrect) perolehPoin += poin

          hasilSoal.push({
            nomor: flatNomor,
            jawaban: subUser[i] || null,
            jawabanBenar,
            isCorrect,
            poin: isCorrect ? poin : 0,
          })
          jawabanDataForMastery.push({ kompetensiId: us.soal.kompetensiId, isCorrect })
        }
      } else {
        flatNomor++
        const jawabanBenar = us.soal.jawaban
        const poin = us.soal.poin
        totalPoin += poin

        let isCorrect = false
        if (us.soal.jenisSoal === "PILIHAN_GANDA" || us.soal.jenisSoal === "TRUE_FALSE") {
          isCorrect = jawab.trim() === jawabanBenar.trim()
        } else if (us.soal.jenisSoal === "ISIAN_SINGKAT") {
          isCorrect = jawab.toLowerCase().trim() === jawabanBenar.toLowerCase().trim()
        } else {
          isCorrect = jawab.trim() === jawabanBenar.trim()
        }

        if (isCorrect) perolehPoin += poin

        hasilSoal.push({
          nomor: flatNomor,
          jawaban: jawab || null,
          jawabanBenar,
          isCorrect,
          poin: isCorrect ? poin : 0,
        })
        jawabanDataForMastery.push({ kompetensiId: us.soal.kompetensiId, isCorrect })
      }
    }

    const nilaiAkhir = totalPoin > 0 ? Math.round((perolehPoin / totalPoin) * 100) : 0
    const jumlahBenar = hasilSoal.filter((h) => h.isCorrect).length

    const nilaiExists = await prisma.nilai.findFirst({
      where: { siswaId: siswa.id, ujianId: ujian.id },
    })
    if (nilaiExists) {
      await prisma.nilai.update({
        where: { id: nilaiExists.id },
        data: {
          nilai: nilaiAkhir,
          keterangan: `Nilai ${ujian.nama}`,
        },
      })
    } else {
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
    }

    if (jawabanDataForMastery.length > 0) {
      updatePenguasaanAfterUjian(siswa.id, id, jawabanDataForMastery).catch(() => {})
    }

    trackAssessmentSelesai(siswa.id, id, ujian.mataPelajaranId ?? undefined, {
      nilai: nilaiAkhir,
      jumlahBenar,
      jumlahSoal: flatNomor,
      isLatihan: ujian.isLatihan,
    }).catch(() => {})

    lockAssessment(id, siswa.id).catch(() => {})

    try {
      const activeSession = await getActiveSession(id, siswa.id)
      if (activeSession) {
        const submitResult = await submitExamSession(activeSession.id)
        await logExamAudit({
          ujianId: id,
          siswaId: siswa.id,
          sessionId: activeSession.id,
          action: "SESSION_SUBMITTED",
          actorId: siswa.userId,
          actorRole: "SISWA",
          detail: { nilai: nilaiAkhir, durationMs: submitResult.durationMs },
        })
      }
    } catch {}

    return NextResponse.json({
      nilai: nilaiAkhir,
      totalPoin,
      perolehPoin,
      jumlahSoal: flatNomor,
      jumlahBenar,
      hasilSoal,
    })
  } catch (error) {
    console.error("Error submitting ujian:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
