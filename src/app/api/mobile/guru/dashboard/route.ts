import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    const [kelasCount, siswaCount, ujianAktif, soalCount] = await Promise.all([
      prisma.kelas.count({where:{guruId:guru.id, deletedAt:null}}),
      prisma.siswa.count({where:{kelas:{guruId:guru.id, deletedAt:null}, deletedAt:null}}),
      prisma.ujian.count({where:{guruId:guru.id, status:"AKTIF", deletedAt:null}}),
      prisma.soal.count({where:{guruId:guru.id, deletedAt:null}}),
    ]);
    return NextResponse.json({kelasCount, siswaCount, ujianAktif, soalCount},{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
