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
            throw new ApiException(System.Net.HttpStatusCode.ServiceUnavailable, "Tidak dapat terhubung ke server.", inner: ex);
        }

        using (response)
        {
            _logger.LogInformation("HTTP {Status}: {Method} {Uri}", (int)response.StatusCode, request.Method, request.RequestUri);

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
