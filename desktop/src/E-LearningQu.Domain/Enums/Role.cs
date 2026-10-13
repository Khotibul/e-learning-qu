namespace E_LearningQu.Domain.Enums;

/// <summary>Role user sesuai backend Prisma (src/constants &amp; prisma/schema.prisma).</summary>
public enum Role
{
    SISWA,
    GURU,
    ADMIN,
    RESEARCHER,
    KEPALA_PONDOK,
    PENGURUS_PONDOK,
    USTADZ_PONDOK
}

public static class RoleParser
{
    public static bool TryParse(string? value, out Role role)
    {
        role = default;
        if (string.IsNullOrWhiteSpace(value)) return false;
        return Enum.TryParse(value.Trim(), ignoreCase: true, out role)
               && Enum.IsDefined(role);
    }
}
