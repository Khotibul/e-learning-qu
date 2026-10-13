using E_LearningQu.Contracts.Auth;
using E_LearningQu.Domain.Enums;

namespace E_LearningQu.Application.Abstractions;

public interface IAuthService
{
    Task<AuthResult> LoginAsync(string email, string password, Role role, CancellationToken ct = default);
    Task<bool> RefreshAsync(CancellationToken ct = default);
    Task SignOutAsync(CancellationToken ct = default);

    /// <summary>
    /// Set session dari respons exchange Google desktop (sudah JWT) — dipakai IOAuthService
    /// agar logika session-building tidak diduplikasi.
    /// </summary>
    AuthResult ApplyGoogleExchange(DesktopGoogleExchangeResponse response, Role fallbackRole);
}

public sealed record AuthResult(bool IsSuccess, string? ErrorMessage, DesktopLoginResponse? Response)
{
    public static AuthResult Success(DesktopLoginResponse response) => new(true, null, response);
    public static AuthResult Failure(string message) => new(false, message, null);
}
