using System.Net;
using System.Text.Json;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Application.Services;
using E_LearningQu.Contracts.Auth;
using E_LearningQu.Domain.Enums;
using E_LearningQu.Domain.Identity;
using Microsoft.Extensions.Logging.Abstractions;

namespace E_LearningQu.UnitTests;

public class AuthServiceTests
{
    private sealed class FakeApi : IBackendApiClient
    {
        public Func<object, object>? OnPost { get; set; }
        public string? LastPath { get; private set; }

        public Task<TResponse> GetAsync<TResponse>(string path, string? token = null, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<TResponse> PostAsync<TBody, TResponse>(string path, TBody body, string? token = null, CancellationToken ct = default)
        {
            LastPath = path;
            if (OnPost is null) throw new ApiException(HttpStatusCode.ServiceUnavailable, "no stub");
            return Task.FromResult((TResponse)OnPost(body!));
        }

        public Task<TResponse> PostAsync<TResponse>(string path, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<TResponse> PostAsync<TResponse>(string path, string? token, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task DeleteAsync(string path, string? token = null, CancellationToken ct = default)
            => throw new NotSupportedException();
    }

    private sealed class FakeStore : IAuthTokenStore
    {
        public UserSession? Saved { get; private set; }
        public Task SaveAsync(UserSession session, CancellationToken ct = default) { Saved = session; return Task.CompletedTask; }
        public Task<UserSession?> LoadAsync(CancellationToken ct = default) => Task.FromResult(Saved);
        public Task ClearAsync(CancellationToken ct = default) { Saved = null; return Task.CompletedTask; }
    }

    private static DesktopLoginResponse LoginResponse(string accessToken = "acc-1", string refreshToken = "ref-1")
    {
        var json = """
        {
          "success": true,
          "accessToken": "acc-1",
          "refreshToken": "ref-1",
          "expiresIn": 900,
          "refreshExpiresIn": 2592000,
          "user": { "id": "u-1", "email": "andi@e-learning.qu", "name": "Andi", "image": null, "role": "SISWA" },
          "extra": { "siswaId": "s-1", "jabatan": "ANGGOTA", "kelas": { "id": "k-1", "nama": "XI-TKJ" } }
        }
        """
        .Replace("acc-1", accessToken).Replace("ref-1", refreshToken);

        return JsonSerializer.Deserialize<DesktopLoginResponse>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
    }

    [Fact]
    public async Task Login_sukses_set_sesi_dengan_token_dan_profil()
    {
        var api = new FakeApi { OnPost = _ => LoginResponse() };
        var session = new SessionManager(new FakeStore());
        var auth = new AuthService(api, session, NullLogger<AuthService>.Instance);

        var result = await auth.LoginAsync("andi@e-learning.qu", "siswa123", Role.SISWA);

        Assert.True(result.IsSuccess);
        Assert.Equal("/api/mobile/auth/desktop/login", api.LastPath);
        Assert.NotNull(session.Current);
        Assert.Equal("u-1", session.Current!.UserId);
        Assert.Equal(Role.SISWA, session.Current.Role);
        Assert.Equal("acc-1", session.Current.Token);
        Assert.Equal("ref-1", session.Current.RefreshToken);
        Assert.Equal("s-1", session.Current.SiswaId);
        Assert.Equal("XI-TKJ", session.Current.KelasNama);
    }

    [Fact]
    public async Task Login_ditolak_server_kembalikan_pesan_backend()
    {
        var api = new FakeApi { OnPost = _ => throw new ApiException(HttpStatusCode.Unauthorized, "Email atau password salah") };
        var auth = new AuthService(api, new SessionManager(new FakeStore()), NullLogger<AuthService>.Instance);

        var result = await auth.LoginAsync("andi@e-learning.qu", "salah", Role.SISWA);

        Assert.False(result.IsSuccess);
        Assert.Equal("Email atau password salah", result.ErrorMessage);
    }

    [Fact]
    public async Task Refresh_update_token_sesi()
    {
        var store = new FakeStore();
        var session = new SessionManager(store);
        var api = new FakeApi
        {
            OnPost = body => body is RefreshRequest
                ? new RefreshResponse { Success = true, AccessToken = "acc-2", ExpiresIn = 900, Role = "SISWA" }
                : LoginResponse()
        };
        var auth = new AuthService(api, session, NullLogger<AuthService>.Instance);

        session.SetSession(new UserSession
        {
            UserId = "u-1", Role = Role.SISWA, Token = "acc-1", RefreshToken = "ref-1",
            Email = "a@x.id", Name = "A"
        });

        var ok = await auth.RefreshAsync();

        Assert.True(ok);
        Assert.Equal("acc-2", session.Current!.Token);
        Assert.Equal("ref-1", session.Current.RefreshToken);
    }

    [Fact]
    public async Task Refresh_tanpa_refresh_token_gagal()
    {
        var session = new SessionManager(new FakeStore());
        var auth = new AuthService(new FakeApi(), session, NullLogger<AuthService>.Instance);
        session.SetSession(new UserSession { UserId = "u", Role = Role.GURU, Token = "t", Email = "e", Name = "n" });

        Assert.False(await auth.RefreshAsync());
    }

    [Fact]
    public async Task SignOut_kosongkan_sesi()
    {
        var store = new FakeStore();
        var session = new SessionManager(store);
        var auth = new AuthService(new FakeApi(), session, NullLogger<AuthService>.Instance);
        session.SetSession(new UserSession { UserId = "u", Role = Role.SISWA, Token = "t", RefreshToken = "r", Email = "e", Name = "n" });

        await auth.SignOutAsync();

        Assert.Null(session.Current);
        Assert.Null(store.Saved);
    }
}
