import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, DELETE, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

type SekretarisResult = { ok: false; error: string; status: number } | { ok: true; siswa: { id: string; kelasId: string | null } };
async function getCurrentSekretaris(req:Request): Promise<SekretarisResult>{
  const user=await getMobileUser(req); if(!user) return {ok:false, error:"Unauthorized", status:401};
  const siswa=await prisma.siswa.findUnique({where:{userId:user.id, jabatan:"SEKRETARIS"}, select:{id:true, kelasId:true}});
  if(!siswa) return {ok:false, error:"Hanya sekretaris yang dapat mengakses fitur ini", status:403};
  if(!siswa.kelasId) return {ok:false, error:"Anda belum memiliki kelas", status:400};
  return {ok:true, siswa};
}
const err=(m:string,s:number)=>NextResponse.json({error:m},{status:s, headers:corsHeaders});

/** GET ?tab=piket|jadwal|siswa|mapel — mirror getSekretaris*. */
export async function GET(req:Request){
  try{
    const s=await getCurrentSekretaris(req); if(!s.ok) return err(s.error,s.status);
    const kelasId=s.siswa.kelasId!; const tab=new URL(req.url).searchParams.get("tab")||"piket";
    if(tab==="piket") return NextResponse.json(await prisma.jadwalPiket.findMany({where:{kelasId}, include:{siswa:{select:{id:true,nama:true}}}, orderBy:[{hari:"asc"},{siswa:{nama:"asc"}}]}),{headers:corsHeaders});
    if(tab==="jadwal") return NextResponse.json(await prisma.jadwalPelajaran.findMany({where:{kelasId, deletedAt:null}, include:{mataPelajaran:{select:{id:true,nama:true}}}, orderBy:[{hari:"asc"},{jamMulai:"asc"}]}),{headers:corsHeaders});
    if(tab==="siswa") return NextResponse.json(await prisma.siswa.findMany({where:{kelasId, deletedAt:null}, select:{id:true,nama:true}, orderBy:{nama:"asc"}}),{headers:corsHeaders});
    if(tab==="mapel") return NextResponse.json(await prisma.pengajaran.findMany({where:{kelasId, deletedAt:null, mataPelajaran:{deletedAt:null}}, select:{mataPelajaran:{select:{id:true,nama:true}}}}).then(rs=>[...new Map(rs.map(r=>[r.mataPelajaran.id, r.mataPelajaran])).values()]),{headers:corsHeaders});
    return err("tab tidak dikenal",400);
  }catch(e){ console.error(e); return err("Gagal",500) }
}

/** POST {op} — createPiket|createJadwal|updateJadwal. */
export async function POST(req:Request){
  try{
    const s=await getCurrentSekretaris(req); if(!s.ok) return err(s.error,s.status);
    const kelasId=s.siswa.kelasId!;
    const body=await req.json().catch(()=>({}) as any);
    const op=String(body.op||"");
    if(op==="createPiket"){
      const siswaId=String(body.siswaId||""), hari=String(body.hari||"").trim();
      if(!siswaId||!hari) return err("Siswa & hari wajib",400);
      const target=await prisma.siswa.findFirst({where:{id:siswaId, kelasId, deletedAt:null}, select:{id:true}});
      if(!target) return err("Siswa tidak ditemukan di kelas ini",404);
      await prisma.jadwalPiket.create({data:{kelasId, siswaId, hari}});
      return NextResponse.json({success:true},{headers:corsHeaders});
    }
    if(op==="createJadwal"||op==="updateJadwal"){
      const jamMulai=String(body.jamMulai||""), jamSelesai=String(body.jamSelesai||"");
      if(jamSelesai<=jamMulai) return err("Jam selesai harus setelah jam mulai",400);
      if(op==="createJadwal"){
        const mataPelajaranId=String(body.mataPelajaranId||""), hari=String(body.hari||"").trim();
        if(!mataPelajaranId||!hari) return err("Mapel & hari wajib",400);
        await prisma.jadwalPelajaran.create({data:{kelasId, mataPelajaranId, hari, jamMulai, jamSelesai}});
        return NextResponse.json({success:true},{headers:corsHeaders});
      }
      const id=String(body.id||"");
      const item=await prisma.jadwalPelajaran.findUnique({where:{id}, select:{kelasId:true}});
      if(!item||item.kelasId!==kelasId) return err("Akses ditolak",403);
      await prisma.jadwalPelajaran.update({where:{id}, data:{
        ...(body.mataPelajaranId?{mataPelajaranId:String(body.mataPelajaranId)}:{}),
        ...(body.hari?{hari:String(body.hari)}:{}),
        jamMulai, jamSelesai,
      }});
      return NextResponse.json({success:true},{headers:corsHeaders});
    }
    return err("op tidak dikenal",400);
  }catch(e){ console.error(e); return err("Gagal",500) }
}

/** DELETE ?jenis=piket|jadwal&id= — piket dihapus permanen (mirror web), jadwal soft-delete. */
export async function DELETE(req:Request){
  try{
    const s=await getCurrentSekretaris(req); if(!s.ok) return err(s.error,s.status);
    const kelasId=s.siswa.kelasId!; const q=new URL(req.url).searchParams;
    const jenis=q.get("jenis"), id=q.get("id");
    if(!jenis||!id) return err("jenis & id wajib",400);
    if(jenis==="piket"){
      const item=await prisma.jadwalPiket.findUnique({where:{id}, select:{kelasId:true}});
      if(!item||item.kelasId!==kelasId) return err("Akses ditolak",403);
      await prisma.jadwalPiket.delete({where:{id}});
      return NextResponse.json({success:true},{headers:corsHeaders});
    }
    if(jenis==="jadwal"){
      const r=await prisma.jadwalPelajaran.updateMany({where:{id, kelasId, deletedAt:null}, data:{deletedAt:new Date()}});
      if(!r.count) return err("Tidak ditemukan",404);
      return NextResponse.json({success:true},{headers:corsHeaders});
    }
    return err("jenis tidak dikenal",400);
  }catch(e){ console.error(e); return err("Gagal",500) }
}
