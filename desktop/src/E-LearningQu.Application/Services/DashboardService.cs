using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Dashboard;
using E_LearningQu.Domain.Enums;

namespace E_LearningQu.Application.Services;

/// <summary>Ambil dashboard sesuai role aktif — token dari ISessionManager (auto-refresh oleh handler).</summary>
public sealed class DashboardService : IDashboardService
{
    private readonly IBackendApiClient _api;
    private readonly ISessionManager _session;

    public DashboardService(IBackendApiClient api, ISessionManager session)
    {
        _api = api;
        _session = session;
    }

    public async Task<SiswaDashboardDto> GetSiswaDashboardAsync(CancellationToken ct = default)
    {
        var session = RequireSession();
        return await _api.GetAsync<SiswaDashboardDto>("/api/mobile/siswa/dashboard", session.Token, ct);
    }

    public async Task<GuruDashboardDto> GetGuruDashboardAsync(CancellationToken ct = default)
    {
        var session = RequireSession();
        return await _api.GetAsync<GuruDashboardDto>("/api/mobile/guru/dashboard", session.Token, ct);
    }

    private Domain.Identity.UserSession RequireSession() =>
        _session.Current ?? throw new ApiException(System.Net.HttpStatusCode.Unauthorized, "Belum login.");
}
