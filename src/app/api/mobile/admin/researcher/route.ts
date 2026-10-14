import { prisma } from "@/lib/prisma"
import { requireAdmin, ok, fail, options } from "../_lib"

export { options }

const HARI_30 = 30 * 24 * 60 * 60 * 1000

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const since = new Date(Date.now() - HARI_30)

    const [totalSiswa, totalUjian, totalSoal, rataNilai, aktivitasCount, aktifUnik, ujianDikerjakan, masteryByKategori, distribusi, mastery, tren, agentPerf, warningBreakdown, warningBySeverity, dropoutRisk] =
      await Promise.all([
        prisma.siswa.count({ where: { deletedAt: null } }),
        prisma.ujian.count({ where: { deletedAt: null } }),
        prisma.soal.count({ where: { deletedAt: null } }),
        prisma.nilai.aggregate({ where: { deletedAt: null }, _avg: { nilai: true } }),
        prisma.learningActivity.count({ where: { createdAt: { gte: since } } }),
        prisma.learningActivity.findMany({ where: { createdAt: { gte: since } }, select: { siswaId: true }, distinct: ["siswaId"] }),
        prisma.ujian.findMany({ where: { deletedAt: null }, select: { _count: { select: { jawabanUjian: true } } } }),
        prisma.penguasaanKompetensi.groupBy({ by: ["kategori"], _count: { id: true } }),
        Promise.all(
          [
            { label: "0-20", min: 0, max: 20 },
            { label: "21-40", min: 21, max: 40 },
            { label: "41-60", min: 41, max: 60 },
            { label: "61-80", min: 61, max: 80 },
            { label: "81-100", min: 81, max: 100 },
          ].map(async (b) => ({
            label: b.label,
            count: await prisma.nilai.count({ where: { deletedAt: null, nilai: { gte: b.min, lte: b.max } } }),
          })),
        ),
        (async () => {
          const grouped = await prisma.penguasaanKompetensi.groupBy({ by: ["kompetensiId"], _avg: { skor: true }, _count: { id: true } })
          const ids = grouped.map((g) => g.kompetensiId)
          const kompetensi = await prisma.kompetensi.findMany({
            where: { id: { in: ids } },
            select: { id: true, nama: true, kode: true, mataPelajaran: { select: { nama: true, kode: true } } },
          })
          const map = new Map(kompetensi.map((k) => [k.id, k]))
          return grouped
            .map((g) => {
              const k = map.get(g.kompetensiId)
              return {
                mapel: k?.mataPelajaran?.nama ?? "-",
                kompetensi: k?.nama ?? g.kompetensiId,
                avgSkor: g._avg.skor ? Math.round(g._avg.skor * 10) / 10 : null,
                jumlahSiswa: g._count.id,
              }
            })
            .sort((a, b) => (a.avgSkor ?? 0) - (b.avgSkor ?? 0))
        })(),
        (async () => {
          const rows = await prisma.learningActivity.findMany({
            where: { createdAt: { gte: since } },
            select: { createdAt: true },
            orderBy: { createdAt: "asc" },
          })
          const buckets = new Map<string, number>()
          for (const r of rows) {
            const key = r.createdAt.toISOString().slice(0, 10)
            buckets.set(key, (buckets.get(key) ?? 0) + 1)
          }
          return [...buckets.entries()].sort().map(([date, count]) => ({ date, count }))
        })(),
        (async () => {
          const grouped = await prisma.agentLog.groupBy({ by: ["agent"], _count: { id: true }, _avg: { durasiMs: true }, where: { createdAt: { gte: since } } })
          return Promise.all(
            grouped.map(async (g) => ({
              agent: g.agent,
              totalCalls: g._count.id,
              successRate: g._count.id ? Math.round(((await prisma.agentLog.count({ where: { agent: g.agent, sukses: true, createdAt: { gte: since } } })) / g._count.id) * 1000) / 10 : 0,
              avgDuration: g._avg.durasiMs ? Math.round(g._avg.durasiMs) : null,
            })),
          )
        })(),
        prisma.earlyWarning.groupBy({ by: ["severity", "tipe"], _count: { id: true } }),
        prisma.earlyWarning.groupBy({ by: ["severity"], _count: { id: true } }),
        (async () => {
          const risky = await prisma.earlyWarning.groupBy({
            by: ["siswaId"],
            where: { severity: { in: ["HIGH", "CRITICAL"] } },
            _count: { id: true },
            having: { id: { _count: { gte: 3 } } },
          })
          const ids = risky.map((r) => r.siswaId)
          if (ids.length === 0) return []
          const siswa = await prisma.siswa.findMany({
            where: { id: { in: ids }, deletedAt: null },
            select: { id: true, nama: true, nis: true, kelas: { select: { nama: true } } },
          })
          const countMap = new Map(risky.map((r) => [r.siswaId, r._count.id]))
          return siswa
            .map((s) => ({ id: s.id, nama: s.nama, nis: s.nis, kelas: s.kelas?.nama ?? null, jumlahPeringatan: countMap.get(s.id) ?? 0 }))
            .sort((a, b) => b.jumlahPeringatan - a.jumlahPeringatan)
        })(),
      ])

    return ok({
      overview: {
        totalSiswa,
        totalUjian,
        totalSoal,
        rataNilai: rataNilai._avg.nilai ? Math.round(rataNilai._avg.nilai * 10) / 10 : null,
        aktivitas30Hari: aktivitasCount,
        siswaAktif30Hari: aktifUnik.length,
        soalTerjawab: ujianDikerjakan.reduce((a, b) => a + b._count.jawabanUjian, 0),
        masteryPerKategori: masteryByKategori.map((m) => ({ kategori: m.kategori, jumlah: m._count.id })),
      },
      distribusiNilai: distribusi,
      mastery,
      trenAktivitas: tren,
      agentPerformance: agentPerf,
      warning: {
        breakdown: warningBreakdown.map((w) => ({ severity: w.severity, tipe: w.tipe, jumlah: w._count.id })),
        bySeverity: warningBySeverity.map((w) => ({ severity: w.severity, jumlah: w._count.id })),
      },
      dropoutRisk,
    })
  } catch (e) {
    console.error(e)
    return fail("Gagal")
  }
}
