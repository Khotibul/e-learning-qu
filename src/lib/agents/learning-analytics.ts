import { prisma } from "@/lib/prisma"
import type { AktivitasJenis } from "@prisma/client"
import type { Prisma } from "@prisma/client"

interface TrackActivityInput {
  siswaId: string
  jenis: AktivitasJenis
  kompetensiId?: string | null
  mataPelajaranId?: string | null
  targetId?: string | null
  detail?: Record<string, unknown> | null
  durationMs?: number | null
}

export async function trackActivity(input: TrackActivityInput) {
  try {
    await prisma.learningActivity.create({
      data: {
        siswaId: input.siswaId,
        jenis: input.jenis,
        kompetensiId: input.kompetensiId ?? null,
        mataPelajaranId: input.mataPelajaranId ?? null,
        targetId: input.targetId ?? null,
        detail: (input.detail as Prisma.InputJsonValue) ?? undefined,
        durationMs: input.durationMs ?? null,
      },
    })
  } catch {
    // silent — analytics must never break main flow
  }
}

export function trackLogin(siswaId: string) {
  return trackActivity({ siswaId, jenis: "LOGIN" })
}

export function trackLogout(siswaId: string) {
  return trackActivity({ siswaId, jenis: "LOGOUT" })
}

export function trackMateriOpened(siswaId: string, materiId: string, mataPelajaranId?: string) {
  return trackActivity({
    siswaId,
    jenis: "MATERI_DIBUKA",
    mataPelajaranId,
    targetId: materiId,
    detail: { materiId },
  })
}

export function trackMateriCompleted(siswaId: string, materiId: string, mataPelajaranId?: string, durationMs?: number) {
  return trackActivity({
    siswaId,
    jenis: "MATERI_SELESAI",
    mataPelajaranId,
    targetId: materiId,
    detail: { materiId },
    durationMs,
  })
}

export function trackSoalDikerjakan(siswaId: string, soalId: string, kompetensiId?: string, mataPelajaranId?: string) {
  return trackActivity({
    siswaId,
    jenis: "SOAL_DIKERJAKAN",
    kompetensiId,
    mataPelajaranId,
    targetId: soalId,
  })
}

export function trackLatihanDimulai(siswaId: string, latihanId: string, mataPelajaranId?: string) {
  return trackActivity({
    siswaId,
    jenis: "LATIHAN_DIMULAI",
    mataPelajaranId,
    targetId: latihanId,
  })
}

export function trackLatihanSelesai(siswaId: string, latihanId: string, mataPelajaranId?: string, detail?: Record<string, unknown>, durationMs?: number) {
  return trackActivity({
    siswaId,
    jenis: "LATIHAN_SELESAI",
    mataPelajaranId,
    targetId: latihanId,
    detail,
    durationMs,
  })
}

export function trackAiChat(siswaId: string, sessionId: string, mapelId?: string) {
  return trackActivity({
    siswaId,
    jenis: "AI_CHAT",
    mataPelajaranId: mapelId,
    targetId: sessionId,
  })
}

export function trackAssessmentDimulai(siswaId: string, ujianId: string, mataPelajaranId?: string) {
  return trackActivity({
    siswaId,
    jenis: "ASSESSMENT_DIMULAI",
    mataPelajaranId,
    targetId: ujianId,
  })
}

export function trackAssessmentSelesai(siswaId: string, ujianId: string, mataPelajaranId?: string, detail?: Record<string, unknown>, durationMs?: number) {
  return trackActivity({
    siswaId,
    jenis: "ASSESSMENT_SELESAI",
    mataPelajaranId,
    targetId: ujianId,
    detail,
    durationMs,
  })
}

export function trackPretest(siswaId: string, kompetensiId?: string, mataPelajaranId?: string, detail?: Record<string, unknown>) {
  return trackActivity({ siswaId, jenis: "PRETEST", kompetensiId, mataPelajaranId, detail })
}

export function trackPosttest(siswaId: string, kompetensiId?: string, mataPelajaranId?: string, detail?: Record<string, unknown>) {
  return trackActivity({ siswaId, jenis: "POSTTEST", kompetensiId, mataPelajaranId, detail })
}

export function trackRekomendasiDiklik(siswaId: string, materiId: string, mataPelajaranId?: string) {
  return trackActivity({
    siswaId,
    jenis: "REKOMENDASI_DIKLIK",
    mataPelajaranId,
    targetId: materiId,
    detail: { materiId },
  })
}
