using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Common;

/// <summary>Shape error backend: { "error": "pesan" } + status non-2xx.</summary>
public sealed record ApiErrorDto
{
    [JsonPropertyName("error")] public string? Error { get; init; }
}
