import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { roleSelectionSchema } from "@/validators/auth"
import { z } from "zod"

const registerSchema = roleSelectionSchema.superRefine((data, ctx) => {
  if (data.role === "GURU" && !data.nip) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "NIP wajib diisi untuk Guru",
      path: ["nip"],
    })
  }
})

export const GET = auth(async (req) => {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const userId = req.auth!.user.id
    const [user, guru, siswa] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
      prisma.guru.findFirst({ where: { userId, deletedAt: null } }),
      prisma.siswa.findFirst({ where: { userId, deletedAt: null } }),
    ])

    return NextResponse.json({
      profileComplete: user?.role === "ADMIN" || !!(guru || siswa),
      role: user?.role,
    })
  } catch (error) {
    console.error("Error checking profile:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
})

export const POST = auth(async (req) => {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validasi gagal" },
        { status: 400 },
      )
    }

    const { role, nama, nip, nis, nisn, kelasId, noTelp, alamat } = parsed.data

    const [existingGuru, existingSiswa] = await Promise.all([
      prisma.guru.findUnique({ where: { userId: req.auth.user.id } }),
      prisma.siswa.findUnique({ where: { userId: req.auth.user.id } }),
    ])

    if (existingGuru || existingSiswa) {
      return NextResponse.json({ error: "Profil sudah lengkap" }, { status: 400 })
    }

    const userId = req.auth!.user.id
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role, name: nama },
      })

      if (role === "GURU") {
        await tx.guru.create({
          data: {
            userId,
            nama,
            nip: nip || null,
            noTelp: noTelp || null,
            alamat: alamat || null,
          },
        })
      } else {
        await tx.siswa.create({
          data: {
            userId,
            nama,
            nis: nis || null,
            nisn: nisn || null,
            kelasId: kelasId || null,
            noTelp: noTelp || null,
            alamat: alamat || null,
          },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = (error.meta?.target as string[]) ?? []
        if (target.includes("nip")) {
          return NextResponse.json({ error: "NIP sudah terdaftar" }, { status: 409 })
        }
        if (target.includes("nis")) {
          return NextResponse.json({ error: "NIS sudah terdaftar" }, { status: 409 })
        }
      }
    }
    console.error("Error updating role:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
})
