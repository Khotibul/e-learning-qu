using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Auth;
using E_LearningQu.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace E_LearningQu.Infrastructure.Http;

/// <summary>
/// Saat respons 401 pada request ber-Bearer: coba refresh token sekali (path refresh sendiri tidak di-retry),
/// lalu ulangi request dengan access token baru. Gagal refresh → biarkan 401 asli (UI ke logout).
/// </summary>
public sealed class AuthAutoRefreshHandler : DelegatingHandler
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _plainClient;
    private readonly ISessionManager _session;
    private readonly ILogger<AuthAutoRefreshHandler> _logger;

    public AuthAutoRefreshHandler(HttpClient plainClient, ISessionManager session, ILogger<AuthAutoRefreshHandler> logger)
    {
        _plainClient = plainClient;
        _session = session;
        _logger = logger;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var response = await base.SendAsync(request, ct);

        if (response.StatusCode != HttpStatusCode.Unauthorized)
            return response;

        var path = request.RequestUri?.OriginalString ?? "";
        var hasBearer = request.Headers.Authorization is not null;
        var current = _session.Current;
        if (!hasBearer || current is null || string.IsNullOrWhiteSpace(current.RefreshToken))
            return response;
        if (path.Contains("/api/mobile/auth/", StringComparison.OrdinalIgnoreCase))
            return response;

        var refreshed = await TryRefreshAsync(current.RefreshToken, ct);
        if (refreshed is null)
            return response; // refresh gagal → 401 asli (UI ke logout)

        response.Dispose();
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", refreshed);
        return await base.SendAsync(await CloneAsync(request), ct);
    }

    private async Task<string?> TryRefreshAsync(string refreshToken, CancellationToken ct)
    {
        try
        {
            var httpResponse = await _plainClient.PostAsJsonAsync(
                "api/mobile/auth/desktop/refresh", new RefreshRequest(refreshToken), JsonOpts, ct);
            if (!httpResponse.IsSuccessStatusCode)
                return null;

            var payload = await httpResponse.Content.ReadFromJsonAsync<RefreshResponse>(JsonOpts, ct);
            if (string.IsNullOrWhiteSpace(payload?.AccessToken))
                return null;

            var current = _session.Current;
            if (current is not null)
                _session.SetSession(current with { Token = payload.AccessToken });

            _logger.LogInformation("Access token berhasil di-refresh");
            return payload.AccessToken;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Auto-refresh token gagal");
            return null;
        }
    }

    /// <summary>Request tidak bisa dikirim dua kali — clone dengan buffer content.</summary>
    private static async Task<HttpRequestMessage> CloneAsync(HttpRequestMessage request)
    {
        var clone = new HttpRequestMessage(request.Method, request.RequestUri)
        {
            Version = request.Version,
            VersionPolicy = request.VersionPolicy
        };

        if (request.Content is not null)
        {
            var bytes = await request.Content.ReadAsByteArrayAsync();
            clone.Content = new ByteArrayContent(bytes);
            foreach (var header in request.Content.Headers)
                clone.Content.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        foreach (var header in request.Headers)
            clone.Headers.TryAddWithoutValidation(header.Key, header.Value);

        return clone;
    }
}
