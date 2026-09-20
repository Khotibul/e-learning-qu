import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const siswa=await prisma.siswa.findUnique({where:{userId:user.id}, select:{id:true}});
    if(!siswa) return NextResponse.json([],{headers:corsHeaders});
    const nilais=await prisma.nilai.findMany({where:{siswaId:siswa.id, deletedAt:null}, select:{id:true,nilai:true,jenis:true,keterangan:true,createdAt:true, mataPelajaran:{select:{nama:true}}, semester:{select:{nama:true}}}, orderBy:{createdAt:"desc"}, take:100});
    return NextResponse.json(nilais,{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
