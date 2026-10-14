import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../../_lib"

export { options }

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { id } = await ctx.params
    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        isPublished: true,
        mapel: { select: { id: true, nama: true } },
        guru: { select: { id: true, nama: true } },
        modules: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            isPublished: true,
            sortOrder: true,
            lessons: {
              where: { deletedAt: null },
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                title: true,
                description: true,
                content: true,
                isPublished: true,
                sortOrder: true,
                materials: {
                  where: { deletedAt: null },
                  orderBy: { sortOrder: "asc" },
                  select: { id: true, title: true, content: true, fileUrl: true, fileType: true, sortOrder: true },
                },
              },
            },
          },
        },
      },
    })
    if (!course) return fail("Tidak ditemukan", 404)
    return ok(course)
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const { op } = body

    if (op === "delete") {
      await prisma.course.update({ where: { id }, data: { deletedAt: new Date() } })
      return ok({ success: true })
    }
    if (op === "updateCourse") {
      const { title, description, isPublished } = body
      const row = await prisma.course.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(isPublished !== undefined && { isPublished }),
        },
        select: { id: true, title: true },
      })
      return ok(row)
    }

    if (op === "createModule") {
      const last = await prisma.courseModule.findFirst({ where: { courseId: id, deletedAt: null }, orderBy: { sortOrder: "desc" } })
      const row = await prisma.courseModule.create({
        data: { courseId: id, title: body.title, description: body.description || null, sortOrder: (last?.sortOrder ?? 0) + 1 },
        select: { id: true, title: true },
      })
      return ok(row, 201)
    }
    if (op === "updateModule") {
      const { title, description, isPublished, sortOrder } = body
      const row = await prisma.courseModule.update({
        where: { id: body.moduleId },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(isPublished !== undefined && { isPublished }),
          ...(sortOrder !== undefined && { sortOrder }),
        },
        select: { id: true, title: true },
      })
      return ok(row)
    }
    if (op === "deleteModule") {
      await prisma.courseModule.update({ where: { id: body.moduleId }, data: { deletedAt: new Date() } })
      return ok({ success: true })
    }

    if (op === "createLesson") {
      const last = await prisma.courseLesson.findFirst({ where: { moduleId: body.moduleId, deletedAt: null }, orderBy: { sortOrder: "desc" } })
      const row = await prisma.courseLesson.create({
        data: { moduleId: body.moduleId, title: body.title, description: body.description || null, content: body.content || null, sortOrder: (last?.sortOrder ?? 0) + 1 },
        select: { id: true, title: true },
      })
      return ok(row, 201)
    }
    if (op === "updateLesson") {
      const { title, description, content, isPublished, sortOrder } = body
      const row = await prisma.courseLesson.update({
        where: { id: body.lessonId },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(content !== undefined && { content }),
          ...(isPublished !== undefined && { isPublished }),
          ...(sortOrder !== undefined && { sortOrder }),
        },
        select: { id: true, title: true },
      })
      return ok(row)
    }
    if (op === "deleteLesson") {
      await prisma.courseLesson.update({ where: { id: body.lessonId }, data: { deletedAt: new Date() } })
      return ok({ success: true })
    }

    if (op === "createMaterial") {
      const last = await prisma.courseMaterial.findFirst({ where: { lessonId: body.lessonId }, orderBy: { sortOrder: "desc" } })
      const row = await prisma.courseMaterial.create({
        data: {
          lessonId: body.lessonId,
          title: body.title,
          content: body.content || null,
          fileUrl: body.fileUrl || null,
          fileType: body.fileType || null,
          sortOrder: (last?.sortOrder ?? 0) + 1,
        },
        select: { id: true, title: true },
      })
      return ok(row, 201)
    }
    if (op === "updateMaterial") {
      const { title, content, fileUrl, fileType, sortOrder } = body
      const row = await prisma.courseMaterial.update({
        where: { id: body.materialId },
        data: {
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
          ...(fileUrl !== undefined && { fileUrl }),
          ...(fileType !== undefined && { fileType }),
          ...(sortOrder !== undefined && { sortOrder }),
        },
        select: { id: true, title: true },
      })
      return ok(row)
    }
    if (op === "deleteMaterial") {
      await prisma.courseMaterial.update({ where: { id: body.materialId }, data: { deletedAt: new Date() } })
      return ok({ success: true })
    }

    return fail("op tidak dikenal", 400)
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
