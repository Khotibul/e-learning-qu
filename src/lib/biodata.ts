import { prisma } from "@/lib/prisma"

// sharp dimuat LAZY (dynamic import) — module-load route yang hanya membaca
// biodata/monitoring tidak boleh ikut crash bila native module sharp gagal
// dimuat di runtime serverless (akses foto = fitur, bukan syarat hidup route).
async function getSharp(): Promise<typeof import("sharp").default> {
  try {
    const mod = await import("sharp")
    return mod.default
  } catch {
    throw new Error("Pemrosesan gambar tidak tersedia di server (modul sharp gagal dimuat)")
  }
}

// ─── MASTER BIODATA ORANG ────────────────────────────────────────────────
// Satu identitas utama per orang: identitas pribadi menempel di User
// (model BiodataOrang 1:1), bukan diduplikasi ke Guru/Siswa/Santri.
// Foto profil disimpan biner via tabel Upload (bukan base64 di kolom
// database utama) + thumbnail terpisah untuk tabel/monitoring.

export const FOTO_MAX_DIM = 1024
export const FOTO_THUMB_DIM = 128
export const FOTO_MAX_BYTES = 5 * 1024 * 1024

export type BiodataInput = {
  panggilan?: string | null
  jenisKelamin?: "LAKI_LAKI" | "PEREMPUAN" | null
  tempatLahir?: string | null
  tanggalLahir?: string | Date | null
  agama?: string | null
  kewarganegaraan?: string | null
  alamat?: string | null
  provinsi?: string | null
  kabupaten?: string | null
  kecamatan?: string | null
  desa?: string | null
  kodePos?: string | null
  noHp?: string | null
  kontakDaruratNama?: string | null
  kontakDaruratHubungan?: string | null
  kontakDaruratTelp?: string | null
}

export type BiodataAdminInput = BiodataInput & {
  nik?: string | null
  nomorKK?: string | null
}

// Field yang boleh diedit sendiri oleh pemilik identitas (self-service).
const SELF_FIELDS: (keyof BiodataInput)[] = [
  "panggilan", "jenisKelamin", "tempatLahir", "tanggalLahir", "agama",
  "kewarganegaraan", "alamat", "provinsi", "kabupaten", "kecamatan",
  "desa", "kodePos", "noHp",
  "kontakDaruratNama", "kontakDaruratHubungan", "kontakDaruratTelp",
]

// Field sensitif hanya Admin (verifikasi dokumen) yang boleh ubah.
const ADMIN_ONLY_FIELDS: (keyof BiodataAdminInput)[] = ["nik", "nomorKK"]

function pick<T extends object>(input: T, keys: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {}
  for (const k of keys) {
    if (k in input) {
      const v = input[k]
      ;(out as Record<string, unknown>)[k as string] = v === "" ? null : v
    }
  }
  return out
}

/** NIK/KK di-mask pada output umum (hanya 4 digit terakhir tampil). */
export function maskSensitive(v?: string | null): string | null {
  if (!v) return null
  if (v.length <= 4) return "****"
  return "*".repeat(v.length - 4) + v.slice(-4)
}

export function fotoUrl(uploadId?: string | null): string | null {
  return uploadId ? `/api/upload/${uploadId}` : null
}

/** Upsert identitas pribadi milik user. `mode` menentukan whitelist field. */
export async function upsertBiodata(
  userId: string,
  input: BiodataAdminInput | BiodataInput,
  mode: "self" | "admin"
) {
  const allowed = mode === "admin" ? [...SELF_FIELDS, ...ADMIN_ONLY_FIELDS] : SELF_FIELDS
  const data = pick(input, allowed as readonly (keyof typeof input)[])
  // tanggalLahir string ISO → Date
  if (typeof (data as { tanggalLahir?: unknown }).tanggalLahir === "string") {
    const d = new Date((data as { tanggalLahir: string }).tanggalLahir)
    if (!Number.isNaN(d.getTime())) (data as { tanggalLahir?: Date }).tanggalLahir = d
  }
  if (Object.keys(data).length === 0) return prisma.biodataOrang.findUnique({ where: { userId } })
  return prisma.biodataOrang.upsert({
    where: { userId },
    create: { userId, ...(data as Record<string, never>) },
    update: data as Record<string, never>,
  })
}

/**
 * Upload/ganti foto profil — dinormalkan ke JPEG via sharp:
 * auto-rotate (EXIF orientation), strip metadata/EXIF (re-encode),
 * resize cover 1024px + thumbnail 128px. Dua baris Upload (akses
 * INTERNAL: semua aplikasi terautentikasi — web/desktop/mobile — boleh
 * menampilkan dengan auth yang sama).
 */
export async function simpanFotoProfil(userId: string, file: File) {
  const sharp = await getSharp()
  if (file.size > FOTO_MAX_BYTES) throw new Error(`Ukuran foto maksimal ${Math.round(FOTO_MAX_BYTES / 1024 / 1024)}MB`)
  const raw = Buffer.from(await file.arrayBuffer())
  let format: string | undefined
  try {
    format = (await sharp(raw).metadata()).format
  } catch {
    throw new Error("File bukan gambar yang valid")
  }
  if (format !== "jpeg" && format !== "png" && format !== "webp") {
    throw new Error("Format foto harus JPEG, PNG, atau WebP")
  }
  // .rotate() tanpa argumen = ikut EXIF orientation, lalu re-encode
  // menghapus seluruh metadata/EXIF yang tidak diperlukan.
  const asli = await sharp(raw)
    .rotate()
    .resize(FOTO_MAX_DIM, FOTO_MAX_DIM, { fit: "cover", position: "attention" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer()
  const thumb = await sharp(asli)
    .resize(FOTO_THUMB_DIM, FOTO_THUMB_DIM, { fit: "cover", position: "attention" })
    .jpeg({ quality: 78 })
    .toBuffer()

  const stamp = new Date().toISOString().slice(0, 10)
  const [fAsli, fThumb] = await prisma.$transaction([
    prisma.upload.create({
      data: { filename: `foto-${stamp}-${userId.slice(0, 8)}.jpg`, mime: "image/jpeg", size: asli.length, data: asli, userId, akses: "INTERNAL" },
    }),
    prisma.upload.create({
      data: { filename: `foto-${stamp}-${userId.slice(0, 8)}-thumb.jpg`, mime: "image/jpeg", size: thumb.length, data: thumb, userId, akses: "INTERNAL" },
    }),
  ])

  await prisma.biodataOrang.upsert({
    where: { userId },
    create: { userId, fotoUploadId: fAsli.id, fotoThumbId: fThumb.id, fotoUpdatedAt: new Date() },
    update: { fotoUploadId: fAsli.id, fotoThumbId: fThumb.id, fotoUpdatedAt: new Date() },
  })
  // User.image = URL foto penuh (satu sumber tampilan avatar lintas aplikasi)
  await prisma.user.update({ where: { id: userId }, data: { image: `/api/upload/${fAsli.id}` } })
  return { fotoUrl: `/api/upload/${fAsli.id}`, fotoThumbUrl: `/api/upload/${fThumb.id}` }
}

/** Hapus foto profil (baris Upload dipertahankan sebagai arsip media; referensi diputus). */
export async function hapusFotoProfil(userId: string) {
  await prisma.biodataOrang.updateMany({ where: { userId }, data: { fotoUploadId: null, fotoThumbId: null, fotoUpdatedAt: new Date() } })
  await prisma.user.update({ where: { id: userId }, data: { image: null } })
}

/**
 * Biodata lengkap satu orang (by userId) — gabungan identitas pribadi
 * + peran (guru/siswa/santri) + relasi wali + status fingerprint.
 * `full=true` menampilkan NIK/KK penuh (pemilik/admin saja).
 */
export async function getBiodataLengkap(userId: string, opts?: { full?: boolean }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, image: true, role: true, isActive: true,
      biodata: true,
      guru: { select: { id: true, nip: true, nuptk: true, nama: true, jabatan: true, alamat: true, noTelp: true, absensiMetode: true } },
      siswa: {
        select: {
          id: true, nis: true, nisn: true, nama: true, alamat: true, noTelp: true, jabatan: true,
          kelas: { select: { id: true, nama: true, guruId: true } },
          jurusan: { select: { id: true, nama: true } },
        },
      },
      santri: {
        select: {
          id: true, nisNo: true, nama: true, status: true, keberadaan: true, tanggalMasuk: true, catatan: true,
          asrama: { select: { id: true, nama: true } },
          kamar: { select: { id: true, nama: true } },
          halaqah: { select: { id: true, nama: true } },
          kelasDiniyah: { select: { id: true, nama: true } },
          walis: {
            where: { wali: { deletedAt: null } },
            select: {
              id: true, isPrimary: true,
              aksesProfil: true, aksesAbsensi: true, aksesTagihan: true, aksesTopup: true,
              bolehNotifikasi: true, bolehSetujuiIzin: true, bolehUploadFoto: true, kontakDarurat: true,
              wali: { select: { id: true, nama: true, hubungan: true, noTelp: true, alamat: true, email: true, pekerjaan: true, pendidikan: true, statusHidup: true, fotoUploadId: true, userId: true } },
            },
          },
        },
      },
      pemetaanFingerprint: { select: { id: true, perangkatId: true, perangkatUserId: true, perangkat: { select: { nama: true, kode: true } } } },
    },
  })
  if (!user) return null

  const b = user.biodata
  return {
    user: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role, isActive: user.isActive },
    biodata: b
      ? {
          panggilan: b.panggilan, jenisKelamin: b.jenisKelamin, tempatLahir: b.tempatLahir,
          tanggalLahir: b.tanggalLahir,
          nik: opts?.full ? b.nik : maskSensitive(b.nik),
          nomorKK: opts?.full ? b.nomorKK : maskSensitive(b.nomorKK),
          kewarganegaraan: b.kewarganegaraan, agama: b.agama,
          alamat: b.alamat, provinsi: b.provinsi, kabupaten: b.kabupaten,
          kecamatan: b.kecamatan, desa: b.desa, kodePos: b.kodePos, noHp: b.noHp,
          kontakDaruratNama: b.kontakDaruratNama, kontakDaruratHubungan: b.kontakDaruratHubungan, kontakDaruratTelp: b.kontakDaruratTelp,
          fotoUrl: fotoUrl(b.fotoUploadId), fotoThumbUrl: fotoUrl(b.fotoThumbId), fotoUpdatedAt: b.fotoUpdatedAt,
        }
      : null,
    guru: user.guru,
    siswa: user.siswa,
    santri: user.santri
      ? {
          ...user.santri,
          walis: user.santri.walis.map((w) => ({
            ...w,
            wali: { ...w.wali, fotoUploadId: undefined, fotoUrl: fotoUrl(w.wali.fotoUploadId) },
          })),
        }
      : null,
    fingerprint: {
      terdaftar: user.pemetaanFingerprint.length > 0,
      pemetaan: user.pemetaanFingerprint.map((p) => ({
        id: p.id, perangkatUserId: p.perangkatUserId,
        perangkat: p.perangkat,
      })),
    },
  }
}

/** Biodata untuk daftar/monitoring: ringkas + foto thumbnail saja. */
export async function thumbUntukUserIds(userIds: string[]): Promise<Map<string, { nama: string | null; fotoThumbUrl: string | null; nis?: string | null; nip?: string | null }>> {
  const map = new Map<string, { nama: string | null; fotoThumbUrl: string | null; nis?: string | null; nip?: string | null }>()
  if (userIds.length === 0) return map
  const rows = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true, name: true,
      biodata: { select: { fotoThumbId: true } },
      guru: { select: { nip: true, nama: true } },
      siswa: { select: { nis: true, nama: true } },
    },
  })
  for (const r of rows) {
    map.set(r.id, {
      nama: r.guru?.nama ?? r.siswa?.nama ?? r.name,
      fotoThumbUrl: fotoUrl(r.biodata?.fotoThumbId),
      nis: r.siswa?.nis ?? null,
      nip: r.guru?.nip ?? null,
    })
  }
  return map
}
