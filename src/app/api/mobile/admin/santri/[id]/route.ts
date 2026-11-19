import { prisma } from "@/lib/prisma"
import { bersihkanNomor, cekNisNoSantriUnik, pesanDuplikat } from "@/lib/identitas"
import { requireAdmin, ok, fail, options } from "../../_lib"

export { options }

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { id } = await ctx.params
    const santri = await prisma.santri.findUnique({
      where: { id },
      select: {
        id: true, userId: true, nisNo: true, nama: true, keberadaan: true, status: true, catatan: true, tanggalMasuk: true, deletedAt: true,
        user: { select: { email: true, isActive: true } },
        siswa: { select: { id: true, kelas: { select: { id: true, nama: true } } } },
        walis: {
          select: {
            isPrimary: true,
            wali: { select: { id: true, nama: true, hubungan: true, noTelp: true, alamat: true } },
          },
        },
      },
    })
    if (!santri || santri.deletedAt) return fail("Tidak ditemukan", 404)
    const { deletedAt: _d, ...rest } = santri
    return ok(rest)
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
    const santri = await prisma.santri.findUnique({ where: { id } })
    if (!santri || santri.deletedAt) return fail("Santri tidak ditemukan", 404)

    if (op === "update") {
      const nisNo = body.nisNo === undefined ? undefined : bersihkanNomor(body.nisNo)
      if (nisNo) await cekNisNoSantriUnik(nisNo, id)
      const statusBerubah = body.status !== undefined && body.status !== santri.status
      await prisma.$transaction(async (tx) => {
        await tx.santri.update({
          where: { id },
          data: {
            ...(nisNo !== undefined && { nisNo }),
            ...(body.tanggalMasuk !== undefined && { tanggalMasuk: body.tanggalMasuk ? new Date(body.tanggalMasuk) : null }),
            ...(body.catatan !== undefined && { catatan: body.catatan || null }),
            ...(body.status !== undefined && { status: body.status }),
          },
        })
        if (statusBerubah && body.status) {
          await tx.santriStatusLog.create({
            data: { santriId: id, jenis: "ADMINISTRASI", dari: santri.status, ke: body.status, alasan: body.alasan || null, verifiedBy: auth.user.id },
          })
        }
      })
      return ok({ success: true })
    }

    if (op === "updateKeberadaan") {
      const keberadaan = body.keberadaan
      if (!keberadaan) return fail("keberadaan wajib", 400)
      if (santri.keberadaan !== keberadaan) {
        await prisma.$transaction(async (tx) => {
          await tx.santri.update({ where: { id }, data: { keberadaan } })
          await tx.santriStatusLog.create({
            data: { santriId: id, jenis: "KEBERADAAN", dari: santri.keberadaan, ke: keberadaan, alasan: body.alasan || null, verifiedBy: auth.user.id },
          })
        })
      }
      return ok({ success: true })
    }

    if (op === "delete") {
      await prisma.santri.update({ where: { id }, data: { deletedAt: new Date() } })
      return ok({ success: true })
    }

    return fail("op tidak dikenal", 400)
  } catch (e) {
    console.error(e)
    if ((e as { code?: string })?.code === "P2002") return fail(pesanDuplikat(e, "Nomor Induk Santri sudah dipakai").message, 400)
    if (e instanceof Error && !(e as { code?: string })?.code) return fail(e.message, 400)
    return fail("Gagal")
  }
}
