"use server"

import { auth } from "@/lib/auth"
import {
  ajukanIzinSantri, batalkanIzinSantri, getIzinSaya, konfirmasiPerjalanan,
  simpanDraftIzin, perbaruiIzinTerlambat, JENIS_IZIN_LABEL, STATUS_IZIN_LABEL, KEBERADAAN_LABEL,
} from "@/lib/izin-santri"
import { prisma } from "@/lib/prisma"
import type { JenisIzin } from "@prisma/client"

export async function getIzinSayaAction() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const data = await getIzinSaya(session.user.id)
  return { ...data, jenisLabel: JENIS_IZIN_LABEL, statusLabel: STATUS_IZIN_LABEL, keberadaanLabel: KEBERADAAN_LABEL }
}

export async function ajukanIzinAction(input: {
  jenis: string; alasan: string; rencanaKeluar: string; rencanaKembali: string
  alamatTujuan: string; namaPenjemput: string; hubunganPenjemput: string; noTelpPenjemput: string
  lampiranId?: string | null
}, draftId?: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  return ajukanIzinSantri(session.user.id, input, draftId)
}

export async function simpanDraftIzinAction(input: {
  jenis: string; alasan: string; rencanaKeluar: string; rencanaKembali: string
  alamatTujuan: string; namaPenjemput: string; hubunganPenjemput: string; noTelpPenjemput: string
  lampiranId?: string | null
}, draftId?: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  return simpanDraftIzin(session.user.id, input, draftId)
}

export async function batalkanIzinAction(izinId: string, alasan: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  return batalkanIzinSantri(session.user.id, izinId, alasan)
}

export async function konfirmasiPerjalananAction(izinId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  return konfirmasiPerjalanan(izinId, session.user.id)
}

/** Daftar jenis izin yang aktif (untuk dropdown form). */
export async function getJenisIzinOpts(): Promise<{ value: JenisIzin; label: string }[]> {
  const rows = await prisma.izinPengaturan.findMany({ where: { aktif: true }, select: { jenis: true } })
  const aktif = new Set(rows.map((r) => r.jenis))
  // default bila belum ada pengaturan tersimpan → semua jenis aktif
  const semua = Object.entries(JENIS_IZIN_LABEL) as [JenisIzin, string][]
  if (rows.length === 0) return semua.map(([value, label]) => ({ value, label }))
  return semua.filter(([v]) => aktif.has(v)).map(([value, label]) => ({ value, label }))
}

export async function refreshStatusIzin() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  return perbaruiIzinTerlambat()
}
