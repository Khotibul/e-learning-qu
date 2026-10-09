import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, DELETE, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};

type WaliResult = { ok: false; error: string; status: number } | { ok: true; guruId: string };
async function getWali(req: Request): Promise<WaliResult> {
  const user = await getMobileUser(req);
  if (!user) return { ok: false, error: "Unauthorized", status: 401 };
  const guru = await prisma.guru.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
  if (!guru) return { ok: false, error: "Bukan guru", status: 403 };
  return { ok: true, guruId: guru.id };
}
const err = (m: string, s: number) => NextResponse.json({ error: m }, { status: s, headers: corsHeaders });

/** Guard: kelasId harus milik kelas wali (guruId) yang aktif. */
async function ambilKelas(guruId: string, kelasId: string) {
  if (!kelasId) return null;
  return prisma.kelas.findFirst({ where: { id: kelasId, guruId, deletedAt: null }, select: { id: true } });
}

export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

/** GET — default struktur kelas wali; ?tab=kas|iuran|denda|pengeluaran|piket|siswa&kelasId=. */
export async function GET(req: Request) {
  try {
    const w = await getWali(req);
    if (!w.ok) return err(w.error, w.status);
    const q = new URL(req.url).searchParams;
    const tab = q.get("tab");
    if (!tab) {
      const kelas = await prisma.kelas.findMany({ where: { guruId: w.guruId, deletedAt: null }, include: { siswas: { where: { deletedAt: null }, select: { id: true, nama: true, nis: true, jabatan: true } }, _count: { select: { siswas: true } } } });
      return NextResponse.json(kelas, { headers: corsHeaders });
    }
    const kelas = await ambilKelas(w.guruId, q.get("kelasId") || "");
    if (!kelas) return err("Kelas tidak ditemukan atau bukan wali kelas", 403);
    const kelasId = kelas.id;
    if (tab === "kas") {
      const [iuran, denda, pengeluaran] = await Promise.all([
        prisma.pembayaranIuran.aggregate({ where: { iuran: { kelasId, deletedAt: null }, status: "LUNAS" }, _sum: { jumlah: true } }),
        prisma.pembayaranDenda.aggregate({ where: { denda: { kelasId, deletedAt: null } }, _sum: { jumlah: true } }),
        prisma.pengeluaranKelas.aggregate({ where: { kelasId, deletedAt: null }, _sum: { jumlah: true } }),
      ]);
      const pemasukanIuran = iuran._sum.jumlah || 0, pemasukanDenda = denda._sum.jumlah || 0;
      const totalPengeluaran = pengeluaran._sum.jumlah || 0;
      return NextResponse.json({ pemasukanIuran, pemasukanDenda, totalPemasukan: pemasukanIuran + pemasukanDenda, totalPengeluaran, sisaKas: pemasukanIuran + pemasukanDenda - totalPengeluaran }, { headers: corsHeaders });
    }
    if (tab === "iuran") return NextResponse.json(await prisma.iuran.findMany({ where: { kelasId, deletedAt: null }, include: { _count: { select: { pembayaran: true } }, pembayaran: { include: { siswa: { select: { id: true, nama: true } } } } }, orderBy: { createdAt: "desc" } }), { headers: corsHeaders });
    if (tab === "denda") return NextResponse.json(await prisma.denda.findMany({ where: { kelasId, deletedAt: null }, include: { _count: { select: { pembayaran: true } }, pembayaran: { include: { siswa: { select: { id: true, nama: true } } } } }, orderBy: { createdAt: "desc" } }), { headers: corsHeaders });
    if (tab === "pengeluaran") return NextResponse.json(await prisma.pengeluaranKelas.findMany({ where: { kelasId, deletedAt: null }, orderBy: { tanggal: "desc" } }), { headers: corsHeaders });
    if (tab === "piket") return NextResponse.json(await prisma.jadwalPiket.findMany({ where: { kelasId }, include: { siswa: { select: { id: true, nama: true } } }, orderBy: [{ hari: "asc" }, { siswa: { nama: "asc" } }] }), { headers: corsHeaders });
    if (tab === "siswa") return NextResponse.json(await prisma.siswa.findMany({ where: { kelasId, deletedAt: null }, select: { id: true, nama: true, jabatan: true }, orderBy: { nama: "asc" } }), { headers: corsHeaders });
    return err("tab tidak dikenal", 400);
  } catch (e) { console.error(e); return err("Gagal", 500) }
}

/** POST {op} — kas ops (createIuran/createDenda/createPengeluaran/recordIuran/confirmIuran/rejectIuran/recordDenda), createPiket, updateJabatan. */
export async function POST(req: Request) {
  try {
    const w = await getWali(req);
    if (!w.ok) return err(w.error, w.status);
    const body = await req.json().catch(() => ({}) as any);
    const op = String(body.op || "");

    if (op === "createIuran" || op === "createDenda" || op === "createPengeluaran" || op === "createPiket") {
      const kelas = await ambilKelas(w.guruId, String(body.kelasId || ""));
      if (!kelas) return err("Kelas tidak ditemukan atau bukan wali kelas", 403);
      const kelasId = kelas.id;
      if (op === "createIuran") {
        const nama = String(body.nama || "").trim(), nominal = Number(body.nominal) || 0;
        if (!nama || nominal <= 0) return err("Nama & nominal wajib", 400);
        await prisma.iuran.create({ data: { kelasId, nama, nominal, tenggat: body.tenggat ? new Date(`${body.tenggat}T23:59:59`) : null, deskripsi: body.deskripsi || null } });
        return NextResponse.json({ success: true }, { headers: corsHeaders });
      }
      if (op === "createDenda") {
        const nama = String(body.nama || "").trim(), nominal = Number(body.nominal) || 0;
        if (!nama || nominal <= 0) return err("Nama & nominal wajib", 400);
        await prisma.denda.create({ data: { kelasId, nama, nominal, deskripsi: body.deskripsi || null } });
        return NextResponse.json({ success: true }, { headers: corsHeaders });
      }
      if (op === "createPengeluaran") {
        const keterangan = String(body.keterangan || "").trim(), jumlah = Number(body.jumlah) || 0;
        if (!keterangan || jumlah <= 0) return err("Keterangan & jumlah wajib", 400);
        await prisma.pengeluaranKelas.create({ data: { kelasId, keterangan, jumlah, tanggal: body.tanggal ? new Date(body.tanggal) : new Date() } });
        return NextResponse.json({ success: true }, { headers: corsHeaders });
      }
      // createPiket
      const siswaId = String(body.siswaId || ""), hari = String(body.hari || "");
      if (!siswaId || !hari) return err("Siswa & hari wajib", 400);
      const target = await prisma.siswa.findFirst({ where: { id: siswaId, kelasId, deletedAt: null }, select: { id: true } });
      if (!target) return err("Siswa tidak ditemukan di kelas ini", 404);
      await prisma.jadwalPiket.create({ data: { kelasId, siswaId, hari } });
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    if (op === "recordIuran" || op === "confirmIuran" || op === "rejectIuran") {
      const iuranId = String(body.iuranId || ""), siswaId = String(body.siswaId || "");
      const iuran = await prisma.iuran.findUnique({ where: { id: iuranId }, select: { kelasId: true, nominal: true, kelas: { select: { guruId: true } } } });
      if (!iuran || iuran.kelas.guruId !== w.guruId) return err("Akses ditolak", 403);
      const target = await prisma.siswa.findFirst({ where: { id: siswaId, kelasId: iuran.kelasId, deletedAt: null }, select: { id: true } });
      if (!target) return err("Siswa tidak ditemukan di kelas ini", 404);
      if (op === "rejectIuran") { await prisma.pembayaranIuran.deleteMany({ where: { iuranId, siswaId } }); return NextResponse.json({ success: true }, { headers: corsHeaders }); }
      const existing = await prisma.pembayaranIuran.findUnique({ where: { iuranId_siswaId: { iuranId, siswaId } } });
      if (op === "confirmIuran") {
        if (!existing) return err("Belum ada pengajuan pembayaran", 400);
        await prisma.pembayaranIuran.update({ where: { id: existing.id }, data: { status: "LUNAS", jumlah: iuran.nominal, tanggalBayar: new Date() } });
      } else {
        await prisma.pembayaranIuran.upsert({ where: { iuranId_siswaId: { iuranId, siswaId } }, update: { jumlah: iuran.nominal, status: "LUNAS", tanggalBayar: new Date() }, create: { iuranId, siswaId, jumlah: iuran.nominal, status: "LUNAS" } });
      }
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    if (op === "recordDenda") {
      const dendaId = String(body.dendaId || ""), siswaId = String(body.siswaId || ""), jumlah = Number(body.jumlah) || 0;
      const denda = await prisma.denda.findUnique({ where: { id: dendaId }, select: { kelasId: true, kelas: { select: { guruId: true } } } });
      if (!denda || denda.kelas.guruId !== w.guruId) return err("Akses ditolak", 403);
      if (jumlah <= 0) return err("Nominal wajib", 400);
      await prisma.pembayaranDenda.upsert({ where: { dendaId_siswaId: { dendaId, siswaId } }, update: { jumlah, status: "LUNAS", tanggalBayar: new Date() }, create: { dendaId, siswaId, jumlah, status: "LUNAS" } });
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    if (op === "updateJabatan") {
      const siswaId = String(body.siswaId || "");
      const jabatan = body.jabatan ? String(body.jabatan) : null;
      if (jabatan && !["KETUA", "WAKIL", "BENDAHARA", "SEKRETARIS"].includes(jabatan)) return err("Jabatan tidak dikenal", 400);
      const siswa = await prisma.siswa.findUnique({ where: { id: siswaId }, select: { kelas: { select: { guruId: true } } } });
      if (!siswa || siswa.kelas?.guruId !== w.guruId) return err("Akses ditolak", 403);
      await prisma.siswa.update({ where: { id: siswaId }, data: { jabatan } });
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    return err("op tidak dikenal", 400);
  } catch (e) { console.error(e); return err("Gagal", 500) }
}

/** DELETE ?jenis=iuran|denda|pengeluaran|piket&id=&kelasId= — guard wali kelas. */
export async function DELETE(req: Request) {
  try {
    const w = await getWali(req);
    if (!w.ok) return err(w.error, w.status);
    const q = new URL(req.url).searchParams;
    const jenis = q.get("jenis"), id = q.get("id");
    if (!jenis || !id) return err("jenis & id wajib", 400);
    const kelas = await ambilKelas(w.guruId, q.get("kelasId") || "");
    if (!kelas) return err("Kelas tidak ditemukan atau bukan wali kelas", 403);
    const kelasId = kelas.id;
    const now = new Date();
    if (jenis === "iuran") { const r = await prisma.iuran.updateMany({ where: { id, kelasId, deletedAt: null }, data: { deletedAt: now } }); if (!r.count) return err("Tidak ditemukan", 404); }
    else if (jenis === "denda") { const r = await prisma.denda.updateMany({ where: { id, kelasId, deletedAt: null }, data: { deletedAt: now } }); if (!r.count) return err("Tidak ditemukan", 404); }
    else if (jenis === "pengeluaran") { const r = await prisma.pengeluaranKelas.updateMany({ where: { id, kelasId, deletedAt: null }, data: { deletedAt: now } }); if (!r.count) return err("Tidak ditemukan", 404); }
    else if (jenis === "piket") { const r = await prisma.jadwalPiket.deleteMany({ where: { id, kelasId } }); if (!r.count) return err("Tidak ditemukan", 404); }
    else return err("jenis tidak dikenal", 400);
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (e) { console.error(e); return err("Gagal", 500) }
}
