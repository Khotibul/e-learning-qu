import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getRaportCetak } from "@/app/(dashboard)/raport/actions"
import { TombolCetak } from "@/components/raport/tombol-cetak"

export const dynamic = "force-dynamic"

export const metadata = { title: "Cetak Raport" }

function tanggal(value: Date | string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
}

export default async function CetakRaportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  let data: Awaited<ReturnType<typeof getRaportCetak>>
  try {
    data = await getRaportCetak(id)
  } catch {
    redirect("/")
  }

  const { raport, pengaturan, site } = data
  const namaSekolah = site?.siteName || "E-Learning QU"

  return (
    <main className="min-h-screen bg-slate-100 print:bg-white py-6">
      <div className="mx-auto max-w-[210mm] px-4 print:px-0">
        <TombolCetak />
        <article className="bg-white text-slate-900 shadow print:shadow-none print:max-w-none p-8 sm:p-10 print:p-0 text-[12px] leading-relaxed relative">
          {raport.status !== "TERBIT" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="rotate-[-30deg] text-6xl font-black text-slate-200/80 tracking-widest">DRAFT</span>
            </div>
          )}

          <header className="text-center border-b-2 border-slate-800 pb-3">
            <h1 className="text-lg font-bold uppercase tracking-wide">{namaSekolah}</h1>
            <p className="text-xs">{site?.tagline || "Laporan Hasil Belajar Siswa"}</p>
            <h2 className="mt-2 text-base font-semibold uppercase">Raport Semester</h2>
            <p className="text-xs">{raport.semester.nama} — Tahun Ajaran {raport.semester.tahunAjaran.nama}</p>
          </header>

          <section className="grid grid-cols-2 gap-x-8 gap-y-1 mt-4 text-xs">
            <div className="flex"><span className="w-24 shrink-0">Nama Siswa</span><span className="font-semibold">: {raport.siswa.nama}</span></div>
            <div className="flex"><span className="w-20 shrink-0">Kelas</span><span className="font-semibold">: {raport.kelas.nama}</span></div>
            <div className="flex"><span className="w-24 shrink-0">NIS</span><span>: {raport.siswa.nis || "-"}</span></div>
            <div className="flex"><span className="w-20 shrink-0">NISN</span><span>: {raport.siswa.nisn || "-"}</span></div>
            <div className="flex"><span className="w-24 shrink-0">Wali Kelas</span><span>: {raport.waliKelas?.nama || "-"}</span></div>
            <div className="flex"><span className="w-20 shrink-0">Status</span><span>: {raport.status === "TERBIT" ? `Terbit ${tanggal(raport.terbitAt)}` : "Draft"}</span></div>
          </section>

          <section className="mt-5">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 px-2 py-1.5 text-center w-8">No</th>
                  <th className="border border-slate-400 px-2 py-1.5 text-left">Mata Pelajaran</th>
                  <th className="border border-slate-400 px-2 py-1.5 text-center w-16">Nilai</th>
                  <th className="border border-slate-400 px-2 py-1.5 text-center w-16">Predikat</th>
                  <th className="border border-slate-400 px-2 py-1.5 text-left">Deskripsi Capaian</th>
                </tr>
              </thead>
              <tbody>
                {raport.nilais.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border border-slate-400 px-2 py-4 text-center text-slate-500">
                      Belum ada nilai mata pelajaran.
                    </td>
                  </tr>
                ) : (
                  raport.nilais.map((n, i) => (
                    <tr key={n.mapel.kode + i}>
                      <td className="border border-slate-400 px-2 py-1.5 text-center">{i + 1}</td>
                      <td className="border border-slate-400 px-2 py-1.5">{n.mapel.nama}</td>
                      <td className="border border-slate-400 px-2 py-1.5 text-center font-semibold">{n.nilaiAkhir}</td>
                      <td className="border border-slate-400 px-2 py-1.5 text-center">{n.predikat}</td>
                      <td className="border border-slate-400 px-2 py-1.5">{n.deskripsi || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={2} className="border border-slate-400 px-2 py-1.5 text-right">Rata-rata</td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center">{raport.rataRata ?? "-"}</td>
                  <td colSpan={2} className="border border-slate-400 px-2 py-1.5">
                    {pengaturan.tampilkanPeringkat ? `Peringkat ${raport.peringkat ?? "-"} dari kelas` : ""}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <h3 className="font-semibold mb-1">Ketidakhadiran</h3>
              <table className="text-xs">
                <tbody>
                  <tr><td className="pr-4 py-0.5">Sakit</td><td className="pr-2">:</td><td>{raport.sakit} hari</td></tr>
                  <tr><td className="pr-4 py-0.5">Izin</td><td className="pr-2">:</td><td>{raport.izin} hari</td></tr>
                  <tr><td className="pr-4 py-0.5">Tanpa Keterangan</td><td className="pr-2">:</td><td>{raport.alpa} hari</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Sikap</h3>
              <p>
                {raport.sikapPredikat ? <span className="font-medium">{raport.sikapPredikat}. </span> : null}
                {raport.sikapDeskripsi || "Belum diisi."}
              </p>
              {raport.prestasi ? <p className="mt-1"><span className="font-medium">Prestasi: </span>{raport.prestasi}</p> : null}
            </div>
          </section>

          <section className="mt-4">
            <h3 className="font-semibold mb-1">Catatan Wali Kelas</h3>
            <p>{raport.catatanWali || "Belum ada catatan."}</p>
          </section>

          {pengaturan.catatanKepala ? (
            <section className="mt-3">
              <h3 className="font-semibold mb-1">Catatan Kepala Sekolah</h3>
              <p>{pengaturan.catatanKepala}</p>
            </section>
          ) : null}

          <section className="grid grid-cols-3 gap-6 mt-10 text-center text-xs">
            <div>
              <p>Orang Tua / Wali</p>
              <div className="h-16" />
              <p className="border-t border-slate-500 pt-1">(...................................)</p>
            </div>
            <div>
              <p>Wali Kelas</p>
              <div className="h-16" />
              <p className="border-t border-slate-500 pt-1 font-medium">{raport.waliKelas?.nama || "(...................................)"}</p>
              {raport.waliKelas?.nip ? <p className="text-[10px]">NIP. {raport.waliKelas.nip}</p> : null}
            </div>
            <div>
              <p>Kepala Sekolah</p>
              <div className="h-16" />
              <p className="border-t border-slate-500 pt-1 font-medium">{pengaturan.namaKepalaSekolah || "(...................................)"}</p>
              {pengaturan.nipKepalaSekolah ? <p className="text-[10px]">NIP. {pengaturan.nipKepalaSekolah}</p> : null}
            </div>
          </section>
        </article>
      </div>
    </main>
  )
}
