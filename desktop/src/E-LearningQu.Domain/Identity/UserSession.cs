using E_LearningQu.Domain.Enums;

namespace E_LearningQu.Domain.Identity;

/// <summary>Penugasan pondok aktif (mirror prisma PondokStaffAssignment).</summary>
public sealed record PondokAssignment(string Tipe, string? AsramaId, string? KamarId, string? HalaqahId, string? KelasDiniyahId, string? Unit);

/// <summary>Grant permission granular pondok (mirror prisma PondokPermissionGrant).</summary>
public sealed record PondokGrant(string Permission, string? ScopeType, string? ScopeId);

/// <summary>
/// Sesi user login (satu-satunya sumber kebenaran sesi di client desktop).
/// Token disimpan terenkripsi DPAPI — tidak pernah plaintext di disk.
/// </summary>
public sealed record UserSession
{
    public required string UserId { get; init; }
    public required Role Role { get; init; }
    public required string Token { get; init; }
    public string? RefreshToken { get; init; }
    public required string Email { get; init; }
    public required string Name { get; init; }
    public string? ImageUrl { get; init; }
    public string? SiswaId { get; init; }
    public string? GuruId { get; init; }
    public string? Jabatan { get; init; }
    public string? KelasId { get; init; }
    public string? KelasNama { get; init; }

    /// <summary>Effective permission (role default + pondok grant). Di-set saat login/restore.
    /// Concrete HashSet agar bisa di-serialize/deserialize DPAPI + di-mutate saat login.</summary>
    public HashSet<string> Permissions { get; set; } = new(StringComparer.Ordinal);

    public List<PondokAssignment> PondokAssignments { get; set; } = new();
    public List<PondokGrant> PondokGrants { get; set; } = new();

    public string DisplayName => string.IsNullOrWhiteSpace(Name) ? Email : Name;

    public bool Has(string permission) => Permissions.Contains(permission);
}
