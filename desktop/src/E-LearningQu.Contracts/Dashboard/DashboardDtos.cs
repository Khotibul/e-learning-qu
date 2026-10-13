using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Dashboard;

public sealed record KompetensiRingkasDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("skor")] public int Skor { get; init; }
    [JsonPropertyName("mapel")] public string? Mapel { get; init; }
}

public sealed record NextUjianDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("mapel")] public string? Mapel { get; init; }
    [JsonPropertyName("berakhir")] public DateTimeOffset? Berakhir { get; init; }
}

public sealed record PengumumanDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("judul")] public string Judul { get; init; } = "";
    [JsonPropertyName("isi")] public string? Isi { get; init; }
    [JsonPropertyName("author")] public string? Author { get; init; }
    [JsonPropertyName("createdAt")] public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>GET /api/mobile/siswa/dashboard — shape dari route backend.</summary>
public sealed record SiswaDashboardDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
    [JsonPropertyName("kelas")] public string Kelas { get; init; } = "";
    [JsonPropertyName("jurusan")] public string? Jurusan { get; init; }
    [JsonPropertyName("jabatan")] public string? Jabatan { get; init; }
    [JsonPropertyName("semester")] public string? Semester { get; init; }
    [JsonPropertyName("nilaiRataRata")] public double NilaiRataRata { get; init; }
    [JsonPropertyName("rataMastery")] public int RataMastery { get; init; }
    [JsonPropertyName("ujianAktif")] public int UjianAktif { get; init; }
    [JsonPropertyName("tugasAktif")] public int TugasAktif { get; init; }
    [JsonPropertyName("streak")] public int Streak { get; init; }
    [JsonPropertyName("jamBelajar")] public double JamBelajar { get; init; }
    [JsonPropertyName("progresBelajar")] public int ProgresBelajar { get; init; }
    [JsonPropertyName("totalMateri")] public int TotalMateri { get; init; }
    [JsonPropertyName("kompetensiTerkuat")] public KompetensiRingkasDto? KompetensiTerkuat { get; init; }
    [JsonPropertyName("kompetensiTerlemah")] public KompetensiRingkasDto? KompetensiTerlemah { get; init; }
    [JsonPropertyName("nextUjian")] public NextUjianDto? NextUjian { get; init; }
    [JsonPropertyName("aiInsight")] public string? AiInsight { get; init; }
    [JsonPropertyName("persentaseAbsensi")] public int PersentaseAbsensi { get; init; }
    [JsonPropertyName("keaktifanMateri")] public int KeaktifanMateri { get; init; }
    [JsonPropertyName("keaktifanAI")] public int KeaktifanAI { get; init; }
    [JsonPropertyName("keaktifanAplikasi")] public int KeaktifanAplikasi { get; init; }
    [JsonPropertyName("hadirAbsensi")] public int HadirAbsensi { get; init; }
    [JsonPropertyName("totalAbsensi")] public int TotalAbsensi { get; init; }
    [JsonPropertyName("materiDiakses")] public int MateriDiakses { get; init; }
    [JsonPropertyName("aiChatCount")] public int AiChatCount { get; init; }
    [JsonPropertyName("totalAktivitas")] public int TotalAktivitas { get; init; }
    [JsonPropertyName("pengumuman")] public List<PengumumanDto> Pengumuman { get; init; } = new();
}

/// <summary>GET /api/mobile/guru/dashboard — shape dari route backend.</summary>
public sealed record GuruDashboardDto
{
    [JsonPropertyName("kelasCount")] public int KelasCount { get; init; }
    [JsonPropertyName("mapelCount")] public int MapelCount { get; init; }
    [JsonPropertyName("siswaCount")] public int SiswaCount { get; init; }
    [JsonPropertyName("ujianAktif")] public int UjianAktif { get; init; }
    [JsonPropertyName("latihanAktif")] public int LatihanAktif { get; init; }
    [JsonPropertyName("totalSoal")] public int TotalSoal { get; init; }
    [JsonPropertyName("rataNilai")] public int RataNilai { get; init; }
    [JsonPropertyName("rataMastery")] public int RataMastery { get; init; }
}
