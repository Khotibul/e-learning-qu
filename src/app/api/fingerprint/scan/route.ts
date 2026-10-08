import { NextResponse } from "next/server"
import { prosesScan, type HasilScan } from "@/lib/absensi-harian"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key, X-Device-Code",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

/**
 * POST /api/fingerprint/scan — endpoint mesin fingerprint.
 *
 * Auth perangkat: header `X-Api-Key` (atau body.apiKey) + kode perangkat.
 * Wajib HTTPS di produksi. Tidak ada template biometrik yang diterima/disispan —
 * perangkat hanya mengirim UID sidik jari (perangkatUserId) atau NIS + scanId.
 *
 * Bentuk tunggal:
 *   { scanId, perangkatUserId?, nis?, tipe: "MASUK"|"PULANG", deviceTimestamp? }
 * Bentuk batch (sinkronisasi ulang saat jaringan pulih — idempoten):
 *   { scans: [ { scanId, perangkatUserId?, nis?, tipe, deviceTimestamp? }, ... ] }
 */
export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("x-api-key") ?? ""
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400, headers: corsHeaders })
    }
    const perangkatKode = String(req.headers.get("x-device-code") ?? body?.perangkatKode ?? "")
    const key = apiKey || String(body?.apiKey ?? "")
    if (!perangkatKode || !key) {
      return NextResponse.json({ error: "Kode perangkat dan API key wajib" }, { status: 401, headers: corsHeaders })
    }

    const scans: any[] = Array.isArray(body?.scans) ? body.scans : [body]
    if (scans.length === 0) {
      return NextResponse.json({ error: "Tidak ada scan" }, { status: 400, headers: corsHeaders })
    }
    if (scans.length > 200) {
      return NextResponse.json({ error: "Maksimal 200 scan per permintaan" }, { status: 400, headers: corsHeaders })
    }

    const hasil: (HasilScan & { scanId: string })[] = []
    for (const s of scans) {
      const scanId = String(s?.scanId ?? "").trim()
      const tipe = String(s?.tipe ?? "").toUpperCase()
      if (!scanId || (tipe !== "MASUK" && tipe !== "PULANG")) {
        hasil.push({ status: "GAGAL", pesan: "scanId dan tipe (MASUK/PULANG) wajib", eventKey: `${perangkatKode}:${scanId || "?"}`, scanId })
        continue
      }
      const r = await prosesScan({
        eventKey: `${perangkatKode}:${scanId}`,
        perangkatKode,
        apiKey: key,
        perangkatUserId: s?.perangkatUserId != null ? String(s.perangkatUserId) : null,
        nis: s?.nis != null ? String(s.nis) : null,
        tipe,
        deviceAt: s?.deviceTimestamp ?? null,
      })
      hasil.push({ ...r, scanId })
      // Sinkronisasi perangkat dianggap berhasil menerima hasil tiap scan
      // (retry aman: eventKey unik → tidak menggandakan absensi/notifikasi)
    }

    const sukses = hasil.filter((h) => h.status === "SUKSES" || h.status === "DUPLIKAT").length
    if (sukses === hasil.length) {
      const { prisma } = await import("@/lib/prisma")
      await prisma.perangkatFingerprint
        .updateMany({ where: { kode: perangkatKode }, data: { lastSyncAt: new Date() } })
        .catch(() => {})
    }

    return NextResponse.json({ success: true, hasil }, { headers: corsHeaders })
  } catch (e) {
    console.error("fingerprint/scan error:", e)
    return NextResponse.json({ error: "Gagal memproses scan" }, { status: 500, headers: corsHeaders })
  }
}
