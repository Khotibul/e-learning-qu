import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../../_lib"
import { createAuditLog } from "@/lib/audit"

export { options }

type Ctx = { params: Promise<{ id: string }> }

const SELECT = {
  id: true, nama: true, hubungan: true, noTelp: true, alamat: true,
  email: true, pekerjaan: true, pendidikan: true, tempatLahir: true, tanggalLahir: true, statusHidup: true, fotoUploadId: true,
  deletedAt: true,
} as const

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { id } = await ctx.params
    const wali = await prisma.waliSantri.findUnique({
      where: { id },
      select: {
        ...SELECT,
        anak: {
          select: {
            id: true, isPrimary: true,
            aksesProfil: true, aksesAbsensi: true, aksesTagihan: true, aksesTopup: true,
            bolehNotifikasi: true, bolehSetujuiIzin: true, bolehUploadFoto: true, kontakDarurat: true,
            santri: { select: { id: true, nama: true, nisNo: true, status: true, siswa: { select: { nis: true, kelas: { select: { nama: true } } } } } },
          },
        },
      },
    })
    if (!wali || wali.deletedAt) return fail("Wali tidak ditemukan", 404)
    return ok({ ...wali, deletedAt: undefined, fotoUploadId: undefined, fotoUrl: wali.fotoUploadId ? `/api/upload/${wali.fotoUploadId}` : null })
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
    const wali = await prisma.waliSantri.findUnique({ where: { id } })
    if (!wali || wali.deletedAt) return fail("Wali tidak ditemukan", 404)
    const row = await prisma.waliSantri.update({
      where: { id },
      data: {
        ...(body.nama !== undefined && { nama: body.nama }),
        ...(body.hubungan !== undefined && { hubungan: body.hubungan }),
        ...(body.noTelp !== undefined && { noTelp: body.noTelp || null }),
        ...(body.alamat !== undefined && { alamat: body.alamat || null }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.pekerjaan !== undefined && { pekerjaan: body.pekerjaan || null }),
        ...(body.pendidikan !== undefined && { pendidikan: body.pendidikan || null }),
        ...(body.tempatLahir !== undefined && { tempatLahir: body.tempatLahir || null }),
        ...(body.tanggalLahir !== undefined && { tanggalLahir: body.tanggalLahir ? new Date(body.tanggalLahir) : null }),
        ...(body.statusHidup !== undefined && { statusHidup: body.statusHidup || null }),
      },
      select: SELECT,
    })
    await createAuditLog({ userId: auth.user.id, action: "WALI_UPDATE", entity: "WaliSantri", entityId: id, detail: { fields: Object.keys(body) } })
    return ok(row)
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
