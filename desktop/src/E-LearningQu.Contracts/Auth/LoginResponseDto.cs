using System.Text.Json;
using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Auth;

/// <summary>
/// Respons login backend: { success, message?, token, user:{...}, extra? }.
/// Field extra bervariasi per role (siswaId/guruId/jabatan/kelas) — disimpan mentah sebagai JsonElement.
/// </summary>
public sealed record LoginResponseDto
{
    [JsonPropertyName("success")] public bool Success { get; init; }
    [JsonPropertyName("message")] public string? Message { get; init; }
    [JsonPropertyName("token")] public string? Token { get; init; }
    [JsonPropertyName("user")] public LoginUserDto? User { get; init; }
    [JsonPropertyName("extra")] public JsonElement? Extra { get; init; }
}
