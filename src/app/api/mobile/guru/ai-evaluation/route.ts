import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
import { getSUSResults, getAIEvaluationSummary } from "@/lib/agents/evaluation";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};

async function ambilGuru(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return null;
  if (user.role !== "GURU") return { forbidden: true } as const;
  const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
  if (!guru) return null;
  return guru;
}

export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

/** Evaluasi AI + hasil SUS (full, role berprivilese) — mirror web /guru/ai-evaluation. */
export async function GET(req: Request) {
  try {
    const guru = await ambilGuru(req);
    if (!guru) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in guru) return NextResponse.json({ error: "Bukan guru" }, { status: 403, headers: corsHeaders });
    const [sus, ai] = await Promise.all([
      getSUSResults().catch(() => ({ average: 0, total: 0, distribusi: { excellent: 0, good: 0, ok: 0, poor: 0, terrible: 0 }, results: [] })),
      getAIEvaluationSummary().catch(() => ({ summary: [], total: 0 })),
    ]);
    return NextResponse.json({ sus, ai }, { headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders }) }
}
