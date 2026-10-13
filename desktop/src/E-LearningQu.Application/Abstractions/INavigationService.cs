using E_LearningQu.Domain.Identity;

namespace E_LearningQu.Application.Abstractions;

/// <summary>
/// Satu entri menu desktop. Semua metadata (module/feature/route/permission/scope) dibawa
/// agar shell cukup merender tanpa menghardcode aturan.
/// ViewKey dipakai shell (layer Desktop) untuk memetakan ke View+ViewModel nyata —
/// Application tidak boleh tahu tipe WPF.
/// </summary>
public sealed record MenuItemDef(
    string ModuleKey,
    string FeatureKey,
    string RouteKey,
    string PermissionKey,
    string DisplayName,
    string Icon,
    string ViewKey,
    string? Scope = null,
    int SortOrder = 0);

/// <summary>
/// Menu generator — sumber tunggal struktur menu desktop.
/// Menu tampil IFF session memiliki PermissionKey (dan scope valid bila ada).
/// Backend tetap wajib memvalidasi ulang; ini hanya lapisan presentasi.
/// </summary>
public interface INavigationService
{
    IReadOnlyList<MenuItemDef> BuildMenu(UserSession session);
}