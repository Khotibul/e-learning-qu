import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { trackAssessmentSelesai } from "@/lib/agents/learning-analytics"
import { updatePenguasaanAfterUjian } from "@/lib/agents/knowledge-tracing"
import { isAssessmentLocked, lockAssessment } from "@/lib/assessment-guard"
import { submitExamSession, getActiveSession } from "@/lib/exam/session"
import { logExamAudit } from "@/lib/exam/audit"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

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
    if (siswa) {
      const ip = getClientIp(req)
      const rl = rateLimit(`submit:${ip}:${siswa.id}:${id}`, 5, 60000)
      if (!rl.success) {
        return NextResponse.json({ error: "Terlalu banyak submit, coba lagi 60 detik" }, { status: 429, headers: { "Retry-After": "60" } })
      }
    }

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

    if (!ujian || ujian.kelasId !== siswa.kelasId) {
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
    const ops: ReturnType<typeof prisma.jawabanUjian.upsert>[] = []
    for (const us of ujian.ujianSoal) {
      const subs = subSoalItem(us.soal.subSoal)
      let jawabanStr: string
      if (subs.length > 0 && subBuckets[us.soal.id]) {
        const arr: string[] = []
        const bucket = subBuckets[us.soal.id]
        for (let i = 0; i < subs.length; i++) {
          arr.push(bucket[i] || "")
        }
        jawabanStr = JSON.stringify(arr)
        regrouped[us.soal.id] = jawabanStr
      } else {
        jawabanStr = regrouped[us.soal.id] ?? ""
      }

      ops.push(
        prisma.jawabanUjian.upsert({
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
      )
    }
    if (ops.length > 0) await prisma.$transaction(ops as never)

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
    const perSoal: Record<string, { earned: number; allCorrect: boolean }> = {}

    for (const us of ujian.ujianSoal) {
      const jawab = regrouped[us.soal.id] ?? ""
      const subs = subSoalItem(us.soal.subSoal)

      if (subs.length > 0) {
        let subUser: string[] = []
        try { const p = JSON.parse(jawab); if (Array.isArray(p)) subUser = p } catch { subUser = [] }

        const acc = { earned: 0, allCorrect: true }
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
          if (isCorrect) acc.earned += poin
          if (!isCorrect) acc.allCorrect = false

          hasilSoal.push({
            nomor: flatNomor,
            jawaban: subUser[i] || null,
            jawabanBenar,
            isCorrect,
            poin: isCorrect ? poin : 0,
          })
          jawabanDataForMastery.push({ kompetensiId: us.soal.kompetensiId, isCorrect })
        }
        perSoal[us.soal.id] = acc
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

        perSoal[us.soal.id] = { earned: isCorrect ? poin : 0, allCorrect: isCorrect }

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

    // Persist hasil koreksi ke baris jawaban (dipakai review guru, export, analitik)
    const jawabanRows = await prisma.jawabanUjian.findMany({
      where: { ujianId: id, siswaId: siswa.id },
      select: { id: true, soalId: true },
    })
    const gradeOps: ReturnType<typeof prisma.jawabanUjian.update>[] = []
    for (const row of jawabanRows) {
      const g = perSoal[row.soalId]
      if (!g) continue
      gradeOps.push(
        prisma.jawabanUjian.update({
          where: { id: row.id },
          data: { isCorrect: g.allCorrect, poin: g.earned },
        })
      )
    }
    if (gradeOps.length > 0) await prisma.$transaction(gradeOps as never)

    const nilaiAkhir = totalPoin > 0 ? Math.round((perolehPoin / totalPoin) * 100) : 0
    const jumlahBenar = hasilSoal.filter((h) => h.isCorrect).length

    await prisma.nilai.upsert({
      where: { siswaId_ujianId: { siswaId: siswa.id, ujianId: ujian.id } },
      update: {
        nilai: nilaiAkhir,
        keterangan: `Nilai ${ujian.nama}`,
      },
      create: {
        siswaId: siswa.id,
        ujianId: ujian.id,
        mataPelajaranId: ujian.mataPelajaranId,
        semesterId: ujian.semesterId,
        nilai: nilaiAkhir,
        jenis: ujian.isLatihan ? "LATIHAN" : "UJIAN",
        keterangan: `Nilai ${ujian.nama}`,
      },
    })

    if (jawabanDataForMastery.length > 0) {
      updatePenguasaanAfterUjian(siswa.id, id, jawabanDataForMastery).catch(() => {})
    }

    trackAssessmentSelesai(siswa.id, id, ujian.mataPelajaranId ?? undefined, {
      nilai: nilaiAkhir,
      jumlahBenar,
      jumlahSoal: flatNomor,
      isLatihan: ujian.isLatihan,
    }).catch(() => {})

    if (!ujian.bisaRetake) {
      lockAssessment(id, siswa.id).catch(() => {})
    }

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
