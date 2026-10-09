import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, DELETE, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }

async function getGuru(req:Request){
  const user=await getMobileUser(req); if(!user) return null;
  return prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
}

export async function GET(req:Request){
  try{
    const guru=await getGuru(req); if(!guru) return NextResponse.json({error:"Unauthorized/Not guru"},{status:401, headers:corsHeaders});
    const tab=new URL(req.url).searchParams.get("tab");
    if(tab==="refs"){
      const pengajarans=await prisma.pengajaran.findMany({where:{guruId:guru.id, deletedAt:null}, select:{kelasId:true, mataPelajaranId:true, kelas:{select:{id:true,nama:true}}, mataPelajaran:{select:{id:true,nama:true}}}});
      const kelas=[...new Map(pengajarans.map(p=>[p.kelasId,p.kelas])).values()];
      const mapels=[...new Map(pengajarans.map(p=>[p.mataPelajaranId,p.mataPelajaran])).values()];
      const [ta, sm]=await Promise.all([
        prisma.tahunAjaran.findFirst({where:{deletedAt:null, isAktif:true}, select:{id:true, nama:true}}),
        prisma.semester.findFirst({where:{deletedAt:null, isAktif:true}, select:{id:true, nama:true}}),
      ]);
      const soals=await prisma.soal.findMany({where:{guruId:guru.id, deletedAt:null}, select:{id:true, pertanyaan:true, jenisSoal:true, poin:true, mataPelajaranId:true}, orderBy:{createdAt:"desc"}, take:100});
      return NextResponse.json({kelas, mapels, tahunAjaran:ta, semester:sm, soals, pengajaran: pengajarans.map(p=>({kelasId:p.kelasId, mataPelajaranId:p.mataPelajaranId}))},{headers:corsHeaders});
    }
    const ujians=await prisma.ujian.findMany({where:{guruId:guru.id, deletedAt:null}, select:{id:true,nama:true,status:true,jumlahSoal:true,durasi:true,tanggal:true, mataPelajaran:{select:{nama:true}}, kelas:{select:{nama:true}}}, orderBy:{createdAt:"desc"}, take:50});
    return NextResponse.json(ujians,{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}

/** POST {op} — createUjian|startUjian|stopUjian|resetUjian — mirror web actions. */
export async function POST(req:Request){
  try{
    const guru=await getGuru(req); if(!guru) return NextResponse.json({error:"Unauthorized/Not guru"},{status:401, headers:corsHeaders});
    const body=await req.json().catch(()=>({}) as any);
    const op=String(body.op||"");

    if(op==="startUjian"||op==="stopUjian"||op==="resetUjian"){
      const id=String(body.id||"");
      const ujian=await prisma.ujian.findFirst({where:{id, guruId:guru.id, deletedAt:null}, select:{status:true}});
      if(!ujian) return NextResponse.json({error:"Ujian tidak ditemukan"},{status:404, headers:corsHeaders});
      if(op==="startUjian"){
        if(ujian.status!=="DRAFT" && ujian.status!=="SELESAI") return NextResponse.json({error:"Hanya ujian Draft/Selesai yang bisa dimulai"},{status:400, headers:corsHeaders});
        await prisma.ujian.updateMany({where:{id, guruId:guru.id}, data:{status:"AKTIF"}});
      }else if(op==="stopUjian"){
        if(ujian.status!=="AKTIF") return NextResponse.json({error:"Hanya ujian Aktif yang bisa dihentikan"},{status:400, headers:corsHeaders});
        await prisma.ujian.updateMany({where:{id, guruId:guru.id}, data:{status:"SELESAI"}});
      }else{
        if(ujian.status!=="SELESAI") return NextResponse.json({error:"Hanya ujian Selesai yang bisa direset"},{status:400, headers:corsHeaders});
        await prisma.ujian.updateMany({where:{id, guruId:guru.id}, data:{status:"DRAFT"}});
      }
      return NextResponse.json({success:true},{headers:corsHeaders});
    }

    if(op==="createUjian"){
      const nama=String(body.nama||"").trim();
      const mataPelajaranId=String(body.mataPelajaranId||""), kelasId=String(body.kelasId||"");
      if(!nama||!mataPelajaranId||!kelasId) return NextResponse.json({error:"Nama, mapel & kelas wajib"},{status:400, headers:corsHeaders});
      const pengajaran=await prisma.pengajaran.findFirst({where:{guruId:guru.id, mataPelajaranId, kelasId, deletedAt:null}, select:{id:true}});
      if(!pengajaran) return NextResponse.json({error:"Anda tidak mengampu mata pelajaran ini di kelas tersebut"},{status:403, headers:corsHeaders});
      const [ta, sm]=await Promise.all([
        prisma.tahunAjaran.findFirst({where:{deletedAt:null, isAktif:true}, select:{id:true}}),
        prisma.semester.findFirst({where:{deletedAt:null, isAktif:true}, select:{id:true}}),
      ]);
      if(!ta||!sm) return NextResponse.json({error:"Tahun ajaran/semester aktif belum diatur (via web admin)"},{status:400, headers:corsHeaders});
      const tanggal=String(body.tanggal||new Date().toISOString().split("T")[0]);
      const jamMulai=String(body.jamMulai||"07:00"), jamSelesai=String(body.jamSelesai||"09:00");
      const soalIds: string[] = Array.isArray(body.soalIds) ? body.soalIds.map((v: unknown) => String(v)) : [];
      const ujian=await prisma.ujian.create({data:{
        nama, deskripsi:body.deskripsi||null, mataPelajaranId, kelasId, guruId:guru.id,
        tahunAjaranId:ta.id, semesterId:sm.id,
        jumlahSoal:Number(body.jumlahSoal)||soalIds.length||0,
        nilaiMinimum:Number(body.nilaiMinimum)||70,
        durasi:Number(body.durasi)||60,
        tanggal:new Date(tanggal),
        jamMulai:new Date(`${tanggal}T${jamMulai}`),
        jamSelesai:new Date(`${tanggal}T${jamSelesai}`),
        mode:String(body.mode||"manual"),
        isLatihan:Boolean(body.isLatihan),
        randomSoal:body.randomSoal!==false,
        randomJawaban:body.randomJawaban!==false,
        fullscreen:body.fullscreen!==false,
        disableCopy:Boolean(body.disableCopy),
        disablePaste:Boolean(body.disablePaste),
        bisaRetake:Boolean(body.bisaRetake),
        status:"DRAFT",
      }});
      if(soalIds.length>0){
        await prisma.ujianSoal.createMany({data:soalIds.map((soalId,idx)=>({ujianId:ujian.id, soalId, nomor:idx+1}))});
      }
      return NextResponse.json(ujian,{headers:corsHeaders});
    }
    return NextResponse.json({error:"op tidak dikenal"},{status:400, headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}

/** DELETE ?id= — soft-delete ujian milik guru (mirror web deleteUjian()). */
export async function DELETE(req:Request){
  try{
    const guru=await getGuru(req); if(!guru) return NextResponse.json({error:"Unauthorized/Not guru"},{status:401, headers:corsHeaders});
    const id=new URL(req.url).searchParams.get("id");
    if(!id) return NextResponse.json({error:"id wajib"},{status:400, headers:corsHeaders});
    const r=await prisma.ujian.updateMany({where:{id, guruId:guru.id, deletedAt:null}, data:{deletedAt:new Date()}});
    if(!r.count) return NextResponse.json({error:"Tidak ditemukan"},{status:404, headers:corsHeaders});
    return NextResponse.json({success:true},{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
