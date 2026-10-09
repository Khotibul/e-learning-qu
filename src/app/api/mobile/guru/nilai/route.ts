import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    const ujians=await prisma.ujian.findMany({where:{guruId:guru.id, deletedAt:null}, select:{id:true, nama:true, status:true, kelas:{select:{nama:true}}, mataPelajaran:{select:{nama:true}}}});
    const ujianIds=ujians.map(u=>u.id);
    const q=new URL(req.url).searchParams;
    if(q.get("tab")==="essays"){
      const ujianId=q.get("ujianId");
      if(!ujianId||!ujianIds.includes(ujianId)) return NextResponse.json({error:"Ujian tidak ditemukan"},{status:404, headers:corsHeaders});
      const essays=await prisma.jawabanUjian.findMany({
        where:{ujianId, soal:{jenisSoal:"ESSAY"}},
        select:{id:true, siswaId:true, esaiJawaban:true, jawaban:true, createdAt:true, siswa:{select:{nama:true}}, soal:{select:{pertanyaan:true}}, penilaianEssay:{select:{nilai:true, komentar:true}}},
        orderBy:{createdAt:"asc"},
      });
      return NextResponse.json(essays,{headers:corsHeaders});
    }
    const nilais=await prisma.nilai.findMany({where:{ujianId:{in:ujianIds}, deletedAt:null}, select:{id:true,nilai:true, ujianId:true, siswa:{select:{nama:true}}, ujian:{select:{nama:true}}}, orderBy:{createdAt:"desc"}, take:100});
    return NextResponse.json({ujians, nilais},{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}

/** POST {op: gradeEssay, jawabanUjianId, nilai, komentar?} — mirror web gradeEssay(). */
export async function POST(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    const body=await req.json().catch(()=>({}) as any);
    if(String(body.op||"")!=="gradeEssay") return NextResponse.json({error:"op tidak dikenal"},{status:400, headers:corsHeaders});
    const jawabanUjianId=String(body.jawabanUjianId||"");
    const nilai=Number(body.nilai);
    if(!jawabanUjianId||Number.isNaN(nilai)||nilai<0) return NextResponse.json({error:"jawabanUjianId & nilai wajib"},{status:400, headers:corsHeaders});
    const jw=await prisma.jawabanUjian.findFirst({where:{id:jawabanUjianId, ujian:{guruId:guru.id}}, select:{id:true}});
    if(!jw) return NextResponse.json({error:"Jawaban tidak ditemukan"},{status:404, headers:corsHeaders});
    const existing=await prisma.penilaianEssay.findUnique({where:{jawabanUjianId}});
    if(existing){
      await prisma.penilaianEssay.update({where:{jawabanUjianId}, data:{nilai, komentar:body.komentar||null}});
    }else{
      await prisma.penilaianEssay.create({data:{jawabanUjianId, guruId:guru.id, nilai, komentar:body.komentar||null}});
    }
    return NextResponse.json({success:true},{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
