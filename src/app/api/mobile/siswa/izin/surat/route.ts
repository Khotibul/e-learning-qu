import { NextResponse } from "next/server"
import { getMobileUser } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { getSantriByUserId } from "@/lib/izin-santri"
import { buatSuratIzinPdf, namaFileSuratIzin } from "@/lib/izin-surat-pdf"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Expose-Headers": "Content-Disposition",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

/**
 * Unduh surat izin (PDF) dari aplikasi santri.
 * Isi surat identik dengan versi web karena memakai builder yang sama.
 * Hanya pemilik izin (santri yang sedang login) yang boleh mengunduh.
 */
export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const id = new URL(req.url).searchParams.get("id")?.trim()
    if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400, headers: corsHeaders })

    const santri = await getSantriByUserId(user.id)
    if (!santri) return NextResponse.json({ error: "Akun ini tidak terdaftar sebagai santri" }, { status: 403, headers: corsHeaders })

    const izin = await prisma.izinSantri.findUnique({
      where: { id },
      include: {
        santri: {
          select: {
            nama: true,
            nisNo: true,
            asrama: { select: { nama: true } },
            kamar: { select: { nama: true } },
          },
        },
      },
    })
    if (!izin) return NextResponse.json({ error: "Izin tidak ditemukan" }, { status: 404, headers: corsHeaders })
    if (izin.santriId !== santri.id) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders })

    const pdf = await buatSuratIzinPdf(izin)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${namaFileSuratIzin(izin)}"`,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 400, headers: corsHeaders })
  }
}
