import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const siswa=await prisma.siswa.findUnique({where:{userId:user.id}, select:{id:true, kelasId:true}});
    if(!siswa?.kelasId) return NextResponse.json({ranking:[]},{headers:corsHeaders});
    const all=await prisma.siswa.findMany({where:{kelasId:siswa.kelasId, deletedAt:null}, select:{id:true,nama:true, nilai:{where:{deletedAt:null}, select:{nilai:true}}}});
    const ranking=all.map(s=>({id:s.id, nama:s.nama, rataRata: s.nilai.length>0 ? s.nilai.reduce((a,b)=>a+b.nilai,0)/s.nilai.length : 0, isCurrentUser:s.id===siswa.id})).sort((a,b)=>b.rataRata-a.rataRata).map((r,i)=>({...r, peringkat:i+1}));
    return NextResponse.json({ranking},{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
