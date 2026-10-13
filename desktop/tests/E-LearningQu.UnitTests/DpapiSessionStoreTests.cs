using E_LearningQu.Domain.Enums;
using E_LearningQu.Domain.Identity;
using E_LearningQu.Infrastructure.Storage;

namespace E_LearningQu.UnitTests;

/// <summary>DPAPI CurrentUser — test ini hanya berjalan di Windows (aman: CI/dev desktop = Windows).</summary>
public class DpapiSessionStoreTests : IDisposable
{
    private readonly string _path = Path.Combine(Path.GetTempPath(), "e-learning-qu-tests", Guid.NewGuid() + ".bin");

    public void Dispose()
    {
        if (File.Exists(_path)) File.Delete(_path);
    }

    [Fact]
    public async Task Save_lalu_load_kembalikan_sesi_sama()
    {
        var store = new DpapiSessionStore(_path);
        var session = new UserSession
        {
            UserId = "u-1",
            Role = Role.SISWA,
            Token = "token-rahasia-123",
            Email = "siswa@x.id",
            Name = "Budi",
            SiswaId = "s-1",
            KelasId = "k-1",
            KelasNama = "X-1",
            Jabatan = "ANGGOTA"
        };

        await store.SaveAsync(session);
        var loaded = await store.LoadAsync();

        Assert.NotNull(loaded);
        Assert.Equal(session.UserId, loaded!.UserId);
        Assert.Equal(Role.SISWA, loaded.Role);
        Assert.Equal("token-rahasia-123", loaded.Token);
        Assert.Equal("X-1", loaded.KelasNama);
    }

    [Fact]
    public async Task File_di_disk_tidak_berisi_token_plaintext()
    {
        var store = new DpapiSessionStore(_path);
        await store.SaveAsync(new UserSession
        {
            UserId = "u-1", Role = Role.GURU, Token = "token-tersimpan-jangan-terbaca",
            Email = "g@x.id", Name = "Guru"
        });

        var raw = await File.ReadAllBytesAsync(_path);
        var text = Convert.ToBase64String(raw);

        Assert.DoesNotContain("token-tersimpan-jangan-terbaca", text);
        Assert.False(EncodingContains(raw, "token-tersimpan-jangan-terbaca"u8.ToArray()));
    }

    [Fact]
    public async Task Load_tanpa_file_kembalikan_null()
    {
        var store = new DpapiSessionStore(_path);
        Assert.Null(await store.LoadAsync());
    }

    [Fact]
    public async Task Clear_menghapus_file()
    {
        var store = new DpapiSessionStore(_path);
        await store.SaveAsync(new UserSession { UserId = "u", Role = Role.SISWA, Token = "t", Email = "e", Name = "n" });
        Assert.True(File.Exists(_path));

        await store.ClearAsync();

        Assert.False(File.Exists(_path));
        Assert.Null(await store.LoadAsync());
    }

    [Fact]
    public async Task File_korup_dianggap_tidak_ada_sesi()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        await File.WriteAllBytesAsync(_path, "bukan-dpapi"[..].Select(b => (byte)b).ToArray());

        var store = new DpapiSessionStore(_path);
        Assert.Null(await store.LoadAsync());
    }

    private static bool EncodingContains(byte[] haystack, byte[] needle)
    {
        for (var i = 0; i <= haystack.Length - needle.Length; i++)
        {
            var match = true;
            for (var j = 0; j < needle.Length; j++)
                if (haystack[i + j] != needle[j]) { match = false; break; }
            if (match) return true;
        }
        return false;
    }
}
