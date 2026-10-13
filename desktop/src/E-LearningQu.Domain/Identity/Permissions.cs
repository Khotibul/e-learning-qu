using E_LearningQu.Domain.Enums;

namespace E_LearningQu.Domain.Identity;

/// <summary>
/// Kode permission (string) — sinkron dengan website (NAV_ITEMS href + PONDOK_PERMISSIONS).
/// Desktop hanya menampilkan menu/halaman yang permission-nya dimiliki.
/// Backend tetap wajib memvalidasi permission (desktop tidak jadi satu-satunya gate).
/// </summary>
public static class Permissions
{
    // Admin
    public const string AdminDashboard = "admin.dashboard";
    public const string AdminGuru = "admin.guru";
    public const string AdminMurid = "admin.murid";
    public const string AdminSantri = "admin.santri";
    public const string AdminPpdb = "admin.ppdb";
    public const string AdminKelas = "admin.kelas";
    public const string AdminJurusan = "admin.jurusan";
    public const string AdminKompetensi = "admin.kompetensi";
    public const string AdminCourses = "admin.courses";
    public const string AdminMapel = "admin.mapel";
    public const string AdminTahunAjaran = "admin.tahun-ajaran";
    public const string AdminSemester = "admin.semester";
    public const string AdminJadwal = "admin.jadwal";
    public const string AdminAbsensiGuru = "admin.absensi-guru";
    public const string AdminFingerprint = "admin.fingerprint";
    public const string AdminJadwalUjian = "admin.jadwal-ujian";
    public const string AdminPengumuman = "admin.pengumuman";
    public const string AdminNilai = "admin.nilai";
    public const string AdminIzin = "admin.izin";
    public const string AdminKeuangan = "admin.keuangan";
    public const string AdminKantin = "admin.kantin";
    public const string AdminPengaturan = "admin.pengaturan";
    public const string AdminResearcher = "admin.researcher";
    public const string AdminStatistik = "admin.statistik";

    // Guru
    public const string GuruDashboard = "guru.dashboard";
    public const string GuruMurid = "guru.murid";
    public const string GuruBankSoal = "guru.bank-soal";
    public const string GuruSoal = "guru.soal";
    public const string GuruUjian = "guru.ujian";
    public const string GuruAbsensi = "guru.absensi";
    public const string GuruWaliKelas = "guru.wali-kelas";
    public const string GuruPelanggaran = "guru.pelanggaran";
    public const string GuruMateri = "guru.materi";
    public const string GuruNilai = "guru.nilai";
    public const string GuruAnalitik = "guru.analitik";
    public const string GuruIntervensi = "guru.intervensi";
    public const string GuruAntiCheat = "guru.anti-cheat";
    public const string GuruAiKnowledge = "guru.ai-knowledge";

    // Siswa
    public const string SiswaDashboard = "siswa.dashboard";
    public const string SiswaAiTutor = "siswa.ai-tutor";
    public const string SiswaAiAnalitik = "siswa.ai-analitik";
    public const string SiswaUjian = "siswa.ujian";
    public const string SiswaLatihan = "siswa.latihan";
    public const string SiswaAbsensi = "siswa.absensi";
    public const string SiswaKehadiran = "siswa.kehadiran";
    public const string SiswaMateri = "siswa.materi";
    public const string SiswaStrukturKelas = "siswa.struktur-kelas";
    public const string SiswaJadwalPiket = "siswa.jadwal-piket";
    public const string SiswaJadwalPelajaran = "siswa.jadwal-pelajaran";
    public const string SiswaIuran = "siswa.iuran";
    public const string SiswaDompet = "siswa.dompet";
    public const string SiswaKantin = "siswa.kantin";
    public const string SiswaNilai = "siswa.nilai";
    public const string SiswaRanking = "siswa.ranking";
    public const string SiswaPengaturan = "siswa.pengaturan";

    // Kepala Pondok
    public const string KepalaPondokDashboard = "kepala-pondok.dashboard";
    public const string KepalaPondokKeuangan = "kepala-pondok.keuangan";
    public const string KepalaPondokGerbang = "kepala-pondok.gerbang";
    public const string KepalaPondokUstadz = "kepala-pondok.ustadz";
    public const string KepalaPondokPengurus = "kepala-pondok.pengurus";

    // Pengurus Pondok
    public const string PengurusPondokDashboard = "pengurus-pondok.dashboard";
    public const string PengurusPondokGerbang = "pengurus-pondok.gerbang";
    public const string PengurusPondokUstadz = "pengurus-pondok.ustadz";

    // Ustadz Pondok
    public const string UstadzPondokDashboard = "ustadz-pondok.dashboard";
    public const string UstadzPondokPengurus = "ustadz-pondok.pengurus";
}

/// <summary>Pemetaan Role → set permission default (mirror website NAV_ITEMS + aturan pondok).</summary>
public static class RolePermissionMap
{
    public static IReadOnlySet<string> For(Role role) => role switch
    {
        Role.ADMIN => new HashSet<string>(StringComparer.Ordinal)
        {
            Permissions.AdminDashboard, Permissions.AdminGuru, Permissions.AdminMurid, Permissions.AdminSantri,
            Permissions.AdminPpdb, Permissions.AdminKelas, Permissions.AdminJurusan, Permissions.AdminKompetensi,
            Permissions.AdminCourses, Permissions.AdminMapel, Permissions.AdminTahunAjaran, Permissions.AdminSemester,
            Permissions.AdminJadwal, Permissions.AdminAbsensiGuru, Permissions.AdminFingerprint, Permissions.AdminJadwalUjian,
            Permissions.AdminPengumuman, Permissions.AdminNilai, Permissions.AdminIzin, Permissions.AdminKeuangan,
            Permissions.AdminKantin, Permissions.AdminPengaturan, Permissions.AdminResearcher, Permissions.AdminStatistik,
        },
        Role.GURU => new HashSet<string>(StringComparer.Ordinal)
        {
            Permissions.GuruDashboard, Permissions.GuruMurid, Permissions.GuruBankSoal, Permissions.GuruSoal,
            Permissions.GuruUjian, Permissions.GuruAbsensi, Permissions.GuruWaliKelas, Permissions.GuruPelanggaran,
            Permissions.GuruMateri, Permissions.GuruNilai, Permissions.GuruAnalitik, Permissions.GuruIntervensi,
            Permissions.GuruAntiCheat, Permissions.GuruAiKnowledge,
        },
        Role.SISWA => new HashSet<string>(StringComparer.Ordinal)
        {
            Permissions.SiswaDashboard, Permissions.SiswaAiTutor, Permissions.SiswaAiAnalitik, Permissions.SiswaUjian,
            Permissions.SiswaLatihan, Permissions.SiswaAbsensi, Permissions.SiswaKehadiran, Permissions.SiswaMateri,
            Permissions.SiswaStrukturKelas, Permissions.SiswaJadwalPiket, Permissions.SiswaJadwalPelajaran,
            Permissions.SiswaIuran, Permissions.SiswaDompet, Permissions.SiswaKantin, Permissions.SiswaNilai,
            Permissions.SiswaRanking, Permissions.SiswaPengaturan,
        },
        Role.RESEARCHER => new HashSet<string>(StringComparer.Ordinal) { Permissions.AdminResearcher, Permissions.AdminStatistik },
        Role.KEPALA_PONDOK => new HashSet<string>(StringComparer.Ordinal)
        {
            Permissions.KepalaPondokDashboard, Permissions.KepalaPondokKeuangan, Permissions.KepalaPondokGerbang,
            Permissions.KepalaPondokUstadz, Permissions.KepalaPondokPengurus,
        },
        Role.PENGURUS_PONDOK => new HashSet<string>(StringComparer.Ordinal)
        {
            Permissions.PengurusPondokDashboard, Permissions.PengurusPondokGerbang, Permissions.PengurusPondokUstadz,
        },
        Role.USTADZ_PONDOK => new HashSet<string>(StringComparer.Ordinal)
        {
            Permissions.UstadzPondokDashboard, Permissions.UstadzPondokPengurus,
        },
        _ => new HashSet<string>(StringComparer.Ordinal),
    };
}
