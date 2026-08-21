import type { Role, JenisSoal, TingkatKesulitan, StatusUjian } from "@prisma/client"

export type { Role, JenisSoal, TingkatKesulitan, StatusUjian }

export interface SessionUser {
  id: string
  email: string
  name?: string | null
  image?: string | null
  role: Role
}

export interface PaginationParams {
  page: number
  limit: number
  search?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export interface PaginationResult<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface DashboardStats {
  totalGuru: number
  totalSiswa: number
  totalSoal: number
  totalUjian: number
  totalKelas: number
  totalMapel: number
  totalNilai: number
}

export interface GuruDashboardStats {
  kelasCount: number
  mapelCount: number
  siswaCount: number
  ujianAktif: number
  latihanAktif: number
  totalSoal: number
  rataNilai: number
  rataMastery: number
  riskHigh: number
  riskMedium: number
  topAtRisk: { id: string; nama: string; kelas: string; severity: string; message: string }[]
  aiInsight: string[]
}

export interface SiswaDashboardStats {
  nama: string
  kelas: string
  semester: string
  nilaiRataRata: number
  ujianAktif: number
  tugasAktif: number
  pengumuman: number
}

export interface NilaiGrafik {
  label: string
  nilai: number
}
