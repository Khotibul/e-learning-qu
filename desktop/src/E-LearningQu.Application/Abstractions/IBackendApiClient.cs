namespace E_LearningQu.Application.Abstractions;

/// <summary>HTTP client backend — semua akses data lewat interface ini (tidak ada koneksi DB langsung).</summary>
public interface IBackendApiClient
{
    Task<TResponse> GetAsync<TResponse>(string path, string? token = null, CancellationToken ct = default);
    Task<TResponse> PostAsync<TBody, TResponse>(string path, TBody body, string? token = null, CancellationToken ct = default);
    Task<TResponse> PostAsync<TResponse>(string path, CancellationToken ct = default);

    /// <summary>POST tanpa body tapi dengan header Authorization (mis. start ujian).</summary>
    Task<TResponse> PostAsync<TResponse>(string path, string? token, CancellationToken ct = default);
    Task<TResponse> PatchAsync<TBody, TResponse>(string path, TBody body, string? token = null, CancellationToken ct = default);
    Task DeleteAsync(string path, string? token = null, CancellationToken ct = default);
}
