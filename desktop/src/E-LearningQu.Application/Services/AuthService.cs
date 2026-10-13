using System.Text.Json;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Auth;
using E_LearningQu.Domain.Enums;
using E_LearningQu.Domain.Identity;
using Microsoft.Extensions.Logging;

namespace E_LearningQu.Application.Services;

/// <summary>Login desktop via POST /api/mobile/auth/desktop/login (JWT + refresh) — akun &amp; DB sama dengan website/mobile.</summary>
public sealed class AuthService : IAuthService
{
    private readonly IBackendApiClient _api;
    private readonly ISessionManager _session;
    private readonly ILogger<AuthService> _logger;

    public AuthService(IBackendApiClient api, ISessionManager session, ILogger<AuthService> logger)
    {
        _api = api;
        _session = session;
        _logger = logger;
    }

    public async Task<AuthResult> LoginAsync(string email, string password, Role role, CancellationToken ct = default)
    {
        var request = new DesktopLoginRequest(email.Trim(), password, role.ToString());
        DesktopLoginResponse response;
        try
        {
            response = await _api.PostAsync<DesktopLoginRequest, DesktopLoginResponse>(
                "/api/mobile/auth/desktop/login", request, token: null, ct);
        }
        catch (ApiException ex)
        {
            _logger.LogWarning(ex, "Login ditolak server untuk {Email}: {Status}", email, (int)ex.StatusCode);
            return AuthResult.Failure(ex.ServerMessage ?? ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Login gagal jaringan untuk {Email}", email);
            return AuthResult.Failure("Tidak dapat terhubung ke server. Periksa koneksi internet.");
        }

        if (string.IsNullOrWhiteSpace(response.AccessToken) || response.User is null)
            return AuthResult.Failure(response is { Success: false } ? "Login gagal." : "Respons login tidak valid.");

        var roleResolved = RoleParser.TryParse(response.User.Role, out var parsed) ? parsed : role;
        ApplySession(response.User, response.Extra, response.AccessToken, response.RefreshToken, roleResolved);
        return AuthResult.Success(response);
    }

    public AuthResult ApplyGoogleExchange(DesktopGoogleExchangeResponse response, Role fallbackRole)
    {
        if (string.IsNullOrWhiteSpace(response.AccessToken) || response.User is null)
            return AuthResult.Failure(response is { Success: false } ? "Login Google gagal." : "Respons Google tidak valid.");

        var roleResolved = RoleParser.TryParse(response.User.Role, out var parsed) ? parsed : fallbackRole;
        ApplySession(response.User, response.Extra, response.AccessToken, response.RefreshToken, roleResolved);
        return AuthResult.Success(new DesktopLoginResponse
        {
            Success = true,
            AccessToken = response.AccessToken,
            RefreshToken = response.RefreshToken,
            ExpiresIn = response.ExpiresIn,
            RefreshExpiresIn = response.RefreshExpiresIn,
            User = response.User,
            Extra = response.Extra,
        });
    }

    private void ApplySession(LoginUserDto user, System.Text.Json.JsonElement? extra, string accessToken, string? refreshToken, Role role)
    {
        var session = new UserSession
        {
            UserId = user.Id,
            Role = role,
            Token = accessToken,
            RefreshToken = refreshToken,
            Email = user.Email,
            Name = user.Name ?? user.Email,
            ImageUrl = user.Image,
            SiswaId = ExtraString(extra, "siswaId"),
            GuruId = ExtraString(extra, "guruId"),
            Jabatan = ExtraString(extra, "jabatan"),
            KelasId = ExtraString(extra, "kelasId") ?? ExtraNestedString(extra, "kelas", "id"),
            KelasNama = ExtraString(extra, "kelasNama") ?? ExtraNestedString(extra, "kelas", "nama"),
            PondokAssignments = ParsePondokAssignments(extra),
            PondokGrants = ParsePondokGrants(extra),
        };

        // Effective permission = role default + pondok grant override.
        var perms = new HashSet<string>(RolePermissionMap.For(session.Role), StringComparer.Ordinal);
        foreach (var g in session.PondokGrants)
            perms.Add(g.Permission);
        session = session with { Permissions = perms };

        _session.SetSession(session);
    }

    private static List<PondokAssignment> ParsePondokAssignments(JsonElement? extra)
    {
        var list = new List<PondokAssignment>();
        if (extra is not { ValueKind: JsonValueKind.Object } el) return list;
        if (!el.TryGetProperty("pondokAssignments", out var arr) || arr.ValueKind != JsonValueKind.Array) return list;
        foreach (var item in arr.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object) continue;
            list.Add(new PondokAssignment(
                item.TryGetProperty("tipe", out var t) ? t.GetString() ?? "" : "",
                item.TryGetProperty("asramaId", out var a) ? a.GetString() : null,
                item.TryGetProperty("kamarId", out var k) ? k.GetString() : null,
                item.TryGetProperty("halaqahId", out var h) ? h.GetString() : null,
                item.TryGetProperty("kelasDiniyahId", out var kd) ? kd.GetString() : null,
                item.TryGetProperty("unit", out var u) ? u.GetString() : null));
        }
        return list;
    }

    private static List<PondokGrant> ParsePondokGrants(JsonElement? extra)
    {
        var list = new List<PondokGrant>();
        if (extra is not { ValueKind: JsonValueKind.Object } el) return list;
        if (!el.TryGetProperty("pondokGrants", out var arr) || arr.ValueKind != JsonValueKind.Array) return list;
        foreach (var item in arr.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object) continue;
            list.Add(new PondokGrant(
                item.TryGetProperty("permission", out var p) ? p.GetString() ?? "" : "",
                item.TryGetProperty("scopeType", out var st) ? st.GetString() : null,
                item.TryGetProperty("scopeId", out var si) ? si.GetString() : null));
        }
        return list;
    }

    public async Task<bool> RefreshAsync(CancellationToken ct = default)
    {
        var current = _session.Current;
        if (current is null || string.IsNullOrWhiteSpace(current.RefreshToken))
            return false;

        try
        {
            var response = await _api.PostAsync<RefreshRequest, RefreshResponse>(
                "/api/mobile/auth/desktop/refresh", new RefreshRequest(current.RefreshToken), token: null, ct);

            if (string.IsNullOrWhiteSpace(response.AccessToken))
                return false;

            var role = RoleParser.TryParse(response.Role, out var parsed) ? parsed : current.Role;
            _session.SetSession(current with { Token = response.AccessToken, Role = role });
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Refresh token gagal untuk user {UserId}", current.UserId);
            return false;
        }
    }

    public Task SignOutAsync(CancellationToken ct = default) => _session.SignOutAsync(ct);

    private static string? ExtraString(JsonElement? extra, string prop)
    {
        if (extra is not { ValueKind: JsonValueKind.Object } el) return null;
        if (!el.TryGetProperty(prop, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => v.GetString(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null
        };
    }

    private static string? ExtraNestedString(JsonElement? extra, string parent, string child)
    {
        if (extra is not { ValueKind: JsonValueKind.Object } el) return null;
        if (!el.TryGetProperty(parent, out var p) || p.ValueKind != JsonValueKind.Object) return null;
        if (!p.TryGetProperty(child, out var v) || v.ValueKind != JsonValueKind.String) return null;
        return v.GetString();
    }
}
