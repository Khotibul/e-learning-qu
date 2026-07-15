import { z } from "zod"

export const roleSelectionSchema = z.object({
  role: z.enum(["GURU", "SISWA"], { error: "Pilih role terlebih dahulu" }),
  nama: z.string().min(3, "Nama minimal 3 karakter"),
  nip: z.string().optional(),
  nis: z.string().optional(),
  nisn: z.string().optional(),
  noTelp: z.string().optional(),
  alamat: z.string().optional(),
})

export type RoleSelectionInput = z.infer<typeof roleSelectionSchema>
