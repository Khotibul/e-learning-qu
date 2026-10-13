using E_LearningQu.Domain.Identity;

namespace E_LearningQu.Application.Abstractions;

/// <summary>Sesi aktif di memori + sinkronisasi ke IAuthTokenStore.</summary>
public interface ISessionManager
{
    UserSession? Current { get; }
    event EventHandler<UserSession?>? SessionChanged;

    void SetSession(UserSession session);
    Task<UserSession?> RestoreAsync(CancellationToken ct = default);
    Task SignOutAsync(CancellationToken ct = default);
}
