import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const siswa=await prisma.siswa.findUnique({where:{userId:user.id}, select:{id:true, kelasId:true}});
    if(!siswa?.kelasId) return NextResponse.json([],{headers:corsHeaders});
    const iuran=await prisma.iuran.findMany({where:{kelasId:siswa.kelasId, deletedAt:null}, include:{pembayaran:{where:{siswaId:siswa.id}}}, orderBy:{createdAt:"desc"}});
    return NextResponse.json(iuran,{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}

/** Ajukan pembayaran iuran (MENUNGGU) — mirror web bayarIuran(). */
export async function POST(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const siswa=await prisma.siswa.findUnique({where:{userId:user.id}, select:{id:true, kelasId:true}});
    if(!siswa) return NextResponse.json({error:"Siswa tidak ditemukan"},{status:404, headers:corsHeaders});
    const body=await req.json().catch(()=>({}) as any);
    const iuran=await prisma.iuran.findUnique({where:{id:String(body.iuranId||"")}, select:{id:true, kelasId:true, nominal:true}});
    if(!iuran||iuran.kelasId!==siswa.kelasId) return NextResponse.json({error:"Iuran tidak ditemukan"},{status:404, headers:corsHeaders});
    const nominal=Number(body.nominal)>0?Number(body.nominal):iuran.nominal;
    await prisma.pembayaranIuran.upsert({
      where:{iuranId_siswaId:{iuranId:iuran.id, siswaId:siswa.id}},
      update:{jumlah:nominal, status:"MENUNGGU", keterangan:body.keterangan||null},
      create:{iuranId:iuran.id, siswaId:siswa.id, jumlah:nominal, status:"MENUNGGU", keterangan:body.keterangan||null},
    });
    return NextResponse.json({success:true},{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
