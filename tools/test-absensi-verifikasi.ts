import { prisma } from "../src/lib/prisma"
import { haversineMeter, wajibFoto, wajibGps, wajibSidikJari, DAFTAR_METODE } from "../src/lib/absensi-metode"
import { validasiLokasiMurni, validasiVerifikasi, getMetodeGuru, getKebijakanLokasi, type KebijakanLokasi } from "../src/lib/absensi-lokasi"

let lulus = 0
let gagal = 0

function cek(nama: string, kondisi: boolean, detail?: unknown) {
  if (kondisi) {
    lulus++
    console.log(`  ✓ ${nama}`)
  } else {
    gagal++
    console.log(`  ✗ ${nama}`, detail !== undefined ? JSON.stringify(detail) : "")
  }
}

async function main() {
  // ── A. Haversine (murni) ──
  console.log("A) Haversine")
  const d0 = haversineMeter(0, 0, 0.001, 0) // ~111.2 m lintang
  cek("0.001° lat ≈ 111m", Math.abs(d0 - 111.2) < 3, d0)
  cek("titik sama = 0m", haversineMeter(-6.9, 107.6, -6.9, 107.6) === 0)
  const d2 = haversineMeter(-6.9, 107.6, -6.9, 107.601) // ~110m bujur di khatulistiwa
  cek("0.001° bujur ≈ 110m", Math.abs(d2 - 110.7) < 4, d2)

  // ── B. Peta metode ──
  console.log("B) Peta metode wajib")
  cek("7 metode terdaftar", DAFTAR_METODE.length === 7, DAFTAR_METODE)
  cek("TANPA tidak wajib apa pun", !wajibFoto("TANPA") && !wajibGps("TANPA") && !wajibSidikJari("TANPA"))
  cek("FOTO wajib foto saja", wajibFoto("FOTO") && !wajibGps("FOTO") && !wajibSidikJari("FOTO"))
  cek("SIDIK_JARI wajib sidik jari saja", !wajibFoto("SIDIK_JARI") && !wajibGps("SIDIK_JARI") && wajibSidikJari("SIDIK_JARI"))
  cek("FOTO_SIDIK keduanya", wajibFoto("FOTO_SIDIK_JARI") && wajibSidikJari("FOTO_SIDIK_JARI") && !wajibGps("FOTO_SIDIK_JARI"))
  cek("GPS_FOTO", wajibGps("GPS_FOTO") && wajibFoto("GPS_FOTO") && !wajibSidikJari("GPS_FOTO"))
  cek("GPS_SIDIK_JARI", wajibGps("GPS_SIDIK_JARI") && wajibSidikJari("GPS_SIDIK_JARI") && !wajibFoto("GPS_SIDIK_JARI"))

  // ── C. Validasi lokasi murni ──
  console.log("C) validasiLokasiMurni")
  const lok: KebijakanLokasi = { metode: "GPS_FOTO", gpsWajib: true, lokasiNama: "Sekolah", lat: -6.9, lng: 107.6, radiusMeter: 100, akurasiMaksMeter: 50 }
  cek("tanpa konfigurasi Admin", validasiLokasiMurni({ ...lok, lat: null, lng: null }, { lat: -6.9, lng: 107.6 }).alasan?.includes("belum dikonfigurasi") === true)
  cek("koordinat NaN ditolak", validasiLokasiMurni(lok, { lat: NaN, lng: NaN }).valid === false)
  const dlm = validasiLokasiMurni(lok, { lat: -6.9001, lng: 107.6, akurasiMeter: 10 })
  cek("di dalam radius valid", dlm.valid === true && (dlm.jarakMeter ?? 999) < 100, dlm)
  const luar = validasiLokasiMurni(lok, { lat: -6.91, lng: 107.6, akurasiMeter: 10 })
  cek("di luar radius ditolak", luar.valid === false && luar.alasan?.includes("dari titik absensi") === true, luar)
  const buruk = validasiLokasiMurni(lok, { lat: -6.9001, lng: 107.6, akurasiMeter: 120 })
  cek("akurasi jelek ditolak", buruk.valid === false && buruk.alasan?.includes("Akurasi GPS") === true, buruk)
  const mock = validasiLokasiMurni(lok, { lat: -6.9001, lng: 107.6, akurasiMeter: 10, mock: true })
  cek("mock tercatat tapi tidak ditolak", mock.valid === true && mock.mock === true, mock)

  // ── D. Metode efektif (override guru vs SiteConfig) ──
  console.log("D) getMetodeGuru + kebijakan")
  const kebijakan = await getKebijakanLokasi()
  console.log("  kebijakan SiteConfig:", JSON.stringify(kebijakan))
  cek("kebijakan terbaca", typeof kebijakan.metode === "string" && kebijakan.radiusMeter > 0)

  const guru = await prisma.guru.findFirst({ where: { deletedAt: null }, select: { id: true, absensiMetode: true } })
  cek("ada guru di DB", !!guru)
  if (guru) {
    const lama = guru.absensiMetode
    await prisma.guru.update({ where: { id: guru.id }, data: { absensiMetode: "FOTO_SIDIK_JARI" } })
    cek("override per guru dipakai", (await getMetodeGuru(guru.id)) === "FOTO_SIDIK_JARI")
    await prisma.guru.update({ where: { id: guru.id }, data: { absensiMetode: lama } })
    cek("kembali ke kebijakan setelah dihapus", (await getMetodeGuru(guru.id)) === kebijakan.metode)

    // ── E. validasiVerifikasi + alur pengecualian (DB) ──
    console.log("E) validasiVerifikasi + pengecualian")
    const tanggal = new Date()
    tanggal.setHours(0, 0, 0, 0)
    const bersihkan = () => prisma.pengecualianAbsensi.deleteMany({ where: { guruId: guru.id, tanggal } })

    if (!wajibFoto("FOTO")) throw new Error("perkiraan metode FOTO salah")
    // tanpa foto & tanpa pengecualian → ditolak
    await bersihkan()
    try {
      await validasiVerifikasi({ guruId: guru.id, tanggal, metode: "FOTO", tahap: "MASUK" })
      cek("FOTO tanpa foto ditolak", false)
    } catch (e: any) {
      cek("FOTO tanpa foto ditolak", /Foto selfie wajib/.test(e.message), e.message)
    }

    // pengecualian MENUNGGU → pesan menunggu
    await prisma.pengecualianAbsensi.create({ data: { guruId: guru.id, tanggal, jenis: "FOTO", alasan: "kamera rusak (uji)" } })
    try {
      await validasiVerifikasi({ guruId: guru.id, tanggal, metode: "FOTO", tahap: "MASUK" })
      cek("MENUNGGU memblokir", false)
    } catch (e: any) {
      cek("MENUNGGU memblokir", /menunggu persetujuan/.test(e.message), e.message)
    }

    // pengecualian DISETUJUI → lolos + catatan
    await prisma.pengecualianAbsensi.updateMany({ where: { guruId: guru.id, tanggal, jenis: "FOTO", status: "MENUNGGU" }, data: { status: "DISETUJUI" } })
    const hasil = await validasiVerifikasi({ guruId: guru.id, tanggal, metode: "FOTO", tahap: "MASUK" })
    cek("DISETUJUI lolos + catatan", hasil.catatan?.includes("pengecualian DISETUJUI") === true, hasil)

    // foto ada → lolos tanpa pengecualian (foto di fase SELESAI tidak wajib)
    await bersihkan()
    const okFoto = await validasiVerifikasi({ guruId: guru.id, tanggal, metode: "FOTO", fotoUrl: "/api/upload/uji", tahap: "MASUK" })
    cek("foto tersedia lolos", okFoto.catatan === null, okFoto)
    const selesai = await validasiVerifikasi({ guruId: guru.id, tanggal, metode: "FOTO", tahap: "SELESAI" })
    cek("foto TIDAK wajib saat SELESAI", selesai.catatan === null, selesai)

    // sidik jari: klaim verified=false → ditolak
    try {
      await validasiVerifikasi({ guruId: guru.id, tanggal, metode: "SIDIK_JARI", sidikJari: { verified: false }, tahap: "MASUK" })
      cek("sidik jari belum terverifikasi ditolak", false)
    } catch (e: any) {
      cek("sidik jari belum terverifikasi ditolak", /sidik jari wajib/i.test(e.message), e.message)
    }
    const okSidik = await validasiVerifikasi({ guruId: guru.id, tanggal, metode: "SIDIK_JARI", sidikJari: { verified: true, provider: "fingerprint" }, tahap: "MASUK" })
    cek("sidik jari terverifikasi lolos", okSidik.catatan === null)

    // GPS: lokasi di luar radius → ditolak (bila kebijakan GPS aktif)
    if (wajibGps("GPS_FOTO")) {
      const jauh = { lat: (kebijakan.lat ?? -6.9) + 0.05, lng: kebijakan.lng ?? 107.6, akurasiMeter: 5 }
      try {
        await validasiVerifikasi({ guruId: guru.id, tanggal, metode: "GPS_FOTO", fotoUrl: "/api/upload/uji", gps: jauh, tahap: "MASUK" })
        cek("GPS di luar radius ditolak", false)
      } catch (e: any) {
        cek("GPS di luar radius ditolak", /ditolak|tidak valid/.test(e.message), e.message)
      }
      if (kebijakan.lat != null && kebijakan.lng != null) {
        const dekat = { lat: kebijakan.lat, lng: kebijakan.lng, akurasiMeter: 8 }
        const okGps = await validasiVerifikasi({ guruId: guru.id, tanggal, metode: "GPS_FOTO", fotoUrl: "/api/upload/uji", gps: dekat, tahap: "MASUK" })
        cek("GPS di titik Admin lolos", okGps.hasilLokasi?.valid === true, okGps)
      }
    } else {
      console.log("  (lewati uji GPS: kebijakan.gpsWajib=false dan tanpa titik)")
    }

    await bersihkan()
    cek("data uji pengecualian dibersihkan", (await prisma.pengecualianAbsensi.count({ where: { guruId: guru.id, tanggal } })) === 0)
  }

  console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`)
  await prisma.$disconnect()
  if (gagal > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error("ERROR:", e)
  await prisma.$disconnect()
  process.exit(1)
})
