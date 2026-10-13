namespace E_LearningQu.Contracts.Auth;

/// <summary>Request login mobile — field camelCase mengikuti backend (src/app/api/mobile/auth/login/route.ts).</summary>
public sealed record LoginRequest(string Email, string Password, string Role);
