using System.Text.Json;
using E_LearningQu.Contracts.Auth;

namespace E_LearningQu.UnitTests;

/// <summary>Kontrak JSON dicocokkan dengan respons nyata backend mobile (bukan asumsi).</summary>
public class LoginDtoTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [Fact]
    public void LoginResponse_dari_backend_siswa_terdeserialisasi()
    {
        const string json = """
        {
          "success": true,
          "token": "dXNlcjE6U0lTVEE6MTcy",
          "user": { "id": "u-1", "email": "siswa@x.id", "name": "Budi", "image": null, "role": "SISWA" },
          "extra": {
            "siswaId": "s-1",
            "siswaNama": "Budi",
            "kelas": { "id": "k-1", "nama": "X-1" },
            "jabatan": "ANGGOTA"
          }
        }
        """;

        var dto = JsonSerializer.Deserialize<LoginResponseDto>(json, Web);

        Assert.NotNull(dto);
        Assert.True(dto!.Success);
        Assert.Equal("dXNlcjE6U0lTVEE6MTcy", dto.Token);
        Assert.Equal("SISWA", dto.User!.Role);
        Assert.Equal("s-1", dto.Extra!.Value.GetProperty("siswaId").GetString());
        Assert.Equal("X-1", dto.Extra!.Value.GetProperty("kelas").GetProperty("nama").GetString());
    }

    [Fact]
    public void LoginResponse_guru_punya_extra_guruId()
    {
        const string json = """
        { "success": true, "token": "t", "user": { "id": "u-2", "email": "g@x.id", "name": "Guru", "role": "GURU" },
          "extra": { "guruId": "g-1", "guruNama": "Guru", "jabatan": "WALI_KELAS" } }
        """;

        var dto = JsonSerializer.Deserialize<LoginResponseDto>(json, Web);

        Assert.Equal("g-1", dto!.Extra!.Value.GetProperty("guruId").GetString());
        Assert.Equal("WALI_KELAS", dto.Extra!.Value.GetProperty("jabatan").GetString());
    }

    [Fact]
    public void LoginRequest_terserialisasi_camelCase_untuk_backend()
    {
        var request = new LoginRequest("a@b.id", "rahasia", "SISWA");
        var json = JsonSerializer.Serialize(request, Web);

        Assert.Contains("\"email\":\"a@b.id\"", json);
        Assert.Contains("\"password\":\"rahasia\"", json);
        Assert.Contains("\"role\":\"SISWA\"", json);
    }
}
