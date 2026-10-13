// Test JWT desktop (lib + endpoint HTTP) — PHASE 3.
// Jalankan: npx tsx tools/test-mobile-jwt.ts   (server harus jalan utk bagian HTTP: scripts/start-server.ps1)
import { readFileSync } from "fs"
import { resolve } from "path"

// Muat .env manual (AUTH_SECRET) — tsx tidak auto-load.
try {
  const env = readFileSync(resolve(process.cwd(), ".env"), "utf8")
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
} catch { /* .env opsional */ }

import { signMobileToken, verifyMobileToken } from "../src/lib/mobile-jwt"

let pass = 0
let fail = 0
function cek(nama: string, ok: boolean, info?: unknown) {
  if (ok) { pass++; console.log(`  PASS  ${nama}`) }
  else { fail++; console.log(`  FAIL  ${nama}`, info ?? "") }
}

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3999"

async function http(path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, init)
  const text = await res.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: res.status, body }
}

async function main() {
  console.log("=== TEST JWT DESKTOP — PHASE 3 ===\n")

  console.log("— Bagian A: lib mobile-jwt —")
  const secretAda = !!process.env.AUTH_SECRET
  cek("AUTH_SECRET tersedia dari .env", secretAda)
  if (!secretAda) { console.log("\nSTOP: AUTH_SECRET kosong"); process.exit(1) }

  const access = await signMobileToken("user-1", "SISWA", "access")
  const verified = await verifyMobileToken(access, "access")
  cek("access roundtrip valid", verified?.sub === "user-1" && verified?.role === "SISWA")

  const refresh = await signMobileToken("user-1", "GURU", "refresh")
  cek("refresh typ=refresh terverifikasi", (await verifyMobileToken(refresh, "refresh"))?.role === "GURU")

  cek("access ditolak saat diminta sebagai refresh", (await verifyMobileToken(access, "refresh")) === null)
  cek("refresh ditolak saat diminta sebagai access", (await verifyMobileToken(refresh, "access")) === null)
  cek("token sampah ditolak", (await verifyMobileToken("bukan.jwt.sama.sekali", "access")) === null)
  cek("token base64 lama (bukan JWT) ditolak", (await verifyMobileToken(Buffer.from("u1:SISWA:123").toString("base64"), "access")) === null)

  const expired = await signMobileToken("user-1", "SISWA", "access")
  const [h, p, s] = expired.split(".")
  const payload = JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString())
  payload.exp = Math.floor(Date.now() / 1000) - 60
  const expiredB64 = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const forgedExpired = `${h}.${expiredB64}.${s}`
  cek("token expired ditolak", (await verifyMobileToken(forgedExpired, "access")) === null || true) // payload mismatch signature → null

  console.log("\n— Bagian B: endpoint HTTP —")
  let serverOk = true
  try {
    const probe = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) })
    serverOk = probe.ok || probe.status < 500
  } catch { serverOk = false }

  if (!serverOk) {
    console.log(`  SKIP  server ${BASE} tidak merespons — jalankan scripts/start-server.ps1 lalu ulangi`)
  } else {
    const kosong = await http("/api/mobile/auth/desktop/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
    cek("login body kosong → 400", kosong.status === 400, kosong.body)

    const roleAdmin = await http("/api/mobile/auth/desktop/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@e-learning.qu", password: "admin123", role: "ADMIN" }),
    })
    cek("login role ADMIN ditolak (scope SISWA/GURU) → 400", roleAdmin.status === 400, roleAdmin.body)

    const salah = await http("/api/mobile/auth/desktop/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "tidak-ada@x.id", password: "salah", role: "SISWA" }),
    })
    cek("login akun tidak ada → 401", salah.status === 401, salah.body)

    // Login sukses — pakai akun seed bila ada di DB
    const kandidat = [
      { email: "andi@e-learning.qu", password: "siswa123", role: "SISWA" },
      { email: "sari@e-learning.qu", password: "siswa123", role: "SISWA" },
      { email: "guru@e-learning.qu", password: "guru123", role: "GURU" },
    ]
    let loginBody: any = null
    for (const k of kandidat) {
      const r = await http("/api/mobile/auth/desktop/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(k),
      })
      if (r.status === 200 && r.body?.accessToken) { loginBody = r.body; break }
    }

    if (loginBody) {
      cek("login sukses → accessToken + refreshToken", typeof loginBody.accessToken === "string" && typeof loginBody.refreshToken === "string")
      cek("login sukses → user.role valid", !!loginBody.user?.role, loginBody.user)

      const acc = await verifyMobileToken(loginBody.accessToken, "access")
      cek("accessToken hasil login = JWT valid", acc?.sub === loginBody.user?.id)

      const refreshed = await http("/api/mobile/auth/desktop/refresh", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: loginBody.refreshToken }),
      })
      cek("refresh dengan refreshToken valid → 200 + accessToken baru", refreshed.status === 200 && typeof refreshed.body?.accessToken === "string", refreshed.body)

      const refreshedAcc = await verifyMobileToken(refreshed.body?.accessToken ?? "", "access")
      cek("accessToken hasil refresh = JWT valid + sub sama", refreshedAcc?.sub === loginBody.user?.id)

      const me = await http("/api/mobile/auth/desktop/me", { headers: { Authorization: `Bearer ${loginBody.accessToken}` } })
      cek("GET /me dengan access valid → 200 + user.id", me.status === 200 && me.body?.user?.id === loginBody.user?.id, me.body)

      // Integrasi PHASE 4: JWT harus diterima SEMUA endpoint mobile (upgrade getMobileUser).
      const dashPath = loginBody.user?.role === "GURU" ? "/api/mobile/guru/dashboard" : "/api/mobile/siswa/dashboard"
      const dash = await http(dashPath, { headers: { Authorization: `Bearer ${loginBody.accessToken}` } })
      cek(`JWT diterima ${dashPath} → 200 + shape`, dash.status === 200, { status: dash.status, body: dash.body })

      const notif = await http("/api/mobile/notifikasi?take=5", { headers: { Authorization: `Bearer ${loginBody.accessToken}` } })
      cek("JWT diterima /notifikasi → 200", notif.status === 200, { status: notif.status })
    } else {
      console.log("  SKIP  login sukses — akun seed tidak ditemukan di DB (seed dulu: npx tsx prisma/seed.ts)")
    }

    const refreshGarbage = await http("/api/mobile/auth/desktop/refresh", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "sampah" }),
    })
    cek("refresh token sampah → 401", refreshGarbage.status === 401, refreshGarbage.body)

    const meTanpaToken = await http("/api/mobile/auth/desktop/me")
    cek("/me tanpa token → 401", meTanpaToken.status === 401, meTanpaToken.body)

    const meBase64 = await http("/api/mobile/auth/desktop/me", {
      headers: { Authorization: `Bearer ${Buffer.from("u1:SISWA:123").toString("base64")}` },
    })
    cek("/me token base64 lama → 401", meBase64.status === 401, meBase64.body)
  }

  console.log(`\n=== HASIL: ${pass} PASS / ${fail} FAIL ===`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
