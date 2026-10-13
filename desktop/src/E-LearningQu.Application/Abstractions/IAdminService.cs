using E_LearningQu.Contracts.Admin;
using E_LearningQu.Contracts.Common;

namespace E_LearningQu.Application.Abstractions;

/// <summary>
/// API admin — semua lewat /api/mobile/admin/* (guard ADMIN, token auto-refresh).
/// Pola respons mengikuti audit route.ts: envelope paginasi, objek tunggal, atau array mentah.
/// </summary>
public interface IAdminService
{
    Task<AdminDashboardStatsDto> GetDashboardStatsAsync(CancellationToken ct = default);

    // ── Guru / Murid ──
    Task<PagedResult<AdminUserDto>> GetGurusAsync(string? search = null, int page = 1, int limit = 10, bool includeDeleted = false, CancellationToken ct = default);
    Task<AdminUserDto?> GetGuruAsync(string id, CancellationToken ct = default);
    Task<AdminUserDto?> CreateGuruAsync(AdminCreateUserRequest request, CancellationToken ct = default);
    Task<AdminUserDto?> UpdateGuruAsync(string id, AdminUpdateUserRequest request, CancellationToken ct = default);
    Task<bool> DeleteGuruAsync(string id, CancellationToken ct = default);
    Task<bool> RestoreGuruAsync(string id, CancellationToken ct = default);
    Task<bool> ResetGuruPasswordAsync(string id, CancellationToken ct = default);

    Task<PagedResult<AdminUserDto>> GetMuridsAsync(string? search = null, int page = 1, int limit = 10, bool includeDeleted = false, string? kelasId = null, CancellationToken ct = default);
    Task<AdminUserDto?> GetMuridAsync(string id, CancellationToken ct = default);
    Task<AdminUserDto?> CreateMuridAsync(AdminCreateUserRequest request, CancellationToken ct = default);
    Task<AdminUserDto?> UpdateMuridAsync(string id, AdminUpdateUserRequest request, CancellationToken ct = default);
    Task<bool> DeleteMuridAsync(string id, CancellationToken ct = default);
    Task<bool> RestoreMuridAsync(string id, CancellationToken ct = default);
    Task<bool> ResetMuridPasswordAsync(string id, CancellationToken ct = default);

    // ── Kelas ──
    Task<PagedResult<KelasDto>> GetKelassAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default);
    Task<KelasDto?> CreateKelasAsync(KelasCreateRequest request, CancellationToken ct = default);
    Task<KelasDto?> UpdateKelasAsync(string id, KelasUpdateRequest request, CancellationToken ct = default);
    Task<bool> DeleteKelasAsync(string id, CancellationToken ct = default);

    // ── Mapel ──
    Task<PagedResult<MapelDto>> GetMapelsAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default);
    Task<MapelDto?> CreateMapelAsync(MapelCreateRequest request, CancellationToken ct = default);
    Task<MapelDto?> UpdateMapelAsync(string id, MapelUpdateRequest request, CancellationToken ct = default);
    Task<bool> DeleteMapelAsync(string id, CancellationToken ct = default);
    Task<bool> AddPengajaranAsync(string mapelId, string guruId, string kelasId, CancellationToken ct = default);
    Task<bool> RemovePengajaranAsync(string mapelId, string pengajaranId, CancellationToken ct = default);

    // ── Tahun Ajaran ──
    Task<PagedResult<TahunAjaranDto>> GetTahunAjaransAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default);
    Task<TahunAjaranDto?> CreateTahunAjaranAsync(TahunAjaranCreateRequest request, CancellationToken ct = default);
    Task<TahunAjaranDto?> UpdateTahunAjaranAsync(string id, TahunAjaranUpdateRequest request, CancellationToken ct = default);
    Task<bool> DeleteTahunAjaranAsync(string id, CancellationToken ct = default);
    Task<bool> SetActiveTahunAjaranAsync(string id, CancellationToken ct = default);

    // ── Semester ──
    Task<PagedResult<SemesterDto>> GetSemestersAsync(string? search = null, int page = 1, int limit = 10, string? tahunAjaranId = null, CancellationToken ct = default);
    Task<SemesterDto?> CreateSemesterAsync(SemesterCreateRequest request, CancellationToken ct = default);
    Task<SemesterDto?> UpdateSemesterAsync(string id, SemesterUpdateRequest request, CancellationToken ct = default);
    Task<bool> DeleteSemesterAsync(string id, CancellationToken ct = default);
    Task<bool> SetActiveSemesterAsync(string id, CancellationToken ct = default);

    // ── Jurusan ──
    Task<PagedResult<JurusanDto>> GetJurussansAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default);
    Task<JurusanDto?> CreateJurusanAsync(JurusanCreateRequest request, CancellationToken ct = default);
    Task<JurusanDto?> UpdateJurusanAsync(string id, JurusanUpdateRequest request, CancellationToken ct = default);
    Task<bool> DeleteJurusanAsync(string id, CancellationToken ct = default);
    Task<List<JurusanSiswaDto>> GetJurusanSiswaAsync(string jurusanId, CancellationToken ct = default);
    Task<bool> AssignSiswaToJurusanAsync(string jurusanId, List<string> siswaIds, CancellationToken ct = default);

    // ── Kompetensi ──
    Task<PagedResult<KompetensiDto>> GetKompetensisAsync(string? search = null, int page = 1, int limit = 10, string? jurusanId = null, string? mapelId = null, CancellationToken ct = default);
    Task<KompetensiDto?> CreateKompetensiAsync(KompetensiCreateRequest request, CancellationToken ct = default);
    Task<KompetensiDto?> UpdateKompetensiAsync(string id, KompetensiUpdateRequest request, CancellationToken ct = default);
    Task<bool> DeleteKompetensiAsync(string id, CancellationToken ct = default);

    // ── Pengumuman ──
    Task<PagedResult<PengumumanDto>> GetPengumumenAsync(int page = 1, int limit = 10, CancellationToken ct = default);
    Task<PengumumanDto?> CreatePengumumanAsync(PengumumanCreateRequest request, CancellationToken ct = default);
    Task<bool> DeletePengumumanAsync(string id, CancellationToken ct = default);

    // ── Nilai (read-only) ──
    Task<PagedResult<AdminNilaiDto>> GetNilaisAsync(string? kelasId = null, string? mapelId = null, string? semesterId = null, int page = 1, int limit = 20, CancellationToken ct = default);

    // ── Statistik ──
    Task<StatistikGuruMuridDto> GetStatistikGuruMuridAsync(CancellationToken ct = default);
    Task<List<StatistikBarDto>> GetStatistikPerKelasAsync(CancellationToken ct = default);
    Task<List<StatistikBarDto>> GetStatistikPerMapelAsync(CancellationToken ct = default);

    // ── Refs ──
    Task<AdminRefsDto> GetRefsAsync(CancellationToken ct = default);
}
