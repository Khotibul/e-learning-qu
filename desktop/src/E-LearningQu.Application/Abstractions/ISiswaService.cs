using E_LearningQu.Contracts.Siswa;

namespace E_LearningQu.Application.Abstractions;

/// <summary>
/// API siswa — semua lewat /api/mobile/siswa/* (token auto-refresh).
/// Pola respons mengikuti audit route.ts: array mentah, objek dibungkus, atau default [].
/// </summary>
public interface ISiswaService
{
    Task<SiswaDashboardDto> GetDashboardAsync(CancellationToken ct = default);

    Task<List<SiswaUjianDto>> GetUjiansAsync(CancellationToken ct = default);
    Task<SiswaUjianDetailDto?> GetUjianDetailAsync(string id, CancellationToken ct = default);
    Task<SiswaUjianStartDto?> StartUjianAsync(string id, CancellationToken ct = default);
    Task<SubmitUjianResponseDto?> SubmitUjianAsync(string id, Dictionary<string, string> answers, List<string> raguRagu, CancellationToken ct = default);
    Task<bool> AutoSaveAsync(string id, Dictionary<string, string> answers, List<string> raguRagu, CancellationToken ct = default);

    Task<List<SiswaUjianDto>> GetLatihanAsync(CancellationToken ct = default);
    Task<List<SiswaAbsensiDto>> GetAbsensiAsync(string? start = null, string? end = null, CancellationToken ct = default);
    Task<List<SiswaMateriDto>> GetMateriAsync(CancellationToken ct = default);
    Task<List<SiswaNilaiDto>> GetNilaiAsync(CancellationToken ct = default);
    Task<RankingResponseDto> GetRankingAsync(CancellationToken ct = default);

    Task<KehadiranResponseDto2> GetKehadiranAsync(string? bulan = null, CancellationToken ct = default);
    Task<bool> AjukanAbsensiAsync(string tanggal, string tipe, string alasan, CancellationToken ct = default);

    Task<ProfilBelajarDto?> GetProfilBelajarAsync(CancellationToken ct = default);
    Task<WarningsDto?> RefreshWarningsAsync(CancellationToken ct = default);

    Task<List<JadwalPiketDto>> GetJadwalPiketAsync(CancellationToken ct = default);
    Task<StrukturKelasDto?> GetStrukturKelasAsync(CancellationToken ct = default);
    Task<List<JadwalPelajaranSiswaDto>> GetJadwalPelajaranAsync(CancellationToken ct = default);

    Task<List<IuranSiswaDto>> GetIuranAsync(CancellationToken ct = default);
    Task<bool> BayarIuranAsync(string iuranId, double? nominal = null, string? keterangan = null, CancellationToken ct = default);

    Task<BendaharaSummaryDto?> GetBendaharaSummaryAsync(CancellationToken ct = default);
    Task<SekretarisPiketDto[]> GetSekretarisPiketAsync(CancellationToken ct = default);

    Task<SusResponseDto?> GetSusAsync(CancellationToken ct = default);
    Task<SusSubmitResponseDto?> SubmitSusAsync(double[] jawaban, string? komentar, CancellationToken ct = default);

    Task<AiAnalitikDto?> GetAiAnalitikAsync(CancellationToken ct = default);

    Task<List<TutorSessionDto>> GetTutorSessionsAsync(CancellationToken ct = default);
    Task<List<TutorMessageDto>> GetTutorMessagesAsync(string sessionId, CancellationToken ct = default);
    Task<List<TutorMapelDto>> GetTutorMapelAsync(CancellationToken ct = default);
    Task<TutorChatResponseDto?> SendTutorMessageAsync(TutorChatRequest request, CancellationToken ct = default);

    Task<SiswaProfilDto?> GetProfilAsync(CancellationToken ct = default);
    Task<SiswaProfilDto?> UpdateProfilAsync(object payload, CancellationToken ct = default);
    Task<bool> UpdatePasswordAsync(string passwordLama, string passwordBaru, CancellationToken ct = default);
}