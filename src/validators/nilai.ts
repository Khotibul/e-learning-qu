import { z } from "zod"

export const penilaianEssaySchema = z.object({
  jawabanUjianId: z.string(),
  nilai: z.number().int().min(0).max(100),
  komentar: z.string().optional(),
  catatan: z.string().optional(),
  rubrik: z.any().optional(),
})

export type PenilaianEssayInput = z.infer<typeof penilaianEssaySchema>
