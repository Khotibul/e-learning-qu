export interface SemesterRef {
  id: string
  nama: string
  isAktif: boolean
  tahunAjaran: { nama: string }
}

export interface KelasRef {
  id: string
  nama: string
  tingkat: number
  guruId: string | null
  guru: { nama: string } | null
}

export interface MapelRef {
  id: string
  nama: string
  kode: string
  semesterId: string
}

export interface RaportRefs {
  semesters: SemesterRef[]
  kelas: KelasRef[]
  mapels: MapelRef[]
  isAdmin: boolean
  guruId: string | null
  waliKelasIds: string[]
}

export interface KomponenRow {
  id: string
  nama: string
  jenis: string
  bobot: number
  tanggal: string | Date
  _count: { nilais: number }
}

export interface RaportBaris {
  id: string
  siswaId: string
  status: "DRAFT" | "TERBIT"
  rataRata: number | null
  peringkat: number | null
  catatanWali: string | null
  sikapPredikat: string | null
  sikapDeskripsi: string | null
  prestasi: string | null
  sakit: number
  izin: number
  alpa: number
  terbitAt: string | Date | null
  nilais: { mapelId: string; nilaiAkhir: number; predikat: string; deskripsi: string | null }[]
}

export interface RekapData {
  siswas: { id: string; nama: string; nis: string | null; nisn: string | null }[]
  mapels: { id: string; nama: string; kode: string }[]
  nilai: Record<string, Record<string, number | null>>
  sumber: Record<string, Record<string, "KOMPONEN" | "UJIAN" | null>>
  jumlahKomponen: Record<string, number>
  pengaturan: {
    bobotFormatif: number
    bobotSumatif: number
    bobotProyek: number
    bobotPraktik: number
    ambangA: number
    ambangB: number
    ambangC: number
    kktp: number
  }
  kelas: { id: string; nama: string; guru: { nama: string } | null } | null
  raports: RaportBaris[]
}
