import assert from "node:assert/strict"
import test from "node:test"
import {
  bersihkanNomor,
  cekIdentitasSiswa,
  cekNipUnik,
  cekNisNoSantriUnik,
  cekNisUnik,
  pesanDuplikat,
} from "../src/lib/identitas"

/**
 * Uji verifikasi identitas otomatis:
 * NIS & NISN unik untuk murid, NISantri unik untuk santri, NIP unik untuk guru.
 * Database diganti objek palsu agar tidak menyentuh data asli.
 */

type Baris = { id?: string; nama: string; nis?: string | null; nisn?: string | null; nip?: string | null; nisNo?: string | null }

function tabelPalsu(rows: Baris[]) {
  return {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      const { id, ...syarat } = where as { id?: { not?: string } } & Record<string, unknown>
      const cocok = rows.find(
        (r) =>
          Object.entries(syarat).every(([k, v]) => (r as Record<string, unknown>)[k] === v) &&
          (!id?.not || r.id !== id.not),
      )
      return cocok ? { nama: cocok.nama } : null
    },
  }
}

function dbPalsu(data: { siswa?: Baris[]; santri?: Baris[]; guru?: Baris[] } = {}) {
  return {
    siswa: tabelPalsu(data.siswa ?? []),
    santri: tabelPalsu(data.santri ?? []),
    guru: tabelPalsu(data.guru ?? []),
  } as never
}

test("nomor kosong dinormalisasi menjadi null", () => {
  assert.equal(bersihkanNomor(undefined), null)
  assert.equal(bersihkanNomor("   "), null)
  assert.equal(bersihkanNomor(" 1234 "), "1234")
})

test("NIS hanya boleh dipakai satu murid", async () => {
  const db = dbPalsu({ siswa: [{ id: "s1", nis: "1234", nama: "Budi" }] })
  await assert.rejects(() => cekNisUnik("1234", undefined, db), /NIS 1234 sudah dipakai oleh Budi/)
})

test("menyimpan NIS sendiri (tanpa perubahan) tidak dianggap duplikat", async () => {
  const db = dbPalsu({ siswa: [{ id: "s1", nis: "1234", nama: "Budi" }] })
  await cekNisUnik("1234", "s1", db)
})

test("NISN hanya boleh dipakai satu murid", async () => {
  const db = dbPalsu({ siswa: [{ id: "s1", nisn: "0097312153", nama: "Budi" }] })
  await assert.rejects(
    () => cekIdentitasSiswa({ nis: "9999", nisn: "0097312153" }, undefined, db),
    /NISN 0097312153 sudah dipakai oleh Budi/,
  )
})

test("NIS dan NISN sama-sama dirujuk ke murid yang sudah ada", async () => {
  const db = dbPalsu({ siswa: [{ id: "s1", nis: "1234", nisn: "0097312153", nama: "Budi" }] })
  await assert.rejects(
    () => cekIdentitasSiswa({ nis: " 1234 ", nisn: "0097312153" }, undefined, db),
    /NIS 1234 sudah dipakai oleh Budi/,
  )
})

test("murid baru dengan NIS/NISN belum terpakai lolos", async () => {
  const db = dbPalsu({ siswa: [{ id: "s1", nis: "1234", nisn: "0097312153", nama: "Budi" }] })
  await cekIdentitasSiswa({ nis: "5678", nisn: "0097312154" }, undefined, db)
})

test("Nomor Induk Santri hanya boleh dipakai satu santri", async () => {
  const db = dbPalsu({ santri: [{ id: "t1", nisNo: "S-01", nama: "Aisyah" }] })
  await assert.rejects(() => cekNisNoSantriUnik("S-01", undefined, db), /Nomor Induk Santri S-01 sudah dipakai oleh Aisyah/)
  await cekNisNoSantriUnik("S-01", "t1", db)
})

test("NIP hanya boleh dipakai satu guru", async () => {
  const db = dbPalsu({ guru: [{ id: "g1", nip: "1987", nama: "Pak Ahmad" }] })
  await assert.rejects(() => cekNipUnik("1987", undefined, db), /NIP 1987 sudah dipakai oleh Pak Ahmad/)
  await cekNipUnik("  ", undefined, db)
})

test("galat unique dari database diterjemahkan ke pesan pengguna", () => {
  const err = pesanDuplikat({ code: "P2002" }, "NIS sudah dipakai")
  assert.equal(err.message, "NIS sudah dipakai")

  const lain = new Error("koneksi putus")
  assert.equal(pesanDuplikat(lain, "NIS sudah dipakai"), lain)
})
