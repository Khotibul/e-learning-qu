using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Kiosk;

/// <summary>Respons POST /api/mobile/desktop/kiosk — token kiosk 30 hari + URL halaman kiosk.</summary>
public sealed record KioskActivationResponse
{
    [JsonPropertyName("token")] public string Token { get; init; } = "";
    [JsonPropertyName("url")] public string Url { get; init; } = "";
    [JsonPropertyName("expiresInDetik")] public int ExpiresInDetik { get; init; }
    [JsonPropertyName("admin")] public string? Admin { get; init; }
}

/// <summary>Token kiosk yang disimpan terenkripsi (DPAPI) di perangkat desktop.</summary>
public sealed record KioskCredential(
    string Token,
    string Url,
    DateTimeOffset ExpiresAt,
    string? Admin = null)
{
    /// <summary>Token masih layak dipakai (beri margin 1 menit sebelum kedaluwarsa).</summary>
    [JsonIgnore]
    public bool MasihBerlaku => ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(1);
}
