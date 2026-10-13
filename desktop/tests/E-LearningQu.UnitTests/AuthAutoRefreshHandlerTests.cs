using System.Net;
using System.Text;
using System.Text.Json;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Services;
using E_LearningQu.Contracts.Auth;
using E_LearningQu.Domain.Enums;
using E_LearningQu.Domain.Identity;
using E_LearningQu.Infrastructure.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace E_LearningQu.UnitTests;

public class AuthAutoRefreshHandlerTests
{
    private sealed class RecordingHandler : HttpMessageHandler
    {
        public List<string?> AuthorizationHeaders { get; } = new();
        private readonly Func<int, HttpResponseMessage> _respond;

        public RecordingHandler(Func<int, HttpResponseMessage> respond) => _respond = respond;
        private int _calls;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            AuthorizationHeaders.Add(request.Headers.Authorization?.ToString());
            return Task.FromResult(_respond(_calls++));
        }
    }

    private sealed class FakeStore : IAuthTokenStore
    {
        public Task SaveAsync(UserSession session, CancellationToken ct = default) => Task.CompletedTask;
        public Task<UserSession?> LoadAsync(CancellationToken ct = default) => Task.FromResult<UserSession?>(null);
        public Task ClearAsync(CancellationToken ct = default) => Task.CompletedTask;
    }

    private static AuthAutoRefreshHandler CreateHandler(RecordingHandler inner, RecordingHandler plain, ISessionManager session)
    {
        var plainHttp = new HttpClient(plain) { BaseAddress = new Uri("http://unit.test/") };
        var handler = new AuthAutoRefreshHandler(plainHttp, session, NullLogger<AuthAutoRefreshHandler>.Instance)
        {
            InnerHandler = inner
        };
        return handler;
    }

    [Fact]
    public async Task Unauthorized_lalu_refresh_lalu_retry_dengan_token_baru()
    {
        var inner = new RecordingHandler(call => call == 0
            ? new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("{\"error\":\"Unauthorized\"}") }
            : new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"ok\":true}") });

        var refreshJson = JsonSerializer.Serialize(
            new RefreshResponse { Success = true, AccessToken = "acc-baru", ExpiresIn = 900 },
            new JsonSerializerOptions(JsonSerializerDefaults.Web));

        var plain = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(refreshJson, Encoding.UTF8, "application/json")
        });

        var session = new SessionManager(new FakeStore());
        session.SetSession(new UserSession { UserId = "u-1", Role = Role.SISWA, Token = "acc-lama", RefreshToken = "ref-1", Email = "e", Name = "n" });

        var handler = CreateHandler(inner, plain, session);
        using var client = new HttpClient(handler) { BaseAddress = new Uri("http://unit.test/") };

        var request = new HttpRequestMessage(HttpMethod.Get, "api/mobile/siswa/dashboard");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "acc-lama");
        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, inner.AuthorizationHeaders.Count);
        Assert.Equal("Bearer acc-lama", inner.AuthorizationHeaders[0]);
        Assert.Equal("Bearer acc-baru", inner.AuthorizationHeaders[1]);
        Assert.Equal("acc-baru", session.Current!.Token);
    }

    [Fact]
    public async Task Refresh_gagal_biarkan_401_asli()
    {
        var inner = new RecordingHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("{\"error\":\"Unauthorized\"}") });
        var plain = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized));

        var session = new SessionManager(new FakeStore());
        session.SetSession(new UserSession { UserId = "u", Role = Role.SISWA, Token = "t", RefreshToken = "r", Email = "e", Name = "n" });

        var handler = CreateHandler(inner, plain, session);
        using var client = new HttpClient(handler) { BaseAddress = new Uri("http://unit.test/") };

        var request = new HttpRequestMessage(HttpMethod.Get, "api/mobile/siswa/dashboard");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "t");
        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("t", session.Current!.Token);
    }

    [Fact]
    public async Task Path_refresh_tidak_di_retry()
    {
        var inner = new RecordingHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("{\"error\":\"Unauthorized\"}") });
        var plain = new RecordingHandler(_ => throw new InvalidOperationException("tidak boleh dipanggil"));

        var session = new SessionManager(new FakeStore());
        session.SetSession(new UserSession { UserId = "u", Role = Role.SISWA, Token = "t", RefreshToken = "r", Email = "e", Name = "n" });

        var handler = CreateHandler(inner, plain, session);
        using var client = new HttpClient(handler) { BaseAddress = new Uri("http://unit.test/") };

        var response = await client.PostAsync("api/mobile/auth/desktop/refresh", new StringContent("{}"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Single(inner.AuthorizationHeaders);
    }

    [Fact]
    public async Task Tanpa_bearer_tidak_coba_refresh()
    {
        var inner = new RecordingHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("{\"error\":\"Unauthorized\"}") });
        var plain = new RecordingHandler(_ => throw new InvalidOperationException("tidak boleh dipanggil"));

        var session = new SessionManager(new FakeStore());
        session.SetSession(new UserSession { UserId = "u", Role = Role.SISWA, Token = "t", RefreshToken = "r", Email = "e", Name = "n" });

        var handler = CreateHandler(inner, plain, session);
        using var client = new HttpClient(handler) { BaseAddress = new Uri("http://unit.test/") };

        var response = await client.GetAsync("api/mobile/siswa/dashboard");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
