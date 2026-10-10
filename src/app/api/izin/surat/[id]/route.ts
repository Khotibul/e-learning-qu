import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireGerbang } from "@/lib/izin-santri"
import PDFDocument from "pdfkit"
import QRCode from "qrcode"

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

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const verifyUrl = `${base}/api/izin/verifikasi?token=${izin.suratToken ?? ""}`

  const doc = new PDFDocument({ size: "A4", margin: 50 })
  const chunks: Buffer[] = []
  doc.on("data", (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))))

  const fmt = (d: Date | null) => (d ? d.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }) + " WIB" : "-")

  // Kop
  doc.fontSize(16).font("Helvetica-Bold").text("PONDOK PESANTREN E-LEARNING QU", { align: "center" })
  doc.fontSize(10).font("Helvetica").text("Sistem Informasi Santri — Surat Izin Pulang Digital", { align: "center" })
  doc.moveDown(0.5)
  doc.fontSize(11).font("Helvetica-Bold").text(`Nomor: ${izin.suratNomor ?? "-"}`, { align: "center" })
  doc.moveDown(1)
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()

  // Identitas
  doc.moveDown(1)
  doc.fontSize(11).font("Helvetica-Bold").text("Identitas Santri")
  doc.font("Helvetica")
  doc.text(`Nama              : ${izin.santri.nama}`)
  doc.text(`Nomor Induk Santri: ${izin.santri.nisNo ?? "-"}`)
  doc.text(`Asrama / Kamar    : ${izin.santri.asrama?.nama ?? "-"} / ${izin.santri.kamar?.nama ?? "-"}`)
  doc.moveDown(0.5)

  // Detail izin
  doc.fontSize(11).font("Helvetica-Bold").text("Detail Izin")
  doc.font("Helvetica")
  const JENIS: Record<string, string> = {
    PULANG_RUMAH: "Izin Pulang ke Rumah", KELUAR_SEMENTARA: "Izin Keluar Sementara", BEROBAT: "Izin Berobat",
    KEGIATAN_KELUARGA: "Izin Kegiatan Keluarga", KEGIATAN_SEKOLAH: "Izin Kegiatan Sekolah", DARURAT: "Izin Darurat", LIBURAN_PONDOK: "Izin Liburan Pondok",
  }
  doc.text(`Jenis Izin        : ${JENIS[izin.jenis] ?? izin.jenis}`)
  doc.text(`Alasan            : ${izin.alasan}`)
  doc.text(`Rencana Keluar    : ${fmt(izin.rencanaKeluar)}`)
  doc.text(`Batas Kembali     : ${fmt(izin.rencanaKembali)}`)
  doc.text(`Alamat Tujuan     : ${izin.alamatTujuan}`)
  doc.moveDown(0.5)

  // Penjemput
  doc.fontSize(11).font("Helvetica-Bold").text("Penjemput")
  doc.font("Helvetica")
  doc.text(`Nama              : ${izin.namaPenjemput}`)
  doc.text(`Hubungan          : ${izin.hubunganPenjemput}`)
  doc.text(`No. HP            : ${izin.noTelpPenjemput}`)
  doc.moveDown(0.5)

  // Persetujuan
  doc.fontSize(11).font("Helvetica-Bold").text("Persetujuan & Verifikasi")
  doc.font("Helvetica")
  doc.text(`Wali              : ${izin.waliApprovedAt ? `Disetujui ${fmt(izin.waliApprovedAt)}` : "—"}`)
  doc.text(`Musyrif           : ${izin.musyrifApprovedAt ? `Disetujui ${fmt(izin.musyrifApprovedAt)}` : "—"}`)
  doc.text(`Admin Pondok      : ${izin.adminApprovedAt ? `Disetujui ${fmt(izin.adminApprovedAt)}` : "—"}`)
  doc.text(`Status            : ${izin.status}`)
  doc.text(`Check-out         : ${fmt(izin.checkoutAt)}`)
  doc.text(`Check-in          : ${fmt(izin.checkinAt)}`)
  doc.moveDown(0.5)

  // QR
  if (izin.suratToken) {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 140, margin: 1 })
    const b64 = qrDataUrl.split(",")[1]
    const qrBuf = Buffer.from(b64, "base64")
    doc.image(qrBuf, 50, doc.y + 5, { width: 140 })
    doc.fontSize(9).text("Scan untuk verifikasi keaslian surat.", 200, doc.y - 120)
    doc.fontSize(9).text(`Berlaku sampai: ${fmt(izin.suratExpiresAt)}`, 200, doc.y - 105)
    doc.fontSize(9).text(izin.suratExpiresAt && izin.suratExpiresAt.getTime() < Date.now() ? "Status QR: KEDALUWARSA" : "Status QR: AKTIF", 200, doc.y - 90)
  }

  doc.moveDown(3)
  doc.fontSize(8).font("Helvetica").text(
    "Surat ini diterbitkan otomatis oleh Sistem E-Learning Qu. Dilarang memalsukan. Setiap pemindaian diverifikasi terhadap database resmi.",
    50, doc.y, { width: 495, align: "center" }
  )

  doc.end()
  const pdf = await done
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="surat-izin-${izin.suratNomor?.replace(/\//g, "-") ?? izin.id}.pdf"`,
    },
  })
}
