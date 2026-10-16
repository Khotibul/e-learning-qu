using System.Net.Http.Json;
using System.Text.Json;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Common;
using E_LearningQu.Infrastructure.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace E_LearningQu.Infrastructure.Http;

/// <summary>
/// HttpClient ke backend Next.js (/api/mobile/*). Sukses = 2xx + JSON domain (tanpa envelope);
/// gagal = non-2xx + body {"error"} → ApiException. Header Authorization: Bearer &lt;token&gt;.
/// </summary>
public sealed class BackendApiClient : IBackendApiClient
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    /// <summary>Dipanggil (true=online, false=offline) setelah tiap request HTTP — untuk indikator status koneksi UI.</summary>
    public static event Action<bool>? ConnectionChanged;

    /// <summary>Dipanggil saat respons 401 masih terjadi setelah auto-refresh token gagal — UI harus logout.</summary>
    public static event Action? SessionExpired;

    /// <summary>Supaya UI tidak logout berulang saat banyak request 401 bersamaan.</summary>
    private static int _sessionExpiredRaised;

    private readonly HttpClient _http;
    private readonly ILogger<BackendApiClient> _logger;

    public BackendApiClient(HttpClient http, IOptions<BackendOptions> options, ILogger<BackendApiClient> logger)
    {
        _http = http;
        _logger = logger;
        _http.BaseAddress = new Uri(options.Value.BaseUrl.TrimEnd('/') + "/");
        _http.Timeout = TimeSpan.FromSeconds(options.Value.TimeoutSeconds);
    }

    public async Task<TResponse> GetAsync<TResponse>(string path, string? token = null, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, Normalize(path));
        AttachAuth(request, token);
        return await SendAsync<TResponse>(request, ct);
    }

    public async Task<byte[]?> GetBytesAsync(string path, string? token = null, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, Normalize(path));
        AttachAuth(request, token);
        try
        {
            using var response = await _http.SendAsync(request, ct);
            _logger.LogInformation("HTTP {Status}: {Method} {Uri}", (int)response.StatusCode, request.Method, request.RequestUri);
            ConnectionChanged?.Invoke(true);
            if (!response.IsSuccessStatusCode) return null;
            var bytes = await response.Content.ReadAsByteArrayAsync(ct);
            return bytes.Length == 0 ? null : bytes;
        }
        catch (TaskCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogDebug(ex, "GET biner gagal: {Uri}", request.RequestUri);
            ConnectionChanged?.Invoke(false);
            return null;
        }
    }

    public async Task<TResponse> PostAsync<TBody, TResponse>(string path, TBody body, string? token = null, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Normalize(path))
        {
            Content = JsonContent.Create(body, options: JsonOpts)
        };
        AttachAuth(request, token);
        return await SendAsync<TResponse>(request, ct);
    }

    public async Task<TResponse> PostAsync<TResponse>(string path, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Normalize(path));
        return await SendAsync<TResponse>(request, ct);
    }

    public async Task<TResponse> PostAsync<TResponse>(string path, string? token, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Normalize(path));
        AttachAuth(request, token);
        return await SendAsync<TResponse>(request, ct);
    }

    public async Task<TResponse> PatchAsync<TBody, TResponse>(string path, TBody body, string? token = null, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Patch, Normalize(path))
        {
            Content = JsonContent.Create(body, options: JsonOpts)
        };
        AttachAuth(request, token);
        return await SendAsync<TResponse>(request, ct);
    }

    public async Task DeleteAsync(string path, string? token = null, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, Normalize(path));
        AttachAuth(request, token);
        using var response = await _http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var serverMessage = await TryReadErrorAsync(response, ct);
            throw new ApiException(response.StatusCode, serverMessage);
        }
    }

    private static string Normalize(string path) => path.StartsWith('/') ? path.TrimStart('/') : path;

    private static void AttachAuth(HttpRequestMessage request, string? token)
    {
        if (!string.IsNullOrWhiteSpace(token))
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    }

    private async Task<TResponse> SendAsync<TResponse>(HttpRequestMessage request, CancellationToken ct)
    {
        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (TaskCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "HTTP gagal: {Method} {Uri}", request.Method, request.RequestUri);
            ConnectionChanged?.Invoke(false);
            throw new ApiException(System.Net.HttpStatusCode.ServiceUnavailable, "Tidak dapat terhubung ke server.", inner: ex);
        }

        using (response)
        {
            _logger.LogInformation("HTTP {Status}: {Method} {Uri}", (int)response.StatusCode, request.Method, request.RequestUri);
            ConnectionChanged?.Invoke(true);

            if (response.IsSuccessStatusCode)
                Interlocked.Exchange(ref _sessionExpiredRaised, 0);

            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized
                && Interlocked.Exchange(ref _sessionExpiredRaised, 1) == 0)
            {
                // 401 masih terbawa sampai sini → auto-refresh di AuthAutoRefreshHandler sudah gagal.
                _logger.LogWarning("401 setelah refresh gagal — memberi sinyal sesi berakhir");
                SessionExpired?.Invoke();
            }

            if (!response.IsSuccessStatusCode)
            {
                var serverMessage = await TryReadErrorAsync(response, ct);
                throw new ApiException(response.StatusCode, serverMessage);
            }

            if (response.Content.Headers.ContentLength == 0)
                return default!;

            // Parse manual agar JSON rusak/HTML (mis. halaman error Vercel/Next) tidak crash tapi jadi ApiException jelas.
            TResponse? result;
            try
            {
                result = await response.Content.ReadFromJsonAsync<TResponse>(JsonOpts, ct);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "JSON rusak dari {Uri}", request.RequestUri);
                throw new ApiException(response.StatusCode, "Respons server tidak valid (bukan JSON).", message: "Respons server tidak valid.", inner: ex);
            }
            if (result is null)
                throw new ApiException(response.StatusCode, "Respons kosong dari server.");
            return result;
        }
    }

    private static async Task<string?> TryReadErrorAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var error = await response.Content.ReadFromJsonAsync<ApiErrorDto>(JsonOpts, ct);
            return error?.Error;
        }
        catch
        {
            return null;
        }
    }
}
