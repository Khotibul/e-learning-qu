import { prisma } from "@/lib/prisma"

// ─── NOTIFICATION CENTER (tabel notifications) ─────────────────────
// Satu-satunya pintu pembuat notifikasi. Idempoten via eventKey+userId
// (unique) sehingga sinkronisasi ulang fingerprint tidak menggandakan notifikasi.

export type PenerimaNotifikasi = {
  userId: string
  label: string // untuk debugging/audit: "siswa" | "wali-kelas" | "wali-murid"
  link?: string // override tujuan per penerima (wali kelas ≠ siswa)
}

export type PayloadNotifikasi = {
  judul: string
  pesan: string
  tipe?: string // INFO | ABSENSI | SISTEM
  link?: string
  eventKey?: string // kunci idempotensi: 1 event absensi → 1 notif per penerima
}

/**
 * Kirim notifikasi in-app ke daftar penerima.
 * Return: { terkirim, duplikat, gagal } — duplikat diabaikan (bukan error).
 */
export async function kirimNotifikasi(
  penerima: PenerimaNotifikasi[],
  payload: PayloadNotifikasi
): Promise<{ terkirim: number; duplikat: number; gagal: number }> {
  const unik = new Map<string, PenerimaNotifikasi>()
  for (const p of penerima) if (p.userId) unik.set(p.userId, p)

  let terkirim = 0
  let duplikat = 0
  let gagal = 0

  for (const p of unik.values()) {
    try {
      await prisma.notification.create({
        data: {
          userId: p.userId,
          judul: payload.judul,
          pesan: payload.pesan,
          tipe: payload.tipe ?? "INFO",
          link: p.link ?? payload.link ?? null,
          eventKey: payload.eventKey ?? null,
          status: "TERKIRIM",
        },
      })
      terkirim++
    } catch (e: any) {
      // P2002 = eventKey+userId sama → notifikasi sudah pernah dibuat (idempoten)
      if (e?.code === "P2002") {
        duplikat++
        continue
      }
      gagal++
      console.error("Notifikasi gagal:", e?.code ?? e)
      // Coba simpan status GAGAL tanpa eventKey agar riwayat tetap ada
      try {
        await prisma.notification.create({
          data: {
            userId: p.userId,
            judul: payload.judul,
            pesan: payload.pesan,
            tipe: payload.tipe ?? "INFO",
            link: p.link ?? payload.link ?? null,
            status: "GAGAL",
          },
        })
      } catch {
        /* DB bermasalah — biarkan log console */
      }
    }
  }
  return { terkirim, duplikat, gagal }
}

/**
 * Penerima notifikasi absensi harian siswa:
 * 1. Akun siswa itu sendiri (dipantau Wali Murid melalui akun siswa bila
 *    akun wali murid tersendiri belum ada).
 * 2. Wali Kelas (Kelas.guruId → Guru.userId) — hanya untuk siswa berkelas.
 * 3. Wali Murid (relasi terpisah) — DIHIDUPKAN otomatis bila model relasi
 *    wali murid tersedia di kemudian hari (lihat cabang `waliMuridUserId`).
 */
export async function penerimaKehadiranSiswa(siswaId: string): Promise<PenerimaNotifikasi[]> {
  const siswa = await prisma.siswa.findUnique({
    where: { id: siswaId },
    select: {
      userId: true,
      nama: true,
      kelas: { select: { id: true, nama: true, guruId: true, guru: { select: { userId: true, nama: true } } } },
    },
  })
  if (!siswa) return []

  const hasil: PenerimaNotifikasi[] = [{ userId: siswa.userId, label: "siswa" }]
  if (siswa.kelas?.guru?.userId) {
    // Wali kelas membuka dashboard kelasnya, bukan halaman siswa
    hasil.push({ userId: siswa.kelas.guru.userId, label: "wali-kelas", link: "/guru/wali-kelas" })
  }
  // TODO(wali-murid): bila tabel relasi wali murid tersedia, tambahkan userId wali di sini.
  return hasil
}

export function pesanAbsensiHarian(params: {
  nama: string
  kelasNama: string | null
  tipe: "MASUK" | "PULANG"
  jam: string
  status?: string | null
  terlambatMenit?: number | null
}): { judul: string; pesan: string } {
  const { nama, kelasNama, tipe, jam, status, terlambatMenit } = params
  const kelas = kelasNama ? ` (Kelas ${kelasNama})` : ""
  if (tipe === "MASUK") {
    if (status === "TERLAMBAT") {
      return {
        judul: "Absensi Masuk — Terlambat",
        pesan: `${nama}${kelas} telah masuk sekolah pukul ${jam} WIB. Status: TERLAMBAT ${terlambatMenit ?? 0} menit.`,
      }
    }
    return {
      judul: "Absensi Masuk Sekolah",
      pesan: `${nama}${kelas} telah melakukan absensi MASUK sekolah pada pukul ${jam} WIB. Status: HADIR.`,
    }
  }
  return {
    judul: "Absensi Pulang Sekolah",
    pesan: `${nama}${kelas} telah melakukan absensi PULANG sekolah pada pukul ${jam} WIB.${status === "AWAL" ? " Status: PULANG LEBIH AWAL." : ""}`,
  }
}

// ─── LISTS (untuk Notification Center UI) ──────────────────────────

export async function getNotifikasi(userId: string, opts?: { unreadOnly?: boolean; take?: number }) {
  return prisma.notification.findMany({
    where: { userId, ...(opts?.unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 50,
    select: { id: true, judul: true, pesan: true, tipe: true, isRead: true, link: true, status: true, createdAt: true },
  })
}

export async function tandaiDibaca(userId: string, ids?: string[]) {
  const res = await prisma.notification.updateMany({
    where: { userId, ...(ids && ids.length > 0 ? { id: { in: ids } } : {}), isRead: false },
    data: { isRead: true },
  })
  return res.count
}
