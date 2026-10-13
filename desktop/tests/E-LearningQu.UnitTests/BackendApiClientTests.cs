using System.Net;
using System.Text;
using System.Text.Json;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Contracts.Common;
using E_LearningQu.Infrastructure.Http;
using E_LearningQu.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace E_LearningQu.UnitTests;

public class BackendApiClientTests
{
    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _respond;
        public StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) => _respond = respond;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(_respond(request));
    }

    private static BackendApiClient CreateClient(StubHandler handler, string baseUrl = "http://unit.test")
    {
        var http = new HttpClient(handler);
        return new BackendApiClient(http, Options.Create(new BackendOptions { BaseUrl = baseUrl, TimeoutSeconds = 10 }));
    }

    [Fact]
    public async Task Sukses_2xx_deserialisasi_json()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"rows\":[{\"id\":\"n1\",\"judul\":\"Hi\"}]}", Encoding.UTF8, "application/json")
        });
        var client = CreateClient(handler);

        var result = await client.GetAsync<JsonElement>("/api/mobile/notifikasi?take=5", token: "tok");

        Assert.Equal(JsonValueKind.Object, result.ValueKind);
        Assert.Equal("n1", result.GetProperty("rows")[0].GetProperty("id").GetString());
    }

    [Fact]
    public async Task Error_401_lempar_ApiException_dengan_pesan_backend()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized)
        {
            Content = new StringContent("{\"error\":\"Unauthorized\"}", Encoding.UTF8, "application/json")
        });
        var client = CreateClient(handler);

        var ex = await Assert.ThrowsAsync<ApiException>(() => client.GetAsync<JsonElement>("/api/mobile/siswa/dashboard", token: "expired"));

        Assert.Equal(HttpStatusCode.Unauthorized, ex.StatusCode);
        Assert.Equal("Unauthorized", ex.ServerMessage);
    }

    [Fact]
    public async Task Error_400_validasi_terbaca()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = new StringContent("{\"error\":\"Email dan password wajib diisi\"}", Encoding.UTF8, "application/json")
        });
        var client = CreateClient(handler);

        var ex = await Assert.ThrowsAsync<ApiException>(() => client.PostAsync<object, JsonElement>("/api/mobile/auth/login", new { }));

        Assert.Equal("Email dan password wajib diisi", ex.ServerMessage);
    }

    [Fact]
    public async Task Header_Bearer_terpasang()
    {
        string? authHeader = null;
        var handler = new StubHandler(req =>
        {
            authHeader = req.Headers.Authorization?.ToString();
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json")
            };
        });
        var client = CreateClient(handler);

        await client.GetAsync<JsonElement>("/api/mobile/siswa/nilai", token: "abc123");

        Assert.Equal("Bearer abc123", authHeader);
    }

    [Fact]
    public async Task Network_error_jadi_ApiException_service_unavailable()
    {
        var handler = new StubHandler(_ => throw new HttpRequestException("connection refused"));
        var client = CreateClient(handler);

        var ex = await Assert.ThrowsAsync<ApiException>(() => client.GetAsync<JsonElement>("/api/mobile/siswa/dashboard"));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, ex.StatusCode);
    }

    [Fact]
    public async Task ApiErrorDto_terdeserialisasi()
    {
        var dto = JsonSerializer.Deserialize<ApiErrorDto>("{\"error\":\"Siswa not found\"}", new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal("Siswa not found", dto!.Error);
    }
}
