import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
import { updateStudentModel } from "@/lib/agents/student-modeling"; import { getPenguasaanOverview } from "@/lib/agents/knowledge-tracing";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};

async function ambilSiswa(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return null;
  if (user.role !== "SISWA") return { forbidden: true } as const;
  const siswa = await prisma.siswa.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
  if (!siswa) return null;
  return siswa;
}

export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

/** Analitik AI siswa — mirror web aiAnalitikData() (agent logs, statistik, profile model, penguasaan). */
export async function GET(req: Request) {
  try {
    const siswa = await ambilSiswa(req);
    if (!siswa) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in siswa) return NextResponse.json({ error: "Bukan siswa" }, { status: 403, headers: corsHeaders });
    const [logs, byAgent, stat, suksesCount, gagalCount, model, penguasaan] = await Promise.all([
      prisma.agentLog.findMany({ where: { siswaId: siswa.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.agentLog.groupBy({ by: ["agent"], where: { siswaId: siswa.id }, _count: { _all: true }, _avg: { durasiMs: true } }),
      prisma.agentLog.aggregate({ where: { siswaId: siswa.id }, _count: { _all: true }, _avg: { durasiMs: true } }),
      prisma.agentLog.count({ where: { siswaId: siswa.id, sukses: true } }),
      prisma.agentLog.count({ where: { siswaId: siswa.id, sukses: false } }),
      updateStudentModel(siswa.id).catch(() => null),
      getPenguasaanOverview(siswa.id).catch(() => []),
    ]);
    const perAgent = byAgent.map((a) => ({ agent: a.agent, total: a._count._all, rataDurasi: a._avg.durasiMs ?? 0 })).sort((a, b) => b.total - a.total);
    return NextResponse.json({
      logs,
      perAgent,
      statistik: { totalRuns: stat._count._all, sukses: suksesCount, gagal: gagalCount, rataDurasi: (stat._avg.durasiMs ?? 0) / 1000 },
      profile: model ? { gayaBelajar: model.gayaBelajar, motivasi: Math.round(model.motivasi * 100), engagement: Math.round(model.engagementScore * 100), konsistensi: Math.round(model.konsistensi * 100), streak: model.streak, trendNilai: model.trendNilai } : null,
      penguasaan,
    }, { headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders }) }
}
