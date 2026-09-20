import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    const pengajaran=await prisma.pengajaran.findMany({where:{guruId:guru.id, deletedAt:null}, select:{kelasId:true}, distinct:["kelasId"]});
    const kelasIds=[...new Set(pengajaran.map(p=>p.kelasId))];
    const kelasList=await prisma.kelas.findMany({where:{id:{in:kelasIds}, deletedAt:null}, select:{id:true}});
    const ids=kelasList.map(k=>k.id);
    const siswa=await prisma.siswa.findMany({where:{kelasId:{in:ids}, deletedAt:null}, select:{id:true,nama:true,nis:true, kelas:{select:{nama:true}}}, orderBy:{nama:"asc"}, take:100});
    return NextResponse.json(siswa,{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
