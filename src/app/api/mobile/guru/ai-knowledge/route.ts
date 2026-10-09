import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
import { chunkText, estimateTokens } from "@/lib/agents/chunker"; import { embedText, geminiEnabled } from "@/lib/agents/gemini";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};

async function ambilGuru(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return null;
  if (user.role !== "GURU") return { forbidden: true } as const;
  const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
  if (!guru) return null;
  return guru;
}

export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

export async function GET(req: Request) {
  try {
    const guru = await ambilGuru(req);
    if (!guru) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in guru) return NextResponse.json({ error: "Bukan guru" }, { status: 403, headers: corsHeaders });
    const materis = await prisma.materi.findMany({ where: { guruId: guru.id, deletedAt: null }, select: { id: true, judul: true, deskripsi: true, _count: { select: { chunks: true } } }, orderBy: { createdAt: "desc" }, take: 50 });
    const totalChunks = await prisma.materiChunk.count({ where: { materi: { guruId: guru.id } } });
    return NextResponse.json({ materis, totalChunks, geminiEnabled: geminiEnabled() }, { headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders }) }
}

/** indexMateri / deleteMateriIndex — mirror web guru/ai actions (RAG knowledge base). */
export async function POST(req: Request) {
  try {
    const guru = await ambilGuru(req);
    if (!guru) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in guru) return NextResponse.json({ error: "Bukan guru" }, { status: 403, headers: corsHeaders });
    const body = await req.json().catch(() => ({}) as any);
    const op = String(body.op || "");
    const materiId = String(body.materiId || "");

    if (op === "indexMateri") {
      const materi = await prisma.materi.findFirst({ where: { id: materiId, guruId: guru.id, deletedAt: null } });
      if (!materi) return NextResponse.json({ error: "Materi tidak ditemukan" }, { status: 404, headers: corsHeaders });
      const teks = [materi.judul, materi.deskripsi, materi.konten].filter(Boolean).join("\n\n").trim();
      if (!teks) return NextResponse.json({ error: "Materi belum memiliki konten teks" }, { status: 400, headers: corsHeaders });
      const bagian = chunkText(teks);
      if (bagian.length === 0) return NextResponse.json({ error: "Tidak ada teks yang bisa diindeks" }, { status: 400, headers: corsHeaders });
      await prisma.materiChunk.deleteMany({ where: { materiId } });
      let failedEmbed = false;
      const rows: { index: number; text: string; tokenCount: number; embedding: number[]; materiId: string; mataPelajaranId: string }[] = [];
      for (let i = 0; i < bagian.length; i++) {
        let embedding: number[] = [];
        if (geminiEnabled() && !failedEmbed) {
          try { embedding = await embedText(bagian[i], { taskType: "RETRIEVAL_DOCUMENT" }); } catch (e) { console.error("Embed gagal:", e); failedEmbed = true; }
        }
        rows.push({ index: i, text: bagian[i], tokenCount: estimateTokens(bagian[i]), embedding, materiId, mataPelajaranId: materi.mataPelajaranId });
      }
      await prisma.materiChunk.createMany({ data: rows });
      return NextResponse.json({ jumlahChunk: rows.length, modeEmbed: failedEmbed ? "keyword" : geminiEnabled() ? "semantic" : "keyword" }, { headers: corsHeaders });
    }

    if (op === "deleteMateriIndex") {
      const materi = await prisma.materi.findFirst({ where: { id: materiId, guruId: guru.id, deletedAt: null }, select: { id: true } });
      if (!materi) return NextResponse.json({ error: "Materi tidak ditemukan" }, { status: 404, headers: corsHeaders });
      await prisma.materiChunk.deleteMany({ where: { materiId } });
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    return NextResponse.json({ error: "Op tidak dikenal" }, { status: 400, headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 500, headers: corsHeaders }) }
}
