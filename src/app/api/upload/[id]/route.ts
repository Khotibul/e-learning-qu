import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"
import { bolehAksesUpload } from "@/lib/upload-akses"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const upload = await prisma.upload.findUnique({
      where: { id },
      select: { data: true, mime: true, size: true, userId: true, akses: true },
    })
    if (!upload) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 })
    }

    // File PUBLIK (mis. logo situs) bisa diakses tanpa login.
    if (upload.akses !== "PUBLIK") {
      // Akses: sesi login web (cookie) ATAU token mobile (Bearer)
      const session = await auth()
      const mobileUser = session?.user ? null : await getMobileUser(req)
      const user = session?.user
        ? { id: session.user.id, role: String(session.user.role ?? "SISWA") }
        : mobileUser
        ? { id: mobileUser.id, role: String(mobileUser.role ?? "SISWA") }
        : null
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      // Kebijakan akses: Admin / INTERNAL / baris lama / pemilik — cegah IDOR
      if (!bolehAksesUpload(upload, user)) {
        return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
      }
    }

    return new NextResponse(new Uint8Array(upload.data), {
      status: 200,
      headers: {
        "Content-Type": upload.mime,
        "Content-Length": String(upload.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (e) {
    console.error("GET /api/upload/[id] error:", e)
    return NextResponse.json({ error: "Gagal memuat file" }, { status: 500 })
  }
}