import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

function tanggalKeDate(tanggal: string): Date {
  const d = new Date(tanggal + "T00:00:00")
  d.setHours(0, 0, 0, 0)
  return d
}

const STATUS_VALID = ["HADIR", "TERLAMBAT", "SAKIT", "IZIN", "ALPA"]

// GET: ambil absensi murid per kelas+mapel+sesi+tanggal
export async function GET(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const { searchParams } = new URL(req.url)
    const kelasId = searchParams.get("kelasId")
    const mataPelajaranId = searchParams.get("mataPelajaranId")
    const tanggal = searchParams.get("tanggal")
    const jadwalPelajaranId = searchParams.get("jadwalPelajaranId")

    if (!kelasId || !mataPelajaranId || !tanggal) {
      return NextResponse.json({ error: "kelasId, mataPelajaranId, tanggal wajib" }, { status: 400, headers: corsHeaders })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ error: "Format tanggal harus YYYY-MM-DD" }, { status: 400, headers: corsHeaders })
    }

    const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
    if (!guru) return NextResponse.json({ error: "Not guru" }, { status: 403, headers: corsHeaders })

    const isPengampu = await prisma.pengajaran.findFirst({
      where: { guruId: guru.id, kelasId, mataPelajaranId, deletedAt: null },
    })
    const isWali = await prisma.kelas.findFirst({ where: { id: kelasId, guruId: guru.id, deletedAt: null }, select: { id: true } })
    if (!isPengampu && !isWali) return NextResponse.json({ error: "Tidak mengampu" }, { status: 403, headers: corsHeaders })

    const date = tanggalKeDate(tanggal)

    // Sesi mengajar guru pada jam pelajaran ini — membuka fitur absensi siswa.
    let guruAbsen: boolean | null = null
    if (jadwalPelajaranId) {
      const jadwal = await prisma.jadwalPelajaran.findFirst({
        where: { id: jadwalPelajaranId, kelasId, mataPelajaranId, deletedAt: null },
        select: { id: true },
      })
      if (!jadwal) return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404, headers: corsHeaders })
      const sesi = await prisma.absensiGuruSesi.findFirst({
        where: { guruId: guru.id, jadwalPelajaranId, tanggal: date },
        select: { jamMasuk: true },
      })
      guruAbsen = !!sesi?.jamMasuk
    }

    const absensi = await prisma.absensi.findFirst({
      where: {
        kelasId,
        mataPelajaranId,
        tanggal: date,
        ...(jadwalPelajaranId ? { jadwalPelajaranId } : {}),
      },
      include: { siswa: { include: { siswa: { select: { id: true, nama: true, nis: true } } } } },
      orderBy: { createdAt: "asc" },
    })

    // Selalu kirim seluruh siswa kelas agar siswa yang belum tercatat tidak hilang dari daftar.
    const semuaSiswa = await prisma.siswa.findMany({
      where: { kelasId, deletedAt: null },
      select: { id: true, nama: true, nis: true },
      orderBy: { nama: "asc" },
    })
    const tercatat = new Map((absensi?.siswa ?? []).map((s) => [s.siswaId, s]))

    return NextResponse.json(
      {
        absensi: absensi ? { id: absensi.id, tanggal: absensi.tanggal, jadwalPelajaranId: absensi.jadwalPelajaranId } : null,
        guruAbsen,
        siswas: semuaSiswa.map((s) => {
          const rec = tercatat.get(s.id)
          return {
            siswaId: s.id,
            nama: s.nama,
            nis: s.nis,
            status: rec?.status ?? "HADIR",
            keterangan: rec?.keterangan ?? null,
          }
        }),
      },
      { headers: corsHeaders }
    )
  } catch (e) {
    console.error("Mobile absensi siswa GET error:", e)
    return NextResponse.json({ error: "Gagal memuat absensi siswa" }, { status: 500, headers: corsHeaders })
  }
}

// POST: simpan absensi murid per sesi mapel (1x per sesi per hari, bisa diperbarui)
export async function POST(req: Request) {
  try {
    const user = await getMobileUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

    const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
    if (!guru) return NextResponse.json({ error: "Not guru" }, { status: 403, headers: corsHeaders })

    const body = await req.json()
    const kelasId = String(body.kelasId ?? "")
    const mataPelajaranId = String(body.mataPelajaranId ?? "")
    const jadwalPelajaranId = body.jadwalPelajaranId ? String(body.jadwalPelajaranId) : null
    const tanggal = String(body.tanggal ?? "")
    const siswaStatus = body.siswaStatus as { siswaId: string; status: string; keterangan?: string | null }[] | undefined

    if (!kelasId || !mataPelajaranId || !tanggal || !Array.isArray(siswaStatus)) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ error: "Format tanggal harus YYYY-MM-DD" }, { status: 400, headers: corsHeaders })
    }
    if (siswaStatus.some((s) => !s?.siswaId || !STATUS_VALID.includes(String(s?.status)))) {
      return NextResponse.json({ error: "Status absensi tidak valid" }, { status: 400, headers: corsHeaders })
    }

    const isPengampu = await prisma.pengajaran.findFirst({
      where: { guruId: guru.id, kelasId, mataPelajaranId, deletedAt: null },
    })
    const isWali = await prisma.kelas.findFirst({ where: { id: kelasId, guruId: guru.id, deletedAt: null }, select: { id: true } })
    if (!isPengampu && !isWali) return NextResponse.json({ error: "Tidak mengampu" }, { status: 403, headers: corsHeaders })

    const date = tanggalKeDate(tanggal)

    // Alur per sesi: Absensi Siswa hanya terbuka setelah guru Absen Masuk pada sesi ini.
    if (jadwalPelajaranId) {
      const jadwal = await prisma.jadwalPelajaran.findFirst({
        where: { id: jadwalPelajaranId, kelasId, mataPelajaranId, deletedAt: null },
        select: { id: true },
      })
      if (!jadwal) return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 400, headers: corsHeaders })

      if (isPengampu) {
        const sesi = await prisma.absensiGuruSesi.findFirst({
          where: { guruId: guru.id, jadwalPelajaranId, tanggal: date },
          select: { jamMasuk: true },
        })
        if (!sesi?.jamMasuk) {
          return NextResponse.json(
            { error: "Lakukan Absen Masuk sesi ini terlebih dahulu sebelum mengabsensi siswa" },
            { status: 400, headers: corsHeaders }
          )
        }
      }
    }

    // Pastikan semua siswa yang dikirim memang anggota kelas ini.
    const siswaKelas = await prisma.siswa.findMany({
      where: { kelasId, deletedAt: null },
      select: { id: true },
    })
    const idKelas = new Set(siswaKelas.map((s) => s.id))
    if (siswaStatus.some((s) => !idKelas.has(String(s.siswaId)))) {
      return NextResponse.json({ error: "Ada siswa yang bukan anggota kelas ini" }, { status: 400, headers: corsHeaders })
    }

    let absensi = await prisma.absensi.findFirst({
      where: {
        kelasId,
        mataPelajaranId,
        tanggal: date,
        ...(jadwalPelajaranId ? { jadwalPelajaranId } : {}),
      },
    })
    if (absensi) {
      await prisma.absensiSiswa.deleteMany({ where: { absensiId: absensi.id } })
    } else {
      absensi = await prisma.absensi.create({
        data: { kelasId, mataPelajaranId, jadwalPelajaranId, guruPencatatId: guru.id, tanggal: date },
      })
    }

    if (siswaStatus.length > 0) {
      await prisma.absensiSiswa.createMany({
        data: siswaStatus.map((s) => ({
          absensiId: absensi!.id,
          siswaId: s.siswaId,
          status: s.status as never,
          keterangan: s.keterangan?.trim() || null,
        })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({ success: true, message: "Tersimpan — 1x per sesi mapel per hari" }, { headers: corsHeaders })
  } catch (e) {
    console.error("Mobile absensi siswa POST error:", e)
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500, headers: corsHeaders })
  }
}
