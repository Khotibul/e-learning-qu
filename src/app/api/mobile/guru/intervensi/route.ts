import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, DELETE, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    if(new URL(req.url).searchParams.get("tab")==="siswa"){
      const pengajaran=await prisma.pengajaran.findMany({where:{guruId:guru.id, deletedAt:null}, select:{kelasId:true}, distinct:["kelasId"]});
      const siswa=await prisma.siswa.findMany({where:{kelasId:{in:pengajaran.map(p=>p.kelasId)}, deletedAt:null}, select:{id:true, nama:true, kelas:{select:{nama:true}}}, orderBy:{nama:"asc"}, take:100});
      return NextResponse.json(siswa,{headers:corsHeaders});
    }
    const list=await prisma.intervention.findMany({where:{guruId:guru.id}, include:{siswa:{select:{nama:true, kelas:{select:{nama:true}}}}}, orderBy:{createdAt:"desc"}, take:50});
    return NextResponse.json(list,{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}

const TIPE=["REMEDIAL","TUGAS_TAMBAHAN","MENTORING","REKOMENDASI_MATERI","KONSULTASI","FOLLOW_UP"];
const STATUS=["OPEN","IN_PROGRESS","COMPLETED","CANCELLED"];

/** POST {op: createIntervention|updateStatus} — mirror web intervensi actions. */
export async function POST(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    const body=await req.json().catch(()=>({}) as any);
    const op=String(body.op||"");

    if(op==="createIntervention"){
      const siswaId=String(body.siswaId||""), tipe=String(body.tipe||""), reason=String(body.reason||"").trim(), action=String(body.action||"").trim();
      if(!siswaId||!TIPE.includes(tipe)||!reason||!action) return NextResponse.json({error:"siswaId, tipe, reason, action wajib"},{status:400, headers:corsHeaders});
      const target=await prisma.siswa.findFirst({where:{id:siswaId, deletedAt:null}, select:{id:true}});
      if(!target) return NextResponse.json({error:"Siswa tidak ditemukan"},{status:404, headers:corsHeaders});
      const it=await prisma.intervention.create({data:{siswaId, guruId:guru.id, tipe:tipe as never, reason, action, deadline:body.deadline?new Date(String(body.deadline)):null, notes:body.notes||null}});
      return NextResponse.json(it,{headers:corsHeaders});
    }

    if(op==="updateStatus"){
      const id=String(body.id||""), status=String(body.status||"");
      if(!STATUS.includes(status)) return NextResponse.json({error:"Status tidak valid"},{status:400, headers:corsHeaders});
      const existing=await prisma.intervention.findUnique({where:{id}, select:{guruId:true}});
      if(!existing||existing.guruId!==guru.id) return NextResponse.json({error:"Unauthorized"},{status:403, headers:corsHeaders});
      await prisma.intervention.update({where:{id}, data:{status:status as never, ...(body.notes!==undefined?{notes:String(body.notes)}:{})}});
      return NextResponse.json({success:true},{headers:corsHeaders});
    }
    return NextResponse.json({error:"op tidak dikenal"},{status:400, headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}

/** DELETE ?id= — mirror web deleteIntervention(). */
export async function DELETE(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    const id=new URL(req.url).searchParams.get("id");
    if(!id) return NextResponse.json({error:"id wajib"},{status:400, headers:corsHeaders});
    const existing=await prisma.intervention.findUnique({where:{id}, select:{guruId:true}});
    if(!existing||existing.guruId!==guru.id) return NextResponse.json({error:"Unauthorized"},{status:403, headers:corsHeaders});
    await prisma.intervention.delete({where:{id}});
    return NextResponse.json({success:true},{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
