import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, DELETE, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search")?.trim() ?? ""
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    const where: Record<string, unknown> = { guruId: guru.id, deletedAt: null }
    if (search) (where as Record<string, unknown>).pertanyaan = { contains: search, mode: "insensitive" }
    const soals=await prisma.soal.findMany({where: where as never, select:{id:true,pertanyaan:true,jenisSoal:true,tingkatKesulitan:true,poin:true, jawaban:true, pilihanGanda:true, trueFalse:true, bab:true, tags:true, mataPelajaranId:true, mataPelajaran:{select:{nama:true}}}, orderBy:{createdAt:"desc"}, take:50});
    return NextResponse.json(soals,{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}

async function getGuru(req:Request){
  const user=await getMobileUser(req); if(!user) return null;
  const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
  return guru;
}

/** POST {op: createSoal|updateSoal} — mirror web createSoal()/updateSoal(). */
export async function POST(req:Request){
  try{
    const guru=await getGuru(req); if(!guru) return NextResponse.json({error:"Unauthorized/Not guru"},{status:401, headers:corsHeaders});
    const body=await req.json().catch(()=>({}) as any);
    const op=String(body.op||"createSoal");
    const jenis=String(body.jenisSoal||"PILIHAN_GANDA");
    const tingkat=String(body.tingkatKesulitan||"SEDANG");
    const pertanyaan=String(body.pertanyaan||"").trim();
    if(!pertanyaan) return NextResponse.json({error:"Pertanyaan wajib"},{status:400, headers:corsHeaders});
    const subSoal=Array.isArray(body.subSoal)?body.subSoal.filter((s:any)=>s?.pertanyaan?.trim()):[];
    const totalPoin=subSoal.length>0?subSoal.reduce((sum:number,s:any)=>sum+(s.poin||0),0):Number(body.poin)||1;
    const combinedJawaban=subSoal.length>0?JSON.stringify(subSoal.map((s:any)=>s.jawaban)):String(body.jawaban||"");
    const data={
      pertanyaan,
      subSoal: subSoal.length>0?subSoal:undefined,
      jenisSoal: jenis as never,
      tingkatKesulitan: tingkat as never,
      pilihanGanda: Array.isArray(body.pilihanGanda)?body.pilihanGanda:undefined,
      trueFalse: typeof body.trueFalse==="boolean"?body.trueFalse:undefined,
      jawaban: combinedJawaban,
      poin: totalPoin,
      bab: body.bab||null,
      tags: body.tags||null,
      mataPelajaranId: String(body.mataPelajaranId||""),
    };
    if(op==="updateSoal"){
      const id=String(body.id||"");
      const {subSoal:_, ...rest}=data as any;
      const updateData={...rest, ...(subSoal.length>0?{subSoal}:{})};
      if(!data.mataPelajaranId) delete (updateData as any).mataPelajaranId;
      const r=await prisma.soal.updateMany({where:{id, guruId:guru.id, deletedAt:null}, data:updateData as never});
      if(!r.count) return NextResponse.json({error:"Soal tidak ditemukan"},{status:404, headers:corsHeaders});
      return NextResponse.json({success:true},{headers:corsHeaders});
    }
    if(!data.mataPelajaranId) return NextResponse.json({error:"Mata pelajaran wajib"},{status:400, headers:corsHeaders});
    const soal=await prisma.soal.create({data:{...data, subSoal: subSoal.length>0?subSoal:undefined, guruId:guru.id, kategoriId:undefined} as never});
    return NextResponse.json(soal,{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}

/** DELETE ?id= — soft-delete soal milik guru (mirror web deleteSoal()). */
export async function DELETE(req:Request){
  try{
    const guru=await getGuru(req); if(!guru) return NextResponse.json({error:"Unauthorized/Not guru"},{status:401, headers:corsHeaders});
    const id=new URL(req.url).searchParams.get("id");
    if(!id) return NextResponse.json({error:"id wajib"},{status:400, headers:corsHeaders});
    const r=await prisma.soal.updateMany({where:{id, guruId:guru.id, deletedAt:null}, data:{deletedAt:new Date()}});
    if(!r.count) return NextResponse.json({error:"Tidak ditemukan"},{status:404, headers:corsHeaders});
    return NextResponse.json({success:true},{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
