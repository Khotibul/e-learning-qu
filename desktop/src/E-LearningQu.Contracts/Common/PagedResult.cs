using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Common;

/// <summary>Envelope paginasi standar backend Next.js — { data, total, page, limit, totalPages }.</summary>
public sealed record PagedResult<T>
{
    [JsonPropertyName("data")] public List<T> Data { get; init; } = new();
    [JsonPropertyName("total")] public int Total { get; init; }
    [JsonPropertyName("page")] public int Page { get; init; }
    [JsonPropertyName("limit")] public int Limit { get; init; }
    [JsonPropertyName("totalPages")] public int TotalPages { get; init; }
}
