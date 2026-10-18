import { getMobileUser } from "@/lib/mobile-auth"
import { simpanFotoProfil, hapusFotoProfil } from "@/lib/biodata"
import { createAuditLog } from "@/lib/audit"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { options, ok, fail } from "../../admin/_lib"

export { options }

// ── Upload/ganti foto profil (self; Admin bisa hapus foto orang via
//    /api/mobile/admin/biodata?userId=… ) ──
// POST multipart/form-data field `file` (JPEG/PNG/WebP, maks 5MB).
// Dinormalkan server: auto-rotate EXIF, strip metadata, resize 1024,
// thumbnail 128 → dua baris Upload (akses INTERNAL — lintas aplikasi
// web/desktop/mobile dengan auth yang sama).

export async function POST(req: Request) {
  const user = await getMobileUser(req)
  if (!user) return fail("Unauthorized", 401)
  const rl = rateLimit(`foto-profil:${getClientIp(req)}:${user.id}`, 20, 60000)
  if (!rl.success) return fail("Too many requests", 429)
  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return fail("Field file wajib (multipart/form-data)", 400)
    const hasil = await simpanFotoProfil(user.id, file)
    await createAuditLog({ userId: user.id, action: "FOTO_PROFIL_UPDATE", entity: "BiodataOrang", entityId: user.id, detail: { size: file.size } })
    return ok({ success: true, ...hasil })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal mengunggah foto"
    if (msg.startsWith("Ukuran") || msg.startsWith("Format") || msg.startsWith("File bukan")) return fail(msg, 400)
    console.error(e)
    return fail("Gagal mengunggah foto: " + msg)
  }
}

export async function DELETE(req: Request) {
  const user = await getMobileUser(req)
  if (!user) return fail("Unauthorized", 401)
  try {
    await hapusFotoProfil(user.id)
    await createAuditLog({ userId: user.id, action: "FOTO_PROFIL_HAPUS", entity: "BiodataOrang", entityId: user.id })
    return ok({ success: true })
  } catch (e) {
    console.error(e)
    return fail("Gagal menghapus foto")
  }
}
