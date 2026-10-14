import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../_lib"

export { options }

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    let config = await prisma.siteConfig.findFirst()
    if (!config) config = await prisma.siteConfig.create({ data: {} })
    return ok(config)
  } catch (e) {
    console.error(e)
    return fail("Gagal memuat konfigurasi")
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const body = await req.json()
    const { siteName, tagline, description, logoUrl, faviconUrl, aboutTitle, aboutText } = body
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries({ siteName, tagline, description, logoUrl, faviconUrl, aboutTitle, aboutText })) {
      if (v !== undefined) data[k] = v
    }
    const existing = await prisma.siteConfig.findFirst()
    const config = existing
      ? await prisma.siteConfig.update({ where: { id: existing.id }, data })
      : await prisma.siteConfig.create({ data })
    return ok(config)
  } catch (e) {
    console.error(e)
    return fail("Gagal menyimpan konfigurasi")
  }
}
