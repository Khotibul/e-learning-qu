using E_LearningQu.Contracts.Academic;

namespace E_LearningQu.Application.Abstractions;

/// <summary>API akademik siswa — semua lewat backend mobile (token auto-refresh).</summary>
public interface IAkademikService
{
    Task<List<UjianListItemDto>> GetUjiansAsync(CancellationToken ct = default);
    Task<UjianDetailDto> GetUjianDetailAsync(string ujianId, CancellationToken ct = default);
    Task<UjianStartResponse> StartUjianAsync(string ujianId, CancellationToken ct = default);
    Task AutoSaveAsync(string ujianId, Dictionary<string, string> answers, List<string> raguRagu, CancellationToken ct = default);
    Task<SubmitUjianResponse> SubmitUjianAsync(string ujianId, Dictionary<string, string> answers, List<string> raguRagu, CancellationToken ct = default);
    Task<List<NilaiDto>> GetNilaiAsync(CancellationToken ct = default);
    Task<List<JadwalPelajaranDto>> GetJadwalAsync(CancellationToken ct = default);
    Task<List<MateriDto>> GetMateriAsync(CancellationToken ct = default);
    Task<KehadiranResponseDto> GetKehadiranAsync(string? bulan = null, CancellationToken ct = default);
    Task AjukanAbsensiAsync(string tanggal, string tipe, string alasan, CancellationToken ct = default);
}
