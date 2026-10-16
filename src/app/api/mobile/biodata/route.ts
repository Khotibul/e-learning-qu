import { getMobileUser } from "@/lib/mobile-auth"
import { getBiodataLengkap, upsertBiodata, type BiodataInput } from "@/lib/biodata"
import { options, ok, fail } from "../admin/_lib"

export { options }

// ── Biodata diri sendiri (semua role login) ──
// GET  → biodata lengkap milik user login (NIK/KK tampil penuh utk pemilik)
// PATCH → identitas pribadi (whitelist self-service; NIK/KK hanya Admin)

async function requireLogin(req: Request) {
  const user = await getMobileUser(req)
  if (!user) return { error: fail("Unauthorized", 401) }
  return { user }
}

export async function GET(req: Request) {
  const auth = await requireLogin(req)
  if ("error" in auth && auth.error) return auth.error
  try {
    const data = await getBiodataLengkap(auth.user.id, { full: true })
    return ok({ success: true, data })
  } catch (e) {
    console.error(e)
    return fail("Gagal memuat biodata")
  }
}

export async function PATCH(req: Request) {
  const auth = await requireLogin(req)
  if ("error" in auth && auth.error) return auth.error
  try {
    const body = await req.json()
    // tolak pengubahan field sensitif oleh self
    if ("nik" in body || "nomorKK" in body) {
      return fail("NIK/Nomor KK hanya dapat diubah oleh Admin (verifikasi dokumen)", 403)
    }
    await upsertBiodata(auth.user.id, body as BiodataInput, "self")
    const data = await getBiodataLengkap(auth.user.id, { full: true })
    return ok({ success: true, data })
  } catch (e) {
    console.error(e)
    return fail("Gagal menyimpan biodata")
  }
}
