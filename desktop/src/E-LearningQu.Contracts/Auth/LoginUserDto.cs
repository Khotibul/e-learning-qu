using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Auth;

public sealed record LoginUserDto
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("email")] public string Email { get; init; } = "";
    [JsonPropertyName("name")] public string? Name { get; init; }
    [JsonPropertyName("image")] public string? Image { get; init; }
    [JsonPropertyName("role")] public string Role { get; init; } = "";
}
