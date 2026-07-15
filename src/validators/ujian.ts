import { z } from "zod"

export const createUjianSchema = z.object({
  nama: z.string().min(1, "Nama ujian tidak boleh kosong"),
  deskripsi: z.string().optional(),
  mataPelajaranId: z.string().min(1, "Mata pelajaran wajib dipilih"),
  kelasId: z.string().min(1, "Kelas wajib dipilih"),
  jumlahSoal: z.number().int().min(1).max(200),
  nilaiMinimum: z.number().int().min(0).max(100).default(0),
  durasi: z.number().int().min(1, "Durasi minimal 1 menit"),
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  jamMulai: z.string().min(1, "Jam mulai wajib diisi"),
  jamSelesai: z.string().min(1, "Jam selesai wajib diisi"),
  mode: z.enum(["manual", "otomatis"]).default("manual"),
  isLatihan: z.boolean().default(false),
  randomSoal: z.boolean().default(true),
  randomJawaban: z.boolean().default(true),
  fullscreen: z.boolean().default(true),
  disableCopy: z.boolean().default(true),
  disablePaste: z.boolean().default(true),
  soalIds: z.array(z.string()).optional(),
})

export type CreateUjianInput = z.infer<typeof createUjianSchema>
