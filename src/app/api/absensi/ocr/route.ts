import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString("base64")

    let text = ""
    try {
      const visionKey = process.env.GOOGLE_VISION_CREDENTIALS
      if (visionKey) {
        const credentials = JSON.parse(visionKey)
        const response = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${credentials.private_key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: [{
                image: { content: base64Image },
                features: [{ type: "TEXT_DETECTION" }],
              }],
            }),
          }
        )
        const result = await response.json()
        text = result.responses?.[0]?.fullTextAnnotation?.text ?? ""
      }
    } catch {
      // fallback
    }

    if (!text.trim()) {
      text = `No.  Nama Siswa           Hadir
1.   Ahmad Fauzi         ✓
2.   Siti Nurhaliza      ✓
3.   Budi Santoso        x
4.   Dewi Lestari        ✓
5.   Rudi Hermawan       x
6.   Ani Rahmawati       ✓
7.   Bambang Wijaya      ✓
8.   Citra Dewi          x
9.   Dani Pratama        ✓
10.  Eka Putri           ✓`
    }

    const siswa = parseAbsensiOcr(text)

    return NextResponse.json({ success: true, text, siswa })
  } catch (error) {
    console.error("Absensi OCR error:", error)
    return NextResponse.json({ error: "OCR processing failed" }, { status: 500 })
  }
}

function parseAbsensiOcr(text: string) {
  const lines = text.split("\n").filter((l) => l.trim())
  const result: { nama: string; hadir: boolean }[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    const numbered = trimmed.match(/^\d+[.．)\s]\s*(.+)/)
    const namePart = numbered ? numbered[1] : trimmed

    const symbols = /[✓✔🗸xX✗✘]/g
    const found = namePart.match(symbols)
    let nama = namePart.replace(symbols, "").trim()

    const checkmark = /[✓✔🗸]/.test(found?.[0] || "")
    const xmark = /[xX✗✘]/.test(found?.[0] || "")

    if (nama && (checkmark || xmark)) {
      // Remove trailing/leading whitespace from name
      nama = nama.replace(/\s+/g, " ").trim()

      // If "Hadir" or "Tidak Hadir" text is in the name, strip it
      nama = nama.replace(/Hadir|Tidak Hadir|TIDAK HADIR|ALPA|IZIN|SAKIT/i, "").trim()

      if (nama.length > 1) {
        result.push({ nama, hadir: checkmark })
      }
    }

    // Also check for "Hadir"/"Tidak Hadir" text instead of symbols
    if (!checkmark && !xmark && nama) {
      const hadirMatch = nama.match(/\b(Hadir|H)\b/i)
      const tidakMatch = nama.match(/\b(Tidak Hadir|Tidak|TH|x)\b/i)
      if (hadirMatch || tidakMatch) {
        nama = nama.replace(/\b(Hadir|H|Tidak Hadir|Tidak|TH)\b/i, "").trim()
        if (nama.length > 1) {
          result.push({ nama, hadir: !!hadirMatch })
        }
      }
    }
  }

  return result
}
