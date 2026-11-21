import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { ekstrakMateri, generateSoalDariMateri } from "@/lib/generate-soal"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const guru = await prisma.guru.findFirst({
    where: { user: { email: session.user.email }, deletedAt: null },
    select: { id: true },
  })
  if (!guru) {
    return NextResponse.json({ error: "Bukan guru" }, { status: 403 })
  }

  const { success } = rateLimit(`generate_soal_${getClientIp(req)}:${guru.id}`, 6, 60000)
  if (!success) {
    return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi sebentar." }, { status: 429 })
  }

  try {
    const form = await req.formData()
    const topik = String(form.get("topik") || "").trim()
    const file = form.get("file")
    const jumlahRaw = Number(form.get("jumlah") || 5)
    const jumlah = Number.isFinite(jumlahRaw) ? Math.min(20, Math.max(1, jumlahRaw)) : 5
    const jenisSoal = String(form.get("jenisSoal") || "CAMPUR")
    const tingkatKesulitan = String(form.get("tingkatKesulitan") || "CAMPUR")
    const poinRaw = Number(form.get("poin") || 1)
    const poin = Number.isFinite(poinRaw) ? Math.max(1, poinRaw) : 1

    if (!topik && !(file instanceof File)) {
      return NextResponse.json({ error: "Topik atau file materi wajib diisi" }, { status: 400 })
    }

    let materi = null
    if (file instanceof File) {
      if (file.size === 0) return NextResponse.json({ error: "File materi kosong" }, { status: 400 })
      materi = await ekstrakMateri(file)
    }

    const result = await generateSoalDariMateri({ topik, materi, jumlah, jenisSoal, tingkatKesulitan, poin })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal generate soal"
    console.error("generate soal:", e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
