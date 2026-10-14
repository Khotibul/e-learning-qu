import { NextResponse } from "next/server"
import { getMobileUser } from "@/lib/mobile-auth"
import { getIzinSaya, ajukanIzinSantri, simpanDraftIzin, batalkanIzinSantri, JENIS_IZIN_LABEL, STATUS_IZIN_LABEL, KEBERADAAN_LABEL } from "@/lib/izin-santri"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    const result = await getIzinSaya(user.id)
    return NextResponse.json(
      { ...result, jenisLabel: JENIS_IZIN_LABEL, statusLabel: STATUS_IZIN_LABEL, keberadaanLabel: KEBERADAAN_LABEL },
      { headers: corsHeaders },
    )
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 400, headers: corsHeaders })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    const body = await req.json()
    const { op } = body

    if (op === "ajukan") {
      const input = {
        jenis: body.jenis,
        alasan: body.alasan,
        rencanaKeluar: body.rencanaKeluar,
        rencanaKembali: body.rencanaKembali,
        alamatTujuan: body.alamatTujuan,
        namaPenjemput: body.namaPenjemput,
        hubunganPenjemput: body.hubunganPenjemput,
        noTelpPenjemput: body.noTelpPenjemput,
        lampiranId: body.lampiranId ?? null,
      }
      const row = await ajukanIzinSantri(user.id, input, body.draftId ?? undefined)
      return NextResponse.json({ success: true, id: row.id, status: row.status }, { headers: corsHeaders })
    }

    if (op === "draft") {
      const input = {
        jenis: body.jenis,
        alasan: body.alasan,
        rencanaKeluar: body.rencanaKeluar,
        rencanaKembali: body.rencanaKembali,
        alamatTujuan: body.alamatTujuan,
        namaPenjemput: body.namaPenjemput,
        hubunganPenjemput: body.hubunganPenjemput,
        noTelpPenjemput: body.noTelpPenjemput,
        lampiranId: body.lampiranId ?? null,
      }
      const row = await simpanDraftIzin(user.id, input, body.draftId ?? undefined)
      return NextResponse.json({ success: true, id: row.id, status: row.status }, { headers: corsHeaders })
    }

    if (op === "batal") {
      if (!body.izinId) return NextResponse.json({ error: "izinId wajib" }, { status: 400, headers: corsHeaders })
      await batalkanIzinSantri(user.id, body.izinId, body.alasan)
      return NextResponse.json({ success: true }, { headers: corsHeaders })
    }

    return NextResponse.json({ error: "op tidak dikenal" }, { status: 400, headers: corsHeaders })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 400, headers: corsHeaders })
  }
}
