using System.Text.Json;
using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Auth;

/// <summary>Login desktop. Role opsional — dikirim null agar backend auto-detect dari akun (multi-login).</summary>
public sealed record DesktopLoginRequest(
    string Email,
    string Password,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Role = null);

public sealed record DesktopLoginResponse
{
    [JsonPropertyName("success")] public bool Success { get; init; }
    [JsonPropertyName("accessToken")] public string? AccessToken { get; init; }
    [JsonPropertyName("refreshToken")] public string? RefreshToken { get; init; }
    [JsonPropertyName("expiresIn")] public int ExpiresIn { get; init; }
    [JsonPropertyName("refreshExpiresIn")] public int RefreshExpiresIn { get; init; }
    [JsonPropertyName("user")] public LoginUserDto? User { get; init; }
    [JsonPropertyName("extra")] public JsonElement? Extra { get; init; }
}

public sealed record RefreshRequest(string RefreshToken);

public sealed record RefreshResponse
{
    [JsonPropertyName("success")] public bool Success { get; init; }
    [JsonPropertyName("accessToken")] public string? AccessToken { get; init; }
    [JsonPropertyName("expiresIn")] public int ExpiresIn { get; init; }
    [JsonPropertyName("role")] public string? Role { get; init; }
}

public sealed record MeResponse
{
    [JsonPropertyName("user")] public LoginUserDto? User { get; init; }
}
