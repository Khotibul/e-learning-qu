// Fixture smoke test: baris Upload & perangkat fingerprint khusus uji.
// - Membuat hanya data ber-prefix "smoke-" / "SMOKE-" (tidak menyentuh data lain).
// - Mode: tanpa argumen = buat + print JSON; --cleanup = hapus semua fixture;
//   --audit = jumlah event fingerprint utk fixture (harus 0 setelah request 401/403).
import { prisma } from "../src/lib/prisma"
import { hashApiKey } from "../src/lib/absensi-harian"

async function cleanup() {
  const up = await prisma.upload.deleteMany({ where: { filename: { startsWith: "smoke-" } } })
  const dev = await prisma.perangkatFingerprint.deleteMany({ where: { kode: { startsWith: "SMOKE-" } } })
  console.log(JSON.stringify({ cleaned: { uploads: up.count, devices: dev.count } }))
}

async function audit() {
  const events = await prisma.fingerprintEvent.count({
    where: { perangkat: { kode: { startsWith: "SMOKE-" } } },
  })
  const absensi = await prisma.absensiHarianSiswa.count({
    where: {
      OR: [
        { eventMasuk: { perangkat: { kode: { startsWith: "SMOKE-" } } } },
        { eventPulang: { perangkat: { kode: { startsWith: "SMOKE-" } } } },
      ],
    },
  })
  console.log(JSON.stringify({ events, absensiDariSmoke: absensi }))
}

async function create() {
  await cleanup()
  const ts = Date.now().toString(36).toUpperCase()
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
  const gurus = await prisma.guru.findMany({ select: { userId: true } })
  const guru = gurus.find((g) => g.userId) ?? null
  const siswas = await prisma.siswa.findMany({ where: { deletedAt: null }, select: { userId: true }, take: 300 })
  const siswa = siswas.find((s) => s.userId) ?? null
  if (!admin || !siswa?.userId) throw new Error("akun referensi tidak ditemukan")

  const data = Buffer.from("SMOKE")
  const pub = await prisma.upload.create({
    data: { filename: "smoke-publik.png", mime: "image/png", size: 5, data, userId: admin.id, akses: "PUBLIK" },
  })
  const priv = await prisma.upload.create({
    data: { filename: "smoke-privat.png", mime: "image/png", size: 5, data, userId: siswa.userId, akses: "PRIVAT" },
  })
  const internal = await prisma.upload.create({
    data: { filename: "smoke-internal.png", mime: "image/png", size: 5, data, userId: guru?.userId ?? siswa.userId, akses: "INTERNAL" },
  })

  const keyAktif = `fp-smoke-aktif-${ts}`
  const keyNonaktif = `fp-smoke-nonaktif-${ts}`
  const devAktif = await prisma.perangkatFingerprint.create({
    data: { kode: `SMOKE-AKTIF-${ts}`, nama: "Smoke Aktif", lokasi: "Smoke", apiKeyHash: hashApiKey(keyAktif), status: "AKTIF" },
  })
  const devNonaktif = await prisma.perangkatFingerprint.create({
    data: { kode: `SMOKE-NONAKTIF-${ts}`, nama: "Smoke Nonaktif", lokasi: "Smoke", apiKeyHash: hashApiKey(keyNonaktif), status: "NONAKTIF" },
  })

  console.log(
    JSON.stringify({
      upload: { pub: pub.id, priv: priv.id, internal: internal.id },
      devices: {
        aktif: { kode: devAktif.kode, key: keyAktif },
        nonaktif: { kode: devNonaktif.kode, key: keyNonaktif },
      },
      users: { siswaId: siswa.userId },
    })
  )
}

const mode = process.argv[2] ?? "create"
;(async () => {
  if (mode === "--cleanup") await cleanup()
  else if (mode === "--audit") await audit()
  else await create()
  await prisma.$disconnect()
})().catch(async (e) => {
  console.error("FIXTURE_ERROR:", e?.message ?? e)
  await prisma.$disconnect()
  process.exit(1)
})
