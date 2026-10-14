import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../_lib"

export { options }

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const features = await prisma.landingFeature.findMany({ orderBy: { order: "asc" } })
    return ok(features)
  } catch (e) {
    console.error(e)
    return fail("Gagal memuat fitur")
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const body = await req.json()
    const { id, icon, title, description, order, isActive, op } = body
    if (op === "delete") {
      if (!id) return fail("id wajib", 400)
      await prisma.landingFeature.delete({ where: { id } })
      return ok({ success: true })
    }
    if (!id) {
      if (!title || !description) return fail("Title dan description wajib diisi", 400)
      const created = await prisma.landingFeature.create({
        data: { icon: icon || "FileText", title, description, order: order || 0, isActive: isActive ?? true },
      })
      return ok(created)
    }
    const updated = await prisma.landingFeature.update({
      where: { id },
      data: { icon, title, description, order, isActive },
    })
    return ok(updated)
  } catch (e) {
    console.error(e)
    return fail("Gagal menyimpan fitur")
  }
}

