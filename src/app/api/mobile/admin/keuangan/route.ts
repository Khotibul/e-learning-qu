import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUser } from "@/lib/mobile-auth"
import { options, ok, fail } from "../_lib"
import { verifikasiTopup } from "@/lib/keuangan/topup"
import { verifikasiPembayaranTagihan, tandaiJatuhTempo } from "@/lib/keuangan/billing"
import { createAuditLog } from "@/lib/audit"

export { options }

/**
 * Mobile API Admin Keuangan (Bendahara) — mirror dari
 * src/app/(dashboard)/bendahara/actions.ts untuk konsumen desktop.
 * Akses: role ADMIN atau petugas keuangan aktif (BENDAHARA/AUDITOR),
 * sama dengan guardBendahara di website.
 * GET  ?view=dashboard|antrean|akun|jurnal|rekap|kantin
 * POST {op:"verifikasiTopup"|"verifikasiPembayaran"|"tandaiJatuhTempo"}
 */
async function guardKeuangan(req: Request): Promise<{ userId: string; error?: NextResponse }> {
  const user = await getMobileUser(req)
  if (!user) return { userId: "", error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (user.role === "ADMIN") return { userId: user.id }
  const asg = await prisma.keuanganStaff.findFirst({
    where: { userId: user.id, peran: { in: ["BENDAHARA", "AUDITOR"] }, aktif: true },
    select: { peran: true },
  })
  if (!asg) return { userId: "", error: NextResponse.json({ error: "Hanya admin/bendahara/auditor" }, { status: 403 }) }
  return { userId: user.id }
}

function hariIni() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(req: Request) {
  try {
    const guard = await guardKeuangan(req)
    if (guard.error) return guard.error
    const q = new URL(req.url).searchParams
    const view = q.get("view") || "dashboard"

    if (view === "dashboard") {
      const [topupMenunggu, tagihanPending, totalSaldo, totalKewajiban, totalPendapatanKantin, totalHpp, transaksiHariIni, invoiceBelumLunas] =
        await Promise.all([
          prisma.topupRequest.count({ where: { status: "MENUNGGU" } }),
          prisma.pembayaranTagihan.count({ where: { status: "PENDING" } }),
          prisma.walletAccount.aggregate({ _sum: { saldo: true }, _count: true }),
          prisma.akunLaporan.findUnique({ where: { kode: "KEWAJIBAN_DOMPET" }, select: { saldo: true } }),
          prisma.akunLaporan.findUnique({ where: { kode: "PENDAPATAN_KANTIN" }, select: { saldo: true } }),
          prisma.akunLaporan.findUnique({ where: { kode: "HPP" }, select: { saldo: true } }),
          prisma.kantinTransaksi.count({ where: { createdAt: { gte: hariIni() }, status: "SELESAI" } }),
          prisma.invoiceTagihan.count({ where: { status: { in: ["BELUM_DIBAYAR", "SEBAGIAN", "JATUH_TEMPO"] } } }),
        ])
      return ok({
        topupMenunggu,
        tagihanPending,
        totalSaldoDompet: totalSaldo._sum.saldo ?? 0,
        jumlahDompet: totalSaldo._count,
        kewajibanDompet: totalKewajiban?.saldo ?? 0,
        pendapatanKantin: totalPendapatanKantin?.saldo ?? 0,
        hpp: totalHpp?.saldo ?? 0,
        transaksiHariIni,
        invoiceBelumLunas,
      })
    }

    if (view === "antrean") {
      const [topups, bayar] = await Promise.all([
        prisma.topupRequest.findMany({
          where: { status: "MENUNGGU" },
          include: {
            account: { select: { nomor: true, user: { select: { santri: { select: { nama: true } }, siswa: { select: { nama: true } } } } } },
            wali: { select: { nama: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.pembayaranTagihan.findMany({
          where: { status: "PENDING" },
          include: { invoice: { select: { kode: true, periode: true, jenis: { select: { nama: true } } } } },
          orderBy: { createdAt: "asc" },
        }),
      ])
      return ok({
        topups: topups.map((t) => ({
          id: t.id,
          nominal: t.jumlah,
          buktiUrl: t.buktiUrl,
          catatan: t.catatan,
          createdAt: t.createdAt.toISOString(),
          nomor: t.account?.nomor ?? "-",
          nama: t.account?.user?.santri?.nama || t.account?.user?.siswa?.nama || t.wali?.nama || "-",
        })),
        pembayaran: bayar.map((b) => ({
          id: b.id,
          jumlah: b.jumlah,
          buktiUrl: b.buktiUrl,
          createdAt: b.createdAt.toISOString(),
          invoiceKode: b.invoice?.kode ?? "-",
          periode: b.invoice?.periode ?? "-",
          jenisNama: b.invoice?.jenis?.nama ?? "-",
        })),
      })
    }

    if (view === "akun") {
      return ok(await prisma.akunLaporan.findMany({ where: { aktif: true }, orderBy: { kode: "asc" } }))
    }

    if (view === "jurnal") {
      const take = Math.min(Number(q.get("take")) || 50, 200)
      const rows = await prisma.jurnalUmum.findMany({
        include: { item: { include: { akun: { select: { kode: true, nama: true } } } } },
        orderBy: { tanggal: "desc" },
        take,
      })
      return ok(
        rows.map((r) => ({
          id: r.id,
          tanggal: r.tanggal.toISOString().slice(0, 10),
          nomor: r.nomor,
          keterangan: r.keterangan,
          item: r.item.map((i) => ({ akunKode: i.akun?.kode, akunNama: i.akun?.nama, debit: i.debit, kredit: i.kredit })),
        }))
      )
    }

    if (view === "rekap") {
      const periode = q.get("periode")
      return ok(
        await prisma.invoiceTagihan.groupBy({
          by: ["status"],
          where: periode ? { periode } : {},
          _count: true,
          _sum: { total: true, terbayar: true, sisa: true },
        })
      )
    }

    if (view === "kantin") {
      const outletId = q.get("outletId")
      const hariTerakhir = Math.min(Number(q.get("hari")) || 7, 90)
      const sejak = new Date()
      sejak.setDate(sejak.getDate() - hariTerakhir)
      const rows = await prisma.kantinTransaksi.findMany({
        where: { createdAt: { gte: sejak }, ...(outletId ? { outletId } : {}), status: { not: "DIBATALKAN" } },
        include: { outlet: { select: { nama: true } }, item: { select: { namaSnapshot: true, qty: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
      return ok(
        rows.map((r) => ({
          id: r.id,
          total: r.total,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          outlet: r.outlet?.nama ?? "-",
          item: r.item.map((i) => ({ nama: i.namaSnapshot, qty: i.qty })),
        }))
      )
    }

    return fail("view tidak dikenal", 400)
  } catch (e) {
    console.error("mobile/admin/keuangan GET error:", e)
    return fail("Gagal memuat data keuangan", 500)
  }
}

export async function POST(req: Request) {
  try {
    const guard = await guardKeuangan(req)
    if (guard.error) return guard.error
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const op = String(body.op || "")

    if (op === "verifikasiTopup") {
      const hasil = await verifikasiTopup({
        topupId: String(body.topupId || ""),
        verifiedBy: guard.userId,
        setujui: body.setujui === true,
        catatan: body.catatan != null ? String(body.catatan) : undefined,
      })
      if (!hasil.ok) return fail(hasil.error ?? "Gagal", 400)
      return ok(hasil)
    }

    if (op === "verifikasiPembayaran") {
      const hasil = await verifikasiPembayaranTagihan({
        pembayaranId: String(body.pembayaranId || ""),
        verifiedBy: guard.userId,
        setujui: body.setujui === true,
        catatan: body.catatan != null ? String(body.catatan) : undefined,
      })
      if (!hasil.ok) return fail(hasil.error ?? "Gagal", 400)
      return ok(hasil)
    }

    if (op === "tandaiJatuhTempo") {
      const hasil = await tandaiJatuhTempo()
      await createAuditLog({ userId: guard.userId, action: "TANDAI_JATUH_TEMPO", entity: "InvoiceTagihan", detail: hasil })
      return ok(hasil)
    }

    return fail("op tidak dikenal", 400)
  } catch (e) {
    console.error("mobile/admin/keuangan POST error:", e)
    return fail(e instanceof Error ? e.message : "Gagal memproses", 500)
  }
}
