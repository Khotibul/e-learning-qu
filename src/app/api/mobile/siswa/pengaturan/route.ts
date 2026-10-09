import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth"; import bcrypt from "bcryptjs";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};

async function ambilSiswa(req: Request) {
  const user = await getMobileUser(req);
  if (!user) return null;
  if (user.role !== "SISWA") return { forbidden: true } as const;
  const siswa = await prisma.siswa.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true, userId: true } });
  if (!siswa) return null;
  return siswa;
}

export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

/** Profil siswa — mirror web getSiswaProfile(). */
export async function GET(req: Request) {
  try {
    const siswa = await ambilSiswa(req);
    if (!siswa) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in siswa) return NextResponse.json({ error: "Bukan siswa" }, { status: 403, headers: corsHeaders });
    const data = await prisma.siswa.findUnique({ where: { id: siswa.id }, select: { id: true, nama: true, nis: true, nisn: true, alamat: true, noTelp: true, user: { select: { id: true, email: true, name: true, image: true } }, kelas: { select: { nama: true } } } });
    return NextResponse.json(data, { headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Gagal" }, { status: 500, headers: corsHeaders }) }
}

/** updateProfile / updatePassword — mirror web updateSiswaProfile/updateSiswaPassword. */
export async function POST(req: Request) {
  try {
    const siswa = await ambilSiswa(req);
    if (!siswa) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    if ("forbidden" in siswa) return NextResponse.json({ error: "Bukan siswa" }, { status: 403, headers: corsHeaders });
    const body = await req.json().catch(() => ({}) as any);
    const op = String(body.op || "");

    if (op === "updateProfile") {
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.siswa.update({
          where: { id: siswa.id },
          data: {
            ...(body.nama !== undefined && { nama: String(body.nama || "") }),
            ...(body.nis !== undefined && { nis: body.nis ? String(body.nis) : null }),
            ...(body.nisn !== undefined && { nisn: body.nisn ? String(body.nisn) : null }),
            ...(body.alamat !== undefined && { alamat: body.alamat ? String(body.alamat) : null }),
            ...(body.noTelp !== undefined && { noTelp: body.noTelp ? String(body.noTelp) : null }),
          },
          select: { id: true, nama: true, nis: true, nisn: true, alamat: true, noTelp: true },
        });
        if (body.nama) await tx.user.update({ where: { id: siswa.userId }, data: { name: String(body.nama) } });
        return updated;
      });
      return NextResponse.json(result, { headers: corsHeaders });
    }

    if (op === "updatePassword") {
      const passwordLama = String(body.passwordLama || "");
      const passwordBaru = String(body.passwordBaru || "");
      if (passwordBaru.length < 6) return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400, headers: corsHeaders });
      const user = await prisma.user.findUnique({ where: { id: siswa.userId }, select: { password: true } });
      if (!user?.password) return NextResponse.json({ error: "Akun ini tidak memiliki password (mungkin menggunakan Google SSO)" }, { status: 400, headers: corsHeaders });
      const isValid = await bcrypt.compare(passwordLama, user.password);
      if (!isValid) return NextResponse.json({ error: "Password lama tidak sesuai" }, { status: 400, headers: corsHeaders });
      const hashed = await bcrypt.hash(passwordBaru, 12);
      await prisma.user.update({ where: { id: siswa.userId }, data: { password: hashed } });
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    return NextResponse.json({ error: "Op tidak dikenal" }, { status: 400, headers: corsHeaders });
  } catch (e) { console.error(e); return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal" }, { status: 500, headers: corsHeaders }) }
}
