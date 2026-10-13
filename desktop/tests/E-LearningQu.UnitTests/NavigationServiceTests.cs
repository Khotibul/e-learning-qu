using E_LearningQu.Application.Services;
using E_LearningQu.Domain.Enums;
using E_LearningQu.Domain.Identity;
using Xunit;

namespace E_LearningQu.UnitTests;

public class NavigationServiceTests
{
    private static UserSession SessionFor(Role role)
    {
        var perms = new HashSet<string>(RolePermissionMap.For(role), StringComparer.Ordinal);
        return new UserSession
        {
            UserId = "u1",
            Role = role,
            Token = "t",
            RefreshToken = "r",
            Email = "u@x.id",
            Name = "U",
            Permissions = perms,
        };
    }

    [Fact]
    public void Siswa_hanya_menu_yang_permissionnya_dimiliki()
    {
        var nav = new NavigationService();
        var menu = nav.BuildMenu(SessionFor(Role.SISWA));

        Assert.NotEmpty(menu);
        Assert.All(menu, m => Assert.StartsWith("siswa.", m.PermissionKey));
        Assert.Contains(menu, m => m.ViewKey == "siswa-ujian");
        Assert.Contains(menu, m => m.ViewKey == "siswa-nilai");
        // Tidak ada menu admin/guru/pondok.
        Assert.DoesNotContain(menu, m => m.PermissionKey.StartsWith("admin."));
        Assert.DoesNotContain(menu, m => m.PermissionKey.StartsWith("guru."));
        Assert.DoesNotContain(menu, m => m.PermissionKey.StartsWith("kepala-pondok."));
    }

    [Fact]
    public void Admin_punya_menu_dan_tidak_bocor_menu_siswa()
    {
        var nav = new NavigationService();
        var menu = nav.BuildMenu(SessionFor(Role.ADMIN));

        Assert.NotEmpty(menu);
        Assert.Contains(menu, m => m.ViewKey == "admin-guru" || m.ModuleKey == "admin");
        Assert.DoesNotContain(menu, m => m.PermissionKey.StartsWith("siswa."));
        Assert.DoesNotContain(menu, m => m.PermissionKey.StartsWith("guru."));
    }

    [Fact]
    public void KepalaPondok_hanya_menu_pondok()
    {
        var nav = new NavigationService();
        var menu = nav.BuildMenu(SessionFor(Role.KEPALA_PONDOK));

        Assert.NotEmpty(menu);
        Assert.All(menu, m => Assert.StartsWith("kepala-pondok.", m.PermissionKey));
        Assert.DoesNotContain(menu, m => m.PermissionKey.StartsWith("siswa."));
    }

    [Fact]
    public void Role_tanpa_permission_menu_kosong()
    {
        var nav = new NavigationService();
        var session = SessionFor(Role.SISWA) with { Permissions = new HashSet<string>(StringComparer.Ordinal) };
        var menu = nav.BuildMenu(session);
        Assert.Empty(menu);
    }

    [Fact]
    public void Grant_pondok_menambah_menu_tanpa_mengubah_role()
    {
        // SISWA + grant admin.researcher → menu researcher muncul tanpa jadi ADMIN.
        var session = SessionFor(Role.SISWA);
        session.Permissions.Add("admin.researcher");
        var nav = new NavigationService();
        var menu = nav.BuildMenu(session);

        Assert.Contains(menu, m => m.PermissionKey == "admin.researcher");
        Assert.Contains(menu, m => m.PermissionKey == "siswa.dashboard");
        Assert.Equal(Role.SISWA, session.Role);
    }

    [Fact]
    public void Menu_terurut_module_lalu_sortorder()
    {
        var nav = new NavigationService();
        var menu = nav.BuildMenu(SessionFor(Role.SISWA));
        for (var i = 1; i < menu.Count; i++)
        {
            var byModule = string.CompareOrdinal(menu[i - 1].ModuleKey, menu[i].ModuleKey);
            if (byModule == 0)
                Assert.True(menu[i - 1].SortOrder <= menu[i].SortOrder);
            else
                Assert.True(byModule < 0);
        }
    }
}