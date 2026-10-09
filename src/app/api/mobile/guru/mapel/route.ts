import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

/** Daftar mata pelajaran yang diajar guru (untuk picker upload materi). */
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    const rows=await prisma.pengajaran.findMany({
      where:{guruId:guru.id, deletedAt:null},
      select:{mataPelajaranId:true, mataPelajaran:{select:{id:true,nama:true}}},
      distinct:["mataPelajaranId"],
    });
    const mapels=rows.map(r=>r.mataPelajaran).filter(Boolean);
    return NextResponse.json(mapels,{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
