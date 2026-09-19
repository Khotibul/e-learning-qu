import { logger } from "./pino"

const rateMap = new Map<string, { count: number; resetTime: number }>()

// Prune expired entries setiap 60s agar Map tidak membesar saat spoof x-forwarded-for
if (typeof globalThis !== "undefined" && !(globalThis as unknown as { __ratePrune?: unknown }).__ratePrune) {
  ;(globalThis as unknown as { __ratePrune: unknown }).__ratePrune = setInterval(() => {
    const now = Date.now()
    for (const [k, v] of rateMap) if (now > v.resetTime) rateMap.delete(k)
    if (rateMap.size > 5000) {
      // Emergency cap: hapus tertua
      const toDelete = rateMap.size - 4000
      let i = 0
      for (const k of rateMap.keys()) {
        if (i++ >= toDelete) break
        rateMap.delete(k)
      }
    }
  }, 60000)
  // @ts-ignore
  if (typeof (globalThis as unknown as { __ratePrune: { unref?: () => void } }).__ratePrune.unref === "function") {
    ;(globalThis as unknown as { __ratePrune: { unref: () => void } }).__ratePrune.unref()
  }
}

export function rateLimit(key: string, limit: number = 60, windowMs: number = 60000) {
  const now = Date.now()
  const record = rateMap.get(key)

  if (!record || now > record.resetTime) {
    rateMap.set(key, { count: 1, resetTime: now + windowMs })
    return { success: true, remaining: limit - 1 }
  }

  if (record.count >= limit) {
    logger.warn(`Rate limit exceeded for key: ${key}`)
    return { success: false, remaining: 0 }
  }

  record.count++
  return { success: true, remaining: limit - record.count }
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown"
  return req.headers.get("x-real-ip")?.trim() || "unknown"
}
