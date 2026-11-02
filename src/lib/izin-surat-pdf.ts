import PDFDocument from "pdfkit"
import QRCode from "qrcode"

/** Data minimal surat izin yang dibutuhkan untuk membuat PDF. */
export type SuratIzinSumber = {
  id: string
  jenis: string
  alasan: string
  rencanaKeluar: Date
  rencanaKembali: Date
  alamatTujuan: string
  namaPenjemput: string
  hubunganPenjemput: string
  noTelpPenjemput: string
  status: string
  suratNomor: string | null
  suratToken: string | null
  suratExpiresAt: Date | null
  waliApprovedAt: Date | null
  musyrifApprovedAt: Date | null
  adminApprovedAt: Date | null
  checkoutAt: Date | null
  checkinAt: Date | null
  santri: {
    nama: string
    nisNo: string | null
    asrama: { nama: string } | null
    kamar: { nama: string } | null
  }
}

const JENIS: Record<string, string> = {
  PULANG_RUMAH: "Izin Pulang ke Rumah",
  KELUAR_SEMENTARA: "Izin Keluar Sementara",
  BEROBAT: "Izin Berobat",
  KEGIATAN_KELUARGA: "Izin Kegiatan Keluarga",
  KEGIATAN_SEKOLAH: "Izin Kegiatan Sekolah",
  DARURAT: "Izin Darurat",
  LIBURAN_PONDOK: "Izin Liburan Pondok",
}

export function namaFileSuratIzin(izin: { id: string; suratNomor: string | null }): string {
  return `surat-izin-${izin.suratNomor?.replace(/\//g, "-") ?? izin.id}.pdf`
}

/**
 * Bangun PDF surat izin digital + QR verifikasi.
 * Dipakai bersama oleh web (/api/izin/surat/[id]) dan aplikasi Android
 * (/api/mobile/siswa/izin/surat) agar isi surat identik.
 */
export async function buatSuratIzinPdf(izin: SuratIzinSumber, baseUrl?: string): Promise<Buffer> {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
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
  return done
}
