import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const siswa = await prisma.siswa.findUnique({
      where: { userId: user.id },
      include: { kelas: true, jurusan: true },
    })
    if (!siswa) return NextResponse.json({ error: "Siswa not found" }, { status: 404, headers: corsHeaders })

    const activeSemester = await prisma.semester.findFirst({
      where: { isAktif: true },
      include: { tahunAjaran: true },
    })

    const [avgNilai, ujianAktif, tugasAktif, pengumuman, penguasaanList, latihanStats, learningActivities, nextUjian, learningPaths] = await Promise.all([
      prisma.nilai.aggregate({ where: { siswaId: siswa.id }, _avg: { nilai: true } }),
      siswa.kelasId ? prisma.ujian.count({ where: { kelasId: siswa.kelasId, isLatihan: false, status: "AKTIF", deletedAt: null } }) : Promise.resolve(0),
      siswa.kelasId ? prisma.ujian.count({ where: { kelasId: siswa.kelasId, isLatihan: true, status: "AKTIF", deletedAt: null } }) : Promise.resolve(0),
      prisma.pengumuman.findMany({
        where: { OR: [{ kelasId: siswa.kelasId }, { tipe: "UMUM" }], deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { name: true } } },
      }),
      prisma.penguasaanKompetensi.findMany({
        where: { siswaId: siswa.id },
        include: { kompetensi: { select: { nama: true, mataPelajaran: { select: { nama: true } } } } },
      }),
      prisma.latihanAI.aggregate({ where: { siswaId: siswa.id }, _avg: { skor: true }, _count: { _all: true } }),
      prisma.learningActivity.findMany({ where: { siswaId: siswa.id }, select: { jenis: true, createdAt: true, durationMs: true }, orderBy: { createdAt: "desc" } }),
      siswa.kelasId ? prisma.ujian.findFirst({
        where: { kelasId: siswa.kelasId, isLatihan: false, status: "AKTIF", deletedAt: null },
        select: { id: true, nama: true, mataPelajaran: { select: { nama: true } }, jamSelesai: true },
        orderBy: { jamSelesai: "asc" },
      }) : Promise.resolve(null),
      prisma.learningPath.findMany({ where: { siswaId: siswa.id }, select: { progres: true } }),
    ])

    const nilaiRataRata = avgNilai._avg.nilai ?? 0
    const rataMastery = penguasaanList.length > 0 ? Math.round(penguasaanList.reduce((sum, p) => sum + p.skor, 0) / penguasaanList.length) : 0
    const kompetensiTerkuat = penguasaanList.length > 0 ? penguasaanList.reduce((best, p) => p.skor > best.skor ? p : best) : null
    const kompetensiTerlemah = penguasaanList.length > 0 ? penguasaanList.reduce((worst, p) => p.skor < worst.skor ? p : worst) : null
    const totalDurationMs = learningActivities.reduce((sum, a) => sum + (a.durationMs ?? 0), 0)
    const jamBelajar = Math.round(totalDurationMs / (1000 * 60 * 60) * 10) / 10

    const today = new Date()
    const activityDates = new Set(
      learningActivities.filter((a) => a.jenis !== "LOGIN" && a.jenis !== "LOGOUT").map((a) => a.createdAt.toISOString().slice(0, 10))
    )
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      if (activityDates.has(key)) streak++
      else if (i > 0) break
    }

    const progresBelajar = learningPaths.length > 0 ? Math.round(learningPaths.reduce((sum, lp) => sum + (lp.progres ?? 0), 0) / learningPaths.length) : 0
    const jurusanNama = (siswa as unknown as { jurusan?: { nama: string } }).jurusan?.nama ?? "-"
    const totalMateri = siswa.kelasId
      ? await prisma.materi.count({ where: { deletedAt: null, mataPelajaran: { pengajaran: { some: { kelasId: siswa.kelasId } } } } })
      : await prisma.materi.count({ where: { deletedAt: null } })

    let aiInsight = "Mulai belajar untuk melihat insight AI."
    if (streak >= 7) aiInsight = `Kamu sudah aktif ${streak} hari berturut-turut. Pertahankan!`
    else if (rataMastery < 40) aiInsight = "Mastery masih rendah. Fokus ke materi dasar dan sering latihan."
    else if (nilaiRataRata >= 80) aiInsight = "Nilaimu bagus! Coba tantang diri dengan materi lebih lanjut."
    else if (kompetensiTerlemah && kompetensiTerlemah.skor < 40) aiInsight = `Perlu perhatian pada "${kompetensiTerlemah.kompetensi.nama}" (mastery ${kompetensiTerlemah.skor}%).`

    // === TAMBAHAN UNTUK ANDROID: persentase absensi, keaktifan materi, AI, aplikasi ===
    const totalAbsensi = await prisma.absensi.count({ where: { siswa: { some: { siswaId: siswa.id } } } })
    const hadirAbsensi = await prisma.absensiSiswa.count({ where: { siswaId: siswa.id, status: "HADIR" } })
    const persentaseAbsensi = totalAbsensi > 0 ? Math.round((hadirAbsensi / totalAbsensi) * 100) : 0

    const materiDiakses = learningActivities.filter((a) => a.jenis === "MATERI_DIBUKA" || a.jenis === "MATERI_SELESAI").length
    const keaktifanMateri = totalMateri > 0 ? Math.round((materiDiakses / totalMateri) * 100) : 0

    const aiChatCount = learningActivities.filter((a) => a.jenis === "AI_CHAT").length
    const keaktifanAI = learningActivities.length > 0 ? Math.round((aiChatCount / learningActivities.length) * 100) : 0

    const totalAktivitas = learningActivities.length
    const keaktifanAplikasi = totalAktivitas > 0 ? Math.min(100, Math.round((totalAktivitas / 30) * 100)) : 0

    return NextResponse.json({
      nama: siswa.nama,
      kelas: siswa.kelas?.nama ?? "-",
      jurusan: jurusanNama,
      jabatan: siswa.jabatan ?? null,
      semester: activeSemester ? `${activeSemester.nama} (${activeSemester.tahunAjaran.nama})` : "-",
      nilaiRataRata,
      rataMastery,
      ujianAktif,
      tugasAktif,
      streak,
      jamBelajar,
      progresBelajar,
      totalMateri,
      kompetensiTerkuat: kompetensiTerkuat ? { nama: kompetensiTerkuat.kompetensi.nama, skor: kompetensiTerkuat.skor, mapel: kompetensiTerkuat.kompetensi.mataPelajaran?.nama ?? "" } : null,
      kompetensiTerlemah: kompetensiTerlemah ? { nama: kompetensiTerlemah.kompetensi.nama, skor: kompetensiTerlemah.skor, mapel: kompetensiTerlemah.kompetensi.mataPelajaran?.nama ?? "" } : null,
      nextUjian: nextUjian ? { nama: nextUjian.nama, mapel: nextUjian.mataPelajaran?.nama ?? "", berakhir: nextUjian.jamSelesai?.toISOString() ?? null } : null,
      aiInsight,
      // Grafik persentase untuk beranda Android
      persentaseAbsensi,
      keaktifanMateri,
      keaktifanAI,
      keaktifanAplikasi,
      hadirAbsensi,
      totalAbsensi,
      materiDiakses,
      aiChatCount,
      totalAktivitas,
      pengumuman: pengumuman.map((p) => ({ id: p.id, judul: p.judul, isi: p.isi, createdAt: p.createdAt.toISOString(), author: p.user.name ?? "-" })),
    }, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile dashboard error:", e)
    return NextResponse.json({ error: "Gagal memuat dashboard" }, { status: 500, headers: corsHeaders })
  }
}
