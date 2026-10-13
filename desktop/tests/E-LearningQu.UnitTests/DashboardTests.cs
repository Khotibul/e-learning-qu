using System.Net;
using System.Text.Json;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Application.Common;
using E_LearningQu.Application.Services;
using E_LearningQu.Contracts.Dashboard;
using E_LearningQu.Domain.Enums;
using E_LearningQu.Domain.Identity;

namespace E_LearningQu.UnitTests;

public class DashboardTests
{
    private sealed class FakeApi : IBackendApiClient
    {
        public string? LastPath { get; private set; }
        public string? LastToken { get; private set; }
        public object? Response { get; set; }

        public Task<TResponse> GetAsync<TResponse>(string path, string? token = null, CancellationToken ct = default)
        {
            LastPath = path;
            LastToken = token;
            return Task.FromResult((TResponse)Response!);
        }

        public Task<TResponse> PostAsync<TBody, TResponse>(string path, TBody body, string? token = null, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<TResponse> PostAsync<TResponse>(string path, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<TResponse> PostAsync<TResponse>(string path, string? token, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<TResponse> PatchAsync<TBody, TResponse>(string path, TBody body, string? token = null, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task DeleteAsync(string path, string? token = null, CancellationToken ct = default)
            => throw new NotSupportedException();
    }

    private sealed class FakeSession : ISessionManager
    {
        public UserSession? Current { get; private set; }
        public event EventHandler<UserSession?>? SessionChanged;
        public void SetSession(UserSession session) { Current = session; SessionChanged?.Invoke(this, session); }
        public Task<UserSession?> RestoreAsync(CancellationToken ct = default) => Task.FromResult(Current);
        public Task SignOutAsync(CancellationToken ct = default) { Current = null; return Task.CompletedTask; }
    }

    private static FakeSession SiswaSession()
    {
        var s = new FakeSession();
        s.SetSession(new UserSession { UserId = "u", Role = Role.SISWA, Token = "tok-siswa", Email = "e", Name = "n" });
        return s;
    }

    [Fact]
    public void SiswaDashboardDto_terdeserialisasi_dari_shape_backend()
    {
        var json = """
        {
          "nama": "Andi Pratama", "kelas": "XI-TKJ", "jurusan": "Teknik Komputer dan Jaringan",
          "jabatan": "ANGGOTA", "semester": "Ganjil (2025/2026)",
          "nilaiRataRata": 84.5, "rataMastery": 62, "ujianAktif": 2, "tugasAktif": 1,
          "streak": 3, "jamBelajar": 4.2, "progresBelajar": 55, "totalMateri": 10,
          "kompetensiTerkuat": { "nama": "Dasar Jaringan", "skor": 80, "mapel": "TI" },
          "kompetensiTerlemah": null,
          "nextUjian": { "nama": "UTS", "mapel": "TI", "berakhir": "2026-10-20T09:00:00Z" },
          "aiInsight": "Pertahankan!", "persentaseAbsensi": 92, "keaktifanMateri": 40,
          "keaktifanAI": 10, "keaktifanAplikasi": 60, "hadirAbsensi": 23, "totalAbsensi": 25,
          "materiDiakses": 4, "aiChatCount": 5, "totalAktivitas": 50,
          "pengumuman": [ { "id": "p1", "judul": "Libur", "isi": "Libur sekolah", "author": "Admin", "createdAt": "2026-10-01T00:00:00Z" } ]
        }
        """;

        var dto = JsonSerializer.Deserialize<SiswaDashboardDto>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.NotNull(dto);
        Assert.Equal("Andi Pratama", dto!.Nama);
        Assert.Equal(84.5, dto.NilaiRataRata);
        Assert.Equal("Dasar Jaringan", dto.KompetensiTerkuat!.Nama);
        Assert.Null(dto.KompetensiTerlemah);
        Assert.Single(dto.Pengumuman);
        Assert.Equal("Libur", dto.Pengumuman[0].Judul);
    }

    [Fact]
    public void GuruDashboardDto_terdeserialisasi_dari_shape_backend()
    {
        const string json = """{"kelasCount":1,"mapelCount":1,"siswaCount":3,"ujianAktif":0,"latihanAktif":1,"totalSoal":12,"rataNilai":80,"rataMastery":55}""";

        var dto = JsonSerializer.Deserialize<GuruDashboardDto>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Equal(3, dto!.SiswaCount);
        Assert.Equal(12, dto.TotalSoal);
    }

    [Fact]
    public async Task SiswaDashboard_pakai_token_sesi_dan_path_benar()
    {
        var api = new FakeApi { Response = JsonSerializer.Deserialize<SiswaDashboardDto>("""{"nama":"A","kelas":"X","pengumuman":[]}""", new JsonSerializerOptions(JsonSerializerDefaults.Web))! };
        var svc = new DashboardService(api, SiswaSession());

        var result = await svc.GetSiswaDashboardAsync();

        Assert.Equal("A", result.Nama);
        Assert.Equal("/api/mobile/siswa/dashboard", api.LastPath);
        Assert.Equal("tok-siswa", api.LastToken);
    }

    [Fact]
    public async Task GuruDashboard_pakai_token_sesi_dan_path_benar()
    {
        var api = new FakeApi { Response = new GuruDashboardDto { SiswaCount = 7 } };
        var svc = new DashboardService(api, SiswaSession());

        var result = await svc.GetGuruDashboardAsync();

        Assert.Equal(7, result.SiswaCount);
        Assert.Equal("/api/mobile/guru/dashboard", api.LastPath);
        Assert.Equal("tok-siswa", api.LastToken);
    }

    [Fact]
    public async Task Dashboard_tanpa_sesi_lempar_unauthorized()
    {
        var svc = new DashboardService(new FakeApi(), new FakeSession());

        var ex = await Assert.ThrowsAsync<ApiException>(() => svc.GetSiswaDashboardAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, ex.StatusCode);
    }
}
