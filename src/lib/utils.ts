import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date))
}

export function formatDateOnly(date: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(date))
}

/**
 * Format tanggal lokal YYYY-MM-DD (bukan UTC).
 * `new Date().toISOString().slice(0,10)` di browser memberi tanggal UTC —
 * pada 00:00–07:00 WIB tanggalnya masih "kemarin". Pakai ini untuk
 * default input date & tampilan tanggal di komponen klien.
 */
export function ymd(d: Date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Format bulan lokal YYYY-MM. */
export function ym(d: Date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}`
}

export function generateRandomString(length: number = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("")
}

export function calculateGrade(nilai: number) {
  if (nilai >= 90) return "A"
  if (nilai >= 80) return "B"
  if (nilai >= 70) return "C"
  if (nilai >= 60) return "D"
  return "E"
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
