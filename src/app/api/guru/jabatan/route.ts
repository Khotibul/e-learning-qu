import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "GURU") {
    return NextResponse.json({ jabatan: null })
  }
  const guru = await prisma.guru.findFirst({
    where: { user: { id: session.user.id }, deletedAt: null },
    select: { jabatan: true },
  })
  return NextResponse.json({ jabatan: guru?.jabatan || null })
}