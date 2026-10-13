using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Academic;

public sealed record NilaiDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("mapel")] public string Mapel { get; init; } = "";
    [JsonPropertyName("semester")] public string Semester { get; init; } = "";
    [JsonPropertyName("jenis")] public string Jenis { get; init; } = "";
    [JsonPropertyName("nilai")] public int Nilai { get; init; }
    [JsonPropertyName("keterangan")] public string? Keterangan { get; init; }
    [JsonPropertyName("tanggal")] public DateTimeOffset Tanggal { get; init; }
}

public sealed record MataPelajaranRefDto
{
    [JsonPropertyName("nama")] public string Nama { get; init; } = "";
}

public sealed record JadwalPelajaranDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("hari")] public string Hari { get; init; } = "";
    [JsonPropertyName("jamMulai")] public string JamMulai { get; init; } = "";
    [JsonPropertyName("jamSelesai")] public string JamSelesai { get; init; } = "";
    [JsonPropertyName("mataPelajaran")] public MataPelajaranRefDto? MataPelajaran { get; init; }
}

public sealed record MateriDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("judul")] public string Judul { get; init; } = "";
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; init; }
    [JsonPropertyName("fileUrl")] public string? FileUrl { get; init; }
    [JsonPropertyName("createdAt")] public DateTimeOffset CreatedAt { get; init; }
    [JsonPropertyName("mataPelajaran")] public MataPelajaranRefDto? MataPelajaran { get; init; }
}

public sealed record HariIniDto
{
    [JsonPropertyName("jamMasuk")] public string? JamMasuk { get; init; }
    [JsonPropertyName("jamPulang")] public string? JamPulang { get; init; }
    [JsonPropertyName("statusMasuk")] public string? StatusMasuk { get; init; }
    [JsonPropertyName("statusPulang")] public string? StatusPulang { get; init; }
}

public sealed record RekapKehadiranDto
{
    [JsonPropertyName("hariTercatat")] public int HariTercatat { get; init; }
    [JsonPropertyName("hadir")] public int Hadir { get; init; }
    [JsonPropertyName("terlambat")] public int Terlambat { get; init; }
    [JsonPropertyName("pulangAwal")] public int PulangAwal { get; init; }
    [JsonPropertyName("persenKehadiran")] public int PersenKehadiran { get; init; }
}

public sealed record AbsensiHarianRowDto
{
    [JsonPropertyName("tanggal")] public DateTime Tanggal { get; init; }
    [JsonPropertyName("jamMasuk")] public string? JamMasuk { get; init; }
    [JsonPropertyName("jamPulang")] public string? JamPulang { get; init; }
    [JsonPropertyName("statusMasuk")] public string? StatusMasuk { get; init; }
    [JsonPropertyName("statusPulang")] public string? StatusPulang { get; init; }
    [JsonPropertyName("terlambatMenit")] public int? TerlambatMenit { get; init; }
}

public sealed record PermintaanAbsensiDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("tanggal")] public string Tanggal { get; init; } = "";
    [JsonPropertyName("tipe")] public string Tipe { get; init; } = "";
    [JsonPropertyName("alasan")] public string? Alasan { get; init; }
    [JsonPropertyName("status")] public string Status { get; init; } = "";
    [JsonPropertyName("catatanAdmin")] public string? CatatanAdmin { get; init; }
}

public sealed record KehadiranResponseDto
{
    [JsonPropertyName("bulan")] public string Bulan { get; init; } = "";
    [JsonPropertyName("hariSekolah")] public int HariSekolah { get; init; }
    [JsonPropertyName("hariIni")] public HariIniDto? HariIni { get; init; }
    [JsonPropertyName("rekap")] public RekapKehadiranDto Rekap { get; init; } = new();
    [JsonPropertyName("rows")] public List<AbsensiHarianRowDto> Rows { get; init; } = new();
    [JsonPropertyName("permintaan")] public List<PermintaanAbsensiDto> Permintaan { get; init; } = new();
}

public sealed record AjukanAbsensiRequest
{
    [JsonPropertyName("tanggal")] public string Tanggal { get; init; } = "";
    [JsonPropertyName("tipe")] public string Tipe { get; init; } = "MASUK";
    [JsonPropertyName("alasan")] public string Alasan { get; init; } = "";
}
