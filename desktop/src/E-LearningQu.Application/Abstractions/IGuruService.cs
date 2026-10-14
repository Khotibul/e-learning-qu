using E_LearningQu.Contracts.Teacher;

namespace E_LearningQu.Application.Abstractions;

/// <summary>
/// API guru — semua lewat /api/mobile/guru/* (token auto-refresh, permission dicek backend).
/// Pola respons mengikuti audit route.ts: kadang array polos, kadang object pembungkus.
/// </summary>
public interface IGuruService
{
    Task<GuruDashboardDto> GetDashboardAsync(CancellationToken ct = default);
    Task<List<GuruMuridDto>> GetMuridAsync(string? search = null, CancellationToken ct = default);
    Task<List<GuruSoalDto>> GetSoalAsync(string? search = null, CancellationToken ct = default);
    Task<GuruSoalDto?> CreateSoalAsync(object payload, CancellationToken ct = default);
    Task<bool> UpdateSoalAsync(object payload, CancellationToken ct = default);
    Task<bool> DeleteSoalAsync(string id, CancellationToken ct = default);

    Task<List<GuruUjianDto>> GetUjiansAsync(CancellationToken ct = default);
    Task<GuruUjianRefsDto?> GetUjianRefsAsync(CancellationToken ct = default);
    Task<GuruUjianDto?> CreateUjianAsync(object payload, CancellationToken ct = default);
    Task<bool> StartUjianAsync(string id, CancellationToken ct = default);
    Task<bool> StopUjianAsync(string id, CancellationToken ct = default);
    Task<bool> ResetUjianAsync(string id, CancellationToken ct = default);
    Task<bool> DeleteUjianAsync(string id, CancellationToken ct = default);

    Task<GuruAnalitikDto> GetAnalitikAsync(CancellationToken ct = default);
    Task<List<GuruMateriDto>> GetMateriAsync(CancellationToken ct = default);
    Task<bool> DeleteMateriAsync(string id, CancellationToken ct = default);

    Task<GuruNilaiResponseDto> GetNilaiAsync(CancellationToken ct = default);
    Task<List<GuruEssayDto>> GetEssaysAsync(string ujianId, CancellationToken ct = default);
    Task<bool> GradeEssayAsync(string jawabanUjianId, double nilai, string? komentar, CancellationToken ct = default);

    Task<AbsensiGuruDto> GetAbsensiAsync(string? tanggal = null, CancellationToken ct = default);
    Task<AbsensiGuruDto> SubmitAbsensiAsync(string? tanggal, string status, string? keterangan, CancellationToken ct = default);
    Task<AbsensiSiswaResponseDto> GetAbsensiSiswaAsync(string kelasId, string mataPelajaranId, string tanggal, CancellationToken ct = default);
    Task<bool> SubmitAbsensiSiswaAsync(string kelasId, string mataPelajaranId, string tanggal, List<(string siswaId, string status)> siswaStatus, CancellationToken ct = default);

    Task<GuruProfilDto?> GetProfilAsync(CancellationToken ct = default);
    Task<bool> UpdateProfilAsync(object payload, CancellationToken ct = default);
    Task<bool> UpdatePasswordAsync(string passwordLama, string passwordBaru, CancellationToken ct = default);

    Task<List<GuruJadwalDto>> GetJadwalAsync(string? tanggal = null, CancellationToken ct = default);
    Task<List<MapelDto>> GetMapelAsync(CancellationToken ct = default);

    Task<List<AntiCheatSessionDto>> GetAntiCheatAsync(CancellationToken ct = default);
    Task<List<IntervensiDto>> GetIntervensiAsync(CancellationToken ct = default);
    Task<List<PelanggaranDto>> GetPelanggaranAsync(CancellationToken ct = default);
    Task<TeacherAnalyticsResponseDto> GetTeacherAnalyticsAsync(CancellationToken ct = default);
    Task<AiKnowledgeResponseDto> GetAiKnowledgeAsync(CancellationToken ct = default);

    /// <summary>Struktur kelas wali (GET /guru/wali-kelas tanpa tab).</summary>
    Task<List<WaliKelasDto>> GetWaliKelasAsync(CancellationToken ct = default);
}