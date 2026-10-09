import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

/** Analitik pembelajaran guru — mirror web getGuruAnalytics(). */
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});

    const [kelas, ujians] = await Promise.all([
      prisma.kelas.findMany({where:{guruId:guru.id, deletedAt:null}, select:{id:true, nama:true}}),
      prisma.ujian.findMany({where:{guruId:guru.id, deletedAt:null, isLatihan:false}, select:{id:true, nama:true, nilaiMinimum:true}}),
    ]);
    const pengajarans = await prisma.pengajaran.findMany({where:{guruId:guru.id, deletedAt:null, mataPelajaran:{deletedAt:null}}, include:{mataPelajaran:{select:{id:true, nama:true}}}});
    const ujianIds = ujians.map(u=>u.id);
    const [allNilai, essayCount, pgCount] = await Promise.all([
      prisma.nilai.findMany({where:{ujianId:{in:ujianIds}, deletedAt:null}, select:{nilai:true, siswa:{select:{kelas:{select:{nama:true}}}}, mataPelajaran:{select:{nama:true}}, ujianId:true}}),
      prisma.penilaianEssay.count({where:{jawabanUjian:{ujian:{guruId:guru.id}}}}),
      prisma.jawabanUjian.count({where:{ujian:{guruId:guru.id}, isCorrect:{not:null}}}),
    ]);

    const nilaiList = allNilai.map(n=>n.nilai);
    const rataRata = nilaiList.length>0 ? nilaiList.reduce((a,b)=>a+b,0)/nilaiList.length : 0;
    const tertinggi = nilaiList.length>0 ? Math.max(...nilaiList) : 0;
    const terendah = nilaiList.length>0 ? Math.min(...nilaiList) : 0;
    const minMap = new Map(ujians.map(u=>[u.id, u.nilaiMinimum]));
    const lulus = allNilai.filter(n=>n.nilai >= (minMap.get(n.ujianId ?? "") ?? 0)).length;

    const perKelas: Record<string, number[]> = {};
    allNilai.forEach(n=>{ const l=n.siswa?.kelas?.nama ?? "Unknown"; (perKelas[l] ||= []).push(n.nilai); });
    const perMapel: Record<string, number[]> = {};
    allNilai.forEach(n=>{ const l=n.mataPelajaran?.nama ?? "Unknown"; (perMapel[l] ||= []).push(n.nilai); });
    const avg=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;

    return NextResponse.json({
      rataRata: Math.round(rataRata*100)/100, tertinggi, terendah,
      lulus, tidakLulus: allNilai.length-lulus, totalSiswaDinilai: allNilai.length,
      grafikKelas: Object.entries(perKelas).map(([label,values])=>({label, nilai:Math.round(avg(values)*100)/100})),
      grafikMapel: Object.entries(perMapel).map(([label,values])=>({label, nilai:Math.round(avg(values)*100)/100})),
      essayCount, pgCount, totalKelas: kelas.length, totalMapel: pengajarans.length,
    },{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
