import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const kelasList = await prisma.kelas.findMany({
      where: { deletedAt: null },
      select: { id: true, nama: true },
      orderBy: { nama: "asc" },
    })
    return NextResponse.json(kelasList)
  } catch {
    return NextResponse.json({ error: "Gagal memuat data kelas" }, { status: 500 })
  }
}
