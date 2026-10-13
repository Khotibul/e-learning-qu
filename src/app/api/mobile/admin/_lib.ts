import { NextResponse } from "next/server"
import { getMobileUser } from "@/lib/mobile-auth"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function options() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function requireAdmin(req: Request): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getMobileUser>>>; error?: undefined }
  | { user?: undefined; error: NextResponse }
> {
  const user = await getMobileUser(req)
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders }) }
  }
  if (user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders }) }
  }
  return { user }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders })
}

export function fail(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status, headers: corsHeaders })
}
