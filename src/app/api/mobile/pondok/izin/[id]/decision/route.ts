import { setujuiIzin, tolakIzin } from "@/lib/izin-santri"
import { requirePondok, ok, fail, options } from "../../../_lib"

export { options }

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: Ctx) {
  const body = await req.json().catch(() => ({}))
  const { aksi, catatan } = body
  if (!["SETUJUI", "TOLAK"].includes(String(aksi))) return fail("aksi harus SETUJUI atau TOLAK", 400)

  const auth = await requirePondok(req, aksi === "SETUJUI" ? "pondok.izin.approve" : "pondok.izin.reject")
  if (auth.error) return auth.error

  try {
    const { id } = await ctx.params
    if (aksi === "TOLAK") {
      if (String(catatan || "").trim().length < 3) return fail("Alasan penolakan minimal 3 karakter", 400)
      const hasil = await tolakIzin(id, "KEPALA", auth.user.id, String(catatan).trim())
      return ok({ success: true, aksi, hasil })
    }
    const hasil = await setujuiIzin(id, "KEPALA", auth.user.id, catatan)
    return ok({ success: true, aksi, hasil })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Gagal", 400)
  }
}
