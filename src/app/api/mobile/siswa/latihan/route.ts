import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const siswa=await prisma.siswa.findUnique({where:{userId:user.id}, select:{id:true, kelasId:true}});
    if(!siswa?.kelasId) return NextResponse.json([],{headers:corsHeaders});
    const latihans=await prisma.ujian.findMany({where:{kelasId:siswa.kelasId, isLatihan:true, status:"AKTIF", deletedAt:null}, select:{id:true,nama:true,jumlahSoal:true,durasi:true,bisaRetake:true,status:true, mataPelajaran:{select:{nama:true}}, _count:{select:{jawabanUjian:{where:{siswaId:siswa.id}}}}}, orderBy:{createdAt:"desc"}, take:50});
    return NextResponse.json(latihans.map(l=>({id:l.id, nama:l.nama, mapel:l.mataPelajaran.nama, jumlahSoal:l.jumlahSoal, durasi:l.durasi, status:l.status, bisaRetake:l.bisaRetake, sudahDikerjakan:l._count.jawabanUjian>0})),{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
