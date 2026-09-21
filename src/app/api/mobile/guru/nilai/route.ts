import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    const ujians=await prisma.ujian.findMany({where:{guruId:guru.id, deletedAt:null}, select:{id:true, nama:true, status:true, kelas:{select:{nama:true}}, mataPelajaran:{select:{nama:true}}}});
    const ujianIds=ujians.map(u=>u.id);
    const nilais=await prisma.nilai.findMany({where:{ujianId:{in:ujianIds}, deletedAt:null}, select:{id:true,nilai:true, ujianId:true, siswa:{select:{nama:true}}, ujian:{select:{nama:true}}}, orderBy:{createdAt:"desc"}, take:100});
    return NextResponse.json({ujians, nilais},{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
