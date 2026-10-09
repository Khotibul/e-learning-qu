import { NextResponse } from "next/server"; import { prisma } from "@/lib/prisma"; import { getMobileUser } from "@/lib/mobile-auth";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, DELETE, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
export async function OPTIONS(){ return new NextResponse(null,{status:204, headers:corsHeaders}) }
export async function GET(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    if(new URL(req.url).searchParams.get("tab")==="siswa"){
      const siswa=await prisma.siswa.findMany({where:{kelas:{guruId:guru.id, deletedAt:null}, deletedAt:null}, select:{id:true, nama:true, kelas:{select:{nama:true}}}, orderBy:{nama:"asc"}, take:100});
      return NextResponse.json(siswa,{headers:corsHeaders});
    }
    const list=await prisma.pelanggaran.findMany({where:{kelas:{guruId:guru.id, deletedAt:null}}, include:{siswa:{select:{nama:true}}, kelas:{select:{nama:true}}}, orderBy:{createdAt:"desc"}, take:50});
    return NextResponse.json(list,{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}

/** POST {op: createPelanggaran, siswaId, jenis, ...} — mirror web createPelanggaran()
 *  (hanya wali kelas: kelas.guruId harus milik guru login). */
export async function POST(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    const body=await req.json().catch(()=>({}) as any);
    if(String(body.op||"")!=="createPelanggaran") return NextResponse.json({error:"op tidak dikenal"},{status:400, headers:corsHeaders});
    const siswaId=String(body.siswaId||""), jenis=String(body.jenis||"").trim();
    if(!siswaId||!jenis) return NextResponse.json({error:"Siswa & jenis wajib"},{status:400, headers:corsHeaders});
    const siswa=await prisma.siswa.findFirst({where:{id:siswaId, deletedAt:null}, select:{kelasId:true, kelas:{select:{guruId:true}}}});
    if(!siswa?.kelasId||!siswa.kelas) return NextResponse.json({error:"Siswa tidak ditemukan"},{status:404, headers:corsHeaders});
    if(siswa.kelas.guruId!==guru.id) return NextResponse.json({error:"Akses ditolak (hanya wali kelas)"},{status:403, headers:corsHeaders});
    await prisma.pelanggaran.create({data:{
      kelasId:siswa.kelasId, siswaId, jenis,
      deskripsi:body.deskripsi||null,
      poin:body.poin!=null?Number(body.poin):null,
      tindakan:body.tindakan||null,
      tanggal:body.tanggal?new Date(String(body.tanggal)):new Date(),
    }});
    return NextResponse.json({success:true},{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}

/** DELETE ?id= — soft-delete pelanggaran milik kelas wali (mirror web deletePelanggaran,
 *  tanpa deleteUploadFile karena fotoUrl tidak dikirim mobile). */
export async function DELETE(req:Request){
  try{
    const user=await getMobileUser(req); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401, headers:corsHeaders});
    const guru=await prisma.guru.findFirst({where:{userId:user.id, deletedAt:null}, select:{id:true}});
    if(!guru) return NextResponse.json({error:"Not guru"},{status:403, headers:corsHeaders});
    const id=new URL(req.url).searchParams.get("id");
    if(!id) return NextResponse.json({error:"id wajib"},{status:400, headers:corsHeaders});
    const item=await prisma.pelanggaran.findUnique({where:{id}, select:{kelas:{select:{guruId:true}}}});
    if(!item||item.kelas.guruId!==guru.id) return NextResponse.json({error:"Akses ditolak"},{status:403, headers:corsHeaders});
    await prisma.pelanggaran.update({where:{id}, data:{deletedAt:new Date()}});
    return NextResponse.json({success:true},{headers:corsHeaders});
  }catch(e){ console.error(e); return NextResponse.json({error:"Gagal"},{status:500, headers:corsHeaders}) }
}
