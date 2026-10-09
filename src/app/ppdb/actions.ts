"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { rateLimit } from "@/lib/rate-limit"
import { createAuditLog } from "@/lib/audit"
import { kirimEmailVerifikasi, kirimEmailReset } from "@/lib/email-ppdb"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import type { JenisPendaftaran } from "@prisma/client"

/**
 * Aksi pendaftaran PPDB (calon pendaftar).
 * Route publik /ppdb/* tidak kena proxy matcher — setiap aksi wajib cek sesi sendiri.
 */
async function requirePendaftar() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isActive: true } })
  if (!user?.isActive) throw new Error("Akun tidak aktif")
  // pendaftar = akun SISWA (role default) — ADMIN/GURU tidak mendaftar via PPDB
  if (user.role === "ADMIN" || user.role === "GURU") throw new Error("Akun ini tidak dapat mendaftar PPDB")
  return session.user.id
}

// ─── REGISTRASI AKUN PENDAFTAR (STEP 5) ────────────────────────────────

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * 1. Daftar akun pendaftar: buat User (role SISWA) + kirim email verifikasi.
 * Rate-limited 5/jam per email. Cegah akun ganda (email unique).
 */
export async function daftarAkunPpdb(input: { email: string; nama: string; setujuPrivasi: boolean }) {
  const email = input.email?.trim().toLowerCase()
  if (!email || !validEmail(email)) throw new Error("Email tidak valid")
  if (!input.nama || input.nama.trim().length < 3) throw new Error("Nama minimal 3 karakter")
  if (!input.setujuPrivasi) throw new Error("Anda harus menyetujui kebijakan privasi")

  const rl = rateLimit(`ppdb-daftar-${email}`, 5, 3600000) // 5/jam
  if (!rl.success) throw new Error("Terlalu banyak percobaan — coba lagi nanti")

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing?.emailVerified) throw new Error("Email sudah terdaftar — silakan login")
  if (existing && !existing.emailVerified) {
    // kirim ulang verifikasi (akun menunggu verifikasi)
    const ulang = await kirimUlangVerifikasiInt(email)
    return { ok: true, message: "Email sudah terdaftar menunggu verifikasi — tautan verifikasi dikirim ulang", ...(ulang as any) }
  }

  const hash = crypto.randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + 24 * 3600000) // 24 jam

  const user = existing ?? await prisma.user.create({
    data: { email, name: input.nama.trim(), role: "SISWA", isActive: true },
  })
  // (existing tanpa emailVerified = akun dari Google belum verifikasi — update nama saja)
  if (existing) await prisma.user.update({ where: { id: user.id }, data: { name: input.nama.trim() } })

  await prisma.ppdbToken.create({ data: { email, token: hash, jenis: "VERIFIKASI_EMAIL", expires } })
  const hasil = await kirimEmailVerifikasi(email, input.nama.trim(), hash)
  await createAuditLog({ userId: user.id, action: "PPDB_DAFTAR", entity: "User", entityId: user.id, detail: { email } })

  return { ok: true, message: "Pendaftaran berhasil — cek email untuk verifikasi", ...(hasil as any) }
}

async function kirimUlangVerifikasiInt(email: string) {
  const hash = crypto.randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + 24 * 3600000)
  await prisma.ppdbToken.deleteMany({ where: { email, jenis: "VERIFIKASI_EMAIL", usedAt: null } })
  await prisma.ppdbToken.create({ data: { email, token: hash, jenis: "VERIFIKASI_EMAIL", expires } })
  const user = await prisma.user.findUnique({ where: { email } })
  return kirimEmailVerifikasi(email, user?.name || "", hash)
}

/** 2. Kirim ulang email verifikasi (rate-limited 3/jam). */
export async function kirimUlangVerifikasi(email: string) {
  const e = email?.trim().toLowerCase()
  if (!e || !validEmail(e)) throw new Error("Email tidak valid")
  const rl = rateLimit(`ppdb-resend-${e}`, 3, 3600000)
  if (!rl.success) throw new Error("Terlalu banyak permintaan — coba lagi nanti")
  const user = await prisma.user.findUnique({ where: { email: e } })
  if (!user) throw new Error("Email tidak terdaftar")
  if (user.emailVerified) throw new Error("Email sudah terverifikasi — silakan login")
  await kirimUlangVerifikasiInt(e)
  return { ok: true, message: "Tautan verifikasi dikirim ulang" }
}

/**
 * 3. Verifikasi email via token. Set emailVerified + buat password sekaligus.
 * Token sekali pakai, kedaluwarsa 24 jam.
 */
export async function verifikasiAkunPpdb(token: string, password: string) {
  if (!token?.trim()) throw new Error("Token tidak valid")
  if (!password || password.length < 8) throw new Error("Password minimal 8 karakter")

  const rl = rateLimit(`ppdb-verif-${token.slice(0, 8)}`, 10, 3600000)
  if (!rl.success) throw new Error("Terlalu banyak percobaan")

  const t = await prisma.ppdbToken.findUnique({ where: { token } })
  if (!t || t.jenis !== "VERIFIKASI_EMAIL") throw new Error("Tautan verifikasi tidak valid")
  if (t.usedAt) throw new Error("Tautan verifikasi sudah dipakai")
  if (t.expires < new Date()) throw new Error("Tautan verifikasi kedaluwarsa — minta kirim ulang")

  const user = await prisma.user.findUnique({ where: { email: t.email } })
  if (!user) throw new Error("Akun tidak ditemukan")

  const hash = await bcrypt.hash(password, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date(), password: hash } }),
    prisma.ppdbToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
  ])
  await createAuditLog({ userId: user.id, action: "PPDB_VERIFIKASI", entity: "User", entityId: user.id, detail: { email: t.email } })
  return { ok: true, message: "Email terverifikasi — akun aktif, silakan login" }
}

/**
 * 4. Lupa password: kirim tautan reset (berlaku 1 jam). Rate-limited 3/jam.
 */
export async function lupaPasswordPpdb(email: string) {
  const e = email?.trim().toLowerCase()
  if (!e || !validEmail(e)) throw new Error("Email tidak valid")
  const rl = rateLimit(`ppdb-lupa-${e}`, 3, 3600000)
  if (!rl.success) throw new Error("Terlalu banyak permintaan — coba lagi nanti")
  const user = await prisma.user.findUnique({ where: { email: e } })
  if (!user || !user.password) throw new Error("Email tidak terdaftar")
  const hash = crypto.randomBytes(32).toString("hex")
  await prisma.ppdbToken.deleteMany({ where: { email: e, jenis: "RESET_PASSWORD", usedAt: null } })
  await prisma.ppdbToken.create({ data: { email: e, token: hash, jenis: "RESET_PASSWORD", expires: new Date(Date.now() + 3600000) } })
  await kirimEmailReset(e, user.name || "", hash)
  return { ok: true, message: "Tautan reset password dikirim ke email Anda" }
}

/** 5. Reset password via token (sekali pakai, 1 jam). */
export async function resetPasswordPpdb(token: string, password: string) {
  if (!token?.trim()) throw new Error("Token tidak valid")
  if (!password || password.length < 8) throw new Error("Password minimal 8 karakter")
  const t = await prisma.ppdbToken.findUnique({ where: { token } })
  if (!t || t.jenis !== "RESET_PASSWORD") throw new Error("Tautan reset tidak valid")
  if (t.usedAt) throw new Error("Tautan reset sudah dipakai")
  if (t.expires < new Date()) throw new Error("Tautan reset kedaluwarsa")
  const user = await prisma.user.findUnique({ where: { email: t.email } })
  if (!user) throw new Error("Akun tidak ditemukan")
  const hash = await bcrypt.hash(password, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: hash } }),
    prisma.ppdbToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
  ])
  await createAuditLog({ userId: user.id, action: "PPDB_RESET_PASSWORD", entity: "User", entityId: user.id, detail: { email: t.email } })
  return { ok: true, message: "Password berhasil direset — silakan login" }
}

/** Gelombang yang sedang DIBUKA untuk publik (landing + form). */
export async function getGelombangPublik() {
  return prisma.gelombangPpdb.findMany({
    where: { deletedAt: null, status: { in: ["DIBUKA", "DITUTUP", "SELEKSI", "PENGUMUMAN", "DAFTAR_ULANG", "SELESAI"] } },
    include: {
      tahunAjaran: { select: { nama: true } },
      jalur: { where: { isActive: true }, orderBy: { nama: "asc" } },
    },
    orderBy: { tanggalBuka: "desc" },
    take: 20,
  })
}

/**
 * Buat pendaftaran (draft) untuk sebuah gelombang.
 * - Satu orang max 1 pendaftaran per gelombang (unique [userId, gelombangId]).
 * - Jenis: SISWA_REGULER / SISWA_SANTRI / SANTRI_PONDOK.
 * - Pilihan program/jalur berurutan (1 = utama).
 */
export async function createPendaftaran(
  gelombangId: string,
  jenis: JenisPendaftaran,
  jalurIds: string[] = []
) {
  const userId = await requirePendaftar()

  const gelombang = await prisma.gelombangPpdb.findFirst({
    where: { id: gelombangId, deletedAt: null },
    include: { jalur: { where: { isActive: true } } },
  })
  if (!gelombang) throw new Error("Gelombang pendaftaran tidak ditemukan")
  if (gelombang.status !== "DIBUKA") throw new Error("Pendaftaran pada gelombang ini sedang tidak dibuka")
  if (new Date() > gelombang.tanggalTutup) throw new Error("Pendaftaran sudah ditutup")

  const existing = await prisma.pendaftaranPpdb.findUnique({
    where: { userId_gelombangId: { userId, gelombangId } },
  })
  if (existing) throw new Error("Anda sudah terdaftar pada gelombang ini")

  // validasi jalur: harus aktif & milik gelombang ini; tanpa duplikat
  const jalurValid = new Set(gelombang.jalur.map((j) => j.id))
  if (jalurIds.length > 0) {
    for (const jid of jalurIds) {
      if (!jalurValid.has(jid)) throw new Error("Jalur tidak valid untuk gelombang ini")
    }
    if (new Set(jalurIds).size !== jalurIds.length) throw new Error("Pilihan jalur tidak boleh duplikat")
  }

  const pendaftaran = await prisma.$transaction(async (tx) => {
    const p = await tx.pendaftaranPpdb.create({
      data: {
        userId,
        gelombangId,
        jenis,
        jalurId: jalurIds[0] || gelombang.jalur[0]?.id || null,
        status: "DRAFT",
      },
    })
    await tx.pilihanPpdb.createMany({
      data: jalurIds.map((jid, i) => ({ pendaftaranId: p.id, jalurId: jid, urutan: i + 1 })),
    })
    return p
  })
  revalidatePath("/ppdb")
  return pendaftaran
}

/** Daftar pendaftaran milik pendaftar yang login. */
export async function getMyPendaftaran() {
  const userId = await requirePendaftar()
  return prisma.pendaftaranPpdb.findMany({
    where: { userId, deletedAt: null },
    include: {
      gelombang: { select: { id: true, nama: true, status: true, unit: true, jenjang: true, program: true } },
      jalur: { select: { nama: true } },
      pilihan: { orderBy: { urutan: "asc" }, include: { jalur: { select: { nama: true } } } },
      keputusan: true,
    },
    orderBy: { createdAt: "desc" },
  })
}

// ─── FORMULIR BIODATA BERTAHAP + AUTOSAVE (STEP 6) ────────────────────

export const LANGKAH_BIODATA = ["identitas", "alamat", "orangTua", "wali", "asalSekolah", "tambahan"] as const
export type LangkahBiodata = (typeof LANGKAH_BIODATA)[number]

/** Ambil draft pendaftaran + data formulir milik pendaftar login. */
export async function getDraftPendaftaran(gelombangId?: string) {
  const userId = await requirePendaftar()
  const where: Record<string, unknown> = { userId, deletedAt: null, status: "DRAFT" }
  if (gelombangId) where.gelombangId = gelombangId
  return prisma.pendaftaranPpdb.findFirst({
    where: where as any,
    include: {
      gelombang: { select: { id: true, nama: true, status: true, tanggalTutup: true, unit: true, jenjang: true, program: true } },
      pilihan: { orderBy: { urutan: "asc" }, include: { jalur: { select: { id: true, nama: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Autosave satu langkah formulir biodata.
 * Data langkah lain TIDAK ditimpa (merge shallow per-key langkah).
 * Hanya boleh mengubah pendaftaran milik sendiri yang masih DRAFT.
 */
export async function simpanDraftBiodata(
  pendaftaranId: string,
  langkah: LangkahBiodata,
  data: Record<string, unknown>
) {
  const userId = await requirePendaftar()
  if (!LANGKAH_BIODATA.includes(langkah)) throw new Error("Langkah formulir tidak valid")
  if (!data || typeof data !== "object") throw new Error("Data formulir tidak valid")

  const p = await prisma.pendaftaranPpdb.findUnique({ where: { id: pendaftaranId } })
  if (!p || p.userId !== userId) throw new Error("Pendaftaran tidak ditemukan")
  if (p.deletedAt) throw new Error("Pendaftaran sudah dinonaktifkan")
  if (p.status !== "DRAFT") throw new Error("Pendaftaran sudah dikunci — tidak dapat diedit")

  const lama = (p.data as Record<string, unknown> | null) || {}
  const baru = { ...lama, [langkah]: data }
  const updated = await prisma.pendaftaranPpdb.update({
    where: { id: pendaftaranId },
    data: { data: baru as any },
  })
  return { ok: true, updatedAt: updated.updatedAt }
}

/**
 * Validasi kelengkapan seluruh langkah biodata sebelum submit.
 * Dipakai STEP 11 (submit & kunci snapshot).
 */
export async function cekKelengkapanBiodata(pendaftaranId: string) {
  const userId = await requirePendaftar()
  const p = await prisma.pendaftaranPpdb.findUnique({ where: { id: pendaftaranId } })
  if (!p || p.userId !== userId) throw new Error("Pendaftaran tidak ditemukan")
  const data = (p.data as Record<string, any> | null) || {}
  const kurang: string[] = []
  const wajib: Record<LangkahBiodata, string[]> = {
    identitas: ["namaLengkap", "jenisKelamin", "tempatLahir", "tanggalLahir"],
    alamat: ["provinsi", "kabupaten", "alamatLengkap"],
    orangTua: ["namaAyah", "namaIbu"],
    wali: ["nama"],
    asalSekolah: ["namaSekolah"],
    tambahan: [],
  }
  for (const langkah of LANGKAH_BIODATA) {
    const isi = data[langkah] as Record<string, unknown> | undefined
    for (const f of wajib[langkah] || []) {
      if (!isi?.[f]) kurang.push(`${langkah}.${f}`)
    }
  }
  return { lengkap: kurang.length === 0, kurang }
}

/**
 * Cek status pendaftaran publik via nomor pendaftaran.
 * Hanya mengembalikan info minimal (tanpa data pribadi).
 */
export async function cekStatusPpdb(noPendaftaran: string) {
  const rl = rateLimit(`ppdb-cek-${noPendaftaran.toLowerCase()}`, 10, 60000)
  if (!rl.success) throw new Error("Terlalu banyak permintaan — coba lagi dalam satu menit")
  if (!noPendaftaran?.trim()) throw new Error("Nomor pendaftaran wajib diisi")
  const p = await prisma.pendaftaranPpdb.findFirst({
    where: { noPendaftaran: noPendaftaran.trim().toUpperCase(), deletedAt: null },
    include: {
      gelombang: { select: { nama: true, unit: true, jenjang: true, program: true } },
      jalur: { select: { nama: true } },
      keputusan: { select: { domain: true, hasil: true, decidedAt: true } },
    },
  })
  if (!p) throw new Error("Nomor pendaftaran tidak ditemukan")
  return {
    noPendaftaran: p.noPendaftaran,
    jenis: p.jenis,
    status: p.status,
    gelombang: p.gelombang,
    jalur: p.jalur?.nama || null,
    submittedAt: p.submittedAt,
    keputusan: p.keputusan.map((k) => ({ domain: k.domain, hasil: k.hasil, decidedAt: k.decidedAt })),
  }
}
