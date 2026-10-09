import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/lib/auth"

const HALAMAN_DEPAN: Record<string, string> = {
  ADMIN: "/admin",
  GURU: "/guru",
  SISWA: "/siswa",
  RESEARCHER: "/admin/researcher",
}

const IZIN_AWALAN: Record<string, string[]> = {
  ADMIN: ["/admin", "/guru", "/siswa"],
  GURU: ["/guru"],
  SISWA: ["/siswa"],
  RESEARCHER: ["/admin"],
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const awalan = "/" + (pathname.split("/")[1] ?? "")

  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role

  if (!session?.user?.id || !role || !IZIN_AWALAN[role]) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new NextResponse(null, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }

  if (!IZIN_AWALAN[role].includes(awalan)) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new NextResponse(null, { status: 403 })
    }
    const url = req.nextUrl.clone()
    url.pathname = HALAMAN_DEPAN[role]
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/guru", "/guru/:path*", "/siswa", "/siswa/:path*"],
}
