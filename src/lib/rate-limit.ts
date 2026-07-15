import { logger } from "./pino"

const rateMap = new Map<string, { count: number; resetTime: number }>()

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
