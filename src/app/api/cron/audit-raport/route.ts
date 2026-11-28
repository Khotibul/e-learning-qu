import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auditRaport } from "@/lib/audit-raport"

export const dynamic = "force-dynamic"

function amanSama(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

/**
 * Endpoint cron harian (Vercel Cron, lihat `vercel.json`).
 * Vercel mengirim `Authorization: Bearer <CRON_SECRET>`.
 * Balasan 200 = raport sesuai, 500 = ada ketidaksesuaian (cron ditandai gagal),
 * 401 = kredensial salah, 503 = CRON_SECRET belum diset.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET belum diset" }, { status: 503 })
  }
  const header = req.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!token || !amanSama(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const hasil = await auditRaport(prisma)
    const sesuai = hasil.totalMasalah === 0
    const ringkas = {
      sesuai,
      dijalankanPada: hasil.dijalankanPada,
      durasiMs: hasil.durasiMs,
      totalMasalah: hasil.totalMasalah,
      statistik: hasil.statistik,
      dataSumber: hasil.dataSumber,
    }

    if (sesuai) {
      console.log("[audit-raport] semua nilai raport sesuai", ringkas)
    } else {
      console.error("[audit-raport] ketidaksesuaian ditemukan", ringkas)
      console.error(
        hasil.temuan
          .slice(0, 50)
          .map((t) => t.pesan)
          .join("\n"),
      )
    }

    return NextResponse.json(
      { ...ringkas, perKelas: hasil.perKelas, temuan: hasil.temuan },
      { status: sesuai ? 200 : 500 },
    )
  } catch (e) {
    console.error("[audit-raport] gagal dijalankan", e)
    return NextResponse.json(
      { sesuai: false, error: e instanceof Error ? e.message : "Audit gagal dijalankan" },
      { status: 500 },
    )
  }
}
