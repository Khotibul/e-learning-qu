using E_LearningQu.Application.Abstractions;
using E_LearningQu.Domain.Identity;

namespace E_LearningQu.Application.Services;

/// <summary>
/// Registry menu desktop — dipetakan dari NAV_ITEMS website + aturan pondok.
/// Tampil berdasarkan permission session (role default + pondok grant).
/// Saat menu punya permission tapi ViewKey belum diimplementasi di shell,
/// shell merender PlaceholderView (tercatat sebagai GAP, bukan dianggap selesai).
/// </summary>
public sealed class NavigationService : INavigationService
{
    private static readonly IReadOnlyList<MenuItemDef> Registry = BuildRegistry();

    public IReadOnlyList<MenuItemDef> BuildMenu(UserSession session)
    {
        var result = new List<MenuItemDef>();
        foreach (var m in Registry)
        {
            if (!session.Has(m.PermissionKey)) continue;
            result.Add(m);
        }

        result.Sort((a, b) =>
        {
            var byModule = string.CompareOrdinal(a.ModuleKey, b.ModuleKey);
            return byModule != 0 ? byModule : a.SortOrder.CompareTo(b.SortOrder);
        });
        return result;
    }

    private static IReadOnlyList<MenuItemDef> BuildRegistry()
    {
        var list = new List<MenuItemDef>();
        void Add(string module, string feature, string route, string perm, string label, string icon, string view, int sort)
            => list.Add(new MenuItemDef(module, feature, route, perm, label, icon, view, null, sort));

        // ── SISWA ──────────────────────────────────────────────────────────
        Add("siswa", "dashboard", "/siswa", Domain.Identity.Permissions.SiswaDashboard, "Beranda", "\uE80F", "siswa-dashboard", 0);
        Add("siswa", "ai-tutor", "/siswa/ai-tutor", Domain.Identity.Permissions.SiswaAiTutor, "AI Tutor", "\uE99A", "siswa-ai-tutor", 1);
        Add("siswa", "ai-analitik", "/siswa/ai-analitik", Domain.Identity.Permissions.SiswaAiAnalitik, "AI Analitik", "\uE9D9", "siswa-ai-analitik", 2);
        Add("siswa", "ujian", "/siswa/ujian", Domain.Identity.Permissions.SiswaUjian, "Ujian", "\uE7C3", "siswa-ujian", 3);
        Add("siswa", "latihan", "/siswa/latihan", Domain.Identity.Permissions.SiswaLatihan, "Latihan", "\uE70F", "siswa-latihan", 4);
        Add("siswa", "absensi", "/siswa/absensi", Domain.Identity.Permissions.SiswaAbsensi, "Absensi", "\uE787", "siswa-absensi", 5);
        Add("siswa", "kehadiran", "/siswa/kehadiran", Domain.Identity.Permissions.SiswaKehadiran, "Monitoring Kehadiran", "\uE7B3", "siswa-kehadiran", 6);
        Add("siswa", "materi", "/siswa/materi", Domain.Identity.Permissions.SiswaMateri, "Materi", "\uE8A5", "siswa-materi", 7);
        Add("siswa", "struktur-kelas", "/siswa/struktur-kelas", Domain.Identity.Permissions.SiswaStrukturKelas, "Struktur Kelas", "\uE8A9", "siswa-struktur-kelas", 8);
        Add("siswa", "jadwal-piket", "/siswa/jadwal-piket", Domain.Identity.Permissions.SiswaJadwalPiket, "Jadwal Piket", "\uE8F5", "siswa-jadwal-piket", 9);
        Add("siswa", "jadwal-pelajaran", "/siswa/jadwal-pelajaran", Domain.Identity.Permissions.SiswaJadwalPelajaran, "Jadwal Pelajaran", "\uE823", "siswa-jadwal", 10);
        Add("siswa", "iuran", "/siswa/iuran", Domain.Identity.Permissions.SiswaIuran, "Iuran", "\uE8AB", "siswa-iuran", 11);
        Add("siswa", "dompet", "/siswa/dompet", Domain.Identity.Permissions.SiswaDompet, "Dompet", "\uE72E", "siswa-dompet", 12);
        Add("siswa", "kantin", "/kantin", Domain.Identity.Permissions.SiswaKantin, "Kantin", "\uE7BF", "kantin", 13);
        Add("siswa", "bendahara", "/siswa/bendahara", "siswa.bendahara", "Bendahara", "\uE8AB", "siswa-bendahara", 14);
        Add("siswa", "sekretaris", "/siswa/sekretaris", "siswa.sekretaris", "Sekretaris", "\uE8FD", "siswa-sekretaris", 15);
        Add("siswa", "nilai", "/siswa/nilai", Domain.Identity.Permissions.SiswaNilai, "Nilai", "\uE9D9", "siswa-nilai", 16);
        Add("siswa", "ranking", "/siswa/ranking", Domain.Identity.Permissions.SiswaRanking, "Ranking", "\uE734", "siswa-ranking", 17);
        Add("siswa", "izin", "/santri/izin", "santri.izin", "Perizinan Santri", "\uE8A5", "santri-izin", 18);
        Add("siswa", "pengaturan", "/siswa/pengaturan", Domain.Identity.Permissions.SiswaPengaturan, "Pengaturan", "\uE713", "siswa-pengaturan", 19);

        // ── GURU ───────────────────────────────────────────────────────────
        Add("guru", "dashboard", "/guru", Domain.Identity.Permissions.GuruDashboard, "Beranda", "\uE80F", "guru-dashboard", 0);
        Add("guru", "murid", "/guru/murid", Domain.Identity.Permissions.GuruMurid, "Murid", "\uE939", "guru-murid", 1);
        Add("guru", "bank-soal", "/guru/bank-soal", Domain.Identity.Permissions.GuruBankSoal, "Bank Soal", "\uE8F1", "guru-bank-soal", 2);
        Add("guru", "soal", "/guru/soal", Domain.Identity.Permissions.GuruSoal, "Soal", "\uE9CE", "guru-soal", 3);
        Add("guru", "ujian", "/guru/ujian", Domain.Identity.Permissions.GuruUjian, "Kelola Ujian", "\uE7C3", "guru-ujian", 4);
        Add("guru", "absensi", "/guru/absensi", Domain.Identity.Permissions.GuruAbsensi, "Absensi", "\uE787", "guru-absensi", 5);
        Add("guru", "wali-kelas", "/guru/wali-kelas", Domain.Identity.Permissions.GuruWaliKelas, "Wali Kelas", "\uE72E", "guru-wali-kelas", 6);
        Add("guru", "pelanggaran", "/guru/pelanggaran", Domain.Identity.Permissions.GuruPelanggaran, "Pelanggaran", "\uE7BA", "guru-pelanggaran", 7);
        Add("guru", "materi", "/guru/materi", Domain.Identity.Permissions.GuruMateri, "Materi", "\uE8A5", "guru-materi", 8);
        Add("guru", "ai-knowledge", "/guru/ai-knowledge", Domain.Identity.Permissions.GuruAiKnowledge, "AI Knowledge Base", "\uE8F1", "guru-ai-knowledge", 9);
        Add("guru", "nilai", "/guru/nilai", Domain.Identity.Permissions.GuruNilai, "Nilai", "\uE9D9", "guru-nilai", 10);
        Add("guru", "analitik", "/guru/analitik", Domain.Identity.Permissions.GuruAnalitik, "Analitik", "\uE890", "guru-analitik", 11);
        Add("guru", "intervensi", "/guru/intervensi", Domain.Identity.Permissions.GuruIntervensi, "Intervensi", "\uE90F", "guru-intervensi", 12);
        Add("guru", "anti-cheat", "/guru/anti-cheat", Domain.Identity.Permissions.GuruAntiCheat, "Anti-Cheat", "\uE72E", "guru-anti-cheat", 13);
        Add("guru", "izin-musyrif", "/guru/izin-musyrif", "guru.izin-musyrif", "Izin Musyrif", "\uE8A5", "guru-izin-musyrif", 14);
        Add("guru", "pengaturan", "/guru/pengaturan", "guru.pengaturan", "Pengaturan", "\uE713", "guru-pengaturan", 15);

        // ── ADMIN ──────────────────────────────────────────────────────────
        Add("admin", "dashboard", "/admin", Domain.Identity.Permissions.AdminDashboard, "Beranda", "\uE80F", "admin-dashboard", 0);
        Add("admin", "guru", "/admin/guru", Domain.Identity.Permissions.AdminGuru, "Guru", "\uE939", "admin-guru", 1);
        Add("admin", "murid", "/admin/murid", Domain.Identity.Permissions.AdminMurid, "Murid", "\uE939", "admin-murid", 2);
        Add("admin", "santri", "/admin/santri", Domain.Identity.Permissions.AdminSantri, "Santri", "\uE8A5", "admin-santri", 3);
        Add("admin", "ppdb", "/admin/ppdb", Domain.Identity.Permissions.AdminPpdb, "PPDB", "\uE7C1", "admin-ppdb", 4);
        Add("admin", "kelas", "/admin/kelas", Domain.Identity.Permissions.AdminKelas, "Kelas", "\uE8A9", "admin-kelas", 5);
        Add("admin", "jurusan", "/admin/jurusan", Domain.Identity.Permissions.AdminJurusan, "Jurusan", "\uE8AB", "admin-jurusan", 6);
        Add("admin", "kompetensi", "/admin/kompetensi", Domain.Identity.Permissions.AdminKompetensi, "Kompetensi", "\uE8FD", "admin-kompetensi", 7);
        Add("admin", "courses", "/admin/courses", Domain.Identity.Permissions.AdminCourses, "Courses", "\uE8A5", "admin-courses", 8);
        Add("admin", "mapel", "/admin/mapel", Domain.Identity.Permissions.AdminMapel, "Mata Pelajaran", "\uE8F1", "admin-mapel", 9);
        Add("admin", "tahun-ajaran", "/admin/tahun-ajaran", Domain.Identity.Permissions.AdminTahunAjaran, "Tahun Ajaran", "\uE787", "admin-tahun-ajaran", 10);
        Add("admin", "semester", "/admin/semester", Domain.Identity.Permissions.AdminSemester, "Semester", "\uE8F5", "admin-semester", 11);
        Add("admin", "jadwal", "/admin/jadwal", Domain.Identity.Permissions.AdminJadwal, "Jadwal Mengajar", "\uE823", "admin-jadwal", 12);
        Add("admin", "absensi-guru", "/admin/absensi-guru", Domain.Identity.Permissions.AdminAbsensiGuru, "Absensi Guru", "\uE72E", "admin-absensi-guru", 13);
        Add("admin", "fingerprint", "/admin/fingerprint", Domain.Identity.Permissions.AdminFingerprint, "Fingerprint", "\uE945", "admin-fingerprint", 14);
        Add("admin", "jadwal-ujian", "/admin/jadwal-ujian", Domain.Identity.Permissions.AdminJadwalUjian, "Jadwal Ujian", "\uE8F5", "admin-jadwal-ujian", 15);
        Add("admin", "pengumuman", "/admin/pengumuman", Domain.Identity.Permissions.AdminPengumuman, "Pengumuman", "\uE946", "admin-pengumuman", 16);
        Add("admin", "nilai", "/admin/nilai", Domain.Identity.Permissions.AdminNilai, "Nilai", "\uE9D9", "admin-nilai", 17);
        Add("admin", "izin", "/admin/izin", Domain.Identity.Permissions.AdminIzin, "Izin Santri", "\uE72E", "admin-izin", 18);
        Add("admin", "keuangan", "/bendahara", Domain.Identity.Permissions.AdminKeuangan, "Keuangan", "\uE8AB", "bendahara", 19);
        Add("admin", "kantin", "/kantin", Domain.Identity.Permissions.AdminKantin, "Kantin", "\uE7BF", "kantin", 20);
        Add("admin", "pengaturan", "/admin/pengaturan", Domain.Identity.Permissions.AdminPengaturan, "Pengaturan", "\uE713", "admin-pengaturan", 21);
        Add("admin", "researcher", "/admin/researcher", Domain.Identity.Permissions.AdminResearcher, "Researcher", "\uE943", "admin-researcher", 22);
        Add("admin", "statistik", "/admin/statistik", Domain.Identity.Permissions.AdminStatistik, "Statistik", "\uE9D9", "admin-statistik", 23);

        // ── KEPALA PONDOK ──────────────────────────────────────────────────
        Add("kepala-pondok", "dashboard", "/kepala-pondok", Domain.Identity.Permissions.KepalaPondokDashboard, "Beranda Kepala Pondok", "\uE80F", "kepala-pondok-dashboard", 0);
        Add("kepala-pondok", "keuangan", "/kepala-pondok/keuangan", Domain.Identity.Permissions.KepalaPondokKeuangan, "Keuangan Pondok", "\uE8AB", "kepala-pondok-keuangan", 1);
        Add("kepala-pondok", "gerbang", "/gerbang", Domain.Identity.Permissions.KepalaPondokGerbang, "Gerbang Pondok", "\uE7C1", "gerbang", 2);
        Add("kepala-pondok", "ustadz", "/ustadz", Domain.Identity.Permissions.KepalaPondokUstadz, "Ustadz Pondok", "\uE939", "ustadz", 3);
        Add("kepala-pondok", "pengurus", "/pengurus", Domain.Identity.Permissions.KepalaPondokPengurus, "Pengurus Pondok", "\uE8A9", "pengurus", 4);

        // ── PENGURUS PONDOK ────────────────────────────────────────────────
        Add("pengurus-pondok", "dashboard", "/pengurus", Domain.Identity.Permissions.PengurusPondokDashboard, "Beranda Pengurus", "\uE80F", "pengurus-dashboard", 0);
        Add("pengurus-pondok", "gerbang", "/gerbang", Domain.Identity.Permissions.PengurusPondokGerbang, "Gerbang Pondok", "\uE7C1", "gerbang", 1);
        Add("pengurus-pondok", "ustadz", "/ustadz", Domain.Identity.Permissions.PengurusPondokUstadz, "Ustadz Pondok", "\uE939", "ustadz", 2);

        // ── USTADZ PONDOK ──────────────────────────────────────────────────
        Add("ustadz-pondok", "dashboard", "/ustadz", Domain.Identity.Permissions.UstadzPondokDashboard, "Beranda Ustadz", "\uE80F", "ustadz-dashboard", 0);
        Add("ustadz-pondok", "pengurus", "/pengurus", Domain.Identity.Permissions.UstadzPondokPengurus, "Pengurus Pondok", "\uE8A9", "pengurus", 1);

        // ── RESEARCHER ─────────────────────────────────────────────────────
        Add("researcher", "researcher", "/admin/researcher", Domain.Identity.Permissions.AdminResearcher, "Researcher", "\uE943", "admin-researcher", 0);
        Add("researcher", "statistik", "/admin/statistik", Domain.Identity.Permissions.AdminStatistik, "Statistik", "\uE9D9", "admin-statistik", 1);

        return list;
    }
}