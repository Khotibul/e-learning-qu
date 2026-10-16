import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../../_lib"
import { getBiodataLengkap, upsertBiodata, hapusFotoProfil, type BiodataAdminInput } from "@/lib/biodata"
import { createAuditLog } from "@/lib/audit"

export { options }

// ── Biodata orang lain (khusus Admin; dipakai Master Biodata + verifikasi) ──
// GET   ?userId=…          → biodata lengkap (NIK/KK penuh utk Admin)
// PATCH { userId, ...data } → ubah identitas (termasuk field sensitif)
// DELETE ?userId=…         → hapus foto profil orang tsb

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { userId } = await params
    if (!userId) return fail("userId wajib", 400)
    const data = await getBiodataLengkap(userId, { full: true })
    if (!data) return fail("User tidak ditemukan", 404)
    return ok({ success: true, data })
  } catch (e) {
    console.error(e)
    return fail("Gagal memuat biodata")
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const body = await req.json()
    const { userId } = body
    if (!userId) return fail("userId wajib", 400)
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
    if (!target) return fail("User tidak ditemukan", 404)
    await upsertBiodata(userId, body as BiodataAdminInput, "admin")
    await createAuditLog({
      userId: auth.user.id,
      action: "BIODATA_UPDATE",
      entity: "BiodataOrang",
      entityId: userId,
      detail: { email: target.email, fields: Object.keys(body).filter((k) => k !== "userId") },
    })
    const data = await getBiodataLengkap(userId, { full: true })
    return ok({ success: true, data })
  } catch (e) {
    console.error(e)
    return fail("Gagal menyimpan biodata")
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const { userId } = await params
    if (!userId) return fail("userId wajib", 400)
    await hapusFotoProfil(userId)
    await createAuditLog({ userId: auth.user.id, action: "FOTO_HAPUS", entity: "BiodataOrang", entityId: userId })
    return ok({ success: true })
  } catch (e) {
    console.error(e)
    return fail("Gagal menghapus foto")
  }
}
