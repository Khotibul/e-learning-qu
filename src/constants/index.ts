export const ROLES = {
  ADMIN: "ADMIN" as const,
  GURU: "GURU" as const,
  SISWA: "SISWA" as const,
}

export const JENIS_SOAL = {
  PILIHAN_GANDA: "PILIHAN_GANDA" as const,
  ESSAY: "ESSAY" as const,
  TRUE_FALSE: "TRUE_FALSE" as const,
  MATCHING: "MATCHING" as const,
  ISIAN_SINGKAT: "ISIAN_SINGKAT" as const,
}

export const TINGKAT_KESULITAN = {
  MUDAH: "MUDAH" as const,
  SEDANG: "SEDANG" as const,
  SULIT: "SULIT" as const,
}

export const STATUS_UJIAN = {
  DRAFT: "DRAFT" as const,
  AKTIF: "AKTIF" as const,
  SELESAI: "SELESAI" as const,
}

export const JENIS_NILAI = {
  HARIAN: "HARIAN" as const,
  LATIHAN: "LATIHAN" as const,
  UTS: "UTS" as const,
  UAS: "UAS" as const,
  AKHIR: "AKHIR" as const,
  UJIAN: "UJIAN" as const,
}

export const NAV_ITEMS = {
  ADMIN: [
    { label: "Dashboard", href: "/admin", icon: "LayoutDashboard" },
    { label: "Guru", href: "/admin/guru", icon: "UserCheck" },
    { label: "Murid", href: "/admin/murid", icon: "Users" },
    { label: "Kelas", href: "/admin/kelas", icon: "DoorOpen" },
    { label: "Mata Pelajaran", href: "/admin/mapel", icon: "BookOpen" },
    { label: "Tahun Ajaran", href: "/admin/tahun-ajaran", icon: "Calendar" },
    { label: "Semester", href: "/admin/semester", icon: "CalendarRange" },
    { label: "Jadwal Ujian", href: "/admin/jadwal-ujian", icon: "CalendarClock" },
    { label: "Pengumuman", href: "/admin/pengumuman", icon: "Megaphone" },
    { label: "Nilai", href: "/admin/nilai", icon: "Award" },
    { label: "Statistik", href: "/admin/statistik", icon: "BarChart3" },
  ],
  GURU: [
    { label: "Dashboard", href: "/guru", icon: "LayoutDashboard" },
    { label: "Murid", href: "/guru/murid", icon: "Users" },
    { label: "Bank Soal", href: "/guru/bank-soal", icon: "Database" },
    { label: "Soal", href: "/guru/soal", icon: "FileQuestion" },
    { label: "Ujian", href: "/guru/ujian", icon: "ClipboardList" },
    { label: "Absensi", href: "/guru/absensi", icon: "ClipboardCheck" },
    { label: "Nilai", href: "/guru/nilai", icon: "Award" },
    { label: "Analitik", href: "/guru/analitik", icon: "BarChart3" },
  ],
  SISWA: [
    { label: "Dashboard", href: "/siswa", icon: "LayoutDashboard" },
    { label: "Ujian", href: "/siswa/ujian", icon: "ClipboardList" },
    { label: "Latihan", href: "/siswa/latihan", icon: "FileText" },
    { label: "Nilai", href: "/siswa/nilai", icon: "Award" },
    { label: "Ranking", href: "/siswa/ranking", icon: "Trophy" },
  ],
}
