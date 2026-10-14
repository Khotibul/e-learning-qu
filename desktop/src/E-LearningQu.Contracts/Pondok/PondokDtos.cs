using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Pondok;

// ═══════════════════════════════════════════════════════════════════════
// DTO untuk /api/mobile/pondok/* — mencerminkan bentuk JSON route handler.
// ═══════════════════════════════════════════════════════════════════════

// ── Kepala Pondok: dashboard ────────────────────────────────────────────

public sealed class KepalaDashboardDto
{
    [JsonPropertyName("totalSantri")] public int TotalSantri { get; set; }
    [JsonPropertyName("diPondok")] public int DiPondok { get; set; }
    [JsonPropertyName("izinPulang")] public int IzinPulang { get; set; }
    [JsonPropertyName("terlambat")] public int Terlambat { get; set; }
    [JsonPropertyName("tidakDiketahui")] public int TidakDiketahui { get; set; }
    [JsonPropertyName("totalAsrama")] public int TotalAsrama { get; set; }
    [JsonPropertyName("totalKamar")] public int TotalKamar { get; set; }
    [JsonPropertyName("kegiatanHariIni")] public int KegiatanHariIni { get; set; }
    [JsonPropertyName("kehadiranKegiatanPersen")] public double? KehadiranKegiatanPersen { get; set; }
    [JsonPropertyName("izinMenunggu")] public int IzinMenunggu { get; set; }
    [JsonPropertyName("izinMenungguPengurus")] public int IzinMenungguPengurus { get; set; }
    [JsonPropertyName("izinMenungguMusyrif")] public int IzinMenungguMusyrif { get; set; }
    [JsonPropertyName("izinMenungguKepala")] public int IzinMenungguKepala { get; set; }
    [JsonPropertyName("izinMenungguAdmin")] public int IzinMenungguAdmin { get; set; }
    [JsonPropertyName("pengumumanMenunggu")] public int PengumumanMenunggu { get; set; }
    [JsonPropertyName("pembinaanMenunggu")] public int PembinaanMenunggu { get; set; }
    [JsonPropertyName("pelanggaranBulanIni")] public int PelanggaranBulanIni { get; set; }
    [JsonPropertyName("prestasiBulanIni")] public int PrestasiBulanIni { get; set; }
    [JsonPropertyName("capaianTahfidz")] public CapaianTahfidzDto? CapaianTahfidz { get; set; }
    [JsonPropertyName("diniyah")] public DiniyahRingkasDto? Diniyah { get; set; }
    [JsonPropertyName("kegiatanMendatang")] public List<KegiatanDto> KegiatanMendatang { get; set; } = new();
}

public sealed class CapaianTahfidzDto
{
    [JsonPropertyName("setoranBulanIni")] public int SetoranBulanIni { get; set; }
    [JsonPropertyName("halaqahAktif")] public int HalaqahAktif { get; set; }
}

public sealed class DiniyahRingkasDto
{
    [JsonPropertyName("kelasAktif")] public int KelasAktif { get; set; }
    [JsonPropertyName("hadirPersenBulan")] public double? HadirPersenBulan { get; set; }
}

// ── Kepala Pondok: tabs ─────────────────────────────────────────────────

public sealed class KeberadaanSantriDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("nisNo")] public string? NisNo { get; set; }
    [JsonPropertyName("keberadaan")] public string Keberadaan { get; set; } = "";
    [JsonPropertyName("keberadaanLabel")] public string KeberadaanLabel { get; set; } = "";
    [JsonPropertyName("asrama")] public string? Asrama { get; set; }
    [JsonPropertyName("kamar")] public string? Kamar { get; set; }
    [JsonPropertyName("izinAktif")] public IzinAktifDto? IzinAktif { get; set; }
}

public sealed class IzinAktifDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("suratNomor")] public string? SuratNomor { get; set; }
    [JsonPropertyName("rencanaKembali")] public DateTime? RencanaKembali { get; set; }
    [JsonPropertyName("jenis")] public string Jenis { get; set; } = "";
    [JsonPropertyName("jenisLabel")] public string JenisLabel { get; set; } = "";
    [JsonPropertyName("checkoutAt")] public DateTime? CheckoutAt { get; set; }
}

public sealed class KegiatanDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("tipe")] public string Tipe { get; set; } = "";
    [JsonPropertyName("tanggal")] public DateTime Tanggal { get; set; }
    [JsonPropertyName("jamMulai")] public string? JamMulai { get; set; }
    [JsonPropertyName("jamSelesai")] public string? JamSelesai { get; set; }
    [JsonPropertyName("lokasi")] public string? Lokasi { get; set; }
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; set; }
    [JsonPropertyName("wajib")] public bool Wajib { get; set; }
    [JsonPropertyName("penanggungJawab")] public string? PenanggungJawab { get; set; }
    [JsonPropertyName("jumlahAbsensi")] public int JumlahAbsensi { get; set; }
}

/// <summary>Wrapper tab: route mengembalikan {tab, rows, [label maps]}.</summary>
public sealed class PondokTabDto<T>
{
    [JsonPropertyName("tab")] public string? Tab { get; set; }
    [JsonPropertyName("scopeSemua")] public bool ScopeSemua { get; set; }
    [JsonPropertyName("rows")] public List<T> Rows { get; set; } = new();
    [JsonPropertyName("data")] public List<T>? Data { get; set; }
    [JsonPropertyName("kelas")] public List<T>? KelasOpt { get; set; }
    [JsonPropertyName("halaqah")] public List<T>? HalaqahOpt { get; set; }
    [JsonPropertyName("total")] public int Total { get; set; }
    [JsonPropertyName("page")] public int Page { get; set; } = 1;
    [JsonPropertyName("totalPages")] public int TotalPages { get; set; } = 1;
    [JsonPropertyName("statusLabel")] public Dictionary<string, string>? StatusLabel { get; set; }
    [JsonPropertyName("jenisLabel")] public Dictionary<string, string>? JenisLabel { get; set; }
    [JsonPropertyName("keberadaanLabel")] public Dictionary<string, string>? KeberadaanLabel { get; set; }
}

public sealed class PengumumanDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("judul")] public string Judul { get; set; } = "";
    [JsonPropertyName("isi")] public string Isi { get; set; } = "";
    [JsonPropertyName("tipe")] public string Tipe { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("pembuat")] public string? Pembuat { get; set; }
    [JsonPropertyName("milikSaya")] public bool MilikSaya { get; set; }
    [JsonPropertyName("createdAt")] public DateTime CreatedAt { get; set; }
    [JsonPropertyName("approvedAt")] public DateTime? ApprovedAt { get; set; }
}

public sealed class PembinaanDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("tipe")] public string Tipe { get; set; } = "";
    [JsonPropertyName("judul")] public string Judul { get; set; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; set; }
    [JsonPropertyName("poin")] public int? Poin { get; set; }
    [JsonPropertyName("tindakLanjut")] public string? TindakLanjut { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("tanggal")] public DateTime Tanggal { get; set; }
    [JsonPropertyName("santri")] public SantriRingkasDto? Santri { get; set; }
    [JsonPropertyName("petugas")] public NamaDto? Petugas { get; set; }
}

public sealed class NamaDto
{
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("nama")] public string? Nama { get; set; }
}

public sealed class SantriRingkasDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("nisNo")] public string? NisNo { get; set; }
    [JsonPropertyName("keberadaan")] public string? Keberadaan { get; set; }
    [JsonPropertyName("asrama")] public NamaValueDto? Asrama { get; set; }
    [JsonPropertyName("kamar")] public NamaValueDto? Kamar { get; set; }
    [JsonPropertyName("halaqah")] public NamaValueDto? Halaqah { get; set; }
    [JsonPropertyName("kelasDiniyah")] public NamaValueDto? KelasDiniyah { get; set; }
}

public sealed class NamaValueDto
{
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
}

public sealed class StatistikBarLaporanDto
{
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("label")] public string? Label { get; set; }
    [JsonPropertyName("tipe")] public string? Tipe { get; set; }
    [JsonPropertyName("nilai")] public int Nilai { get; set; }
    [JsonPropertyName("jumlah")] public int Jumlah { get; set; }
}

public sealed class IzinSantriDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("santriId")] public string? SantriId { get; set; }
    [JsonPropertyName("suratNomor")] public string? SuratNomor { get; set; }
    [JsonPropertyName("jenis")] public string Jenis { get; set; } = "";
    [JsonPropertyName("jenisLabel")] public string? JenisLabel { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("statusLabel")] public string? StatusLabel { get; set; }
    [JsonPropertyName("alasan")] public string? Alasan { get; set; }
    [JsonPropertyName("alasanKeputusan")] public string? AlasanKeputusan { get; set; }
    [JsonPropertyName("rencanaKeluar")] public DateTime RencanaKeluar { get; set; }
    [JsonPropertyName("rencanaKembali")] public DateTime RencanaKembali { get; set; }
    [JsonPropertyName("checkoutAt")] public DateTime? CheckoutAt { get; set; }
    [JsonPropertyName("checkinAt")] public DateTime? CheckinAt { get; set; }
    [JsonPropertyName("namaPenjemput")] public string? NamaPenjemput { get; set; }
    [JsonPropertyName("penjemputNama")] public string? PenjemputNama { get; set; }
    [JsonPropertyName("hubunganPenjemput")] public string? HubunganPenjemput { get; set; }
    [JsonPropertyName("penjemputHubungan")] public string? PenjemputHubungan { get; set; }
    [JsonPropertyName("noTelpPenjemput")] public string? NoTelpPenjemput { get; set; }
    [JsonPropertyName("alamatTujuan")] public string? AlamatTujuan { get; set; }
    [JsonPropertyName("createdAt")] public DateTime CreatedAt { get; set; }
    [JsonPropertyName("santri")] public SantriRingkasDto? Santri { get; set; }
}

// ── Gerbang ─────────────────────────────────────────────────────────────

public sealed class GerbangAntreanDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("suratNomor")] public string? SuratNomor { get; set; }
    [JsonPropertyName("jenis")] public string Jenis { get; set; } = "";
    [JsonPropertyName("jenisLabel")] public string? JenisLabel { get; set; }
    [JsonPropertyName("rencanaKeluar")] public DateTime RencanaKeluar { get; set; }
    [JsonPropertyName("rencanaKembali")] public DateTime RencanaKembali { get; set; }
    [JsonPropertyName("penjemputNama")] public string? PenjemputNama { get; set; }
    [JsonPropertyName("penjemputHubungan")] public string? PenjemputHubungan { get; set; }
    [JsonPropertyName("noTelpPenjemput")] public string? NoTelpPenjemput { get; set; }
    [JsonPropertyName("alamatTujuan")] public string? AlamatTujuan { get; set; }
    [JsonPropertyName("santri")] public SantriRingkasDto? Santri { get; set; }
}

public sealed class GerbangSearchDto
{
    [JsonPropertyName("mode")] public string? Mode { get; set; }
    [JsonPropertyName("rows")] public List<GerbangSantriDto> Rows { get; set; } = new();
    [JsonPropertyName("riwayatRows")] public List<GerbangAntreanDto>? RiwayatRows { get; set; }
    [JsonPropertyName("izin")] public TokenVerifDto? Izin { get; set; }
    [JsonPropertyName("total")] public int Total { get; set; }
    [JsonPropertyName("page")] public int Page { get; set; } = 1;
    [JsonPropertyName("totalPages")] public int TotalPages { get; set; } = 1;
    [JsonPropertyName("riwayat")] public bool Riwayat { get; set; }
}

public sealed class GerbangSantriDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("nisNo")] public string? NisNo { get; set; }
    [JsonPropertyName("keberadaan")] public string Keberadaan { get; set; } = "";
    [JsonPropertyName("keberadaanLabel")] public string? KeberadaanLabel { get; set; }
    [JsonPropertyName("asrama")] public string? Asrama { get; set; }
    [JsonPropertyName("kamar")] public string? Kamar { get; set; }
    [JsonPropertyName("izin")] public GerbangIzinDto? Izin { get; set; }
}

public sealed class GerbangIzinDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("suratNomor")] public string? SuratNomor { get; set; }
    [JsonPropertyName("jenis")] public string Jenis { get; set; } = "";
    [JsonPropertyName("jenisLabel")] public string? JenisLabel { get; set; }
    [JsonPropertyName("rencanaKembali")] public DateTime? RencanaKembali { get; set; }
    [JsonPropertyName("checkoutAt")] public DateTime? CheckoutAt { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
}

public sealed class TokenVerifDto
{
    [JsonPropertyName("valid")] public bool Valid { get; set; }
    [JsonPropertyName("kedaluwarsa")] public bool Kedaluwarsa { get; set; }
    [JsonPropertyName("suratNomor")] public string? SuratNomor { get; set; }
    [JsonPropertyName("jenis")] public string? Jenis { get; set; }
    [JsonPropertyName("namaSantri")] public string? NamaSantri { get; set; }
    [JsonPropertyName("nisNo")] public string? NisNo { get; set; }
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("sudahCheckout")] public bool SudahCheckout { get; set; }
    [JsonPropertyName("sudahCheckin")] public bool SudahCheckin { get; set; }
    [JsonPropertyName("berlakuSampai")] public DateTime? BerlakuSampai { get; set; }
}

// ── Ustadz ──────────────────────────────────────────────────────────────

public sealed class UstadzDashboardDto
{
    [JsonPropertyName("tab")] public string? Tab { get; set; }
    [JsonPropertyName("kelasSaya")] public List<KelasDiniyahDto> KelasSaya { get; set; } = new();
    [JsonPropertyName("halaqahSaya")] public List<HalaqahDto> HalaqahSaya { get; set; } = new();
    [JsonPropertyName("santriBinaan")] public int SantriBinaan { get; set; }
    [JsonPropertyName("absensiBelumDiniyah")] public int AbsensiBelumDiniyah { get; set; }
    [JsonPropertyName("absensiKegiatanTerisi")] public int AbsensiKegiatanTerisi { get; set; }
    [JsonPropertyName("kegiatanDitugaskan")] public int KegiatanDitugaskan { get; set; }
    [JsonPropertyName("setoranTerbaru")] public List<SetoranDto> SetoranTerbaru { get; set; } = new();
    [JsonPropertyName("targetHalaqah")] public List<TargetHalaqahDto> TargetHalaqah { get; set; } = new();
    [JsonPropertyName("izinTerkait")] public List<IzinRingkasDto> IzinTerkait { get; set; } = new();
}

public sealed class KelasDiniyahDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("tingkat")] public string? Tingkat { get; set; }
    [JsonPropertyName("hari")] public string? Hari { get; set; }
    [JsonPropertyName("jam")] public string? Jam { get; set; }
}

public sealed class HalaqahDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("tingkat")] public string? Tingkat { get; set; }
    [JsonPropertyName("targetSurah")] public string? TargetSurah { get; set; }
    [JsonPropertyName("jumlahSantri")] public int JumlahSantri { get; set; }
    [JsonPropertyName("jumlahSetoran")] public int JumlahSetoran { get; set; }
}

public sealed class SetoranDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("surah")] public string Surah { get; set; } = "";
    [JsonPropertyName("ayatMulai")] public int AyatMulai { get; set; }
    [JsonPropertyName("ayatAkhir")] public int AyatAkhir { get; set; }
    [JsonPropertyName("ayat")] public string? Ayat { get; set; }
    [JsonPropertyName("juz")] public int? Juz { get; set; }
    [JsonPropertyName("tipe")] public string Tipe { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("tajwid")] public int? Tajwid { get; set; }
    [JsonPropertyName("kelancaran")] public int? Kelancaran { get; set; }
    [JsonPropertyName("catatan")] public string? Catatan { get; set; }
    [JsonPropertyName("tanggal")] public DateTime Tanggal { get; set; }
    [JsonPropertyName("nama")] public string? Nama { get; set; }
    [JsonPropertyName("halaqah")] public string? Halaqah { get; set; }
    [JsonPropertyName("santri")] public SantriRingkasDto? Santri { get; set; }
}

public sealed class TargetHalaqahDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("targetSurah")] public string? TargetSurah { get; set; }
    [JsonPropertyName("jumlahSantri")] public int JumlahSantri { get; set; }
}

public sealed class IzinRingkasDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string? Nama { get; set; }
    [JsonPropertyName("jenis")] public string? Jenis { get; set; }
    [JsonPropertyName("status")] public string? Status { get; set; }
}

public sealed class AbsensiDiniyahRowDto
{
    [JsonPropertyName("santriId")] public string SantriId { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("nisNo")] public string? NisNo { get; set; }
    [JsonPropertyName("keberadaan")] public string? Keberadaan { get; set; }
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("keterangan")] public string? Keterangan { get; set; }
}

public sealed class UstadzTabDto<T>
{
    [JsonPropertyName("tab")] public string? Tab { get; set; }
    [JsonPropertyName("rows")] public List<T> Rows { get; set; } = new();
    [JsonPropertyName("data")] public List<T>? Data { get; set; }
    [JsonPropertyName("total")] public int Total { get; set; }
    [JsonPropertyName("page")] public int Page { get; set; } = 1;
    [JsonPropertyName("totalPages")] public int TotalPages { get; set; } = 1;
    [JsonPropertyName("statusLabel")] public Dictionary<string, string>? StatusLabel { get; set; }
    [JsonPropertyName("jenisLabel")] public Dictionary<string, string>? JenisLabel { get; set; }
    [JsonPropertyName("kehadiranDiniyah")] public List<StatistikBarLaporanDto>? KehadiranDiniyah { get; set; }
    [JsonPropertyName("setoran")] public List<StatistikBarLaporanDto>? Setoran { get; set; }
    [JsonPropertyName("rataTajwid")] public int? RataTajwid { get; set; }
    [JsonPropertyName("rataKelancaran")] public int? RataKelancaran { get; set; }
    [JsonPropertyName("jumlahDinilai")] public int JumlahDinilai { get; set; }
}

// ── Pengurus ────────────────────────────────────────────────────────────

public sealed class PengurusDashboardDto
{
    [JsonPropertyName("tab")] public string? Tab { get; set; }
    [JsonPropertyName("tanggungJawab")] public int TanggungJawab { get; set; }
    [JsonPropertyName("diPondok")] public int DiPondok { get; set; }
    [JsonPropertyName("sedangPulang")] public int SedangPulang { get; set; }
    [JsonPropertyName("terlambat")] public int Terlambat { get; set; }
    [JsonPropertyName("izinMenunggu")] public int IzinMenunggu { get; set; }
    [JsonPropertyName("izinAktif")] public int IzinAktif { get; set; }
    [JsonPropertyName("kegiatanHariIni")] public int KegiatanHariIni { get; set; }
    [JsonPropertyName("absensiBelumLengkap")] public int AbsensiBelumLengkap { get; set; }
    [JsonPropertyName("scopeSemua")] public bool ScopeSemua { get; set; }
}

public sealed class AsramaDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("musyrif")] public string? Musyrif { get; set; }
    [JsonPropertyName("totalPenghuni")] public int TotalPenghuni { get; set; }
    [JsonPropertyName("kamars")] public List<KamarDto> Kamars { get; set; } = new();
}

public sealed class KamarDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("kapasitas")] public int? Kapasitas { get; set; }
    [JsonPropertyName("terisi")] public int Terisi { get; set; }
}

// ── Keuangan ────────────────────────────────────────────────────────────

public sealed class KeuanganPondokDto
{
    [JsonPropertyName("rekapTagihanPondok")] public List<RekapTagihanDto> RekapTagihanPondok { get; set; } = new();
    [JsonPropertyName("tunggakan")] public List<TunggakanDto> Tunggakan { get; set; } = new();
    [JsonPropertyName("topupBerhasil")] public NilaiCountDto? TopupBerhasil { get; set; }
    [JsonPropertyName("transaksiKantin")] public NilaiCountDto? TransaksiKantin { get; set; }
}

public sealed class RekapTagihanDto
{
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("jumlah")] public int Jumlah { get; set; }
    [JsonPropertyName("total")] public int Total { get; set; }
    [JsonPropertyName("terbayar")] public int Terbayar { get; set; }
    [JsonPropertyName("sisa")] public int Sisa { get; set; }
}

public sealed class TunggakanDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("kode")] public string Kode { get; set; } = "";
    [JsonPropertyName("periode")] public string Periode { get; set; } = "";
    [JsonPropertyName("total")] public int Total { get; set; }
    [JsonPropertyName("terbayar")] public int Terbayar { get; set; }
    [JsonPropertyName("sisa")] public int Sisa { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("jatuhTempo")] public DateTime? JatuhTempo { get; set; }
    [JsonPropertyName("jenis")] public string Jenis { get; set; } = "";
    [JsonPropertyName("kodeJenis")] public string? KodeJenis { get; set; }
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("identitas")] public string? Identitas { get; set; }
}

public sealed class NilaiCountDto
{
    [JsonPropertyName("jumlah")] public int Jumlah { get; set; }
    [JsonPropertyName("count")] public int Count { get; set; }
}

// ── Mutasi request ──────────────────────────────────────────────────────

public sealed class PondokDecisionRequest
{
    [JsonPropertyName("op")] public string Op { get; set; } = "";
    [JsonPropertyName("izinId")] public string? IzinId { get; set; }
    [JsonPropertyName("aksi")] public string? Aksi { get; set; }
    [JsonPropertyName("catatan")] public string? Catatan { get; set; }
    [JsonPropertyName("alasan")] public string? Alasan { get; set; }
}

public sealed class GerbangActionRequest
{
    [JsonPropertyName("op")] public string Op { get; set; } = "";
    [JsonPropertyName("izinId")] public string? IzinId { get; set; }
    [JsonPropertyName("token")] public string? Token { get; set; }
    [JsonPropertyName("verifikasiPenjemput")] public bool? VerifikasiPenjemput { get; set; }
}
