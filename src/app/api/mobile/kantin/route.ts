import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"
import { checkoutKantin, batalTransaksiKantin, bukaShift, tutupShift } from "@/lib/keuangan/kantin"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

async function guardKasir(userId: string, outletId?: string | null) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!user) return { error: "Unauthorized" as const, status: 401 as const }
  if (user.role === "ADMIN") return { userId, outletId: outletId ?? null }
  const staff = await prisma.keuanganStaff.findFirst({
    where: { userId, peran: "KASIR", aktif: true, ...(outletId ? { OR: [{ outletId }, { outletId: null }] } : {}) },
    select: { outletId: true },
  })
  if (!staff) return { error: "Anda bukan kasir yang ditugaskan", status: 403 as const }
  return { userId, outletId: staff.outletId }
}

export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const url = new URL(req.url)
    const view = url.searchParams.get("view") || "outlet"
    const outletId = url.searchParams.get("outletId") || undefined

    if (view === "outlet") {
      const userRow = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } })
      let outlets
      if (userRow?.role === "ADMIN") {
        outlets = await prisma.kantinOutlet.findMany({ where: { aktif: true }, select: { id: true, nama: true, kode: true, lokasi: true } })
      } else {
        const staff = await prisma.keuanganStaff.findMany({ where: { userId: user.id, peran: "KASIR", aktif: true }, select: { outletId: true } })
        const ids = staff.map((s) => s.outletId).filter((x): x is string => !!x)
        outlets = ids.length === 0
          ? []
          : await prisma.kantinOutlet.findMany({ where: { id: { in: ids }, aktif: true }, select: { id: true, nama: true, kode: true, lokasi: true } })
      }
      return NextResponse.json({ rows: outlets }, { headers: corsHeaders })
    }

    const guard = await guardKasir(user.id, outletId)
    if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status, headers: corsHeaders })

    if (view === "produk") {
      if (!outletId) return NextResponse.json({ error: "outletId wajib" }, { status: 400, headers: corsHeaders })
      const rows = await prisma.kantinProduk.findMany({
        where: { outletId, aktif: true },
        orderBy: { nama: "asc" },
        select: { id: true, nama: true, sku: true, hargaJual: true, stok: true, satuan: true, aktif: true, kategori: { select: { nama: true } } },
      })
      return NextResponse.json({ rows }, { headers: corsHeaders })
    }

    if (view === "shift") {
      if (!outletId) return NextResponse.json({ error: "outletId wajib" }, { status: 400, headers: corsHeaders })
      const row = await prisma.kantinShift.findFirst({
        where: { outletId, kasirUserId: user.id, status: "AKTIF" },
        select: { id: true, nomorShift: true, saldoAwal: true },
      })
      return NextResponse.json({ row }, { headers: corsHeaders })
    }

    if (view === "riwayat") {
      const shiftId = url.searchParams.get("shiftId")
      if (!shiftId) return NextResponse.json({ error: "shiftId wajib" }, { status: 400, headers: corsHeaders })
      const shift = await prisma.kantinShift.findUnique({ where: { id: shiftId }, select: { outletId: true } })
      if (!shift) return NextResponse.json({ error: "Shift tidak ditemukan" }, { status: 404, headers: corsHeaders })
      const rows = await prisma.kantinTransaksi.findMany({
        where: { shiftId, status: { not: "DIBATALKAN" } },
        include: { item: { select: { namaSnapshot: true, qty: true, subtotal: true } } },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ rows }, { headers: corsHeaders })
    }

    return NextResponse.json({ error: "view tidak dikenal" }, { status: 400, headers: corsHeaders })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    const body = await req.json()
    const { op } = body

    if (op === "bukaShift") {
      const guard = await guardKasir(user.id, body.outletId)
      if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status, headers: corsHeaders })
      if (!body.outletId) return NextResponse.json({ error: "outletId wajib" }, { status: 400, headers: corsHeaders })
      const hasil = await bukaShift({ outletId: body.outletId, kasirUserId: user.id, saldoAwal: body.saldoAwal ?? 0 })
      if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 422, headers: corsHeaders })
      return NextResponse.json({ success: true, shiftId: hasil.shiftId }, { headers: corsHeaders })
    }

    if (op === "tutupShift") {
      const shift = await prisma.kantinShift.findUnique({ where: { id: body.shiftId }, select: { outletId: true } })
      if (!shift) return NextResponse.json({ error: "Shift tidak ditemukan" }, { status: 404, headers: corsHeaders })
      const guard = await guardKasir(user.id, shift.outletId)
      if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status, headers: corsHeaders })
      const hasil = await tutupShift({ shiftId: body.shiftId, kasirUserId: user.id, kasAkhir: body.kasAkhir, catatan: body.catatan })
      if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 422, headers: corsHeaders })
      return NextResponse.json({ success: true, selisih: hasil.selisih }, { headers: corsHeaders })
    }

    if (op === "checkout") {
      const guard = await guardKasir(user.id, body.outletId)
      if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status, headers: corsHeaders })
      if (!body.outletId) return NextResponse.json({ error: "outletId wajib" }, { status: 400, headers: corsHeaders })
      const hasil = await checkoutKantin({
        outletId: body.outletId,
        kasirUserId: user.id,
        shiftId: body.shiftId ?? null,
        items: body.items ?? [],
        metode: body.metode,
        accountId: body.accountId ?? null,
        diskon: body.diskon ?? 0,
        idempotencyKey: body.idempotencyKey,
      })
      if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 422, headers: corsHeaders })
      return NextResponse.json({ success: true, transaksiId: hasil.transaksiId, nomorStruk: hasil.nomorStruk, total: hasil.total, saldoSesudah: hasil.saldoSesudah }, { headers: corsHeaders })
    }

    if (op === "batal") {
      const trx = await prisma.kantinTransaksi.findUnique({ where: { id: body.transaksiId }, select: { outletId: true } })
      if (!trx) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404, headers: corsHeaders })
      const guard = await guardKasir(user.id, trx.outletId)
      if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status, headers: corsHeaders })
      const hasil = await batalTransaksiKantin({ transaksiId: body.transaksiId, actorUserId: user.id, alasan: body.alasan })
      if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 422, headers: corsHeaders })
      return NextResponse.json({ success: true }, { headers: corsHeaders })
    }

    return NextResponse.json({ error: "op tidak dikenal" }, { status: 400, headers: corsHeaders })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 400, headers: corsHeaders })
  }
}
