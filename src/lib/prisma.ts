import { PrismaClient } from "@prisma/client"

function buildOptimizedUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  // Prisma Accelerate (prisma://) sudah di-optimasi server-side — jangan ubah
  if (raw.startsWith("prisma://") || raw.startsWith("prisma+postgres://")) return raw
  if (!raw.startsWith("postgres://") && !raw.startsWith("postgresql://")) return raw

  try {
    const u = new URL(raw)
    // Parameter stabil untuk region Singapura (PandaStack ap-southeast-1 / Vercel sin1)
    // connection_limit: batasi koneksi per instance serverless agar tidak exhaust DB
    // pool_timeout: tunggu slot pool sebelum error (detik)
    // connect_timeout: timeout koneksi awal (detik)
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "10")
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20")
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "10")
    // keep sslmode=require if already present; otherwise ensure for db.prisma.io
    if (!u.searchParams.has("sslmode") && u.hostname.includes("prisma.io")) {
      u.searchParams.set("sslmode", "require")
    }
    return u.toString()
  } catch {
    return raw
  }
}

function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL
  const optimizedUrl = buildOptimizedUrl(rawUrl)

  const client = new PrismaClient(
    optimizedUrl && optimizedUrl !== rawUrl
      ? { datasources: { db: { url: optimizedUrl } } } as never
      : undefined
  )

  // Slow-query warning: deteksi latency tinggi ke Singapura (>1s)
  // Aktif hanya di development / saat LOG_LEVEL=debug agar tidak spam production
  if (process.env.LOG_LEVEL === "debug" || process.env.PRISMA_LOG_QUERIES === "1") {
    ;(client as unknown as { $on: (ev: string, cb: (e: { query: string; duration: number }) => void) => void }).$on(
      "query",
      (e) => {
        if (e.duration > 1000) {
          console.warn(`[PRISMA SLOW ${e.duration}ms] ${e.query.slice(0, 180)}`)
        }
      }
    )
  }

  return client
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

// Helper untuk retry transient error (network blip region SE Asia)
// Pakai di operasi kritis mis. start ujian: await withRetry(() => prisma.ujian.findFirst(...))
export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (e: unknown) {
      const msg = String((e as { message?: string })?.message ?? e)
      const isTransient =
        msg.includes("Can't reach database") ||
        msg.includes("Connection timed out") ||
        msg.includes("P1001") ||
        msg.includes("P1002") ||
        msg.includes("Timed out fetching")
      if (!isTransient || i === retries) throw e
      lastErr = e
      const delay = 400 * Math.pow(2, i) + Math.random() * 200
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}
