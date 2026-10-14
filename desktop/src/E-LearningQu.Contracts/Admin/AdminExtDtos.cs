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
