import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
import { getStudentModelSummary } from "@/lib/agents/student-modeling"; import { getPenguasaanOverview } from "@/lib/agents/knowledge-tracing"; import { getAdaptivePath } from "@/lib/agents/adaptive-learning"; import { getStudentWarnings, runEarlyWarning } from "@/lib/agents/early-warning";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};

async function ambilSiswa(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return null;
  if (user.role !== "SISWA") return { forbidden: true } as const;
  const siswa = await prisma.siswa.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
  if (!siswa) return null;
  return siswa;
}

function bentukWarnings(warnings: Awaited<ReturnType<typeof getStudentWarnings>>) {
  return {
    total: warnings.length,
    critical: warnings.filter((w) => w.severity === "CRITICAL").length,
    high: warnings.filter((w) => w.severity === "HIGH").length,
    warnings,
  };
}

export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

export async function GET(req: Request) {
  try {
    const siswa = await ambilSiswa(req);
    if (!siswa) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in siswa) return NextResponse.json({ error: "Bukan siswa" }, { status: 403, headers: corsHeaders });
    const [model, penguasaan, jalur, warnings] = await Promise.all([
      getStudentModelSummary(siswa.id).catch(() => null),
      getPenguasaanOverview(siswa.id).catch(() => null),
      getAdaptivePath(siswa.id).catch(() => null),
      getStudentWarnings(siswa.id).catch(() => []),
    ]);
    return NextResponse.json({ model, penguasaan, jalur, warnings: bentukWarnings(warnings) }, { headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders }) }
}

export async function POST(req: Request) {
  try {
    const siswa = await ambilSiswa(req);
    if (!siswa) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in siswa) return NextResponse.json({ error: "Bukan siswa" }, { status: 403, headers: corsHeaders });
    await runEarlyWarning(siswa.id);
    const warnings = await getStudentWarnings(siswa.id);
    return NextResponse.json({ warnings: bentukWarnings(warnings) }, { headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders }) }
}
