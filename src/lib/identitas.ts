import type { PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Verifikasi otomatis identitas unik:
 * - Siswa : NIS dan NISN (1 nomor hanya untuk 1 murid)
 * - Santri: Nomor Induk Santri (NISantri)
 * - Guru  : NIP
 *
 * Nomor dinormalisasi (trim, string kosong → null) sebelum disimpan/dicek,
 * dan pesan error ditampilkan apa adanya oleh form (toast).
 */

/** Klien database yang dipakai pengecekan (bisa diganti saat pengujian). */
type Db = Pick<PrismaClient, "siswa" | "santri" | "guru">

export function bersihkanNomor(v?: string | null): string | null {
  const t = (v ?? "").trim()
  return t || null
}

/** Ubah error Prisma P2002 menjadi pesan yang bisa dibaca pengguna. */
export function pesanDuplikat(err: unknown, pesan: string): Error {
  const code = (err as { code?: string })?.code
  if (code === "P2002") return new Error(pesan)
  return err instanceof Error ? err : new Error(pesan)
}

export async function cekNisUnik(nis: string | null, kecualiSiswaId?: string, db: Db = prisma) {
  if (!nis) return
  const dup = await db.siswa.findFirst({
    where: { nis, ...(kecualiSiswaId ? { id: { not: kecualiSiswaId } } : {}) },
    select: { nama: true },
  })
  if (dup) throw new Error(`NIS ${nis} sudah dipakai oleh ${dup.nama}. Gunakan NIS lain.`)
}

export async function cekNisnUnik(nisn: string | null, kecualiSiswaId?: string, db: Db = prisma) {
  if (!nisn) return
  const dup = await db.siswa.findFirst({
    where: { nisn, ...(kecualiSiswaId ? { id: { not: kecualiSiswaId } } : {}) },
    select: { nama: true },
  })
  if (dup) throw new Error(`NISN ${nisn} sudah dipakai oleh ${dup.nama}. Gunakan NISN lain.`)
}

/** NIS dan NISN harus unik, masing-masing hanya boleh dipakai satu murid. */
export async function cekIdentitasSiswa(
  data: { nis?: string | null; nisn?: string | null },
  kecualiSiswaId?: string,
  db: Db = prisma,
) {
  const nis = bersihkanNomor(data.nis)
  const nisn = bersihkanNomor(data.nisn)
  await cekNisUnik(nis, kecualiSiswaId, db)
  await cekNisnUnik(nisn, kecualiSiswaId, db)
}

export async function cekNisNoSantriUnik(nisNo: string | null, kecualiSantriId?: string, db: Db = prisma) {
  if (!nisNo) return
  const dup = await db.santri.findFirst({
    where: { nisNo, ...(kecualiSantriId ? { id: { not: kecualiSantriId } } : {}) },
    select: { nama: true },
  })
  if (dup) throw new Error(`Nomor Induk Santri ${nisNo} sudah dipakai oleh ${dup.nama}. Gunakan nomor lain.`)
}

export async function cekNipUnik(nip: string | null, kecualiGuruId?: string, db: Db = prisma) {
  if (!nip) return
  const dup = await db.guru.findFirst({
    where: { nip, ...(kecualiGuruId ? { id: { not: kecualiGuruId } } : {}) },
    select: { nama: true },
  })
  if (dup) throw new Error(`NIP ${nip} sudah dipakai oleh ${dup.nama}. Gunakan NIP lain.`)
}
