import fs from "node:fs"
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1")
}

let gagal = 0
function cek(nama: string, ok: boolean, info?: unknown) {
  if (!ok) {
    gagal++
    console.error(`GAGAL ${nama}`, info ?? "")
  } else console.log(`ok    ${nama}`)
}

async function main() {
  const { prisma } = await import("../src/lib/prisma")
  const { signKioskToken, verifyKioskToken, bacaCookie, KIOSK_COOKIE } = await import("../src/lib/wajah-token")
  const { absenKiosk, cariIdentitasKiosk } = await import("../src/lib/kiosk-absensi")
  const { verifikasiWajah } = await import("../src/lib/wajah")
  const route = await import("../src/app/api/absensi/kiosk/route")

  const st = Date.now()
  const dibuat: { users: string[]; siswa: string[]; guru: string[]; kelas: string[] } = {
    users: [],
    siswa: [],
    guru: [],
    kelas: [],
  }

  const kelas = await prisma.kelas.create({ data: { nama: `UJI-KIOSK-${st}`, tingkat: 10 } })
  dibuat.kelas.push(kelas.id)
  const jurusan = await prisma.jurusan.create({ data: { kode: `KJ${st}`, nama: `Jurusan Uji ${st}` } })

  // ── Siswa uji ─────────────────────────────────────────────────
  const uSiswa = await prisma.user.create({
    data: { email: `kiosk.siswa.${st}@contoh.invalid`, name: "Siswa Kiosk", role: "SISWA", password: "x" },
  })
  dibuat.users.push(uSiswa.id)
  const siswa = await prisma.siswa.create({
    data: {
      userId: uSiswa.id,
      nama: "Siswa Kiosk",
      nis: `K${st}`,
      kelasId: kelas.id,
      jurusanId: jurusan.id,
    },
  })
  dibuat.siswa.push(siswa.id)

  // ── Guru uji ─────────────────────────────────────────────────
  const uGuru = await prisma.user.create({
    data: { email: `kiosk.guru.${st}@contoh.invalid`, name: "Guru Kiosk", role: "GURU", password: "x" },
  })
  dibuat.users.push(uGuru.id)
  const guru = await prisma.guru.create({
    data: { userId: uGuru.id, nama: "Guru Kiosk", nip: `19${st}`.slice(0, 18), jabatan: "Wali Kelas" },
  })
  dibuat.guru.push(guru.id)

  // ── Token & cookie ───────────────────────────────────────────
  const token = await signKioskToken(uGuru.id, "Guru Kiosk")
  const payload = await verifyKioskToken(token)
  cek("token kiosk valid & sub benar", payload?.sub === uGuru.id)
  cek("token kiosk punya masa berlaku > 20 hari", !!payload?.exp && payload.exp * 1000 - Date.now() > 20 * 864e5)
  cek("token wajah tidak diterima sebagai token kiosk", (await verifyKioskToken(token + "x")) === null)
  cek(
    "cookie kiosk terbaca dari header",
    bacaCookie(`a=1; ${KIOSK_COOKIE}=${encodeURIComponent(token)}; b=2`, KIOSK_COOKIE) === token
  )
  cek("cookie kosong → string kosong", bacaCookie(null, KIOSK_COOKIE) === "")

  // ── API tanpa cookie → 401 ───────────────────────────────────
  const res401 = await route.POST(
    new Request("http://localhost/api/absensi/kiosk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kode: siswa.nis, metode: "NIS_NIP" }),
    })
  )
  cek("tanpa cookie kiosk → 401", res401.status === 401, res401.status)

  const panggil = async (body: unknown) =>
    await route.POST(
      new Request("http://localhost/api/absensi/kiosk", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `${KIOSK_COOKIE}=${token}` },
        body: JSON.stringify(body),
      })
    )

  // ── Siswa: NIS/NIP ───────────────────────────────────────────
  const ident = await cariIdentitasKiosk(siswa.nis)
  cek("kartu siswa: nama & kelas & jurusan", ident?.kartu.nama === "Siswa Kiosk" && ident?.kartu.kelas === kelas.nama && ident?.kartu.jurusan === jurusan.nama)
  cek("kartu siswa: NIS & formal", ident?.kartu.nis === siswa.nis && ident?.kartu.sekolahFormal === true)
  cek("kartu siswa: non formal false (belum santri)", ident?.kartu.sekolahNonFormal === false)

  const r1 = await panggil({ kode: siswa.nis, metode: "NIS_NIP" })
  const d1 = (await r1.json()) as { status: string; kartu?: { nis: string | null }; jam?: string }
  cek("siswa absen NIS/NIP → SUKSES", r1.ok && d1.status === "SUKSES", d1)
  cek("respons membawa kartu identitas", d1.kartu?.nis === siswa.nis)

  const baris = await prisma.absensiHarianSiswa.findUnique({
    where: { siswaId_tanggal: { siswaId: siswa.id, tanggal: hariIni() } },
  })
  cek("DB: jamMasuk terisi", !!baris?.jamMasuk, baris)
  cek("DB: sumberMasuk MANUAL", baris?.sumberMasuk === "MANUAL", baris?.sumberMasuk)
  cek("DB: bukan bukti wajah", baris?.wajahMasuk === false && baris?.wajahJarakMasuk === null)
  cek("DB: status masuk HADIR/TERLAMBAT", baris?.statusMasuk === "HADIR" || baris?.statusMasuk === "TERLAMBAT")

  const r2 = await panggil({ kode: siswa.nis, metode: "NIS_NIP" })
  const d2 = (await r2.json()) as { status: string }
  cek("absen ganda → DUPLIKAT (bukan pulang)", d2.status === "DUPLIKAT", d2)

  // ── Guru: NIP ────────────────────────────────────────────────
  const rg = await panggil({ kode: guru.nip, metode: "NIS_NIP" })
  const dg = (await rg.json()) as { status: string; kartu?: { nip: string | null; jabatan: string | null } }
  cek("guru absen NIP → SUKSES", rg.ok && dg.status === "SUKSES", dg)
  cek("kartu guru: NIP & jabatan", dg.kartu?.nip === guru.nip && dg.kartu?.jabatan === "Wali Kelas", dg.kartu)

  const ag = await prisma.absensiGuru.findUnique({
    where: { guruId_tanggal: { guruId: guru.id, tanggal: hariIni() } },
    select: { jamMasuk: true, wajahVerified: true, keterangan: true },
  })
  cek("DB guru: jamMasuk terisi", !!ag?.jamMasuk, ag)
  cek("DB guru: wajahVerified false & keterangan kiosk", ag?.wajahVerified === false && /kiosk/i.test(ag?.keterangan ?? ""), ag)

  const rg2 = await panggil({ kode: guru.nip, metode: "NIS_NIP" })
  const dg2 = (await rg2.json()) as { status: string }
  cek("guru absen ganda → DUPLIKAT", dg2.status === "DUPLIKAT", dg2)

  // ── Sidik jari belum terdaftar ───────────────────────────────
  const rs = await panggil({ kode: siswa.nis, metode: "SIDIK_JARI" })
  const ds = (await rs.json()) as { status: string; pesan: string }
  cek("sidik jari tanpa pemetaan → DITOLAK", ds.status === "DITOLAK", ds)
  cek("pesan sidik jari menjelaskan pendaftaran", /sidik jari belum terdaftar/i.test(ds.pesan), ds.pesan)

  // ── Tidak dikenal & kode invalid ─────────────────────────────
  const rn = await panggil({ kode: "TIDAK-ADA-123", metode: "NIS_NIP" })
  const dn = (await rn.json()) as { status: string }
  cek("NIS/NIP tak dikenal → TIDAK_DIKENAL", dn.status === "TIDAK_DIKENAL", dn)

  const rb = await panggil({ kode: "ab", metode: "NIS_NIP" })
  cek("kode terlalu pendek → 400", rb.status === 400, rb.status)

  // ── Wajah: hasil verifikasi memuat kartu lengkap ────────────
  const uWajah = await prisma.user.create({
    data: { email: `kiosk.wajah.${st}@contoh.invalid`, name: "Siswa Wajah", role: "SISWA", password: "x" },
  })
  dibuat.users.push(uWajah.id)
  const siswaWajah = await prisma.siswa.create({
    data: { userId: uWajah.id, nama: "Siswa Wajah", nis: `W${st}`, kelasId: kelas.id, jurusanId: jurusan.id },
  })
  dibuat.siswa.push(siswaWajah.id)
  await prisma.santri.create({ data: { userId: uWajah.id, siswaId: siswaWajah.id, nama: "Siswa Wajah" } })

  const d = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.37) * 0.1)
  await prisma.profilWajah.create({
    data: { userId: uWajah.id, siswaId: siswaWajah.id, deskriptor: d, aktif: true, status: "AKTIF", sumber: "WEBCAM" },
  })

  const hw = await verifikasiWajah({ deskriptor: d, perangkat: "DESKTOP" })
  cek("wajah kiosk → SUKSES mencatat absensi", hw.status === "SUKSES", hw)
  cek("wajah: kartu berisi kelas & jurusan", hw.kartu?.kelas === kelas.nama && hw.kartu?.jurusan === jurusan.nama, hw.kartu)
  cek("wajah: kartu menandai non formal (santri)", hw.kartu?.sekolahNonFormal === true, hw.kartu)
  cek("wajah: absensi WAJAH benar", hw.absensi?.tipe === "MASUK" && !!hw.absensi?.jam, hw.absensi)

  // ── Bersihkan ───────────────────────────────────────────────
  await prisma.logVerifikasiWajah.deleteMany({
    where: { OR: [{ siswaId: { in: dibuat.siswa } }, { userId: { in: dibuat.users } }] },
  })
  await prisma.profilWajah.deleteMany({
    where: { OR: [{ siswaId: { in: dibuat.siswa } }, { userId: { in: dibuat.users } }] },
  })
  await prisma.notification.deleteMany({ where: { userId: { in: dibuat.users } } })
  await prisma.auditLog.deleteMany({ where: { userId: { in: dibuat.users } } })
  await prisma.absensiHarianSiswa.deleteMany({ where: { siswaId: { in: dibuat.siswa } } })
  await prisma.absensiGuru.deleteMany({ where: { guruId: { in: dibuat.guru } } })
  await prisma.fingerprintEvent.deleteMany({ where: { userId: { in: dibuat.users } } })
  await prisma.pemetaanFingerprint.deleteMany({ where: { userId: { in: dibuat.users } } })
  await prisma.santri.deleteMany({ where: { userId: { in: dibuat.users } } })
  await prisma.siswa.deleteMany({ where: { id: { in: dibuat.siswa } } })
  await prisma.guru.deleteMany({ where: { id: { in: dibuat.guru } } })
  await prisma.kelas.deleteMany({ where: { id: { in: dibuat.kelas } } })
  await prisma.jurusan.deleteMany({ where: { kode: `KJ${st}` } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat.users } } })

  const sisa = await prisma.absensiHarianSiswa.count({ where: { siswaId: { in: dibuat.siswa } } })
  cek("data uji bersih", sisa === 0 && (await prisma.guru.count({ where: { id: { in: dibuat.guru } } })) === 0)

  await prisma.$disconnect()
  console.log(gagal ? `ADA ${gagal} KEGAGALAN` : "SEMUA OK")
  if (gagal) process.exitCode = 1
}

function hariIni() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
