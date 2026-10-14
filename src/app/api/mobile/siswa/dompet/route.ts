import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"
import { getOrCreateDompet } from "@/lib/keuangan/wallet"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const url = new URL(req.url)
    const view = url.searchParams.get("view") || "dompet"

    if (view === "riwayat") {
      const account = await prisma.walletAccount.findUnique({ where: { userId: user.id }, select: { id: true } })
      if (!account) return NextResponse.json({ rows: [] }, { headers: corsHeaders })
      const rows = await prisma.kantinTransaksi.findMany({
        where: { accountId: account.id, status: { not: "DIBATALKAN" } },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { item: { select: { namaSnapshot: true, qty: true, subtotal: true } }, outlet: { select: { nama: true } } },
      })
      return NextResponse.json({ rows }, { headers: corsHeaders })
    }

    if (view === "tagihan") {
      const rows = await prisma.invoiceTagihan.findMany({
        where: { userId: user.id, status: { not: "DIBATALKAN" } },
        include: { jenis: { select: { kode: true, nama: true, unit: true } } },
        orderBy: [{ status: "asc" }, { jatuhTempo: "asc" }],
      })
      return NextResponse.json({ rows }, { headers: corsHeaders })
    }

    const dompet = await getOrCreateDompet(user.id)
    const riwayat = await prisma.walletLedger.findMany({
      where: { accountId: dompet.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, tipe: true, jumlah: true, saldoSesudah: true, deskripsi: true, createdAt: true, refType: true },
    })
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, siswa: { select: { nama: true } }, santri: { select: { nama: true } } },
    })
    const nama = profile?.santri?.nama ?? profile?.siswa?.nama ?? profile?.name ?? "-"
    return NextResponse.json({ dompet: { ...dompet, nama }, riwayat }, { headers: corsHeaders })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Gagal memuat dompet" }, { status: 500, headers: corsHeaders })
  }
}
