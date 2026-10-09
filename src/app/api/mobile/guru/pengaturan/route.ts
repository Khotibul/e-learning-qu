import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth"; import bcrypt from "bcryptjs";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};

async function ambilGuru(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return null;
  if (user.role !== "GURU") return { forbidden: true } as const;
  const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true, userId: true } });
  if (!guru) return null;
  return guru;
}

export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

/** Profil guru — mirror web getGuruProfile(). */
export async function GET(req: Request) {
  try {
    const guru = await ambilGuru(req);
    if (!guru) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in guru) return NextResponse.json({ error: "Bukan guru" }, { status: 403, headers: corsHeaders });
    const data = await prisma.guru.findUnique({ where: { id: guru.id }, select: { id: true, nama: true, nip: true, nuptk: true, alamat: true, noTelp: true, user: { select: { id: true, email: true, name: true, image: true } } } });
    return NextResponse.json(data, { headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders }) }
}

/** updateProfile / updatePassword — mirror web updateGuruProfile/updateGuruPassword. */
export async function POST(req: Request) {
  try {
    const guru = await ambilGuru(req);
    if (!guru) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in guru) return NextResponse.json({ error: "Bukan guru" }, { status: 403, headers: corsHeaders });
    const body = await req.json().catch(() => ({}) as any);
    const op = String(body.op || "");

    if (op === "updateProfile") {
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.guru.update({
          where: { id: guru.id },
          data: {
            ...(body.nama !== undefined && { nama: String(body.nama || "") }),
            ...(body.nip !== undefined && { nip: body.nip ? String(body.nip) : null }),
            ...(body.nuptk !== undefined && { nuptk: body.nuptk ? String(body.nuptk) : null }),
            ...(body.alamat !== undefined && { alamat: body.alamat ? String(body.alamat) : null }),
            ...(body.noTelp !== undefined && { noTelp: body.noTelp ? String(body.noTelp) : null }),
          },
          select: { id: true, nama: true, nip: true, nuptk: true, alamat: true, noTelp: true },
        });
        if (body.nama) await tx.user.update({ where: { id: guru.userId }, data: { name: String(body.nama) } });
        return updated;
      });
      return NextResponse.json(result, { headers: corsHeaders });
    }

    if (op === "updatePassword") {
      const passwordLama = String(body.passwordLama || "");
      const passwordBaru = String(body.passwordBaru || "");
      if (passwordBaru.length < 6) return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400, headers: corsHeaders });
      const user = await prisma.user.findUnique({ where: { id: guru.userId }, select: { password: true } });
      if (!user?.password) return NextResponse.json({ error: "Akun ini tidak memiliki password (mungkin menggunakan Google SSO)" }, { status: 400, headers: corsHeaders });
      const isValid = await bcrypt.compare(passwordLama, user.password);
      if (!isValid) return NextResponse.json({ error: "Password lama tidak sesuai" }, { status: 400, headers: corsHeaders });
      const hashed = await bcrypt.hash(passwordBaru, 12);
      await prisma.user.update({ where: { id: guru.userId }, data: { password: hashed } });
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    return NextResponse.json({ error: "Op tidak dikenal" }, { status: 400, headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 500, headers: corsHeaders }) }
}
