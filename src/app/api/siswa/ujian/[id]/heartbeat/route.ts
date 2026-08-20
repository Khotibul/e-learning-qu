import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { examHeartbeat } from "@/lib/exam/session"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    const siswa = await prisma.siswa.findUnique({
      where: { userId: session.user.id },
    })
    if (!siswa) {
      return NextResponse.json({ error: "Siswa not found" }, { status: 404 })
    }

    const examSession = await prisma.examSession.findUnique({
      where: { id: sessionId },
    })
    if (!examSession || examSession.siswaId !== siswa.id || examSession.ujianId !== id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 403 })
    }

    const result = await examHeartbeat(sessionId)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Heartbeat error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
