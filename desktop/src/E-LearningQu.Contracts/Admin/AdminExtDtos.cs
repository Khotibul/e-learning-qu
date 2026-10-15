using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Admin;

// ═══════════════════════════════════════════════════════════════════════
// DTO batch 2: site-config (pengaturan), jadwal-ujian, researcher.
// ═══════════════════════════════════════════════════════════════════════

public sealed class SiteConfigDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("siteName")] public string SiteName { get; set; } = "";
    [JsonPropertyName("tagline")] public string Tagline { get; set; } = "";
    [JsonPropertyName("description")] public string Description { get; set; } = "";
    [JsonPropertyName("logoUrl")] public string? LogoUrl { get; set; }
    [JsonPropertyName("faviconUrl")] public string? FaviconUrl { get; set; }
    [JsonPropertyName("aboutTitle")] public string? AboutTitle { get; set; }
    [JsonPropertyName("aboutText")] public string? AboutText { get; set; }
}

public sealed class SiteConfigUpdateRequest
{
    [JsonPropertyName("siteName")] public string? SiteName { get; set; }
    [JsonPropertyName("tagline")] public string? Tagline { get; set; }
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("logoUrl")] public string? LogoUrl { get; set; }
    [JsonPropertyName("faviconUrl")] public string? FaviconUrl { get; set; }
    [JsonPropertyName("aboutTitle")] public string? AboutTitle { get; set; }
    [JsonPropertyName("aboutText")] public string? AboutText { get; set; }
}

public sealed class LandingFeatureDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("icon")] public string Icon { get; set; } = "";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("description")] public string Description { get; set; } = "";
    [JsonPropertyName("order")] public int Order { get; set; }
    [JsonPropertyName("isActive")] public bool IsActive { get; set; }
}

public sealed class LandingFeatureRequest
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("icon")] public string? Icon { get; set; }
    [JsonPropertyName("title")] public string? Title { get; set; }
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("order")] public int? Order { get; set; }
    [JsonPropertyName("isActive")] public bool? IsActive { get; set; }
}

public sealed class JadwalUjianAdminDto
{
    [JsonPropertyName("rows")] public List<UjianAdminDto> Rows { get; set; } = new();
    [JsonPropertyName("stats")] public UjianStatsDto? Stats { get; set; }
}

public sealed class UjianAdminDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("tanggal")] public DateTime Tanggal { get; set; }
    [JsonPropertyName("durasi")] public int Durasi { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("mapel")] public string? Mapel { get; set; }
    [JsonPropertyName("kelas")] public string? Kelas { get; set; }
    [JsonPropertyName("guru")] public string? Guru { get; set; }
}

public sealed class UjianStatsDto
{
    [JsonPropertyName("total")] public int Total { get; set; }
    [JsonPropertyName("aktif")] public int Aktif { get; set; }
    [JsonPropertyName("selesai")] public int Selesai { get; set; }
    [JsonPropertyName("draft")] public int Draft { get; set; }
}

// ── Researcher analytics ────────────────────────────────────────────────

public sealed class ResearcherOverviewDto
{
    [JsonPropertyName("overview")] public ResearcherSummaryDto? Overview { get; set; }
    [JsonPropertyName("distribusiNilai")] public List<DistribusiNilaiDto> DistribusiNilai { get; set; } = new();
    [JsonPropertyName("mastery")] public List<MasteryDto> Mastery { get; set; } = new();
    [JsonPropertyName("trenAktivitas")] public List<TrenAktivitasDto> TrenAktivitas { get; set; } = new();
    [JsonPropertyName("agentPerformance")] public List<AgentPerformanceDto> AgentPerformance { get; set; } = new();
    [JsonPropertyName("warning")] public WarningStatsDto? Warning { get; set; }
    [JsonPropertyName("dropoutRisk")] public List<DropoutRiskDto> DropoutRisk { get; set; } = new();
}

public sealed class ResearcherSummaryDto
{
    [JsonPropertyName("totalSiswa")] public int TotalSiswa { get; set; }
    [JsonPropertyName("totalUjian")] public int TotalUjian { get; set; }
    [JsonPropertyName("totalSoal")] public int TotalSoal { get; set; }
    [JsonPropertyName("rataNilai")] public double? RataNilai { get; set; }
    [JsonPropertyName("aktivitas30Hari")] public int Aktivitas30Hari { get; set; }
    [JsonPropertyName("siswaAktif30Hari")] public int SiswaAktif30Hari { get; set; }
    [JsonPropertyName("soalTerjawab")] public int SoalTerjawab { get; set; }
    [JsonPropertyName("masteryPerKategori")] public List<KategoriCountDto> MasteryPerKategori { get; set; } = new();
}

public sealed class KategoriCountDto
{
    [JsonPropertyName("kategori")] public string Kategori { get; set; } = "";
    [JsonPropertyName("jumlah")] public int Jumlah { get; set; }
}

public sealed class DistribusiNilaiDto
{
    [JsonPropertyName("label")] public string Label { get; set; } = "";
    [JsonPropertyName("count")] public int Count { get; set; }
}

public sealed class MasteryDto
{
    [JsonPropertyName("mapel")] public string Mapel { get; set; } = "";
    [JsonPropertyName("kompetensi")] public string Kompetensi { get; set; } = "";
    [JsonPropertyName("avgSkor")] public double? AvgSkor { get; set; }
    [JsonPropertyName("jumlahSiswa")] public int JumlahSiswa { get; set; }
}

public sealed class TrenAktivitasDto
{
    [JsonPropertyName("date")] public string Date { get; set; } = "";
    [JsonPropertyName("count")] public int Count { get; set; }
}

public sealed class AgentPerformanceDto
{
    [JsonPropertyName("agent")] public string Agent { get; set; } = "";
    [JsonPropertyName("totalCalls")] public int TotalCalls { get; set; }
    [JsonPropertyName("successRate")] public double SuccessRate { get; set; }
    [JsonPropertyName("avgDuration")] public int? AvgDuration { get; set; }
}

public sealed class WarningStatsDto
{
    [JsonPropertyName("breakdown")] public List<WarningBreakdownDto> Breakdown { get; set; } = new();
    [JsonPropertyName("bySeverity")] public List<SeverityCountDto> BySeverity { get; set; } = new();
}

public sealed class WarningBreakdownDto
{
    [JsonPropertyName("severity")] public string Severity { get; set; } = "";
    [JsonPropertyName("tipe")] public string Tipe { get; set; } = "";
    [JsonPropertyName("jumlah")] public int Jumlah { get; set; }
}

public sealed class SeverityCountDto
{
    [JsonPropertyName("severity")] public string Severity { get; set; } = "";
    [JsonPropertyName("jumlah")] public int Jumlah { get; set; }
}

public sealed class DropoutRiskDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("nis")] public string? Nis { get; set; }
    [JsonPropertyName("kelas")] public string? Kelas { get; set; }
    [JsonPropertyName("jumlahPeringatan")] public int JumlahPeringatan { get; set; }
}

// ═══════════════════════════════════════════════════════════════════════
// DTO batch B: courses, jadwal pelajaran, santri, wali, ppdb, izin.
// ═══════════════════════════════════════════════════════════════════════

public sealed class CourseAdminDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("isPublished")] public bool IsPublished { get; set; }
    [JsonPropertyName("mapel")] public string? Mapel { get; set; }
    [JsonPropertyName("guru")] public string? Guru { get; set; }
    [JsonPropertyName("jumlahModule")] public int JumlahModule { get; set; }
}

public sealed class CourseDetailDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("isPublished")] public bool IsPublished { get; set; }
    [JsonPropertyName("modules")] public List<CourseModuleDto> Modules { get; set; } = new();
}

public sealed class CourseModuleDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("isPublished")] public bool IsPublished { get; set; }
    [JsonPropertyName("sortOrder")] public int SortOrder { get; set; }
    [JsonPropertyName("lessons")] public List<CourseLessonDto> Lessons { get; set; } = new();
}

public sealed class CourseLessonDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("content")] public string? Content { get; set; }
    [JsonPropertyName("isPublished")] public bool IsPublished { get; set; }
    [JsonPropertyName("sortOrder")] public int SortOrder { get; set; }
    [JsonPropertyName("materials")] public List<CourseMaterialDto> Materials { get; set; } = new();
}

public sealed class CourseMaterialDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("content")] public string? Content { get; set; }
    [JsonPropertyName("fileUrl")] public string? FileUrl { get; set; }
    [JsonPropertyName("fileType")] public string? FileType { get; set; }
    [JsonPropertyName("sortOrder")] public int SortOrder { get; set; }
}

public sealed class JadwalPelajaranDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("hari")] public string Hari { get; set; } = "";
    [JsonPropertyName("jamMulai")] public string JamMulai { get; set; } = "";
    [JsonPropertyName("jamSelesai")] public string JamSelesai { get; set; } = "";
    [JsonPropertyName("kelasId")] public string? KelasId { get; set; }
    [JsonPropertyName("kelas")] public string? Kelas { get; set; }
    [JsonPropertyName("waliKelas")] public string? WaliKelas { get; set; }
    [JsonPropertyName("mapelId")] public string? MapelId { get; set; }
    [JsonPropertyName("mapel")] public string? Mapel { get; set; }
    [JsonPropertyName("kodeMapel")] public string? KodeMapel { get; set; }
}

public sealed class JadwalResponseDto
{
    [JsonPropertyName("rows")] public List<JadwalPelajaranDto> Rows { get; set; } = new();
    [JsonPropertyName("kelas")] public List<KelasOptionDto> Kelas { get; set; } = new();
    [JsonPropertyName("mapel")] public List<MapelOptionDto> Mapel { get; set; } = new();
    [JsonPropertyName("hariList")] public List<string> HariList { get; set; } = new();
}

public sealed class KelasOptionDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
}

public sealed class MapelOptionDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("kode")] public string? Kode { get; set; }
}

public sealed class SantriAdminDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nisNo")] public string? NisNo { get; set; }
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("keberadaan")] public string Keberadaan { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("tanggalMasuk")] public DateTime? TanggalMasuk { get; set; }
    [JsonPropertyName("catatan")] public string? Catatan { get; set; }
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("kelas")] public string? Kelas { get; set; }
    [JsonPropertyName("wali")] public WaliBriefDto? Wali { get; set; }
}

public sealed class SantriListResponseDto
{
    [JsonPropertyName("data")] public List<SantriAdminDto> Data { get; set; } = new();
    [JsonPropertyName("total")] public int Total { get; set; }
    [JsonPropertyName("page")] public int Page { get; set; }
    [JsonPropertyName("limit")] public int Limit { get; set; }
    [JsonPropertyName("totalPages")] public int TotalPages { get; set; }
    [JsonPropertyName("statistik")] public List<KeberadaanCountDto> Statistik { get; set; } = new();
}

public sealed class KeberadaanCountDto
{
    [JsonPropertyName("keberadaan")] public string Keberadaan { get; set; } = "";
    [JsonPropertyName("count")] public int Count { get; set; }
}

public sealed class SantriDetailDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nisNo")] public string? NisNo { get; set; }
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("keberadaan")] public string Keberadaan { get; set; } = "";
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("catatan")] public string? Catatan { get; set; }
    [JsonPropertyName("tanggalMasuk")] public DateTime? TanggalMasuk { get; set; }
    [JsonPropertyName("user")] public UserBriefDto? User { get; set; }
    [JsonPropertyName("walis")] public List<SantriWaliDto> Walis { get; set; } = new();
}

public sealed class UserBriefDto
{
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("isActive")] public bool IsActive { get; set; }
}

public sealed class SantriWaliDto
{
    [JsonPropertyName("isPrimary")] public bool IsPrimary { get; set; }
    [JsonPropertyName("wali")] public WaliBriefDto? Wali { get; set; }
}

public sealed class WaliBriefDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("hubungan")] public string Hubungan { get; set; } = "";
}

public sealed class SantriStatusLogDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("jenis")] public string Jenis { get; set; } = "";
    [JsonPropertyName("dari")] public string Dari { get; set; } = "";
    [JsonPropertyName("ke")] public string Ke { get; set; } = "";
    [JsonPropertyName("alasan")] public string? Alasan { get; set; }
    [JsonPropertyName("verifiedBy")] public string? VerifiedBy { get; set; }
    [JsonPropertyName("createdAt")] public DateTime CreatedAt { get; set; }
}

public sealed class WaliAdminDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("hubungan")] public string Hubungan { get; set; } = "";
    [JsonPropertyName("noTelp")] public string? NoTelp { get; set; }
    [JsonPropertyName("alamat")] public string? Alamat { get; set; }
    [JsonPropertyName("jumlahAnak")] public int JumlahAnak { get; set; }
}

public sealed class GelombangPpdbDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("unit")] public string? Unit { get; set; }
    [JsonPropertyName("jenjang")] public string? Jenjang { get; set; }
    [JsonPropertyName("program")] public string? Program { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("tanggalBuka")] public DateTime TanggalBuka { get; set; }
    [JsonPropertyName("tanggalTutup")] public DateTime TanggalTutup { get; set; }
    [JsonPropertyName("kuota")] public int? Kuota { get; set; }
    [JsonPropertyName("biayaDaftar")] public int? BiayaDaftar { get; set; }
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; set; }
    [JsonPropertyName("tahunAjaran")] public TahunAjaranBriefDto? TahunAjaran { get; set; }
    [JsonPropertyName("jalur")] public List<JalurPpdbDto> Jalur { get; set; } = new();
}

public sealed class TahunAjaranBriefDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
}

public sealed class JalurPpdbDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; set; }
    [JsonPropertyName("kuota")] public int? Kuota { get; set; }
    [JsonPropertyName("isActive")] public bool IsActive { get; set; }
}

public sealed class PpdbListResponseDto
{
    [JsonPropertyName("data")] public List<GelombangPpdbDto> Data { get; set; } = new();
    [JsonPropertyName("total")] public int Total { get; set; }
    [JsonPropertyName("page")] public int Page { get; set; }
    [JsonPropertyName("limit")] public int Limit { get; set; }
    [JsonPropertyName("totalPages")] public int TotalPages { get; set; }
    [JsonPropertyName("tahunAjaran")] public List<TahunAjaranBriefDto> TahunAjaran { get; set; } = new();
}

public sealed class IzinAntreanDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("santriId")] public string SantriId { get; set; } = "";
    [JsonPropertyName("jenis")] public string Jenis { get; set; } = "";
    [JsonPropertyName("alasan")] public string? Alasan { get; set; }
    [JsonPropertyName("rencanaKeluar")] public DateTime RencanaKeluar { get; set; }
    [JsonPropertyName("rencanaKembali")] public DateTime RencanaKembali { get; set; }
    [JsonPropertyName("alamatTujuan")] public string? AlamatTujuan { get; set; }
    [JsonPropertyName("namaPenjemput")] public string? NamaPenjemput { get; set; }
    [JsonPropertyName("hubunganPenjemput")] public string? HubunganPenjemput { get; set; }
    [JsonPropertyName("noTelpPenjemput")] public string? NoTelpPenjemput { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("suratNomor")] public string? SuratNomor { get; set; }
    [JsonPropertyName("santri")] public IzinSantriBriefDto? Santri { get; set; }

    /// <summary>
    /// Alasan penolakan yang diisi operator di kolom grid (client-side saja).
    /// Tidak dikirim/diterima API — hanya dipakai sebagai parameter TolakAsync.
    /// </summary>
    public string? AlasanTolak { get; set; }
}

public sealed class IzinSantriBriefDto
{
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("nisNo")] public string? NisNo { get; set; }
    [JsonPropertyName("asrama")] public NamaBriefDto? Asrama { get; set; }
    [JsonPropertyName("kamar")] public NamaBriefDto? Kamar { get; set; }
}

public sealed class NamaBriefDto
{
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
}

public sealed class IzinAntreanResponseDto
{
    [JsonPropertyName("rows")] public List<IzinAntreanDto> Rows { get; set; } = new();
}

public sealed class IzinStatistikDto
{
    [JsonPropertyName("totalSantri")] public int TotalSantri { get; set; }
    [JsonPropertyName("diPondok")] public int DiPondok { get; set; }
    [JsonPropertyName("izinAktif")] public int IzinAktif { get; set; }
    [JsonPropertyName("menunggu")] public int Menunggu { get; set; }
    [JsonPropertyName("sedangPulang")] public int SedangPulang { get; set; }
    [JsonPropertyName("terlambat")] public int Terlambat { get; set; }
}

public sealed class IzinRiwayatResponseDto
{
    [JsonPropertyName("data")] public List<IzinAntreanDto> Data { get; set; } = new();
    [JsonPropertyName("total")] public int Total { get; set; }
    [JsonPropertyName("page")] public int Page { get; set; }
    [JsonPropertyName("totalPages")] public int TotalPages { get; set; }
}

public sealed class PengaturanIzinDto
{
    [JsonPropertyName("jenis")] public string Jenis { get; set; } = "";
    [JsonPropertyName("butuhWali")] public bool ButuhWali { get; set; }
    [JsonPropertyName("butuhPengurus")] public bool ButuhPengurus { get; set; }
    [JsonPropertyName("butuhMusyrif")] public bool ButuhMusyrif { get; set; }
    [JsonPropertyName("butuhKepala")] public bool ButuhKepala { get; set; }
    [JsonPropertyName("butuhAdmin")] public bool ButuhAdmin { get; set; }
    [JsonPropertyName("aktif")] public bool Aktif { get; set; }
}

public sealed class PengaturanIzinResponseDto
{
    [JsonPropertyName("data")] public List<PengaturanIzinDto> Data { get; set; } = new();
}

public sealed class AsramaDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; set; }
    [JsonPropertyName("musyrif")] public WaliBriefDto? Musyrif { get; set; }
    [JsonPropertyName("kamars")] public List<KamarDto> Kamars { get; set; } = new();
}

public sealed class KamarDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("kapasitas")] public int? Kapasitas { get; set; }
}

public sealed class AsramaResponseDto
{
    [JsonPropertyName("rows")] public List<AsramaDto> Rows { get; set; } = new();
}

public sealed class GelombangPpdbCreateRequest
{
    [JsonPropertyName("tahunAjaranId")] public string TahunAjaranId { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("unit")] public string? Unit { get; set; }
    [JsonPropertyName("jenjang")] public string? Jenjang { get; set; }
    [JsonPropertyName("program")] public string? Program { get; set; }
    [JsonPropertyName("tanggalBuka")] public string TanggalBuka { get; set; } = "";
    [JsonPropertyName("tanggalTutup")] public string TanggalTutup { get; set; } = "";
    [JsonPropertyName("kuota")] public int? Kuota { get; set; }
    [JsonPropertyName("biayaDaftar")] public int? BiayaDaftar { get; set; }
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; set; }
}

public sealed class GelombangPpdbUpdateRequest
{
    [JsonPropertyName("nama")] public string? Nama { get; set; }
    [JsonPropertyName("unit")] public string? Unit { get; set; }
    [JsonPropertyName("jenjang")] public string? Jenjang { get; set; }
    [JsonPropertyName("program")] public string? Program { get; set; }
    [JsonPropertyName("tanggalBuka")] public string? TanggalBuka { get; set; }
    [JsonPropertyName("tanggalTutup")] public string? TanggalTutup { get; set; }
    [JsonPropertyName("kuota")] public int? Kuota { get; set; }
    [JsonPropertyName("biayaDaftar")] public int? BiayaDaftar { get; set; }
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; set; }
}
