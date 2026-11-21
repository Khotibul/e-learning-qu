import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { upsertBiodata } from "@/lib/biodata"
import { bersihkanNomor, cekIdentitasSiswa, cekNipUnik, pesanDuplikat } from "@/lib/identitas"
import bcrypt from "bcryptjs"

export const runtime = "nodejs"

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
  const parsed: string[][] = []
  for (const line of lines) {
    if (line.trim() === "") continue
    const cells: string[] = []
    let cur = ""
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (inQ) {
        if (c === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false
        } else cur += c
      } else {
        if (c === '"') inQ = true
        else if (c === ",") { cells.push(cur); cur = "" }
        else cur += c
      }
    }
    cells.push(cur)
    parsed.push(cells.map((x) => x.trim()))
  }
  if (parsed.length === 0) return { headers: [], rows: [] }
  const headers = parsed[0]
  const rows = parsed.slice(1).map((cells) => {
    const o: Record<string, string> = {}
    headers.forEach((h, i) => { o[h] = cells[i] ?? "" })
    return o
  })
  return { headers, rows }
}

function get(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k]
    const found = Object.keys(row).find((h) => h.trim().toLowerCase() === k.trim().toLowerCase())
    if (found && row[found] !== "") return row[found]
  }
  return ""
}

function mapJK(v: string): "LAKI_LAKI" | "PEREMPUAN" | null {
  const t = v.trim().toLowerCase()
  if (!t) return null
  if (t.startsWith("l")) return "LAKI_LAKI"
  if (t.startsWith("p")) return "PEREMPUAN"
  return null
}

function parseTanggal(v: string): Date | null {
  const t = v.trim()
  if (!t || t === "-") return null
  // dd/mm/yyyy atau dd-mm-yyyy
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type")
  if (type !== "murid" && type !== "guru") {
    return NextResponse.json({ error: "Tipe import tidak valid" }, { status: 400 })
  }

  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File wajib diunggah" }, { status: 400 })
  }
  const text = await file.text()
  const { headers, rows } = parseCsv(text)
  if (headers.length === 0 || rows.length === 0) {
    return NextResponse.json({ error: "File CSV kosong / tidak valid" }, { status: 400 })
  }

  const errors: string[] = []
  let success = 0
  let failed = 0

  if (type === "murid") {
    // preload kelas
    const kelasList = await prisma.kelas.findMany({ where: { deletedAt: null }, select: { id: true, nama: true } })
    const kelasMap = new Map(kelasList.map((k) => [k.nama.trim().toLowerCase(), k.id]))

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const no = i + 2
      const nama = get(row, "Nama")
      const email = get(row, "Email")
      const password = get(row, "Password") || "password123"
      const kelasNama = get(row, "Kelas")
      if (!nama || !email || !kelasNama) {
        failed++; errors.push(`Baris ${no}: Nama, Email, Kelas wajib diisi`); continue
      }
      const kelasId = kelasMap.get(kelasNama.trim().toLowerCase())
      if (!kelasId) { failed++; errors.push(`Baris ${no}: Kelas '${kelasNama}' tidak ditemukan`); continue }
      if (password.length < 6) { failed++; errors.push(`Baris ${no}: Password minimal 6 karakter`); continue }

      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) { failed++; errors.push(`Baris ${no}: Email '${email}' sudah terdaftar`); continue }

      const nis = bersihkanNomor(get(row, "NIS"))
      const nisn = bersihkanNomor(get(row, "NISN"))
      try { await cekIdentitasSiswa({ nis, nisn }) } catch (e) {
        failed++; errors.push(`Baris ${no}: ${e instanceof Error ? e.message : "Identitas duplikat"}`); continue
      }

      try {
        const hashed = await bcrypt.hash(password, 12)
        const siswa = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({ data: { email, name: nama, password: hashed, role: "SISWA" } })
          const s = await tx.siswa.create({
            data: {
              nama,
              nis,
              nisn,
              alamat: get(row, "Alamat") || null,
              noTelp: get(row, "No Telp") || null,
              jabatan: get(row, "Jabatan") || null,
              kelasId,
              userId: user.id,
            },
          })
          await upsertBiodata(user.id, {
            jenisKelamin: mapJK(get(row, "Jenis Kelamin")),
            agama: get(row, "Agama") || null,
            tempatLahir: get(row, "Tempat Lahir") || null,
            tanggalLahir: parseTanggal(get(row, "Tanggal Lahir")),
            alamat: get(row, "Alamat") || null,
            anakKe: get(row, "Anak Ke") || null,
            statusKeluarga: get(row, "Status Keluarga") || null,
            namaAyah: get(row, "Nama Ayah") || null,
            namaIbu: get(row, "Nama Ibu") || null,
            pekerjaanAyah: get(row, "Pekerjaan Ayah") || null,
            pekerjaanIbu: get(row, "Pekerjaan Ibu") || null,
            asalSekolah: get(row, "Asal Sekolah") || null,
            noTelpWali: get(row, "No Telp Wali") || null,
          }, "admin")
          return s
        })
        success++
      } catch (e) {
        failed++
        const msg = e instanceof Error ? e.message : "Gagal menyimpan"
        errors.push(`Baris ${no}: ${msg}`)
      }
    }
  } else {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const no = i + 2
      const nama = get(row, "Nama")
      const email = get(row, "Email")
      const password = get(row, "Password") || "password123"
      if (!nama || !email) { failed++; errors.push(`Baris ${no}: Nama dan Email wajib diisi`); continue }
      if (password.length < 6) { failed++; errors.push(`Baris ${no}: Password minimal 6 karakter`); continue }

      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) { failed++; errors.push(`Baris ${no}: Email '${email}' sudah terdaftar`); continue }

      const nip = bersihkanNomor(get(row, "NIP"))
      try { await cekNipUnik(nip) } catch (e) {
        failed++; errors.push(`Baris ${no}: ${e instanceof Error ? e.message : "NIP duplikat"}`); continue
      }

      try {
        const hashed = await bcrypt.hash(password, 12)
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({ data: { email, name: nama, password: hashed, role: "GURU" } })
          await tx.guru.create({
            data: {
              nama,
              nip,
              nuptk: get(row, "NUPTK") || null,
              jabatan: get(row, "Jabatan") || null,
              alamat: get(row, "Alamat") || null,
              noTelp: get(row, "No Telp") || null,
              userId: user.id,
            },
          })
          await upsertBiodata(user.id, {
            jenisKelamin: mapJK(get(row, "Jenis Kelamin")),
            agama: get(row, "Agama") || null,
            tempatLahir: get(row, "Tempat Lahir") || null,
            tanggalLahir: parseTanggal(get(row, "Tanggal Lahir")),
            alamat: get(row, "Alamat") || null,
          }, "admin")
        })
        success++
      } catch (e) {
        failed++
        errors.push(`Baris ${no}: ${e instanceof Error ? e.message : "Gagal menyimpan"}`)
      }
    }
  }

  return NextResponse.json({
    success,
    failed,
    total: rows.length,
    errors: errors.slice(0, 50),
  })
}
