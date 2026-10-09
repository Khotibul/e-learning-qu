import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
import { submitSUSSurvey, getSUSResults } from "@/lib/agents/evaluation";
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

/** Hasil SUS agregat — mobile = SISWA, rincian per-siswa disisipkan hanya untuk role berprivilese (privasi audit M3). */
export async function GET(req: Request) {
  try {
    const siswa = await ambilSiswa(req);
    if (!siswa) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in siswa) return NextResponse.json({ error: "Bukan siswa" }, { status: 403, headers: corsHeaders });
    const hasil = await getSUSResults();
    return NextResponse.json({ average: hasil.average, total: hasil.total, distribusi: hasil.distribusi }, { headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders }) }
}

/** Submit survei SUS 10 pertanyaan (skor 0-100). */
export async function POST(req: Request) {
  try {
    const siswa = await ambilSiswa(req);
    if (!siswa) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in siswa) return NextResponse.json({ error: "Bukan siswa" }, { status: 403, headers: corsHeaders });
    const body = await req.json().catch(() => ({}) as any);
    const jawaban: number[] = Array.isArray(body.jawaban) ? body.jawaban.map((v: any) => Number(v) || 0) : [];
    if (jawaban.length !== 10) return NextResponse.json({ error: "SUS harus 10 pertanyaan" }, { status: 400, headers: corsHeaders });
    if (jawaban.some((v) => v < 1 || v > 5)) return NextResponse.json({ error: "Jawaban harus 1-5" }, { status: 400, headers: corsHeaders });
    const hasil = await submitSUSSurvey(siswa.id, jawaban, typeof body.komentar === "string" && body.komentar.trim() ? body.komentar.trim() : undefined);
    return NextResponse.json({ id: hasil.id, skor: hasil.skor }, { headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 500, headers: corsHeaders }) }
}
