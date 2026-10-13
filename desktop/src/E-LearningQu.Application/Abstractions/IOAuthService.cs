using E_LearningQu.Contracts.Auth;
using E_LearningQu.Domain.Enums;

namespace E_LearningQu.Application.Abstractions;

/// <summary>
/// OAuth 2.0 Authorization Code + PKCE untuk login Google di desktop.
/// Browser sistem dibuka untuk authorize; loopback listener menangkap code;
/// code+code_verifier ditukar ke backend desktop (exchange) yang issue JWT.
/// </summary>
public interface IOAuthService
{
    /// <summary>
    /// Jalankan full flow: generate PKCE → buka browser → tunggu code → exchange ke backend.
    /// Role opsional: null → backend auto-detect dari akun (multi-login).
    /// Mengembalikan AuthResult sukses (session sudah ter-set) atau gagal dengan pesan.
    /// </summary>
    Task<AuthResult> LoginWithGoogleAsync(string? role = null, CancellationToken ct = default);
}
