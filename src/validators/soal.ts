import { z } from "zod"

export const pilihanGandaSchema = z.object({
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
    isCorrect: z.boolean(),
  })).min(2, "Minimal 2 pilihan"),
})

export const trueFalseSchema = z.object({
  isTrue: z.boolean(),
})

export const matchingSchema = z.object({
  pairs: z.array(z.object({
    left: z.string(),
    right: z.string(),
  })).min(2, "Minimal 2 pasangan"),
})

export const isianSingkatSchema = z.object({
  jawaban: z.string().min(1, "Jawaban tidak boleh kosong"),
})

export const createSoalSchema = z.object({
  pertanyaan: z.string().min(1, "Pertanyaan tidak boleh kosong"),
  gambar: z.string().optional(),
  jenisSoal: z.enum(["PILIHAN_GANDA", "ESSAY", "TRUE_FALSE", "MATCHING", "ISIAN_SINGKAT"]),
  tingkatKesulitan: z.enum(["MUDAH", "SEDANG", "SULIT"]).default("SEDANG"),
  pilihanGanda: z.any().optional(),
  trueFalse: z.boolean().optional(),
  matching: z.any().optional(),
  jawaban: z.string().min(1, "Jawaban tidak boleh kosong"),
  poin: z.number().int().min(1).default(1),
  bab: z.string().optional(),
  tags: z.string().optional(),
  kategoriId: z.string().optional(),
  mataPelajaranId: z.string().min(1, "Mata pelajaran wajib dipilih"),
})

export type CreateSoalInput = z.infer<typeof createSoalSchema>
