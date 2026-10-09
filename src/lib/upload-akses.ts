// Kebijakan akses file Upload (/api/upload/[id]) — cegah IDOR.
//
// Tingkat akses (kolom upload.akses):
// - PUBLIK   : semua orang, termasuk tanpa login (mis. logo situs landing).
// - INTERNAL : semua user yang login (mis. materi, foto pelanggaran lintas guru BK).
// - PRIVAT   : pemilik upload + Admin (mis. bukti foto absensi — data pribadi).
//
// Kompatibilitas: baris lama (userId null, sebelum kolom pemilik ada) diperlakukan
// seperti INTERNAL agar link lama (materi, dll) tidak putus.

export type SubjekAkses = { id: string; role: string }
export type FileUploadAkses = { userId: string | null; akses: string }

export function bolehAksesUpload(file: FileUploadAkses, user: SubjekAkses | null | undefined): boolean {
  if (file.akses === "PUBLIK") return true
  if (!user) return false
  if (user.role === "ADMIN") return true
  if (file.akses === "INTERNAL") return true
  if (file.userId == null) return true // baris lama → tetap terbaca user login
  return file.userId === user.id
}
