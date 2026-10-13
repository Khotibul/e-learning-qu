using E_LearningQu.Domain.Identity;

namespace E_LearningQu.Application.Abstractions;

/// <summary>Persistensi sesi (token + profil) — implementasi wajib terenkripsi (DPAPI), tanpa plaintext.</summary>
public interface IAuthTokenStore
{
    Task SaveAsync(UserSession session, CancellationToken ct = default);
    Task<UserSession?> LoadAsync(CancellationToken ct = default);
    Task ClearAsync(CancellationToken ct = default);
}
