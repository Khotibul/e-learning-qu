import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireGerbang } from "@/lib/izin-santri"
import { buatSuratIzinPdf, namaFileSuratIzin } from "@/lib/izin-surat-pdf"

export const dynamic = "force-dynamic"

/**
 * Surat izin pulang digital (PDF) + QR verifikasi.
 * Diakses: pemilik izin (santri/wali via relasi), ADMIN, atau petugas gerbang.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const izin = await prisma.izinSantri.findUnique({
    where: { id },
    include: {
      santri: {
        select: {
          id: true, nama: true, nisNo: true, userId: true,
          asrama: { select: { nama: true } },
          kamar: { select: { nama: true } },
          walis: { include: { wali: { select: { nama: true, hubungan: true } } } },
        },
      },
    },
  })
  if (!izin) return NextResponse.json({ error: "Izin tidak ditemukan" }, { status: 404 })

  // otorisasi: santri pemilik, wali anak tsb, atau petugas gerbang/admin
  let boleh = izin.santri.userId === session.user.id
  if (!boleh) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    if (user?.role === "ADMIN") boleh = true
    else {
      const rel = await prisma.santriWali.findFirst({ where: { santriId: izin.santriId, wali: { userId: session.user.id } }, select: { id: true } })
      if (rel) boleh = true
      else {
        try { await requireGerbang(); boleh = true } catch { /* bukan petugas */ }
      }
    }
  }
  if (!boleh) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const pdf = await buatSuratIzinPdf(izin)
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${namaFileSuratIzin(izin)}"`,
    },
  })
}
