import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
import { getTeacherAnalytics, getTeacherStudentInsights } from "@/lib/agents/teacher-analytics";
import { getAtRiskStudents, resolveWarning } from "@/lib/agents/early-warning";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};

type Hasil = { ok: false; error: string; status: number } | { ok: true; guruId: string };
async function ambilGuru(req: Request): Promise<Hasil> {
  const user = await getMobileUser(req);
  if (!user) return { ok: false, error: "Unauthorized", status: 401 };
  if (user.role !== "GURU") return { ok: false, error: "Bukan guru", status: 403 };
  const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
  if (!guru) return { ok: false, error: "Guru tidak ditemukan", status: 404 };
  return { ok: true, guruId: guru.id };
}
const err = (m: string, s: number) => NextResponse.json({ error: m }, { status: s, headers: corsHeaders });

/** Kelas yang boleh dilihat guru: pengajaran + kelas perwalian — mirror web teacher-analytics actions. */
async function kelasDiizinkan(guruId: string): Promise<string[]> {
  const [pengajaranKelas, waliKelas] = await Promise.all([
    prisma.pengajaran.findMany({ where: { guruId, deletedAt: null, mataPelajaran: { deletedAt: null } }, select: { kelasId: true }, distinct: ["kelasId"] }),
    prisma.kelas.findMany({ where: { guruId, deletedAt: null }, select: { id: true } }),
  ]);
  return [...new Set([...pengajaranKelas.map((p) => p.kelasId), ...waliKelas.map((k) => k.id)])];
}

export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

/** GET — analitik guru + siswa berisiko + insight per siswa (mirror web teacher-analytics). */
export async function GET(req: Request) {
  try {
    const g = await ambilGuru(req);
    if (!g.ok) return err(g.error, g.status);
    const kelasIds = await kelasDiizinkan(g.guruId);
    const [analytics, atRisk, insights] = await Promise.all([
      getTeacherAnalytics(g.guruId).catch(() => null),
      getAtRiskStudents(kelasIds).catch(() => []),
      getTeacherStudentInsights(g.guruId, { limit: 50 }).catch(() => []),
    ]);
    return NextResponse.json({ analytics, atRisk, insights }, { headers: corsHeaders });
  } catch (e) { console.error(e); return err("Gagal", 500); }
}

/** POST {op:"resolveWarning", warningId} — ownership check (warning harus di kelas guru). */
export async function POST(req: Request) {
  try {
    const g = await ambilGuru(req);
    if (!g.ok) return err(g.error, g.status);
    const body = await req.json().catch(() => ({}) as any);
    if (String(body.op || "") !== "resolveWarning") return err("Op tidak dikenal", 400);
    const warningId = String(body.warningId || "");
    const warning = await prisma.earlyWarning.findFirst({ where: { id: warningId }, select: { id: true, siswa: { select: { kelasId: true } } } });
    if (!warning) return err("Peringatan tidak ditemukan", 404);
    const allowed = await kelasDiizinkan(g.guruId);
    if (!warning.siswa?.kelasId || !allowed.includes(warning.siswa.kelasId)) return err("Tidak berhak menutup peringatan ini", 403);
    await resolveWarning(warningId);
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (e) { console.error(e); return err("Gagal", 500); }
}
