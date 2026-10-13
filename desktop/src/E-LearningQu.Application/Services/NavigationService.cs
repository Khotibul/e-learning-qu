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
        Add("siswa", "dashboard", "/siswa", Domain.Identity.Permissions.SiswaDashboard, "Beranda", "🏠", "siswa-dashboard", 0);
        Add("siswa", "ai-tutor", "/siswa/ai-tutor", Domain.Identity.Permissions.SiswaAiTutor, "AI Tutor", "🤖", "siswa-ai-tutor", 1);
        Add("siswa", "ai-analitik", "/siswa/ai-analitik", Domain.Identity.Permissions.SiswaAiAnalitik, "AI Analitik", "🧠", "siswa-ai-analitik", 2);
        Add("siswa", "ujian", "/siswa/ujian", Domain.Identity.Permissions.SiswaUjian, "Ujian", "📝", "siswa-ujian", 3);
        Add("siswa", "latihan", "/siswa/latihan", Domain.Identity.Permissions.SiswaLatihan, "Latihan", "✏️", "siswa-latihan", 4);
        Add("siswa", "absensi", "/siswa/absensi", Domain.Identity.Permissions.SiswaAbsensi, "Absensi", "🗓️", "siswa-absensi", 5);
        Add("siswa", "kehadiran", "/siswa/kehadiran", Domain.Identity.Permissions.SiswaKehadiran, "Monitoring Kehadiran", "📍", "siswa-kehadiran", 6);
        Add("siswa", "materi", "/siswa/materi", Domain.Identity.Permissions.SiswaMateri, "Materi", "📖", "siswa-materi", 7);
        Add("siswa", "struktur-kelas", "/siswa/struktur-kelas", Domain.Identity.Permissions.SiswaStrukturKelas, "Struktur Kelas", "👥", "siswa-struktur-kelas", 8);
        Add("siswa", "jadwal-piket", "/siswa/jadwal-piket", Domain.Identity.Permissions.SiswaJadwalPiket, "Jadwal Piket", "🗓️", "siswa-jadwal-piket", 9);
        Add("siswa", "jadwal-pelajaran", "/siswa/jadwal-pelajaran", Domain.Identity.Permissions.SiswaJadwalPelajaran, "Jadwal Pelajaran", "🗓️", "siswa-jadwal", 10);
        Add("siswa", "iuran", "/siswa/iuran", Domain.Identity.Permissions.SiswaIuran, "Iuran", "🧾", "siswa-iuran", 11);
        Add("siswa", "dompet", "/siswa/dompet", Domain.Identity.Permissions.SiswaDompet, "Dompet", "👛", "siswa-dompet", 12);
        Add("siswa", "kantin", "/kantin", Domain.Identity.Permissions.SiswaKantin, "Kantin", "🛒", "kantin", 13);
        Add("siswa", "bendahara", "/siswa/bendahara", "siswa.bendahara", "Bendahara", "💰", "siswa-bendahara", 14);
        Add("siswa", "sekretaris", "/siswa/sekretaris", "siswa.sekretaris", "Sekretaris", "📋", "siswa-sekretaris", 15);
        Add("siswa", "nilai", "/siswa/nilai", Domain.Identity.Permissions.SiswaNilai, "Nilai", "📊", "siswa-nilai", 16);
        Add("siswa", "ranking", "/siswa/ranking", Domain.Identity.Permissions.SiswaRanking, "Ranking", "🏆", "siswa-ranking", 17);
        Add("siswa", "izin", "/santri/izin", "santri.izin", "Perizinan Santri", "📄", "santri-izin", 18);
        Add("siswa", "pengaturan", "/siswa/pengaturan", Domain.Identity.Permissions.SiswaPengaturan, "Pengaturan", "⚙️", "siswa-pengaturan", 19);

        // ── GURU ───────────────────────────────────────────────────────────
        Add("guru", "dashboard", "/guru", Domain.Identity.Permissions.GuruDashboard, "Beranda", "🏠", "guru-dashboard", 0);
        Add("guru", "murid", "/guru/murid", Domain.Identity.Permissions.GuruMurid, "Murid", "👨‍🎓", "guru-murid", 1);
        Add("guru", "bank-soal", "/guru/bank-soal", Domain.Identity.Permissions.GuruBankSoal, "Bank Soal", "🗂️", "guru-bank-soal", 2);
        Add("guru", "soal", "/guru/soal", Domain.Identity.Permissions.GuruSoal, "Soal", "❓", "guru-soal", 3);
        Add("guru", "ujian", "/guru/ujian", Domain.Identity.Permissions.GuruUjian, "Kelola Ujian", "📝", "guru-ujian", 4);
        Add("guru", "absensi", "/guru/absensi", Domain.Identity.Permissions.GuruAbsensi, "Absensi", "🗓️", "guru-absensi", 5);
        Add("guru", "wali-kelas", "/guru/wali-kelas", Domain.Identity.Permissions.GuruWaliKelas, "Wali Kelas", "🛡️", "guru-wali-kelas", 6);
        Add("guru", "pelanggaran", "/guru/pelanggaran", Domain.Identity.Permissions.GuruPelanggaran, "Pelanggaran", "⚖️", "guru-pelanggaran", 7);
        Add("guru", "materi", "/guru/materi", Domain.Identity.Permissions.GuruMateri, "Materi", "📖", "guru-materi", 8);
        Add("guru", "ai-knowledge", "/guru/ai-knowledge", Domain.Identity.Permissions.GuruAiKnowledge, "AI Knowledge Base", "📚", "guru-ai-knowledge", 9);
        Add("guru", "nilai", "/guru/nilai", Domain.Identity.Permissions.GuruNilai, "Nilai", "📊", "guru-nilai", 10);
        Add("guru", "analitik", "/guru/analitik", Domain.Identity.Permissions.GuruAnalitik, "Analitik", "📈", "guru-analitik", 11);
        Add("guru", "intervensi", "/guru/intervensi", Domain.Identity.Permissions.GuruIntervensi, "Intervensi", "🩺", "guru-intervensi", 12);
        Add("guru", "anti-cheat", "/guru/anti-cheat", Domain.Identity.Permissions.GuruAntiCheat, "Anti-Cheat", "🛡️", "guru-anti-cheat", 13);
        Add("guru", "izin-musyrif", "/guru/izin-musyrif", "guru.izin-musyrif", "Izin Musyrif", "📄", "guru-izin-musyrif", 14);
        Add("guru", "pengaturan", "/guru/pengaturan", "guru.pengaturan", "Pengaturan", "⚙️", "guru-pengaturan", 15);

        // ── ADMIN ──────────────────────────────────────────────────────────
        Add("admin", "dashboard", "/admin", Domain.Identity.Permissions.AdminDashboard, "Beranda", "🏠", "admin-dashboard", 0);
        Add("admin", "guru", "/admin/guru", Domain.Identity.Permissions.AdminGuru, "Guru", "👩‍🏫", "admin-guru", 1);
        Add("admin", "murid", "/admin/murid", Domain.Identity.Permissions.AdminMurid, "Murid", "👨‍🎓", "admin-murid", 2);
        Add("admin", "santri", "/admin/santri", Domain.Identity.Permissions.AdminSantri, "Santri", "🕌", "admin-santri", 3);
        Add("admin", "ppdb", "/admin/ppdb", Domain.Identity.Permissions.AdminPpdb, "PPDB", "📮", "admin-ppdb", 4);
        Add("admin", "kelas", "/admin/kelas", Domain.Identity.Permissions.AdminKelas, "Kelas", "🏫", "admin-kelas", 5);
        Add("admin", "jurusan", "/admin/jurusan", Domain.Identity.Permissions.AdminJurusan, "Jurusan", "🎓", "admin-jurusan", 6);
        Add("admin", "kompetensi", "/admin/kompetensi", Domain.Identity.Permissions.AdminKompetensi, "Kompetensi", "🎯", "admin-kompetensi", 7);
        Add("admin", "courses", "/admin/courses", Domain.Identity.Permissions.AdminCourses, "Courses", "📖", "admin-courses", 8);
        Add("admin", "mapel", "/admin/mapel", Domain.Identity.Permissions.AdminMapel, "Mata Pelajaran", "📚", "admin-mapel", 9);
        Add("admin", "tahun-ajaran", "/admin/tahun-ajaran", Domain.Identity.Permissions.AdminTahunAjaran, "Tahun Ajaran", "📅", "admin-tahun-ajaran", 10);
        Add("admin", "semester", "/admin/semester", Domain.Identity.Permissions.AdminSemester, "Semester", "📅", "admin-semester", 11);
        Add("admin", "jadwal", "/admin/jadwal", Domain.Identity.Permissions.AdminJadwal, "Jadwal Mengajar", "🗓️", "admin-jadwal", 12);
        Add("admin", "absensi-guru", "/admin/absensi-guru", Domain.Identity.Permissions.AdminAbsensiGuru, "Absensi Guru", "🛡️", "admin-absensi-guru", 13);
        Add("admin", "fingerprint", "/admin/fingerprint", Domain.Identity.Permissions.AdminFingerprint, "Fingerprint", "👆", "admin-fingerprint", 14);
        Add("admin", "jadwal-ujian", "/admin/jadwal-ujian", Domain.Identity.Permissions.AdminJadwalUjian, "Jadwal Ujian", "🗓️", "admin-jadwal-ujian", 15);
        Add("admin", "pengumuman", "/admin/pengumuman", Domain.Identity.Permissions.AdminPengumuman, "Pengumuman", "📢", "admin-pengumuman", 16);
        Add("admin", "nilai", "/admin/nilai", Domain.Identity.Permissions.AdminNilai, "Nilai", "📊", "admin-nilai", 17);
        Add("admin", "izin", "/admin/izin", Domain.Identity.Permissions.AdminIzin, "Izin Santri", "🛡️", "admin-izin", 18);
        Add("admin", "keuangan", "/bendahara", Domain.Identity.Permissions.AdminKeuangan, "Keuangan", "💰", "bendahara", 19);
        Add("admin", "kantin", "/kantin", Domain.Identity.Permissions.AdminKantin, "Kantin", "🛒", "kantin", 20);
        Add("admin", "pengaturan", "/admin/pengaturan", Domain.Identity.Permissions.AdminPengaturan, "Pengaturan", "⚙️", "admin-pengaturan", 21);
        Add("admin", "researcher", "/admin/researcher", Domain.Identity.Permissions.AdminResearcher, "Researcher", "🔬", "admin-researcher", 22);
        Add("admin", "statistik", "/admin/statistik", Domain.Identity.Permissions.AdminStatistik, "Statistik", "📉", "admin-statistik", 23);

        // ── KEPALA PONDOK ──────────────────────────────────────────────────
        Add("kepala-pondok", "dashboard", "/kepala-pondok", Domain.Identity.Permissions.KepalaPondokDashboard, "Beranda Kepala Pondok", "🏠", "kepala-pondok-dashboard", 0);
        Add("kepala-pondok", "keuangan", "/kepala-pondok/keuangan", Domain.Identity.Permissions.KepalaPondokKeuangan, "Keuangan Pondok", "💰", "kepala-pondok-keuangan", 1);
        Add("kepala-pondok", "gerbang", "/gerbang", Domain.Identity.Permissions.KepalaPondokGerbang, "Gerbang Pondok", "🚪", "gerbang", 2);
        Add("kepala-pondok", "ustadz", "/ustadz", Domain.Identity.Permissions.KepalaPondokUstadz, "Ustadz Pondok", "👨‍🏫", "ustadz", 3);
        Add("kepala-pondok", "pengurus", "/pengurus", Domain.Identity.Permissions.KepalaPondokPengurus, "Pengurus Pondok", "👥", "pengurus", 4);

        // ── PENGURUS PONDOK ────────────────────────────────────────────────
        Add("pengurus-pondok", "dashboard", "/pengurus", Domain.Identity.Permissions.PengurusPondokDashboard, "Beranda Pengurus", "🏠", "pengurus-dashboard", 0);
        Add("pengurus-pondok", "gerbang", "/gerbang", Domain.Identity.Permissions.PengurusPondokGerbang, "Gerbang Pondok", "🚪", "gerbang", 1);
        Add("pengurus-pondok", "ustadz", "/ustadz", Domain.Identity.Permissions.PengurusPondokUstadz, "Ustadz Pondok", "👨‍🏫", "ustadz", 2);

        // ── USTADZ PONDOK ──────────────────────────────────────────────────
        Add("ustadz-pondok", "dashboard", "/ustadz", Domain.Identity.Permissions.UstadzPondokDashboard, "Beranda Ustadz", "🏠", "ustadz-dashboard", 0);
        Add("ustadz-pondok", "pengurus", "/pengurus", Domain.Identity.Permissions.UstadzPondokPengurus, "Pengurus Pondok", "👥", "pengurus", 1);

        // ── RESEARCHER ─────────────────────────────────────────────────────
        Add("researcher", "researcher", "/admin/researcher", Domain.Identity.Permissions.AdminResearcher, "Researcher", "🔬", "admin-researcher", 0);
        Add("researcher", "statistik", "/admin/statistik", Domain.Identity.Permissions.AdminStatistik, "Statistik", "📉", "admin-statistik", 1);

        return list;
    }
}