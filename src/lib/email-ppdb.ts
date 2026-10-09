import { Resend } from "resend"
import { logger } from "./pino"

const apiKey = process.env.RESEND_API_KEY
// anggap placeholder / key kosong sebagai "belum dikonfigurasi"
const keyValid = apiKey && apiKey.startsWith("re_")
let resend: Resend | null = null
if (keyValid) {
  resend = new Resend(apiKey)
}

const FROM = process.env.EMAIL_FROM || "PPDB <onboarding@resend.dev>"

/**
 * Kirim email verifikasi PPDB. Jika RESEND_API_KEY belum diisi,
 * token dicetak ke log server (untuk pengembangan/testing).
 */
export async function kirimEmailVerifikasi(to: string, nama: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/ppdb/verifikasi?token=${token}`
  if (!resend) {
    logger.info({ to, token, url }, "[PPDB] RESEND_API_KEY belum diisi — token verifikasi (dev only)")
    return { ok: true, devToken: token, devUrl: url }
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "Verifikasi Email Pendaftaran PPDB",
      html: `
        <h2>Verifikasi Email Anda</h2>
        <p>Halo ${nama || "Calon Pendaftar"},</p>
        <p>Silakan verifikasi email Anda dengan menekan tombol di bawah:</p>
        <p><a href="${url}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Verifikasi Sekarang</a></p>
        <p>Atau salin tautan berikut:</p>
        <p>${url}</p>
        <p>Tautan berlaku 24 jam. Jika Anda tidak mendaftar, abaikan email ini.</p>
      `,
    })
    return { ok: true }
  } catch (e) {
    logger.error({ e, to }, "[PPDB] Gagal kirim email verifikasi")
    return { ok: false, error: "Gagal mengirim email verifikasi" }
  }
}

/** Kirim email reset password. */
export async function kirimEmailReset(to: string, nama: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/ppdb/reset-password?token=${token}`
  if (!resend) {
    logger.info({ to, token, url }, "[PPDB] RESEND_API_KEY belum diisi — token reset (dev only)")
    return { ok: true, devToken: token, devUrl: url }
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "Reset Password PPDB",
      html: `
        <h2>Reset Password</h2>
        <p>Halo ${nama || "Calon Pendaftar"},</p>
        <p>Anda meminta reset password. Tekan tombol di bawah untuk membuat password baru:</p>
        <p><a href="${url}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Reset Password</a></p>
        <p>Atau salin tautan: ${url}</p>
        <p>Tautan berlaku 1 jam. Jika Anda tidak meminta ini, abaikan email ini.</p>
      `,
    })
    return { ok: true }
  } catch (e) {
    logger.error({ e, to }, "[PPDB] Gagal kirim email reset")
    return { ok: false, error: "Gagal mengirim email reset" }
  }
}
