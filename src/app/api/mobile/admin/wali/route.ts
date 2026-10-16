import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../_lib"
import { createAuditLog } from "@/lib/audit"

export { options }

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get("q")?.trim()
    const rows = await prisma.waliSantri.findMany({
      where: {
        deletedAt: null,
        ...(q ? { OR: [{ nama: { contains: q, mode: "insensitive" as const } }, { noTelp: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {}),
      },
      orderBy: { nama: "asc" },
      take: 100,
      select: {
        id: true, nama: true, hubungan: true, noTelp: true, alamat: true,
        email: true, pekerjaan: true, pendidikan: true, statusHidup: true, fotoUploadId: true,
        _count: { select: { anak: true } },
      },
    })
    return ok({ rows: rows.map((r) => ({ ...r, fotoUrl: r.fotoUploadId ? `/api/upload/${r.fotoUploadId}` : null, fotoUploadId: undefined, jumlahAnak: r._count.anak, _count: undefined })) })
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

    if (op === "create") {
      if (!body.nama) return fail("Nama wali wajib diisi", 400)
      const row = await prisma.waliSantri.create({
        data: {
          nama: body.nama, hubungan: body.hubungan, noTelp: body.noTelp || null, alamat: body.alamat || null,
          email: body.email || null, pekerjaan: body.pekerjaan || null, pendidikan: body.pendidikan || null,
          tempatLahir: body.tempatLahir || null,
          tanggalLahir: body.tanggalLahir ? new Date(body.tanggalLahir) : null,
          statusHidup: body.statusHidup || null,
        },
        select: { id: true, nama: true, hubungan: true, noTelp: true, alamat: true, email: true, pekerjaan: true, pendidikan: true, statusHidup: true },
      })
      await createAuditLog({ userId: auth.user.id, action: "WALI_CREATE", entity: "WaliSantri", entityId: row.id, detail: { nama: row.nama, hubungan: row.hubungan } })
      return ok(row, 201)
    }

    if (op === "delete") {
      if (!body.id) return fail("id wajib", 400)
      await prisma.waliSantri.update({ where: { id: body.id }, data: { deletedAt: new Date() } })
      await createAuditLog({ userId: auth.user.id, action: "WALI_DELETE", entity: "WaliSantri", entityId: body.id })
      return ok({ success: true })
    }

    if (op === "assignToSantri") {
      const { santriId, waliId } = body
      if (!santriId || !waliId) return fail("santriId dan waliId wajib", 400)
      const [santri, wali] = await Promise.all([
        prisma.santri.findUnique({ where: { id: santriId } }),
        prisma.waliSantri.findUnique({ where: { id: waliId } }),
      ])
      if (!santri || santri.deletedAt) return fail("Santri tidak ditemukan", 404)
      if (!wali || wali.deletedAt) return fail("Wali tidak ditemukan", 404)
      const existing = await prisma.santriWali.findUnique({ where: { santriId_waliId: { santriId, waliId } } })
      if (existing) return fail("Wali sudah terhubung ke santri ini", 400)
      const isPrimary = body.isPrimary === true
      if (isPrimary) {
        await prisma.santriWali.updateMany({ where: { santriId, isPrimary: true }, data: { isPrimary: false } })
      }
      // Hak akses eksplisit — default ketat (false semua) kecuali wali utama
      // diberi hak dasar notifikasi/persetujuan agar fitur izin & absensi
      // tetap berjalan untuk relasi yang memang ditandai utama.
      const row = await prisma.santriWali.create({
        data: {
          santriId, waliId, isPrimary,
          aksesProfil: isPrimary, aksesAbsensi: isPrimary, aksesTagihan: isPrimary, aksesTopup: isPrimary,
          bolehNotifikasi: isPrimary, bolehSetujuiIzin: isPrimary, kontakDarurat: isPrimary,
        },
      })
      await createAuditLog({ userId: auth.user.id, action: "WALI_ASSIGN", entity: "SantriWali", entityId: row.id, detail: { santriId, waliId, isPrimary } })
      return ok(row, 201)
    }

    if (op === "unassignFromSantri") {
      const { santriId, waliId } = body
      if (!santriId || !waliId) return fail("santriId dan waliId wajib", 400)
      await prisma.santriWali.delete({ where: { santriId_waliId: { santriId, waliId } } })
      return ok({ success: true })
    }

    // Hak akses eksplisit per relasi wali↔anak (jangan anggap kontak
    // keluarga otomatis berhak — semua default false, Admin menentukan).
    if (op === "setHak") {
      const { santriWaliId } = body
      if (!santriWaliId) return fail("santriWaliId wajib", 400)
      const allowed = ["aksesProfil", "aksesAbsensi", "aksesTagihan", "aksesTopup", "bolehNotifikasi", "bolehSetujuiIzin", "bolehUploadFoto", "kontakDarurat"] as const
      const data: Record<string, boolean> = {}
      for (const k of allowed) if (typeof body[k] === "boolean") data[k] = body[k]
      if (Object.keys(data).length === 0) return fail("Tidak ada hak yang dikirim", 400)
      const rel = await prisma.santriWali.findUnique({ where: { id: santriWaliId } })
      if (!rel) return fail("Relasi wali-anak tidak ditemukan", 404)
      const row = await prisma.santriWali.update({ where: { id: santriWaliId }, data })
      await createAuditLog({ userId: auth.user.id, action: "WALI_HAK_UPDATE", entity: "SantriWali", entityId: santriWaliId, detail: data })
      return ok(row)
    }

    return fail("op tidak dikenal", 400)
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
