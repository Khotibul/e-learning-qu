import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"
import { setujuiIzin, tolakIzin, getIzinMenunggu, getRiwayatIzin, getStatistikIzin, STATUS_IZIN_LABEL, JENIS_IZIN_LABEL } from "@/lib/izin-santri"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

async function requireMusyrifMobile(userId: string): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!user) return { ok: false, status: 401, message: "Unauthorized" }
  if (user.role === "ADMIN") return { ok: true }
  const guru = await prisma.guru.findFirst({
    where: { userId, deletedAt: null },
    select: { jabatan: true, asramaDibina: { select: { id: true } } },
  })
  if (!guru || (guru.jabatan !== "MUSYRIF" && guru.asramaDibina.length === 0))
    return { ok: false, status: 403, message: "Bukan musyrif" }
  return { ok: true }
}

export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    const guard = await requireMusyrifMobile(user.id)
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status, headers: corsHeaders })

    const url = new URL(req.url)
    const view = url.searchParams.get("view") || "antrean"

    if (view === "antrean") {
      const rows = await getIzinMenunggu("MUSYRIF")
      return NextResponse.json({ rows, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }, { headers: corsHeaders })
    }

    if (view === "monitoring") {
      const [statistik, diPondok, sedangIzin, terlambat] = await Promise.all([
        getStatistikIzin(),
        prisma.santri.findMany({
          where: { status: "AKTIF", deletedAt: null, keberadaan: "DI_PONDOK" },
          select: { id: true, nama: true, nisNo: true, asrama: { select: { nama: true } }, kamar: { select: { nama: true } } },
          orderBy: { nama: "asc" },
          take: 100,
        }),
        prisma.santri.findMany({
          where: { status: "AKTIF", deletedAt: null, keberadaan: { in: ["IZIN_PULANG", "IZIN_KELUAR", "DI_RUMAH", "DALAM_PERJALANAN", "KEGIATAN_LUAR"] } },
          select: {
            id: true, nama: true, nisNo: true, keberadaan: true, asrama: { select: { nama: true } },
            izins: { where: { status: "DISETUJUI" }, select: { id: true, rencanaKembali: true, suratNomor: true, jenis: true }, take: 1 },
          },
          orderBy: { nama: "asc" },
        }),
        prisma.santri.findMany({
          where: { status: "AKTIF", deletedAt: null, keberadaan: "TERLAMBAT_KEMBALI" },
          select: {
            id: true, nama: true, nisNo: true, asrama: { select: { nama: true } },
            izins: { where: { status: "DISETUJUI" }, select: { id: true, rencanaKembali: true, suratNomor: true }, take: 1 },
          },
        }),
      ])
      return NextResponse.json({ statistik, diPondok, sedangIzin, terlambat, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }, { headers: corsHeaders })
    }

    if (view === "riwayat") {
      const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1)
      const r = await getRiwayatIzin({ page, limit: 20 })
      return NextResponse.json({ ...r, statusLabel: STATUS_IZIN_LABEL, jenisLabel: JENIS_IZIN_LABEL }, { headers: corsHeaders })
    }

    return NextResponse.json({ error: "view tidak dikenal" }, { status: 400, headers: corsHeaders })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 400, headers: corsHeaders })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    const guard = await requireMusyrifMobile(user.id)
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status, headers: corsHeaders })

    const body = await req.json()
    const { op } = body

    if (op === "setujui") {
      if (!body.izinId) return NextResponse.json({ error: "izinId wajib" }, { status: 400, headers: corsHeaders })
      const hasil = await setujuiIzin(body.izinId, "MUSYRIF", user.id, body.catatan)
      return NextResponse.json({ success: true, status: hasil.status }, { headers: corsHeaders })
    }

    if (op === "tolak") {
      if (!body.izinId) return NextResponse.json({ error: "izinId wajib" }, { status: 400, headers: corsHeaders })
      const hasil = await tolakIzin(body.izinId, "MUSYRIF", user.id, body.alasan)
      return NextResponse.json({ success: true, status: hasil.status }, { headers: corsHeaders })
    }

    return NextResponse.json({ error: "op tidak dikenal" }, { status: 400, headers: corsHeaders })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 400, headers: corsHeaders })
  }
}
