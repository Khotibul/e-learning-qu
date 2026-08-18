import { prisma } from "@/lib/prisma"

export interface Explanation {
  tipe: string
  judul: string
  penjelasan: string
  bukti: string[]
  confidence: number
}

export async function explainRecommendation(siswaId: string, materiId: string): Promise<Explanation> {
  const [materi, penguasaan, profile, rekomendasi] = await Promise.all([
    prisma.materi.findUnique({
      where: { id: materiId },
      include: { mataPelajaran: { select: { nama: true } }, kompetensi: { select: { nama: true, kode: true } } },
    }),
    prisma.penguasaanKompetensi.findMany({
      where: { siswaId },
      include: { kompetensi: { select: { nama: true, mataPelajaranId: true } } },
    }),
    prisma.studentProfile.findUnique({ where: { siswaId } }),
    prisma.rekomendasi.findFirst({
      where: { siswaId, materiId },
      orderBy: { createdAt: "desc" },
    }),
  ])

  if (!materi) {
    return { tipe: "ERROR", judul: "Materi tidak ditemukan", penjelasan: "Materi yang diminta tidak tersedia.", bukti: [], confidence: 0 }
  }

  const bukti: string[] = []
  const reasons: string[] = []

  const mapelPenguasaan = penguasaan.filter(
    (p) => p.kompetensi.mataPelajaranId === materi.mataPelajaranId
  )
  const avgSkor = mapelPenguasaan.length > 0
    ? Math.round(mapelPenguasaan.reduce((s, p) => s + p.skor, 0) / mapelPenguasaan.length)
    : 0

  if (avgSkor < 50) {
    reasons.push(`Penguasaan rata-rata di ${materi.mataPelajaran?.nama} hanya ${avgSkor}%`)
    bukti.push(`Rata-rata mastery: ${avgSkor}% (${mapelPenguasaan.length} kompetensi)`)
  }

  if (materi.kompetensi) {
    const kp = penguasaan.find((p) => p.kompetensiId === materi.kompetensiId)
    if (kp && kp.skor < 40) {
      reasons.push(`Kompetensi "${materi.kompetensi.nama}" (${materi.kompetensi.kode}) baru ${kp.skor}%`)
      bukti.push(`Mastery kompetensi: ${kp.skor}% (${kp.kategori})`)
    }
  }

  const nilaiMapel = await prisma.nilai.findMany({
    where: { siswaId, mataPelajaranId: materi.mataPelajaranId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 5,
  })
  if (nilaiMapel.length > 0) {
    const rata = Math.round(nilaiMapel.reduce((s, n) => s + n.nilai, 0) / nilaiMapel.length)
    if (rata < 75) {
      reasons.push(`Nilai rata-rata ${materi.mataPelajaran?.nama}: ${rata}`)
      bukti.push(`Nilai terakhir: ${nilaiMapel.map((n) => n.nilai).join(", ")}`)
    }
  }

  if (profile?.gayaBelajar) {
    bukti.push(`Gaya belajar: ${profile.gayaBelajar}`)
  }

  if (rekomendasi?.alasan) {
    reasons.push(rekomendasi.alasan)
  }

  const confidence = Math.min(reasons.length / 3, 1)
  return {
    tipe: "REKOMENDASI",
    judul: `Materi: ${materi.judul}`,
    penjelasan: reasons.length > 0
      ? `Materi ini direkomendasikan karena: ${reasons.join("; ")}.`
      : `Materi ini merupakan bagian dari ${materi.mataPelajaran?.nama} yang dapat memperkuat pemahaman.`,
    bukti,
    confidence: Math.round(confidence * 100) / 100,
  }
}

export async function explainMastery(siswaId: string, kompetensiId: string): Promise<Explanation> {
  const penguasaan = await prisma.penguasaanKompetensi.findUnique({
    where: { siswaId_kompetensiId: { siswaId, kompetensiId } },
    include: { kompetensi: { select: { nama: true, kode: true } } },
  })

  if (!penguasaan) {
    return { tipe: "MASTERY", judul: "Belum ada data", penjelasan: "Kompetensi ini belum pernah dinilai.", bukti: [], confidence: 0 }
  }

  const bukti: string[] = []
  const facts: string[] = []

  facts.push(`Skor penguasaan: ${penguasaan.skor}% (${penguasaan.kategori})`)
  bukti.push(`Benar: ${penguasaan.jumlahSoalBenar}, Salah: ${penguasaan.jumlahSoalSalah}`)
  bukti.push(`Latihan: ${penguasaan.jumlahLatihan}, Chat AI: ${penguasaan.jumlahChat}, Materi dibaca: ${penguasaan.jumlahMateri}`)

  if (penguasaan.rataNilaiMapel != null) {
    facts.push(`Rata-rata nilai: ${Math.round(penguasaan.rataNilaiMapel)}`)
  }

  let kesimpulan = ""
  if (penguasaan.kategori === "ADVANCED") kesimpulan = "Penguasaan sangat baik. Pertahankan!"
  else if (penguasaan.kategori === "PROFICIENT") kesimpulan = "Penguasaan baik. Beberapa area masih bisa diperkuat."
  else if (penguasaan.kategori === "DEVELOPING") kesimpulan = "Pembelajaran sedang berjalan. Terus latihan untuk meningkatkan."
  else if (penguasaan.kategori === "BASIC") kesimpulan = "Masih dasar. Perlu lebih banyak latihan dan membaca materi."
  else kesimpulan = "Baru mulai. Mulai dari materi dasar dan kerjakan latihan."

  return {
    tipe: "MASTERY",
    judul: `${penguasaan.kompetensi.kode} — ${penguasaan.kompetensi.nama}`,
    penjelasan: `${facts.join(". ")}. ${kesimpulan}`,
    bukti,
    confidence: Math.min((penguasaan.jumlahSoalBenar + penguasaan.jumlahSoalSalah) / 10, 1),
  }
}

export async function explainEarlyWarning(warningId: string): Promise<Explanation> {
  const warning = await prisma.earlyWarning.findUnique({ where: { id: warningId } })
  if (!warning) {
    return { tipe: "WARNING", judul: "Warning tidak ditemukan", penjelasan: "", bukti: [], confidence: 0 }
  }

  const detail = warning.detail as any
  const bukti: string[] = []
  let penjelasan = warning.message

  switch (warning.tipe) {
    case "NILAI_DROP":
      if (detail) {
        bukti.push(`Rata-rata keseluruhan: ${detail.avg}`)
        bukti.push(`Rata-rata 3 terakhir: ${detail.recentAvg}`)
        bukti.push(`Penurunan: ${detail.drop} poin`)
        penjelasan = `Nilai ${detail.mapel} mengalami penurunan sebesar ${detail.drop} poin. ${warning.severity === "CRITICAL" ? "Perlu perhatian segera!" : "Pantau terus perkembangannya."}`
      }
      break
    case "INAKTIF":
      if (detail) {
        bukti.push(`Terakhir aktif: ${new Date(detail.lastActive).toLocaleDateString("id-ID")}`)
        bukti.push(`Hari tidak aktif: ${detail.daysInactive}`)
        penjelasan = `Siswa sudah tidak aktif selama ${detail.daysInactive} hari. Hubungi orang tua atau wali kelas.`
      }
      break
    case "RENDAH_PENGUASAAN":
      if (detail?.kompetensi) {
        for (const k of detail.kompetensi) bukti.push(`${k.nama}: ${k.skor}% (${k.kategori})`)
        penjelasan = `${detail.kompetensi.length} kompetensi dengan penguasaan di bawah 30%. Fokuskan remediasi.`
      }
      break
    case "GAGAL_UJIAN":
      if (detail?.ujian) {
        for (const u of detail.ujian) bukti.push(`${u.nama}: ${u.nilai} (min: ${u.minimum})`)
        penjelasan = `Gagal ${detail?.ujian?.length || 0} ujian. Pertimbangkan bimbingan intensif.`
      }
      break
    case "LOW_MOTIVASI":
      if (detail) {
        bukti.push(`Motivasi: ${Math.round(detail.motivasi * 100)}%`)
        bukti.push(`Engagement: ${Math.round(detail.engagement * 100)}%`)
        bukti.push(`Konsistensi: ${Math.round(detail.konsistensi * 100)}%`)
        bukti.push(`Streak: ${detail.streak} hari`)
        penjelasan = `Skor motivasi rendah (${Math.round(detail.motivasi * 100)}%). Pertimbangkan pendekatan yang lebih menarik.`
      }
      break
  }

  return {
    tipe: "WARNING",
    judul: warning.tipe.replace(/_/g, " "),
    penjelasan,
    bukti,
    confidence: warning.skor,
  }
}
