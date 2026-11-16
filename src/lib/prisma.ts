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
    // Saat ramai, Vercel menjalankan banyak instance sekaligus; tiap instance punya
    // pool sendiri. 10 koneksi/instance cepat menghabiskan kuota koneksi Postgres
    // (gejala: "too many connections" / P1001 saat jam sibuk). Default 5, dan bisa
    // dinaikkan lewat env PRISMA_CONNECTION_LIMIT bila kuota DB besar.
    if (!u.searchParams.has("connection_limit")) {
      u.searchParams.set("connection_limit", process.env.PRISMA_CONNECTION_LIMIT || "5")
    }
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

/**
 * Operasi baca yang aman diulang. Mutasi sengaja TIDAK diulang: kalau koneksi
 * putus setelah INSERT/UPDATE diproses, pengulangan bisa membuat data ganda.
 */
const OPERASI_BACA = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
])

/** Kegagalan sesaat (jaringan putus, pool penuh) — layak dicoba ulang. */
export function galatSesaat(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e)
  return (
    msg.includes("P1001") ||
    msg.includes("P1002") ||
    msg.includes("P1017") ||
    msg.includes("P2024") ||
    msg.includes("Can't reach database") ||
    msg.includes("Connection timed out") ||
    msg.includes("Timed out fetching") ||
    msg.includes("Connection pool") ||
    msg.includes("Server has closed the connection") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT")
  )
}

async function ulangiBilaSesaat<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (e) {
      if (!galatSesaat(e) || i === retries) throw e
      lastErr = e
      // Jeda pendek berjitter: memberi waktu pool/DB pulih tanpa menahan request lama.
      await new Promise((r) => setTimeout(r, 150 * Math.pow(2, i) + Math.random() * 100))
    }
  }
  throw lastErr
}

/**
 * Semua query BACA diulang otomatis sekali-dua kali saat gagal sesaat.
 *
 * Inilah penyebab paling sering "An error occurred in the Server Components
 * render": satu query timeout/pool penuh saat ramai langsung melempar error ke
 * render halaman. Dengan retry di lapisan ini, gangguan sepersekian detik tidak
 * lagi tampil sebagai halaman error, dan tidak perlu diingat pemanggilnya.
 */
function denganRetryBaca(client: PrismaClient): PrismaClient {
  return client.$extends({
    name: "retryBacaSesaat",
    query: {
      $allOperations({ operation, args, query }) {
        if (!OPERASI_BACA.has(operation)) return query(args)
        return ulangiBilaSesaat(() => query(args))
      },
    },
  }) as unknown as PrismaClient
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma: PrismaClient = globalForPrisma.prisma ?? denganRetryBaca(createPrismaClient())

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

// Helper untuk retry manual pada blok berisi beberapa query sekaligus
// (mis. start ujian: await withRetry(() => prisma.ujian.findFirst(...)))
export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  return ulangiBilaSesaat(fn, retries)
}
