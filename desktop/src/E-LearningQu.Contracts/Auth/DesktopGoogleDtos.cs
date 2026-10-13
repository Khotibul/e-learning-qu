using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Auth;

/// <summary>Request tukar authorization code Google (PKCE) ke backend desktop.</summary>
public sealed record DesktopGoogleExchangeRequest(
    [property: JsonPropertyName("code")] string Code,
    [property: JsonPropertyName("codeVerifier")] string CodeVerifier,
    [property: JsonPropertyName("redirectUri")] string RedirectUri,
    [property: JsonPropertyName("role")] string Role);

/// <summary>Respons exchange Google = sama bentuknya dengan DesktopLoginResponse (JWT desktop).</summary>
public sealed record DesktopGoogleExchangeResponse
{
    [JsonPropertyName("success")] public bool Success { get; init; }
    [JsonPropertyName("accessToken")] public string? AccessToken { get; init; }
    [JsonPropertyName("refreshToken")] public string? RefreshToken { get; init; }
    [JsonPropertyName("expiresIn")] public int ExpiresIn { get; init; }
    [JsonPropertyName("refreshExpiresIn")] public int RefreshExpiresIn { get; init; }
    [JsonPropertyName("user")] public LoginUserDto? User { get; init; }
    [JsonPropertyName("extra")] public System.Text.Json.JsonElement? Extra { get; init; }
}
