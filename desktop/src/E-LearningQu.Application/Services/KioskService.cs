using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Kiosk;

namespace E_LearningQu.Application.Services;

/// <summary>Klaim token kiosk desktop lewat /api/mobile/desktop/kiosk memakai sesi Admin.</summary>
public sealed class KioskService : IKioskService
{
    private readonly IBackendApiClient _api;
    private readonly ISessionManager _session;

    public KioskService(IBackendApiClient api, ISessionManager session)
    {
        _api = api;
        _session = session;
    }

    public async Task<KioskActivationResponse> AktifkanAsync(CancellationToken ct = default)
    {
        var token = _session.Current?.Token;
        if (string.IsNullOrWhiteSpace(token))
            throw new InvalidOperationException("Sesi Admin belum aktif — masukkan email dan kata sandi Admin terlebih dahulu.");

        // Nama komputer ikut dikirim agar panel Admin bisa menampilkan status per perangkat.
        var response = await _api.PostAsync<object, KioskActivationResponse>(
            "/api/mobile/desktop/kiosk",
            new { perangkatNama = Environment.MachineName },
            token,
            ct);
        if (string.IsNullOrWhiteSpace(response.Token) || string.IsNullOrWhiteSpace(response.Url))
            throw new InvalidOperationException("Server tidak mengembalikan token kiosk yang valid.");
        return response;
    }
}
