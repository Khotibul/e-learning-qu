using E_LearningQu.Domain.Enums;

namespace E_LearningQu.UnitTests;

public class RoleParserTests
{
    [Theory]
    [InlineData("SISWA", Role.SISWA)]
    [InlineData("siswa", Role.SISWA)]
    [InlineData("GURU", Role.GURU)]
    [InlineData("ADMIN", Role.ADMIN)]
    [InlineData("RESEARCHER", Role.RESEARCHER)]
    [InlineData("KEPALA_PONDOK", Role.KEPALA_PONDOK)]
    [InlineData("PENGURUS_PONDOK", Role.PENGURUS_PONDOK)]
    [InlineData("USTADZ_PONDOK", Role.USTADZ_PONDOK)]
    public void TryParse_role_backend_valid(string input, Role expected)
    {
        var ok = RoleParser.TryParse(input, out var role);
        Assert.True(ok);
        Assert.Equal(expected, role);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("SUPERUSER")]
    [InlineData("SISWA_EXTRA")]
    public void TryParse_role_invalid(string? input)
    {
        var ok = RoleParser.TryParse(input, out _);
        Assert.False(ok);
    }

    [Fact]
    public void Semua_enum_role_memiliki_string_backend()
    {
        var names = Enum.GetNames<Role>();
        Assert.Contains("SISWA", names);
        Assert.Contains("GURU", names);
        Assert.Contains("ADMIN", names);
        Assert.Contains("KEPALA_PONDOK", names);
        Assert.Contains("USTADZ_PONDOK", names);
    }
}
