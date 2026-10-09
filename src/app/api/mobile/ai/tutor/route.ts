import { NextResponse } from "next/server"; import { getMobileUser } from "@/lib/mobile-auth"; import { prisma } from "@/lib/prisma"; import { runTutorAgent } from "@/lib/agents/tutor"; import { buildConversationHistory } from "@/lib/agents/orchestrator";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};

async function ambilSiswa(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return null;
  if (user.role !== "SISWA") return { forbidden: true } as const;
  const siswa = await prisma.siswa.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true, kelasId: true } });
  if (!siswa) return null;
  return siswa;
}

export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

/** GET ?tab=sessions|messages|mapel — daftar sesi, pesan sesi, atau mapel kelas. */
export async function GET(req: Request) {
  try {
    const siswa = await ambilSiswa(req);
    if (!siswa) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in siswa) return NextResponse.json({ error: "Bukan siswa" }, { status: 403, headers: corsHeaders });
    const q = new URL(req.url).searchParams;
    const tab = q.get("tab") || "sessions";
    if (tab === "sessions") {
      const sessions = await prisma.chatSession.findMany({ where: { siswaId: siswa.id }, orderBy: { updatedAt: "desc" }, take: 30, include: { _count: { select: { messages: true } } } });
      return NextResponse.json(sessions, { headers: corsHeaders });
    }
    if (tab === "messages") {
      const sessionId = q.get("sessionId") || "";
      const session = await prisma.chatSession.findFirst({ where: { id: sessionId, siswaId: siswa.id }, select: { id: true } });
      if (!session) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404, headers: corsHeaders });
      const messages = await prisma.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
      return NextResponse.json(messages, { headers: corsHeaders });
    }
    if (tab === "mapel") {
      const mapels = siswa.kelasId ? await prisma.pengajaran.findMany({ where: { kelasId: siswa.kelasId, deletedAt: null, mataPelajaran: { deletedAt: null } }, select: { mataPelajaran: { select: { id: true, nama: true } } }, distinct: ["mataPelajaranId"] }).then((ps) => ps.map((p) => p.mataPelajaran)) : [];
      return NextResponse.json(mapels, { headers: corsHeaders });
    }
    return NextResponse.json({ error: "tab tidak dikenal" }, { status: 400, headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders }) }
}

/** POST {message, sessionId?, mapelId?} — chat dengan sesi tersimpan + riwayat (mirror web aiChat bagian tutor). */
export async function POST(req: Request) {
  try {
    const siswa = await ambilSiswa(req);
    if (!siswa) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in siswa) return NextResponse.json({ error: "Bukan siswa" }, { status: 403, headers: corsHeaders });
    const body = await req.json().catch(() => ({}) as any);
    const pesan = String(body.message || "").trim();
    if (!pesan) return NextResponse.json({ error: "Pesan kosong" }, { status: 400, headers: corsHeaders });
    const mapelId = body.mapelId ? String(body.mapelId) : null;

    let sessionId = body.sessionId ? String(body.sessionId) : null;
    if (sessionId) {
      const owned = await prisma.chatSession.findFirst({ where: { id: sessionId, siswaId: siswa.id }, select: { id: true } });
      if (!owned) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404, headers: corsHeaders });
    } else {
      const judul = pesan.length > 40 ? `${pesan.slice(0, 40)}…` : pesan;
      const created = await prisma.chatSession.create({ data: { siswaId: siswa.id, mapelId, judul } });
      sessionId = created.id;
    }

    const existing = await prisma.chatMessage.findMany({ where: { sessionId: sessionId! }, orderBy: { createdAt: "asc" } });
    const history = buildConversationHistory(existing);

    await prisma.chatMessage.create({ data: { sessionId: sessionId!, role: "siswa", konten: pesan } });

    const result = await runTutorAgent(pesan, {
      mapelId,
      kelasId: siswa.kelasId ?? null,
      history,
      studentId: siswa.id,
    });

    await prisma.chatMessage.create({ data: { sessionId: sessionId!, role: "assistant", agent: "tutor", konten: result.jawaban, sumber: (result.sumber ?? undefined) as any } });
    await prisma.chatSession.update({ where: { id: sessionId! }, data: { updatedAt: new Date() } });

    return NextResponse.json({ sessionId, ...result }, { headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders }) }
}
