import pino from "pino"

// pino-pretty hanya opsional (dev). Bila tidak terpasang, fallback ke plain JSON
// agar dev/test tidak crash — jangan pernah membuat proses gagal start karena logger.
function buatLogger(): pino.Logger {
  const base = { level: process.env.LOG_LEVEL ?? "info" }
  if (process.env.NODE_ENV === "production") return pino(base)
  try {
    return pino({ ...base, transport: { target: "pino-pretty", options: { colorize: true } } })
  } catch {
    return pino(base)
  }
}

export const logger = buatLogger()
