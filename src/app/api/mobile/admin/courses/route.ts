import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../_lib"

export { options }

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get("q")?.trim()
    const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || "20") || 20))

    const where = {
      deletedAt: null,
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    }
    const [data, total] = await Promise.all([
      prisma.course.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          isPublished: true,
          createdAt: true,
          mapel: { select: { nama: true } },
          guru: { select: { nama: true } },
          _count: { select: { modules: true } },
        },
      }),
      prisma.course.count({ where }),
    ])
    return ok({
      data: data.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        isPublished: c.isPublished,
        createdAt: c.createdAt,
        mapel: c.mapel?.nama ?? null,
        guru: c.guru?.nama ?? null,
        jumlahModule: c._count.modules,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const body = await req.json()
    const { op } = body

    if (op === "delete") {
      if (!body.id) return fail("id wajib", 400)
      await prisma.course.update({ where: { id: body.id }, data: { deletedAt: new Date() } })
      return ok({ success: true })
    }

    const { title, description, mapelId, guruId } = body
    if (!title || !mapelId || !guruId) return fail("title, mapelId, guruId wajib", 400)
    const row = await prisma.course.create({
      data: { title, description: description || null, mapelId, guruId },
      select: { id: true, title: true },
    })
    return ok(row, 201)
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
