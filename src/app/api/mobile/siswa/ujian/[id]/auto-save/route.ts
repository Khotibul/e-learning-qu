import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

const SUB_RE = /^(.+)::sub::(\d+)$/

function subSoalItem(s: unknown) {
  if (!s) return []
  const arr = Array.isArray(s) ? s as unknown[] : []
  return arr.filter((a: unknown) => (a as { pertanyaan?: string })?.pertanyaan?.trim())
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const { id } = await params
    const { answers, raguRagu } = await req.json()
    const siswa = await prisma.siswa.findUnique({ where: { userId: user.id } })
    if (!siswa) return NextResponse.json({ error: "Siswa not found" }, { status: 404, headers: corsHeaders })

    const subBuckets: Record<string, Record<number, string>> = {}
    const directAnswers: Record<string, string> = {}
    if (answers && typeof answers === "object") {
      for (const [key, val] of Object.entries(answers as Record<string, string>)) {
        const m = key.match(SUB_RE)
        if (m) {
          const parentId = m[1]
          const subIdx = parseInt(m[2])
          if (!subBuckets[parentId]) subBuckets[parentId] = {}
          subBuckets[parentId][subIdx] = val
        } else {
          directAnswers[key] = val
        }
      }
    }

    const ujian = await prisma.ujian.findUnique({ where: { id }, include: { ujianSoal: { include: { soal: true } } } })
    if (!ujian) return NextResponse.json({ error: "Ujian not found" }, { status: 404, headers: corsHeaders })

    const parentRagu = (soalId: string) => {
      if (!Array.isArray(raguRagu)) return false
      const subs = subSoalItem(ujian.ujianSoal.find((us) => us.soal.id === soalId)?.soal.subSoal)
      if (subs.length === 0) return (raguRagu as string[]).includes(soalId)
      return subs.some((_: unknown, i: number) => (raguRagu as string[]).includes(`${soalId}::sub::${i}`))
    }

    const ops = ujian.ujianSoal.map((us) => {
      const subs = subSoalItem(us.soal.subSoal)
      let jawabanJson: string
      if (subs.length > 0 && subBuckets[us.soal.id]) {
        const arr: string[] = []
        const bucket = subBuckets[us.soal.id]
        for (let i = 0; i < subs.length; i++) arr.push(bucket[i] || "")
        jawabanJson = JSON.stringify(arr)
      } else {
        jawabanJson = directAnswers[us.soal.id] ?? ""
      }
      return prisma.jawabanUjian.upsert({
        where: { ujianId_siswaId_soalId: { ujianId: id, siswaId: siswa.id, soalId: us.soal.id } },
        update: { jawaban: jawabanJson, raguRagu: parentRagu(us.soal.id) },
        create: { ujianId: id, siswaId: siswa.id, soalId: us.soal.id, jawaban: jawabanJson, raguRagu: parentRagu(us.soal.id) },
      })
    })

    if (ops.length > 0) await prisma.$transaction(ops as never)

    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile auto-save error:", e)
    return NextResponse.json({ error: "Gagal auto save" }, { status: 500, headers: corsHeaders })
  }
}
