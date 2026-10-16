using System.Text.Json;
using System.Text.Json.Nodes;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Admin;
using E_LearningQu.Contracts.Common;
using E_LearningQu.Domain.Identity;

namespace E_LearningQu.Application.Services;

/// <summary>
/// Semua endpoint /api/mobile/admin/* — guard ADMIN di server. Mengikuti pola respons audit route.ts:
/// envelope paginasi {data,total,page,limit,totalPages}, objek tunggal, atau array mentah.
/// </summary>
public sealed class AdminService : IAdminService
{
    private const string Base = "/api/mobile/admin";
    private static readonly JsonSerializerOptions Opts = new(JsonSerializerDefaults.Web);

    private readonly IBackendApiClient _api;
    private readonly ISessionManager _session;

    public AdminService(IBackendApiClient api, ISessionManager session)
    {
        _api = api;
        _session = session;
    }

    // ══════════════════ DASHBOARD ══════════════════

    public async Task<AdminDashboardStatsDto> GetDashboardStatsAsync(CancellationToken ct = default) =>
        await GetObjectAsync<AdminDashboardStatsDto>($"{Base}/dashboard", ct) ?? new AdminDashboardStatsDto();

    // ══════════════════ GURU ══════════════════

    public async Task<PagedResult<AdminUserDto>> GetGurusAsync(string? search = null, int page = 1, int limit = 10, bool includeDeleted = false, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        if (includeDeleted) qs.Add("includeDeleted=true");
        return await GetPagedAsync<AdminUserDto>($"{Base}/guru?{string.Join("&", qs)}", ct);
    }

    public Task<AdminUserDto?> GetGuruAsync(string id, CancellationToken ct = default) =>
        GetObjectAsync<AdminUserDto>($"{Base}/guru/{Uri.EscapeDataString(id)}", ct);

    public Task<AdminUserDto?> CreateGuruAsync(AdminCreateUserRequest request, CancellationToken ct = default) =>
        PostObjectAsync<AdminUserDto>($"{Base}/guru", request, ct);

    public Task<AdminUserDto?> UpdateGuruAsync(string id, AdminUpdateUserRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<AdminUserDto>($"{Base}/guru/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteGuruAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/guru/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<bool> RestoreGuruAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/guru/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "restore" }, ct);

    public async Task<bool> ResetGuruPasswordAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/guru/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "resetPassword" }, ct);

    // ══════════════════ MURID ══════════════════

    public async Task<PagedResult<AdminUserDto>> GetMuridsAsync(string? search = null, int page = 1, int limit = 10, bool includeDeleted = false, string? kelasId = null, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        if (includeDeleted) qs.Add("includeDeleted=true");
        if (!string.IsNullOrWhiteSpace(kelasId)) qs.Add($"kelasId={Uri.EscapeDataString(kelasId)}");
        return await GetPagedAsync<AdminUserDto>($"{Base}/murid?{string.Join("&", qs)}", ct);
    }

    public Task<AdminUserDto?> GetMuridAsync(string id, CancellationToken ct = default) =>
        GetObjectAsync<AdminUserDto>($"{Base}/murid/{Uri.EscapeDataString(id)}", ct);

    public Task<AdminUserDto?> CreateMuridAsync(AdminCreateUserRequest request, CancellationToken ct = default) =>
        PostObjectAsync<AdminUserDto>($"{Base}/murid", request, ct);

    public Task<AdminUserDto?> UpdateMuridAsync(string id, AdminUpdateUserRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<AdminUserDto>($"{Base}/murid/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteMuridAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/murid/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<bool> RestoreMuridAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/murid/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "restore" }, ct);

    public async Task<bool> ResetMuridPasswordAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/murid/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "resetPassword" }, ct);

    // ══════════════════ KELAS ══════════════════

    public async Task<PagedResult<KelasDto>> GetKelassAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        return await GetPagedAsync<KelasDto>($"{Base}/kelas?{string.Join("&", qs)}", ct);
    }

    public Task<KelasDto?> CreateKelasAsync(KelasCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<KelasDto>($"{Base}/kelas", request, ct);

    public Task<KelasDto?> UpdateKelasAsync(string id, KelasUpdateRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<KelasDto>($"{Base}/kelas/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteKelasAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/kelas/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    // ══════════════════ MAPEL ══════════════════

    public async Task<PagedResult<MapelDto>> GetMapelsAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        return await GetPagedAsync<MapelDto>($"{Base}/mapel?{string.Join("&", qs)}", ct);
    }

    public Task<MapelDto?> CreateMapelAsync(MapelCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<MapelDto>($"{Base}/mapel", request, ct);

    public Task<MapelDto?> UpdateMapelAsync(string id, MapelUpdateRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<MapelDto>($"{Base}/mapel/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteMapelAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/mapel/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<bool> AddPengajaranAsync(string mapelId, string guruId, string kelasId, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/mapel/{Uri.EscapeDataString(mapelId)}", new JsonObject
        {
            ["op"] = "addPengajaran",
            ["guruId"] = guruId,
            ["kelasId"] = kelasId,
        }, ct);

    public async Task<bool> RemovePengajaranAsync(string mapelId, string pengajaranId, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/mapel/{Uri.EscapeDataString(mapelId)}", new JsonObject
        {
            ["op"] = "removePengajaran",
            ["pengajaranId"] = pengajaranId,
        }, ct);

    // ══════════════════ TAHUN AJARAN ══════════════════

    public async Task<PagedResult<TahunAjaranDto>> GetTahunAjaransAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        return await GetPagedAsync<TahunAjaranDto>($"{Base}/tahun-ajaran?{string.Join("&", qs)}", ct);
    }

    public Task<TahunAjaranDto?> CreateTahunAjaranAsync(TahunAjaranCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<TahunAjaranDto>($"{Base}/tahun-ajaran", request, ct);

    public Task<TahunAjaranDto?> UpdateTahunAjaranAsync(string id, TahunAjaranUpdateRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<TahunAjaranDto>($"{Base}/tahun-ajaran/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteTahunAjaranAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/tahun-ajaran/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<bool> SetActiveTahunAjaranAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/tahun-ajaran/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "setActive" }, ct);

    // ══════════════════ SEMESTER ══════════════════

    public async Task<PagedResult<SemesterDto>> GetSemestersAsync(string? search = null, int page = 1, int limit = 10, string? tahunAjaranId = null, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        if (!string.IsNullOrWhiteSpace(tahunAjaranId)) qs.Add($"tahunAjaranId={Uri.EscapeDataString(tahunAjaranId)}");
        return await GetPagedAsync<SemesterDto>($"{Base}/semester?{string.Join("&", qs)}", ct);
    }

    public Task<SemesterDto?> CreateSemesterAsync(SemesterCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<SemesterDto>($"{Base}/semester", request, ct);

    public Task<SemesterDto?> UpdateSemesterAsync(string id, SemesterUpdateRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<SemesterDto>($"{Base}/semester/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteSemesterAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/semester/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<bool> SetActiveSemesterAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/semester/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "setActive" }, ct);

    // ══════════════════ JURUSAN ══════════════════

    public async Task<PagedResult<JurusanDto>> GetJurussansAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        return await GetPagedAsync<JurusanDto>($"{Base}/jurusan?{string.Join("&", qs)}", ct);
    }

    public Task<JurusanDto?> CreateJurusanAsync(JurusanCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<JurusanDto>($"{Base}/jurusan", request, ct);

    public Task<JurusanDto?> UpdateJurusanAsync(string id, JurusanUpdateRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<JurusanDto>($"{Base}/jurusan/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteJurusanAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/jurusan/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<List<JurusanSiswaDto>> GetJurusanSiswaAsync(string jurusanId, CancellationToken ct = default)
    {
        var element = await GetRawAsync($"{Base}/jurusan/{Uri.EscapeDataString(jurusanId)}", ct);
        return element.ValueKind == JsonValueKind.Array
            ? element.Deserialize<List<JurusanSiswaDto>>(Opts) ?? new List<JurusanSiswaDto>()
            : new List<JurusanSiswaDto>();
    }

    public async Task<bool> AssignSiswaToJurusanAsync(string jurusanId, List<string> siswaIds, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/jurusan/{Uri.EscapeDataString(jurusanId)}", new JsonObject
        {
            ["op"] = "assignSiswa",
            ["siswaIds"] = JsonSerializer.SerializeToNode(siswaIds, Opts)!,
        }, ct);

    // ══════════════════ KOMPETENSI ══════════════════

    public async Task<PagedResult<KompetensiDto>> GetKompetensisAsync(string? search = null, int page = 1, int limit = 10, string? jurusanId = null, string? mapelId = null, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        if (!string.IsNullOrWhiteSpace(jurusanId)) qs.Add($"jurusanId={Uri.EscapeDataString(jurusanId)}");
        if (!string.IsNullOrWhiteSpace(mapelId)) qs.Add($"mapelId={Uri.EscapeDataString(mapelId)}");
        return await GetPagedAsync<KompetensiDto>($"{Base}/kompetensi?{string.Join("&", qs)}", ct);
    }

    public Task<KompetensiDto?> CreateKompetensiAsync(KompetensiCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<KompetensiDto>($"{Base}/kompetensi", request, ct);

    public Task<KompetensiDto?> UpdateKompetensiAsync(string id, KompetensiUpdateRequest request, CancellationToken ct = default) =>
        PatchObjectAsync<KompetensiDto>($"{Base}/kompetensi/{Uri.EscapeDataString(id)}", request, ct);

    public async Task<bool> DeleteKompetensiAsync(string id, CancellationToken ct = default) =>
        await PatchSuccessAsync($"{Base}/kompetensi/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    // ══════════════════ PENGUMUMAN ══════════════════

    public async Task<PagedResult<PengumumanDto>> GetPengumumenAsync(int page = 1, int limit = 10, CancellationToken ct = default) =>
        await GetPagedAsync<PengumumanDto>($"{Base}/pengumuman?page={page}&limit={limit}", ct);

    public Task<PengumumanDto?> CreatePengumumanAsync(PengumumanCreateRequest request, CancellationToken ct = default) =>
        PostObjectAsync<PengumumanDto>($"{Base}/pengumuman", request, ct);

    public async Task<bool> DeletePengumumanAsync(string id, CancellationToken ct = default)
    {
        var element = await PatchRawAsync($"{Base}/pengumuman/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);
        return IsSuccess(element);
    }

    // ══════════════════ NILAI ══════════════════

    public async Task<PagedResult<AdminNilaiDto>> GetNilaisAsync(string? kelasId = null, string? mapelId = null, string? semesterId = null, int page = 1, int limit = 20, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(kelasId)) qs.Add($"kelasId={Uri.EscapeDataString(kelasId)}");
        if (!string.IsNullOrWhiteSpace(mapelId)) qs.Add($"mapelId={Uri.EscapeDataString(mapelId)}");
        if (!string.IsNullOrWhiteSpace(semesterId)) qs.Add($"semesterId={Uri.EscapeDataString(semesterId)}");
        return await GetPagedAsync<AdminNilaiDto>($"{Base}/nilai?{string.Join("&", qs)}", ct);
    }

    // ══════════════════ STATISTIK ══════════════════

    public async Task<StatistikGuruMuridDto> GetStatistikGuruMuridAsync(CancellationToken ct = default) =>
        await GetObjectAsync<StatistikGuruMuridDto>($"{Base}/statistik", ct) ?? new StatistikGuruMuridDto();

    public async Task<List<StatistikBarDto>> GetStatistikPerKelasAsync(CancellationToken ct = default) =>
        await GetListAsync<StatistikBarDto>($"{Base}/statistik/per-kelas", ct);

    public async Task<List<StatistikBarDto>> GetStatistikPerMapelAsync(CancellationToken ct = default) =>
        await GetListAsync<StatistikBarDto>($"{Base}/statistik/per-mapel", ct);

    // ══════════════════ REFS ══════════════════

    public async Task<AdminRefsDto> GetRefsAsync(CancellationToken ct = default) =>
        await GetObjectAsync<AdminRefsDto>($"{Base}/refs", ct) ?? new AdminRefsDto();

    // ══════════════════ PENGATURAN (site-config + features) ══════════════════

    public async Task<SiteConfigDto> GetSiteConfigAsync(CancellationToken ct = default) =>
        await GetObjectAsync<SiteConfigDto>($"{Base}/site-config", ct) ?? new SiteConfigDto();

    public async Task<SiteConfigDto?> SaveSiteConfigAsync(SiteConfigUpdateRequest request, CancellationToken ct = default) =>
        await PostObjectAsync<SiteConfigDto>($"{Base}/site-config", request, ct);

    public async Task<List<LandingFeatureDto>> GetFeaturesAsync(CancellationToken ct = default) =>
        await GetListAsync<LandingFeatureDto>($"{Base}/features", ct);

    public async Task<LandingFeatureDto?> SaveFeatureAsync(LandingFeatureRequest request, CancellationToken ct = default) =>
        await PostObjectAsync<LandingFeatureDto>($"{Base}/features", request, ct);

    public async Task<bool> DeleteFeatureAsync(string id, CancellationToken ct = default) =>
        await PostSuccessAsync($"{Base}/features", new JsonObject { ["op"] = "delete", ["id"] = id }, ct);

    // ══════════════════ JADWAL UJIAN ══════════════════

    public async Task<JadwalUjianAdminDto> GetJadwalUjianAsync(CancellationToken ct = default) =>
        await GetObjectAsync<JadwalUjianAdminDto>($"{Base}/jadwal-ujian", ct) ?? new JadwalUjianAdminDto();

    // ══════════════════ RESEARCHER ══════════════════

    public async Task<ResearcherOverviewDto> GetResearcherOverviewAsync(CancellationToken ct = default) =>
        await GetObjectAsync<ResearcherOverviewDto>($"{Base}/researcher", ct) ?? new ResearcherOverviewDto();

    // ══════════════════ COURSES ══════════════════

    public async Task<PagedResult<CourseAdminDto>> GetCoursesAsync(string? search = null, int page = 1, int limit = 20, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"q={Uri.EscapeDataString(search)}");
        return await GetPagedAsync<CourseAdminDto>($"{Base}/courses?{string.Join("&", qs)}", ct);
    }

    public async Task<CourseDetailDto?> GetCourseDetailAsync(string id, CancellationToken ct = default) =>
        await GetObjectAsync<CourseDetailDto>($"{Base}/courses/{Uri.EscapeDataString(id)}", ct);

    public async Task<CourseAdminDto?> CreateCourseAsync(string title, string? description, string mapelId, string guruId, CancellationToken ct = default) =>
        await PostObjectAsync<CourseAdminDto>($"{Base}/courses", new JsonObject { ["title"] = title, ["description"] = description, ["mapelId"] = mapelId, ["guruId"] = guruId }, ct);

    public async Task<bool> UpdateCourseAsync(string id, string? title, string? description, bool? isPublished, CancellationToken ct = default)
    {
        var payload = new JsonObject { ["op"] = "updateCourse" };
        if (title != null) payload["title"] = title;
        if (description != null) payload["description"] = description;
        if (isPublished != null) payload["isPublished"] = isPublished.Value;
        return await PatchSuccessAsync($"{Base}/courses/{Uri.EscapeDataString(id)}", payload, ct);
    }

    public async Task<bool> DeleteCourseAsync(string id, CancellationToken ct = default) =>
        await PostSuccessAsync($"{Base}/courses", new JsonObject { ["op"] = "delete", ["id"] = id }, ct);

    public Task<bool> CourseOpAsync(string id, string op, object payload, CancellationToken ct = default) =>
        PatchSuccessAsync($"{Base}/courses/{Uri.EscapeDataString(id)}", payload, ct);

    // ══════════════════ JADWAL PELAJARAN ══════════════════

    public async Task<JadwalResponseDto> GetJadwalAsync(string? kelasId = null, string? hari = null, CancellationToken ct = default)
    {
        var qs = new List<string>();
        if (!string.IsNullOrWhiteSpace(kelasId)) qs.Add($"kelasId={Uri.EscapeDataString(kelasId)}");
        if (!string.IsNullOrWhiteSpace(hari)) qs.Add($"hari={Uri.EscapeDataString(hari)}");
        var path = qs.Count > 0 ? $"{Base}/jadwal?{string.Join("&", qs)}" : $"{Base}/jadwal";
        return await GetObjectAsync<JadwalResponseDto>(path, ct) ?? new JadwalResponseDto();
    }

    public async Task<JadwalPelajaranDto?> CreateJadwalAsync(string kelasId, string mapelId, string hari, string jamMulai, string jamSelesai, CancellationToken ct = default) =>
        await PostObjectAsync<JadwalPelajaranDto>($"{Base}/jadwal", new JsonObject { ["kelasId"] = kelasId, ["mataPelajaranId"] = mapelId, ["hari"] = hari, ["jamMulai"] = jamMulai, ["jamSelesai"] = jamSelesai }, ct);

    public async Task<JadwalPelajaranDto?> UpdateJadwalAsync(string id, string kelasId, string mapelId, string hari, string jamMulai, string jamSelesai, CancellationToken ct = default) =>
        await PatchObjectAsync<JadwalPelajaranDto>($"{Base}/jadwal/{Uri.EscapeDataString(id)}", new JsonObject { ["kelasId"] = kelasId, ["mataPelajaranId"] = mapelId, ["hari"] = hari, ["jamMulai"] = jamMulai, ["jamSelesai"] = jamSelesai }, ct);

    public async Task<bool> DeleteJadwalAsync(string id, CancellationToken ct = default)
    {
        var element = await PatchRawAsync($"{Base}/jadwal/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);
        return IsSuccess(element);
    }

    public async Task<List<string>> CekBentrokJadwalAsync(string kelasId, string hari, string jamMulai, string jamSelesai, string? mapelId = null, string? excludeId = null, CancellationToken ct = default)
    {
        var payload = new JsonObject { ["op"] = "cekBentrok", ["kelasId"] = kelasId, ["hari"] = hari, ["jamMulai"] = jamMulai, ["jamSelesai"] = jamSelesai };
        if (mapelId != null) payload["mataPelajaranId"] = mapelId;
        if (excludeId != null) payload["excludeId"] = excludeId;
        var element = await PostRawAsync($"{Base}/jadwal", payload, ct);
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("masalah", out var m) || m.ValueKind != JsonValueKind.Array)
            return new List<string>();
        return m.Deserialize<List<string>>(Opts) ?? new List<string>();
    }

    // ══════════════════ SANTRI ══════════════════

    public async Task<SantriListResponseDto> GetSantrisAsync(string? search = null, int page = 1, int limit = 20, string? keberadaan = null, string? status = null, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"q={Uri.EscapeDataString(search)}");
        if (!string.IsNullOrWhiteSpace(keberadaan)) qs.Add($"keberadaan={Uri.EscapeDataString(keberadaan)}");
        if (!string.IsNullOrWhiteSpace(status)) qs.Add($"status={Uri.EscapeDataString(status)}");
        return await GetObjectAsync<SantriListResponseDto>($"{Base}/santri?{string.Join("&", qs)}", ct) ?? new SantriListResponseDto();
    }

    public async Task<SantriDetailDto?> GetSantriDetailAsync(string id, CancellationToken ct = default) =>
        await GetObjectAsync<SantriDetailDto>($"{Base}/santri/{Uri.EscapeDataString(id)}", ct);

    public Task<bool> CreateSantriDariSiswaAsync(string siswaId, string? nisNo, string? tanggalMasuk, string? catatan, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/santri", new JsonObject { ["op"] = "createDariSiswa", ["siswaId"] = siswaId, ["nisNo"] = nisNo, ["tanggalMasuk"] = tanggalMasuk, ["catatan"] = catatan }, ct);

    public Task<bool> CreateSantriNonformalAsync(string nama, string email, string password, string? nisNo, string? tanggalMasuk, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/santri", new JsonObject { ["op"] = "createNonformal", ["nama"] = nama, ["email"] = email, ["password"] = password, ["nisNo"] = nisNo, ["tanggalMasuk"] = tanggalMasuk }, ct);

    public Task<bool> UpdateSantriAsync(string id, string? nisNo, string? tanggalMasuk, string? catatan, string? status, string? alasan, CancellationToken ct = default)
    {
        var payload = new JsonObject { ["op"] = "update" };
        if (nisNo != null) payload["nisNo"] = nisNo;
        if (tanggalMasuk != null) payload["tanggalMasuk"] = tanggalMasuk;
        if (catatan != null) payload["catatan"] = catatan;
        if (status != null) payload["status"] = status;
        if (alasan != null) payload["alasan"] = alasan;
        return PatchSuccessAsync($"{Base}/santri/{Uri.EscapeDataString(id)}", payload, ct);
    }

    public Task<bool> UpdateKeberadaanSantriAsync(string id, string keberadaan, string? alasan, CancellationToken ct = default)
    {
        var payload = new JsonObject { ["op"] = "updateKeberadaan", ["keberadaan"] = keberadaan };
        if (alasan != null) payload["alasan"] = alasan;
        return PatchSuccessAsync($"{Base}/santri/{Uri.EscapeDataString(id)}", payload, ct);
    }

    public Task<bool> DeleteSantriAsync(string id, CancellationToken ct = default) =>
        PatchSuccessAsync($"{Base}/santri/{Uri.EscapeDataString(id)}", new JsonObject { ["op"] = "delete" }, ct);

    public async Task<List<SantriStatusLogDto>> GetSantriStatusLogAsync(string santriId, string? jenis = null, CancellationToken ct = default)
    {
        var path = $"{Base}/santri/{Uri.EscapeDataString(santriId)}/status-log" + (string.IsNullOrWhiteSpace(jenis) ? "" : $"?jenis={Uri.EscapeDataString(jenis)}");
        var element = await GetRawAsync(path, ct);
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("rows", out var r) || r.ValueKind != JsonValueKind.Array)
            return new List<SantriStatusLogDto>();
        return r.Deserialize<List<SantriStatusLogDto>>(Opts) ?? new List<SantriStatusLogDto>();
    }

    // ══════════════════ WALI ══════════════════

    public async Task<List<WaliAdminDto>> GetWalisAsync(string? search = null, CancellationToken ct = default)
    {
        var path = string.IsNullOrWhiteSpace(search) ? $"{Base}/wali" : $"{Base}/wali?q={Uri.EscapeDataString(search)}";
        var element = await GetRawAsync(path, ct);
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("rows", out var r) || r.ValueKind != JsonValueKind.Array)
            return new List<WaliAdminDto>();
        return r.Deserialize<List<WaliAdminDto>>(Opts) ?? new List<WaliAdminDto>();
    }

    public async Task<WaliAdminDto?> CreateWaliAsync(string nama, string hubungan, string? noTelp, string? alamat, CancellationToken ct = default) =>
        await PostObjectAsync<WaliAdminDto>($"{Base}/wali", new JsonObject { ["op"] = "create", ["nama"] = nama, ["hubungan"] = hubungan, ["noTelp"] = noTelp, ["alamat"] = alamat }, ct);

    public async Task<WaliAdminDto?> UpdateWaliAsync(string id, string? nama, string? hubungan, string? noTelp, string? alamat, CancellationToken ct = default)
    {
        var payload = new JsonObject();
        if (nama != null) payload["nama"] = nama;
        if (hubungan != null) payload["hubungan"] = hubungan;
        if (noTelp != null) payload["noTelp"] = noTelp;
        if (alamat != null) payload["alamat"] = alamat;
        return await PatchObjectAsync<WaliAdminDto>($"{Base}/wali/{Uri.EscapeDataString(id)}", payload, ct);
    }

    public Task<bool> DeleteWaliAsync(string id, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/wali", new JsonObject { ["op"] = "delete", ["id"] = id }, ct);

    public Task<bool> AssignWaliToSantriAsync(string santriId, string waliId, bool isPrimary, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/wali", new JsonObject { ["op"] = "assignToSantri", ["santriId"] = santriId, ["waliId"] = waliId, ["isPrimary"] = isPrimary }, ct);

    public Task<bool> UnassignWaliFromSantriAsync(string santriId, string waliId, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/wali", new JsonObject { ["op"] = "unassignFromSantri", ["santriId"] = santriId, ["waliId"] = waliId }, ct);

    // ══════════════════ PPDB ══════════════════

    public async Task<PpdbListResponseDto> GetGelombangsAsync(string? search = null, int page = 1, int limit = 10, string? status = null, string? tahunAjaranId = null, CancellationToken ct = default)
    {
        var qs = new List<string> { $"page={page}", $"limit={limit}" };
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"q={Uri.EscapeDataString(search)}");
        if (!string.IsNullOrWhiteSpace(status)) qs.Add($"status={Uri.EscapeDataString(status)}");
        if (!string.IsNullOrWhiteSpace(tahunAjaranId)) qs.Add($"tahunAjaranId={Uri.EscapeDataString(tahunAjaranId)}");
        return await GetObjectAsync<PpdbListResponseDto>($"{Base}/ppdb?{string.Join("&", qs)}", ct) ?? new PpdbListResponseDto();
    }

    public async Task<GelombangPpdbDto?> CreateGelombangAsync(GelombangPpdbCreateRequest request, CancellationToken ct = default)
    {
        var payload = new JsonObject
        {
            ["op"] = "createGelombang",
            ["tahunAjaranId"] = request.TahunAjaranId,
            ["nama"] = request.Nama,
            ["unit"] = request.Unit,
            ["jenjang"] = request.Jenjang,
            ["program"] = request.Program,
            ["tanggalBuka"] = request.TanggalBuka,
            ["tanggalTutup"] = request.TanggalTutup,
            ["deskripsi"] = request.Deskripsi,
        };
        if (request.Kuota != null) payload["kuota"] = request.Kuota.Value;
        if (request.BiayaDaftar != null) payload["biayaDaftar"] = request.BiayaDaftar.Value;
        return await PostObjectAsync<GelombangPpdbDto>($"{Base}/ppdb", payload, ct);
    }

    public async Task<GelombangPpdbDto?> UpdateGelombangAsync(string id, GelombangPpdbUpdateRequest request, CancellationToken ct = default) =>
        await PatchObjectAsync<GelombangPpdbDto>($"{Base}/ppdb/{Uri.EscapeDataString(id)}", request, ct);

    public Task<bool> UpdateStatusGelombangAsync(string id, string status, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/ppdb", new JsonObject { ["op"] = "updateStatus", ["id"] = id, ["status"] = status }, ct);

    public Task<bool> DeleteGelombangAsync(string id, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/ppdb", new JsonObject { ["op"] = "deleteGelombang", ["id"] = id }, ct);

    public async Task<JalurPpdbDto?> CreateJalurAsync(string gelombangId, string nama, string? deskripsi, int? kuota, CancellationToken ct = default)
    {
        var payload = new JsonObject { ["op"] = "createJalur", ["gelombangId"] = gelombangId, ["nama"] = nama };
        if (deskripsi != null) payload["deskripsi"] = deskripsi;
        if (kuota != null) payload["kuota"] = kuota.Value;
        return await PostObjectAsync<JalurPpdbDto>($"{Base}/ppdb", payload, ct);
    }

    public Task<bool> UpdateJalurAsync(string id, string? nama, string? deskripsi, int? kuota, bool? isActive, CancellationToken ct = default)
    {
        var payload = new JsonObject { ["op"] = "updateJalur", ["jalurId"] = id };
        if (nama != null) payload["nama"] = nama;
        if (deskripsi != null) payload["deskripsi"] = deskripsi;
        if (kuota != null) payload["kuota"] = kuota.Value;
        if (isActive != null) payload["isActive"] = isActive.Value;
        return PatchSuccessAsync($"{Base}/ppdb/{Uri.EscapeDataString(id)}", payload, ct);
    }

    public Task<bool> DeleteJalurAsync(string id, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/ppdb", new JsonObject { ["op"] = "deleteJalur", ["id"] = id }, ct);

    // ══════════════════ IZIN (ADMIN) ══════════════════

    public async Task<IzinAntreanResponseDto> GetIzinAntreanAsync(CancellationToken ct = default) =>
        await GetObjectAsync<IzinAntreanResponseDto>($"{Base}/izin?view=antrean", ct) ?? new IzinAntreanResponseDto();

    public async Task<IzinStatistikDto> GetIzinStatistikAsync(CancellationToken ct = default) =>
        await GetObjectAsync<IzinStatistikDto>($"{Base}/izin?view=statistik", ct) ?? new IzinStatistikDto();

    public async Task<IzinRiwayatResponseDto> GetIzinRiwayatAsync(string? santriId = null, string? asramaId = null, string? status = null, int page = 1, CancellationToken ct = default)
    {
        var qs = new List<string> { $"view=riwayat", $"page={page}" };
        if (!string.IsNullOrWhiteSpace(santriId)) qs.Add($"santriId={Uri.EscapeDataString(santriId)}");
        if (!string.IsNullOrWhiteSpace(asramaId)) qs.Add($"asramaId={Uri.EscapeDataString(asramaId)}");
        if (!string.IsNullOrWhiteSpace(status)) qs.Add($"status={Uri.EscapeDataString(status)}");
        return await GetObjectAsync<IzinRiwayatResponseDto>($"{Base}/izin?{string.Join("&", qs)}", ct) ?? new IzinRiwayatResponseDto();
    }

    public async Task<PengaturanIzinResponseDto> GetPengaturanIzinAsync(CancellationToken ct = default) =>
        await GetObjectAsync<PengaturanIzinResponseDto>($"{Base}/izin?view=pengaturan", ct) ?? new PengaturanIzinResponseDto();

    public Task<bool> SetujuiIzinAsync(string izinId, string? catatan, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/izin", new JsonObject { ["op"] = "setujui", ["izinId"] = izinId, ["catatan"] = catatan }, ct);

    public Task<bool> TolakIzinAsync(string izinId, string alasan, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/izin", new JsonObject { ["op"] = "tolak", ["izinId"] = izinId, ["alasan"] = alasan }, ct);

    public async Task<bool> SimpanPengaturanIzinAsync(PengaturanIzinDto cfg, CancellationToken ct = default) =>
        await PostSuccessAsync($"{Base}/izin", new JsonObject
        {
            ["op"] = "simpanPengaturan",
            ["jenis"] = cfg.Jenis,
            ["butuhWali"] = cfg.ButuhWali,
            ["butuhPengurus"] = cfg.ButuhPengurus,
            ["butuhMusyrif"] = cfg.ButuhMusyrif,
            ["butuhKepala"] = cfg.ButuhKepala,
            ["butuhAdmin"] = cfg.ButuhAdmin,
            ["aktif"] = cfg.Aktif,
        }, ct);

    public async Task<AsramaResponseDto> GetAsramaAsync(CancellationToken ct = default) =>
        await GetObjectAsync<AsramaResponseDto>($"{Base}/izin?view=asrama", ct) ?? new AsramaResponseDto();

    public async Task<AsramaDto?> CreateAsramaAsync(string nama, string? deskripsi, string? musyrifId, CancellationToken ct = default)
    {
        var payload = new JsonObject { ["op"] = "createAsrama", ["nama"] = nama };
        if (deskripsi != null) payload["deskripsi"] = deskripsi;
        if (musyrifId != null) payload["musyrifId"] = musyrifId;
        return await PostObjectAsync<AsramaDto>($"{Base}/izin", payload, ct);
    }

    public async Task<KamarDto?> CreateKamarAsync(string asramaId, string nama, int? kapasitas, CancellationToken ct = default)
    {
        var payload = new JsonObject { ["op"] = "createKamar", ["asramaId"] = asramaId, ["nama"] = nama };
        if (kapasitas != null) payload["kapasitas"] = kapasitas.Value;
        return await PostObjectAsync<KamarDto>($"{Base}/izin", payload, ct);
    }

    public Task<bool> AssignTempatSantriAsync(string santriId, string? asramaId, string? kamarId, CancellationToken ct = default)
    {
        var payload = new JsonObject { ["op"] = "assignTempat", ["santriId"] = santriId };
        if (asramaId != null) payload["asramaId"] = asramaId;
        if (kamarId != null) payload["kamarId"] = kamarId;
        return PostSuccessAsync($"{Base}/izin", payload, ct);
    }

    // ══════════════════ SISWA DOMPET ══════════════════

    private static string SiswaPath(string suffix) => $"/api/mobile/siswa{suffix}";
    private static string MusyrifPath(string suffix) => $"/api/mobile/guru/izin-musyrif{suffix}";
    private static string KantinPath(string suffix) => $"/api/mobile/kantin{suffix}";

    public async Task<DompetSayaDto> GetDompetSayaAsync(CancellationToken ct = default) =>
        await GetObjectAsync<DompetSayaDto>(SiswaPath("/dompet"), ct) ?? new DompetSayaDto();

    public async Task<KantinRiwayatResponseDto> GetRiwayatKantinSayaAsync(CancellationToken ct = default) =>
        await GetObjectAsync<KantinRiwayatResponseDto>(SiswaPath("/dompet?view=riwayat"), ct) ?? new KantinRiwayatResponseDto();

    public async Task<TagihanResponseDto> GetTagihanSayaAsync(CancellationToken ct = default) =>
        await GetObjectAsync<TagihanResponseDto>(SiswaPath("/dompet?view=tagihan"), ct) ?? new TagihanResponseDto();

    // ══════════════════ SANTRI IZIN (siswa side) ══════════════════

    public async Task<IzinSayaResponseDto> GetIzinSayaAsync(CancellationToken ct = default) =>
        await GetObjectAsync<IzinSayaResponseDto>(SiswaPath("/izin"), ct) ?? new IzinSayaResponseDto();

    public Task<bool> AjukanIzinAsync(IzinAjukanRequest request, CancellationToken ct = default)
    {
        var payload = new JsonObject
        {
            ["op"] = "ajukan",
            ["jenis"] = request.Jenis,
            ["alasan"] = request.Alasan,
            ["rencanaKeluar"] = request.RencanaKeluar,
            ["rencanaKembali"] = request.RencanaKembali,
            ["alamatTujuan"] = request.AlamatTujuan,
            ["namaPenjemput"] = request.NamaPenjemput,
            ["hubunganPenjemput"] = request.HubunganPenjemput,
            ["noTelpPenjemput"] = request.NoTelpPenjemput,
        };
        if (request.LampiranId != null) payload["lampiranId"] = request.LampiranId;
        if (request.DraftId != null) payload["draftId"] = request.DraftId;
        return PostSuccessAsync(SiswaPath("/izin"), payload, ct);
    }

    public Task<bool> DraftIzinAsync(IzinAjukanRequest request, CancellationToken ct = default)
    {
        var payload = new JsonObject
        {
            ["op"] = "draft",
            ["jenis"] = request.Jenis,
            ["alasan"] = request.Alasan,
            ["rencanaKeluar"] = request.RencanaKeluar,
            ["rencanaKembali"] = request.RencanaKembali,
            ["alamatTujuan"] = request.AlamatTujuan,
            ["namaPenjemput"] = request.NamaPenjemput,
            ["hubunganPenjemput"] = request.HubunganPenjemput,
            ["noTelpPenjemput"] = request.NoTelpPenjemput,
        };
        if (request.LampiranId != null) payload["lampiranId"] = request.LampiranId;
        if (request.DraftId != null) payload["draftId"] = request.DraftId;
        return PostSuccessAsync(SiswaPath("/izin"), payload, ct);
    }

    public Task<bool> BatalIzinAsync(string izinId, string alasan, CancellationToken ct = default) =>
        PostSuccessAsync(SiswaPath("/izin"), new JsonObject { ["op"] = "batal", ["izinId"] = izinId, ["alasan"] = alasan }, ct);

    // ══════════════════ IZIN MUSYRIF (guru) ══════════════════

    public async Task<IzinAntreanResponseDto> GetIzinMusyrifAntreanAsync(CancellationToken ct = default) =>
        await GetObjectAsync<IzinAntreanResponseDto>(MusyrifPath("?view=antrean"), ct) ?? new IzinAntreanResponseDto();

    public async Task<MusyrifMonitoringDto> GetMusyrifMonitoringAsync(CancellationToken ct = default) =>
        await GetObjectAsync<MusyrifMonitoringDto>(MusyrifPath("?view=monitoring"), ct) ?? new MusyrifMonitoringDto();

    public async Task<IzinRiwayatResponseDto> GetIzinMusyrifRiwayatAsync(int page = 1, CancellationToken ct = default) =>
        await GetObjectAsync<IzinRiwayatResponseDto>(MusyrifPath($"?view=riwayat&page={page}"), ct) ?? new IzinRiwayatResponseDto();

    public Task<bool> SetujuiIzinMusyrifAsync(string izinId, string? catatan, CancellationToken ct = default) =>
        PostSuccessAsync(MusyrifPath(""), new JsonObject { ["op"] = "setujui", ["izinId"] = izinId, ["catatan"] = catatan }, ct);

    public Task<bool> TolakIzinMusyrifAsync(string izinId, string alasan, CancellationToken ct = default) =>
        PostSuccessAsync(MusyrifPath(""), new JsonObject { ["op"] = "tolak", ["izinId"] = izinId, ["alasan"] = alasan }, ct);

    // ══════════════════ KANTIN (kasir) ══════════════════

    public async Task<List<KantinOutletDto>> GetKantinOutletsAsync(CancellationToken ct = default)
    {
        var element = await GetRawAsync(KantinPath("?view=outlet"), ct);
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("rows", out var r) || r.ValueKind != JsonValueKind.Array)
            return new List<KantinOutletDto>();
        return r.Deserialize<List<KantinOutletDto>>(Opts) ?? new List<KantinOutletDto>();
    }

    public async Task<List<KantinProdukDto>> GetKantinProdukAsync(string outletId, CancellationToken ct = default)
    {
        var element = await GetRawAsync(KantinPath($"?view=produk&outletId={Uri.EscapeDataString(outletId)}"), ct);
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("rows", out var r) || r.ValueKind != JsonValueKind.Array)
            return new List<KantinProdukDto>();
        return r.Deserialize<List<KantinProdukDto>>(Opts) ?? new List<KantinProdukDto>();
    }

    public async Task<KantinShiftDto?> GetKantinShiftAktifAsync(string outletId, CancellationToken ct = default)
    {
        var element = await GetRawAsync(KantinPath($"?view=shift&outletId={Uri.EscapeDataString(outletId)}"), ct);
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("row", out var r) || r.ValueKind != JsonValueKind.Object)
            return null;
        return r.Deserialize<KantinShiftDto>(Opts);
    }

    public async Task<string?> BukaShiftAsync(string outletId, int saldoAwal, CancellationToken ct = default)
    {
        var element = await PostRawAsync(KantinPath(""), new JsonObject { ["op"] = "bukaShift", ["outletId"] = outletId, ["saldoAwal"] = saldoAwal }, ct);
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("shiftId", out var s) || s.ValueKind != JsonValueKind.String)
            return null;
        return s.GetString();
    }

    public Task<bool> TutupShiftAsync(string shiftId, int kasAkhir, string? catatan, CancellationToken ct = default) =>
        PostSuccessAsync(KantinPath(""), new JsonObject { ["op"] = "tutupShift", ["shiftId"] = shiftId, ["kasAkhir"] = kasAkhir, ["catatan"] = catatan }, ct);

    public async Task<KantinCheckoutResultDto?> CheckoutKantinAsync(KantinCheckoutRequest request, CancellationToken ct = default)
    {
        var items = new JsonArray();
        foreach (var i in request.Items)
            items.Add(new JsonObject { ["produkId"] = i.ProdukId, ["qty"] = i.Qty });
        var payload = new JsonObject
        {
            ["op"] = "checkout",
            ["outletId"] = request.OutletId,
            ["items"] = items,
            ["metode"] = request.Metode,
            ["diskon"] = request.Diskon,
        };
        if (request.ShiftId != null) payload["shiftId"] = request.ShiftId;
        if (request.AccountId != null) payload["accountId"] = request.AccountId;
        var element = await PostRawAsync(KantinPath(""), payload, ct);
        if (element.ValueKind != JsonValueKind.Object || element.TryGetProperty("error", out _))
            return null;
        return element.Deserialize<KantinCheckoutResultDto>(Opts);
    }

    public Task<bool> BatalTransaksiKantinAsync(string transaksiId, string alasan, CancellationToken ct = default) =>
        PostSuccessAsync(KantinPath(""), new JsonObject { ["op"] = "batal", ["transaksiId"] = transaksiId, ["alasan"] = alasan }, ct);

    public async Task<List<KantinTransaksiDto>> GetRiwayatShiftAsync(string shiftId, CancellationToken ct = default)
    {
        var element = await GetRawAsync(KantinPath($"?view=riwayat&shiftId={Uri.EscapeDataString(shiftId)}"), ct);
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("rows", out var r) || r.ValueKind != JsonValueKind.Array)
            return new List<KantinTransaksiDto>();
        return r.Deserialize<List<KantinTransaksiDto>>(Opts) ?? new List<KantinTransaksiDto>();
    }

    // ══════════════════ ABSENSI GURU ══════════════════

    public async Task<AbsensiGuruMonitoringDto> GetAbsensiGuruMonitoringAsync(string? tanggal = null, string? search = null, CancellationToken ct = default)
    {
        var qs = new List<string> { "view=monitoring" };
        if (!string.IsNullOrWhiteSpace(tanggal)) qs.Add($"tanggal={Uri.EscapeDataString(tanggal)}");
        if (!string.IsNullOrWhiteSpace(search)) qs.Add($"search={Uri.EscapeDataString(search)}");
        return await GetObjectAsync<AbsensiGuruMonitoringDto>($"{Base}/absensi-guru?{string.Join("&", qs)}", ct) ?? new AbsensiGuruMonitoringDto();
    }

    public async Task<AbsensiGuruRekapDto> GetAbsensiGuruRekapAsync(string start, string end, CancellationToken ct = default) =>
        await GetObjectAsync<AbsensiGuruRekapDto>($"{Base}/absensi-guru?view=rekap&start={Uri.EscapeDataString(start)}&end={Uri.EscapeDataString(end)}", ct)
        ?? new AbsensiGuruRekapDto();

    public Task<List<PenggantiDto>> GetPenggantiListAsync(string? tanggal = null, CancellationToken ct = default)
    {
        var qs = new List<string> { "view=pengganti" };
        if (!string.IsNullOrWhiteSpace(tanggal)) qs.Add($"tanggal={Uri.EscapeDataString(tanggal)}");
        return GetListAsync<PenggantiDto>($"{Base}/absensi-guru?{string.Join("&", qs)}", ct);
    }

    public async Task<AbsensiGuruPendukungDto> GetAbsensiGuruPendukungAsync(CancellationToken ct = default) =>
        await GetObjectAsync<AbsensiGuruPendukungDto>($"{Base}/absensi-guru?view=pendukung", ct) ?? new AbsensiGuruPendukungDto();

    public async Task<bool> KoreksiAbsensiGuruAsync(string? sesiId, string? guruId, string? jadwalPelajaranId, string? tanggal, string status, string alasan, CancellationToken ct = default)
    {
        var body = new JsonObject { ["op"] = "koreksi", ["status"] = status, ["alasan"] = alasan };
        if (!string.IsNullOrWhiteSpace(sesiId)) body["sesiId"] = sesiId;
        if (!string.IsNullOrWhiteSpace(guruId)) body["guruId"] = guruId;
        if (!string.IsNullOrWhiteSpace(jadwalPelajaranId)) body["jadwalPelajaranId"] = jadwalPelajaranId;
        if (!string.IsNullOrWhiteSpace(tanggal)) body["tanggal"] = tanggal;
        return await PostSuccessAsync($"{Base}/absensi-guru", body, ct);
    }

    public Task<bool> HapusPenggantiAsync(string id, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/absensi-guru", new JsonObject { ["op"] = "hapusPengganti", ["id"] = id }, ct);

    // ══════════════════ FINGERPRINT ══════════════════

    public Task<List<PerangkatFpDto>> GetPerangkatFpAsync(CancellationToken ct = default) =>
        GetListAsync<PerangkatFpDto>($"{Base}/fingerprint?view=perangkat", ct);

    public Task<List<PemetaanFpDto>> GetPemetaanFpAsync(string perangkatId, CancellationToken ct = default) =>
        GetListAsync<PemetaanFpDto>($"{Base}/fingerprint?view=pemetaan&perangkatId={Uri.EscapeDataString(perangkatId)}", ct);

    public Task<List<SiswaCariDto>> CariSiswaFpAsync(string q, CancellationToken ct = default) =>
        GetListAsync<SiswaCariDto>($"{Base}/fingerprint?view=cari-siswa&q={Uri.EscapeDataString(q)}", ct);

    public async Task<MonitoringHarianDto> GetMonitoringHarianAsync(string? tanggal = null, string? q = null, CancellationToken ct = default)
    {
        var qs = new List<string> { "view=monitoring" };
        if (!string.IsNullOrWhiteSpace(tanggal)) qs.Add($"tanggal={Uri.EscapeDataString(tanggal)}");
        if (!string.IsNullOrWhiteSpace(q)) qs.Add($"q={Uri.EscapeDataString(q)}");
        return await GetObjectAsync<MonitoringHarianDto>($"{Base}/fingerprint?{string.Join("&", qs)}", ct) ?? new MonitoringHarianDto();
    }

    public Task<List<EventFpDto>> GetFpEventsAsync(string? tanggal = null, CancellationToken ct = default)
    {
        var qs = new List<string> { "view=events" };
        if (!string.IsNullOrWhiteSpace(tanggal)) qs.Add($"tanggal={Uri.EscapeDataString(tanggal)}");
        return GetListAsync<EventFpDto>($"{Base}/fingerprint?{string.Join("&", qs)}", ct);
    }

    public Task<List<PermintaanManualFpDto>> GetPermintaanManualAsync(CancellationToken ct = default) =>
        GetListAsync<PermintaanManualFpDto>($"{Base}/fingerprint?view=permintaan", ct);

    public Task<PerangkatBaruDto?> BuatPerangkatFpAsync(string nama, string? lokasi, CancellationToken ct = default) =>
        PostObjectAsync<PerangkatBaruDto>($"{Base}/fingerprint", new JsonObject { ["op"] = "buatPerangkat", ["nama"] = nama, ["lokasi"] = lokasi }, ct);

    public async Task<bool> UbahPerangkatFpAsync(string id, string? nama, string? lokasi, string? status, CancellationToken ct = default)
    {
        var body = new JsonObject { ["op"] = "ubahPerangkat", ["id"] = id };
        if (nama != null) body["nama"] = nama;
        if (lokasi != null) body["lokasi"] = lokasi;
        if (status != null) body["status"] = status;
        return await PostSuccessAsync($"{Base}/fingerprint", body, ct);
    }

    public Task<bool> HapusPerangkatFpAsync(string id, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/fingerprint", new JsonObject { ["op"] = "hapusPerangkat", ["id"] = id }, ct);

    public async Task<string?> RotasiApiKeyFpAsync(string id, CancellationToken ct = default)
    {
        var element = await PostRawAsync($"{Base}/fingerprint", new JsonObject { ["op"] = "rotasiApiKey", ["id"] = id }, ct);
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("apiKey", out var key))
            return null;
        return key.GetString();
    }

    public Task<bool> TambahPemetaanFpAsync(string perangkatId, string siswaId, string perangkatUserId, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/fingerprint", new JsonObject
        {
            ["op"] = "tambahPemetaan",
            ["perangkatId"] = perangkatId,
            ["siswaId"] = siswaId,
            ["perangkatUserId"] = perangkatUserId,
        }, ct);

    public Task<bool> HapusPemetaanFpAsync(string id, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/fingerprint", new JsonObject { ["op"] = "hapusPemetaan", ["id"] = id }, ct);

    public Task<bool> PutuskanPermintaanManualAsync(string permintaanId, string putusan, string? catatan, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/fingerprint", new JsonObject
        {
            ["op"] = "putuskanPermintaan",
            ["permintaanId"] = permintaanId,
            ["putusan"] = putusan,
            ["catatan"] = catatan,
        }, ct);

    /// <summary>Unduh foto/thumbnail paralel ke FotoCache. Dijalankan sebelum baris
    /// ditambahkan ke ObservableCollection supaya binding converter langsung punya
    /// biner. Tidak PERNAH melempar (foto dekoratif; kegagalan = kolom foto kosong).</summary>
    public async Task PreloadFotoAsync(IEnumerable<string?> urls, CancellationToken ct = default)
    {
        try
        {
            var antre = urls
                .Where(u => !string.IsNullOrWhiteSpace(u))
                .Select(u => u!)
                .Distinct()
                .Where(u => !FotoCache.Contains(u))
                .ToList();
            if (antre.Count == 0) return;

            var token = _session.Current?.Token;
            if (string.IsNullOrWhiteSpace(token)) return;

            await Parallel.ForEachAsync(
                antre,
                new ParallelOptions { MaxDegreeOfParallelism = 6, CancellationToken = ct },
                async (url, innerCt) =>
                {
                    try
                    {
                        var bytes = await _api.GetBytesAsync(url, token, innerCt);
                        if (bytes is { Length: > 0 }) FotoCache.Put(url, bytes);
                    }
                    catch { /* foto dekoratif — abaikan */ }
                });
        }
        catch { /* kontrak: tak boleh merusak muat tabel */ }
    }

    // ══════════════════ KEUANGAN (BENDAHARA) ══════════════════

    public async Task<KeuanganDashboardDto> GetKeuanganDashboardAsync(CancellationToken ct = default) =>
        await GetObjectAsync<KeuanganDashboardDto>($"{Base}/keuangan?view=dashboard", ct) ?? new KeuanganDashboardDto();

    public async Task<AntreanKeuanganDto> GetAntreanKeuanganAsync(CancellationToken ct = default) =>
        await GetObjectAsync<AntreanKeuanganDto>($"{Base}/keuangan?view=antrean", ct) ?? new AntreanKeuanganDto();

    public Task<List<AkunLaporanDto>> GetAkunLaporanAsync(CancellationToken ct = default) =>
        GetListAsync<AkunLaporanDto>($"{Base}/keuangan?view=akun", ct);

    public Task<List<JurnalUmumDto>> GetJurnalUmumAsync(int take = 50, CancellationToken ct = default) =>
        GetListAsync<JurnalUmumDto>($"{Base}/keuangan?view=jurnal&take={take}", ct);

    public Task<bool> VerifikasiTopupAsync(string topupId, bool setujui, string? catatan, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/keuangan", new JsonObject
        {
            ["op"] = "verifikasiTopup",
            ["topupId"] = topupId,
            ["setujui"] = setujui,
            ["catatan"] = catatan,
        }, ct);

    public Task<bool> VerifikasiPembayaranTagihanAsync(string pembayaranId, bool setujui, string? catatan, CancellationToken ct = default) =>
        PostSuccessAsync($"{Base}/keuangan", new JsonObject
        {
            ["op"] = "verifikasiPembayaran",
            ["pembayaranId"] = pembayaranId,
            ["setujui"] = setujui,
            ["catatan"] = catatan,
        }, ct);

    // ══════════════════ HELPERS ══════════════════

    private string Token() => _session.Current?.Token
        ?? throw new ApiException(System.Net.HttpStatusCode.Unauthorized, "Belum login.");

    private async Task<PagedResult<T>> GetPagedAsync<T>(string path, CancellationToken ct)
    {
        var element = await GetRawAsync(path, ct);
        if (element.ValueKind != JsonValueKind.Object || element.TryGetProperty("error", out _))
            return new PagedResult<T>();
        var result = element.Deserialize<PagedResult<T>>(Opts) ?? new PagedResult<T>();
        if (result.Data.Count == 0 && element.TryGetProperty("rows", out var rows) && rows.ValueKind == JsonValueKind.Array)
            result = result with { Data = rows.Deserialize<List<T>>(Opts) ?? new List<T>() };
        return result;
    }

    private async Task<List<T>> GetListAsync<T>(string path, CancellationToken ct)
    {
        var element = await GetRawAsync(path, ct);
        return element.ValueKind == JsonValueKind.Array
            ? element.Deserialize<List<T>>(Opts) ?? new List<T>()
            : new List<T>();
    }

    private async Task<T?> GetObjectAsync<T>(string path, CancellationToken ct)
        where T : class
    {
        var element = await GetRawAsync(path, ct);
        if (element.ValueKind != JsonValueKind.Object || element.TryGetProperty("error", out _))
            return null;
        return element.Deserialize<T>(Opts);
    }

    private async Task<T?> PostObjectAsync<T>(string path, object body, CancellationToken ct)
        where T : class
    {
        var element = await PostRawAsync(path, body, ct);
        if (element.ValueKind != JsonValueKind.Object || element.TryGetProperty("error", out _))
            return null;
        return element.Deserialize<T>(Opts);
    }

    private async Task<T?> PatchObjectAsync<T>(string path, object body, CancellationToken ct)
        where T : class
    {
        var element = await PatchRawAsync(path, body, ct);
        if (element.ValueKind != JsonValueKind.Object || element.TryGetProperty("error", out _))
            return null;
        return element.Deserialize<T>(Opts);
    }

    private async Task<bool> PatchSuccessAsync(string path, object body, CancellationToken ct)
    {
        var element = await PatchRawAsync(path, body, ct);
        return IsSuccess(element);
    }

    private async Task<bool> PostSuccessAsync(string path, object body, CancellationToken ct)
    {
        var element = await PostRawAsync(path, body, ct);
        return IsSuccess(element);
    }

    private static bool IsSuccess(JsonElement element) =>
        element.ValueKind == JsonValueKind.Object &&
        element.TryGetProperty("success", out var s) && s.ValueKind == JsonValueKind.True;

    private Task<JsonElement> GetRawAsync(string path, CancellationToken ct) =>
        _api.GetAsync<JsonElement>(path, Token(), ct);

    private Task<JsonElement> PostRawAsync(string path, object body, CancellationToken ct) =>
        _api.PostAsync<object, JsonElement>(path, body, Token(), ct);

    private Task<JsonElement> PatchRawAsync(string path, object body, CancellationToken ct) =>
        _api.PatchAsync<object, JsonElement>(path, body, Token(), ct);
}
