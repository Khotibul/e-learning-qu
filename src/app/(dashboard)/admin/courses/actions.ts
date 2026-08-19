"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getCourses(params: { search?: string; page?: number; limit?: number }) {
  const { search, page = 1, limit = 10 } = params
  const where: Record<string, unknown> = { deletedAt: null }
  if (search) {
    where.OR = [{ title: { contains: search, mode: "insensitive" } }]
  }
  const [data, total] = await Promise.all([
    prisma.course.findMany({
      where: where as any,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        mapel: { select: { nama: true } },
        guru: { select: { nama: true } },
        _count: { select: { modules: true } },
      },
    }),
    prisma.course.count({ where: where as any }),
  ])
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getCourseDetail(id: string) {
  return prisma.course.findUnique({
    where: { id },
    include: {
      mapel: { select: { id: true, nama: true } },
      guru: { select: { id: true, nama: true } },
      modules: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            where: { deletedAt: null },
            orderBy: { sortOrder: "asc" },
            include: {
              materials: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  })
}

export async function createCourse(data: { title: string; description?: string; mapelId: string; guruId: string }) {
  const course = await prisma.course.create({
    data: { title: data.title, description: data.description || null, mapelId: data.mapelId, guruId: data.guruId },
  })
  revalidatePath("/(dashboard)/admin/courses")
  return course
}

export async function updateCourse(
  id: string,
  data: { title?: string; description?: string; isPublished?: boolean }
) {
  const course = await prisma.course.update({ where: { id }, data })
  revalidatePath("/(dashboard)/admin/courses")
  return course
}

export async function deleteCourse(id: string) {
  await prisma.course.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/admin/courses")
}

export async function createModule(data: { courseId: string; title: string; description?: string }) {
  const last = await prisma.courseModule.findFirst({
    where: { courseId: data.courseId, deletedAt: null },
    orderBy: { sortOrder: "desc" },
  })
  const module_ = await prisma.courseModule.create({
    data: {
      courseId: data.courseId,
      title: data.title,
      description: data.description || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  })
  revalidatePath("/(dashboard)/admin/courses")
  return module_
}

export async function updateModule(id: string, data: { title?: string; description?: string; isPublished?: boolean; sortOrder?: number }) {
  const module_ = await prisma.courseModule.update({ where: { id }, data })
  revalidatePath("/(dashboard)/admin/courses")
  return module_
}

export async function deleteModule(id: string) {
  await prisma.courseModule.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/admin/courses")
}

export async function createLesson(data: { moduleId: string; title: string; description?: string; content?: string }) {
  const last = await prisma.courseLesson.findFirst({
    where: { moduleId: data.moduleId, deletedAt: null },
    orderBy: { sortOrder: "desc" },
  })
  const lesson = await prisma.courseLesson.create({
    data: {
      moduleId: data.moduleId,
      title: data.title,
      description: data.description || null,
      content: data.content || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  })
  revalidatePath("/(dashboard)/admin/courses")
  return lesson
}

export async function updateLesson(id: string, data: { title?: string; description?: string; content?: string; isPublished?: boolean; sortOrder?: number }) {
  const lesson = await prisma.courseLesson.update({ where: { id }, data })
  revalidatePath("/(dashboard)/admin/courses")
  return lesson
}

export async function deleteLesson(id: string) {
  await prisma.courseLesson.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/admin/courses")
}

export async function createMaterial(data: { lessonId: string; title: string; content?: string; fileUrl?: string; fileType?: string }) {
  const last = await prisma.courseMaterial.findFirst({
    where: { lessonId: data.lessonId, deletedAt: null },
    orderBy: { sortOrder: "desc" },
  })
  const material = await prisma.courseMaterial.create({
    data: {
      lessonId: data.lessonId,
      title: data.title,
      content: data.content || null,
      fileUrl: data.fileUrl || null,
      fileType: data.fileType || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  })
  revalidatePath("/(dashboard)/admin/courses")
  return material
}

export async function updateMaterial(id: string, data: { title?: string; content?: string; fileUrl?: string; fileType?: string; sortOrder?: number }) {
  const material = await prisma.courseMaterial.update({ where: { id }, data })
  revalidatePath("/(dashboard)/admin/courses")
  return material
}

export async function deleteMaterial(id: string) {
  await prisma.courseMaterial.update({ where: { id }, data: { deletedAt: new Date() } })
  revalidatePath("/(dashboard)/admin/courses")
}

export async function getCourseRefs() {
  return prisma.course.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, mapel: { select: { nama: true } } },
    orderBy: { createdAt: "desc" },
  })
}
