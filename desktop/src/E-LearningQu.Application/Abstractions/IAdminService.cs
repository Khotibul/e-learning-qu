using E_LearningQu.Contracts.Admin;
using E_LearningQu.Contracts.Common;

namespace E_LearningQu.Application.Abstractions;

/// <summary>
/// API admin — semua lewat /api/mobile/admin/* (guard ADMIN, token auto-refresh).
/// Pola respons mengikuti audit route.ts: envelope paginasi, objek tunggal, atau array mentah.
/// </summary>
public interface IAdminService
{
    Task<AdminDashboardStatsDto> GetDashboardStatsAsync(CancellationToken ct = default);

    // ── Guru / Murid ──
    Task<PagedResult<AdminUserDto>> GetGurusAsync(string? search = null, int page = 1, int limit = 10, bool includeDeleted = false, CancellationToken ct = default);
    Task<AdminUserDto?> GetGuruAsync(string id, CancellationToken ct = default);
    Task<AdminUserDto?> CreateGuruAsync(AdminCreateUserRequest request, CancellationToken ct = default);
    Task<AdminUserDto?> UpdateGuruAsync(string id, AdminUpdateUserRequest request, CancellationToken ct = default);
    Task<bool> DeleteGuruAsync(string id, CancellationToken ct = default);
    Task<bool> RestoreGuruAsync(string id, CancellationToken ct = default);
    Task<bool> ResetGuruPasswordAsync(string id, CancellationToken ct = default);

    Task<PagedResult<AdminUserDto>> GetMuridsAsync(string? search = null, int page = 1, int limit = 10, bool includeDeleted = false, string? kelasId = null, CancellationToken ct = default);
    Task<AdminUserDto?> GetMuridAsync(string id, CancellationToken ct = default);
    Task<AdminUserDto?> CreateMuridAsync(AdminCreateUserRequest request, CancellationToken ct = default);
    Task<AdminUserDto?> UpdateMuridAsync(string id, AdminUpdateUserRequest request, CancellationToken ct = default);
    Task<bool> DeleteMuridAsync(string id, CancellationToken ct = default);
    Task<bool> RestoreMuridAsync(string id, CancellationToken ct = default);
    Task<bool> ResetMuridPasswordAsync(string id, CancellationToken ct = default);

    // ── Kelas ──
    Task<PagedResult<KelasDto>> GetKelassAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default);
    Task<KelasDto?> CreateKelasAsync(KelasCreateRequest request, CancellationToken ct = default);
    Task<KelasDto?> UpdateKelasAsync(string id, KelasUpdateRequest request, CancellationToken ct = default);
    Task<bool> DeleteKelasAsync(string id, CancellationToken ct = default);

    // ── Mapel ──
    Task<PagedResult<MapelDto>> GetMapelsAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default);
    Task<MapelDto?> CreateMapelAsync(MapelCreateRequest request, CancellationToken ct = default);
    Task<MapelDto?> UpdateMapelAsync(string id, MapelUpdateRequest request, CancellationToken ct = default);
    Task<bool> DeleteMapelAsync(string id, CancellationToken ct = default);
    Task<bool> AddPengajaranAsync(string mapelId, string guruId, string kelasId, CancellationToken ct = default);
    Task<bool> RemovePengajaranAsync(string mapelId, string pengajaranId, CancellationToken ct = default);

    // ── Tahun Ajaran ──
    Task<PagedResult<TahunAjaranDto>> GetTahunAjaransAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default);
    Task<TahunAjaranDto?> CreateTahunAjaranAsync(TahunAjaranCreateRequest request, CancellationToken ct = default);
    Task<TahunAjaranDto?> UpdateTahunAjaranAsync(string id, TahunAjaranUpdateRequest request, CancellationToken ct = default);
    Task<bool> DeleteTahunAjaranAsync(string id, CancellationToken ct = default);
    Task<bool> SetActiveTahunAjaranAsync(string id, CancellationToken ct = default);

    // ── Semester ──
    Task<PagedResult<SemesterDto>> GetSemestersAsync(string? search = null, int page = 1, int limit = 10, string? tahunAjaranId = null, CancellationToken ct = default);
    Task<SemesterDto?> CreateSemesterAsync(SemesterCreateRequest request, CancellationToken ct = default);
    Task<SemesterDto?> UpdateSemesterAsync(string id, SemesterUpdateRequest request, CancellationToken ct = default);
    Task<bool> DeleteSemesterAsync(string id, CancellationToken ct = default);
    Task<bool> SetActiveSemesterAsync(string id, CancellationToken ct = default);

    // ── Jurusan ──
    Task<PagedResult<JurusanDto>> GetJurussansAsync(string? search = null, int page = 1, int limit = 10, CancellationToken ct = default);
    Task<JurusanDto?> CreateJurusanAsync(JurusanCreateRequest request, CancellationToken ct = default);
    Task<JurusanDto?> UpdateJurusanAsync(string id, JurusanUpdateRequest request, CancellationToken ct = default);
    Task<bool> DeleteJurusanAsync(string id, CancellationToken ct = default);
    Task<List<JurusanSiswaDto>> GetJurusanSiswaAsync(string jurusanId, CancellationToken ct = default);
    Task<bool> AssignSiswaToJurusanAsync(string jurusanId, List<string> siswaIds, CancellationToken ct = default);

    // ── Kompetensi ──
    Task<PagedResult<KompetensiDto>> GetKompetensisAsync(string? search = null, int page = 1, int limit = 10, string? jurusanId = null, string? mapelId = null, CancellationToken ct = default);
    Task<KompetensiDto?> CreateKompetensiAsync(KompetensiCreateRequest request, CancellationToken ct = default);
    Task<KompetensiDto?> UpdateKompetensiAsync(string id, KompetensiUpdateRequest request, CancellationToken ct = default);
    Task<bool> DeleteKompetensiAsync(string id, CancellationToken ct = default);

    // ── Pengumuman ──
    Task<PagedResult<PengumumanDto>> GetPengumumenAsync(int page = 1, int limit = 10, CancellationToken ct = default);
    Task<PengumumanDto?> CreatePengumumanAsync(PengumumanCreateRequest request, CancellationToken ct = default);
    Task<bool> DeletePengumumanAsync(string id, CancellationToken ct = default);

    // ── Nilai (read-only) ──
    Task<PagedResult<AdminNilaiDto>> GetNilaisAsync(string? kelasId = null, string? mapelId = null, string? semesterId = null, int page = 1, int limit = 20, CancellationToken ct = default);

    // ── Statistik ──
    Task<StatistikGuruMuridDto> GetStatistikGuruMuridAsync(CancellationToken ct = default);
    Task<List<StatistikBarDto>> GetStatistikPerKelasAsync(CancellationToken ct = default);
    Task<List<StatistikBarDto>> GetStatistikPerMapelAsync(CancellationToken ct = default);

    // ── Refs ──
    Task<AdminRefsDto> GetRefsAsync(CancellationToken ct = default);

    // ── Pengaturan (site-config + features) ──
    Task<SiteConfigDto> GetSiteConfigAsync(CancellationToken ct = default);
    Task<SiteConfigDto?> SaveSiteConfigAsync(SiteConfigUpdateRequest request, CancellationToken ct = default);
    Task<List<LandingFeatureDto>> GetFeaturesAsync(CancellationToken ct = default);
    Task<LandingFeatureDto?> SaveFeatureAsync(LandingFeatureRequest request, CancellationToken ct = default);
    Task<bool> DeleteFeatureAsync(string id, CancellationToken ct = default);

    // ── Jadwal Ujian (read-only) ──
    Task<JadwalUjianAdminDto> GetJadwalUjianAsync(CancellationToken ct = default);

    // ── Researcher analytics (read-only) ──
    Task<ResearcherOverviewDto> GetResearcherOverviewAsync(CancellationToken ct = default);

    // ── Courses ──
    Task<PagedResult<CourseAdminDto>> GetCoursesAsync(string? search = null, int page = 1, int limit = 20, CancellationToken ct = default);
    Task<CourseDetailDto?> GetCourseDetailAsync(string id, CancellationToken ct = default);
    Task<CourseAdminDto?> CreateCourseAsync(string title, string? description, string mapelId, string guruId, CancellationToken ct = default);
    Task<bool> UpdateCourseAsync(string id, string? title, string? description, bool? isPublished, CancellationToken ct = default);
    Task<bool> DeleteCourseAsync(string id, CancellationToken ct = default);
    Task<bool> CourseOpAsync(string id, string op, object payload, CancellationToken ct = default);

    // ── Jadwal Pelajaran ──
    Task<JadwalResponseDto> GetJadwalAsync(string? kelasId = null, string? hari = null, CancellationToken ct = default);
    Task<JadwalPelajaranDto?> CreateJadwalAsync(string kelasId, string mapelId, string hari, string jamMulai, string jamSelesai, CancellationToken ct = default);
    Task<JadwalPelajaranDto?> UpdateJadwalAsync(string id, string kelasId, string mapelId, string hari, string jamMulai, string jamSelesai, CancellationToken ct = default);
    Task<bool> DeleteJadwalAsync(string id, CancellationToken ct = default);
    Task<List<string>> CekBentrokJadwalAsync(string kelasId, string hari, string jamMulai, string jamSelesai, string? mapelId = null, string? excludeId = null, CancellationToken ct = default);

    // ── Santri ──
    Task<SantriListResponseDto> GetSantrisAsync(string? search = null, int page = 1, int limit = 20, string? keberadaan = null, string? status = null, CancellationToken ct = default);
    Task<SantriDetailDto?> GetSantriDetailAsync(string id, CancellationToken ct = default);
    Task<bool> CreateSantriDariSiswaAsync(string siswaId, string? nisNo, string? tanggalMasuk, string? catatan, CancellationToken ct = default);
    Task<bool> CreateSantriNonformalAsync(string nama, string email, string password, string? nisNo, string? tanggalMasuk, CancellationToken ct = default);
    Task<bool> UpdateSantriAsync(string id, string? nisNo, string? tanggalMasuk, string? catatan, string? status, string? alasan, CancellationToken ct = default);
    Task<bool> UpdateKeberadaanSantriAsync(string id, string keberadaan, string? alasan, CancellationToken ct = default);
    Task<bool> DeleteSantriAsync(string id, CancellationToken ct = default);
    Task<List<SantriStatusLogDto>> GetSantriStatusLogAsync(string santriId, string? jenis = null, CancellationToken ct = default);

    // ── Wali ──
    Task<List<WaliAdminDto>> GetWalisAsync(string? search = null, CancellationToken ct = default);
    Task<WaliAdminDto?> CreateWaliAsync(string nama, string hubungan, string? noTelp, string? alamat, CancellationToken ct = default);
    Task<WaliAdminDto?> UpdateWaliAsync(string id, string? nama, string? hubungan, string? noTelp, string? alamat, CancellationToken ct = default);
    Task<bool> DeleteWaliAsync(string id, CancellationToken ct = default);
    Task<bool> AssignWaliToSantriAsync(string santriId, string waliId, bool isPrimary, CancellationToken ct = default);
    Task<bool> UnassignWaliFromSantriAsync(string santriId, string waliId, CancellationToken ct = default);

    // ── PPDB ──
    Task<PpdbListResponseDto> GetGelombangsAsync(string? search = null, int page = 1, int limit = 10, string? status = null, string? tahunAjaranId = null, CancellationToken ct = default);
    Task<GelombangPpdbDto?> CreateGelombangAsync(GelombangPpdbCreateRequest request, CancellationToken ct = default);
    Task<GelombangPpdbDto?> UpdateGelombangAsync(string id, GelombangPpdbUpdateRequest request, CancellationToken ct = default);
    Task<bool> UpdateStatusGelombangAsync(string id, string status, CancellationToken ct = default);
    Task<bool> DeleteGelombangAsync(string id, CancellationToken ct = default);
    Task<JalurPpdbDto?> CreateJalurAsync(string gelombangId, string nama, string? deskripsi, int? kuota, CancellationToken ct = default);
    Task<bool> UpdateJalurAsync(string id, string? nama, string? deskripsi, int? kuota, bool? isActive, CancellationToken ct = default);
    Task<bool> DeleteJalurAsync(string id, CancellationToken ct = default);

    // ── Izin (admin) ──
    Task<IzinAntreanResponseDto> GetIzinAntreanAsync(CancellationToken ct = default);
    Task<IzinStatistikDto> GetIzinStatistikAsync(CancellationToken ct = default);
    Task<IzinRiwayatResponseDto> GetIzinRiwayatAsync(string? santriId = null, string? asramaId = null, string? status = null, int page = 1, CancellationToken ct = default);
    Task<PengaturanIzinResponseDto> GetPengaturanIzinAsync(CancellationToken ct = default);
    Task<bool> SetujuiIzinAsync(string izinId, string? catatan, CancellationToken ct = default);
    Task<bool> TolakIzinAsync(string izinId, string alasan, CancellationToken ct = default);
    Task<bool> SimpanPengaturanIzinAsync(PengaturanIzinDto cfg, CancellationToken ct = default);
    Task<AsramaResponseDto> GetAsramaAsync(CancellationToken ct = default);
    Task<AsramaDto?> CreateAsramaAsync(string nama, string? deskripsi, string? musyrifId, CancellationToken ct = default);
    Task<KamarDto?> CreateKamarAsync(string asramaId, string nama, int? kapasitas, CancellationToken ct = default);
    Task<bool> AssignTempatSantriAsync(string santriId, string? asramaId, string? kamarId, CancellationToken ct = default);

    // ── Siswa dompet ──
    Task<DompetSayaDto> GetDompetSayaAsync(CancellationToken ct = default);
    Task<KantinRiwayatResponseDto> GetRiwayatKantinSayaAsync(CancellationToken ct = default);
    Task<TagihanResponseDto> GetTagihanSayaAsync(CancellationToken ct = default);

    // ── Santri izin (siswa side) ──
    Task<IzinSayaResponseDto> GetIzinSayaAsync(CancellationToken ct = default);
    Task<bool> AjukanIzinAsync(IzinAjukanRequest request, CancellationToken ct = default);
    Task<bool> DraftIzinAsync(IzinAjukanRequest request, CancellationToken ct = default);
    Task<bool> BatalIzinAsync(string izinId, string alasan, CancellationToken ct = default);

    // ── Izin musyrif (guru) ──
    Task<IzinAntreanResponseDto> GetIzinMusyrifAntreanAsync(CancellationToken ct = default);
    Task<MusyrifMonitoringDto> GetMusyrifMonitoringAsync(CancellationToken ct = default);
    Task<IzinRiwayatResponseDto> GetIzinMusyrifRiwayatAsync(int page = 1, CancellationToken ct = default);
    Task<bool> SetujuiIzinMusyrifAsync(string izinId, string? catatan, CancellationToken ct = default);
    Task<bool> TolakIzinMusyrifAsync(string izinId, string alasan, CancellationToken ct = default);

    // ── Kantin (kasir) ──
    Task<List<KantinOutletDto>> GetKantinOutletsAsync(CancellationToken ct = default);
    Task<List<KantinProdukDto>> GetKantinProdukAsync(string outletId, CancellationToken ct = default);
    Task<KantinShiftDto?> GetKantinShiftAktifAsync(string outletId, CancellationToken ct = default);
    Task<string?> BukaShiftAsync(string outletId, int saldoAwal, CancellationToken ct = default);
    Task<bool> TutupShiftAsync(string shiftId, int kasAkhir, string? catatan, CancellationToken ct = default);
    Task<KantinCheckoutResultDto?> CheckoutKantinAsync(KantinCheckoutRequest request, CancellationToken ct = default);
    Task<bool> BatalTransaksiKantinAsync(string transaksiId, string alasan, CancellationToken ct = default);
    Task<List<KantinTransaksiDto>> GetRiwayatShiftAsync(string shiftId, CancellationToken ct = default);

    // ── Absensi Guru (mobile/admin/absensi-guru) ──
    Task<AbsensiGuruMonitoringDto> GetAbsensiGuruMonitoringAsync(string? tanggal = null, string? search = null, CancellationToken ct = default);
    Task<AbsensiGuruRekapDto> GetAbsensiGuruRekapAsync(string start, string end, CancellationToken ct = default);
    Task<List<PenggantiDto>> GetPenggantiListAsync(string? tanggal = null, CancellationToken ct = default);
    Task<AbsensiGuruPendukungDto> GetAbsensiGuruPendukungAsync(CancellationToken ct = default);
    Task<bool> KoreksiAbsensiGuruAsync(string? sesiId, string? guruId, string? jadwalPelajaranId, string? tanggal, string status, string alasan, CancellationToken ct = default);
    Task<bool> HapusPenggantiAsync(string id, CancellationToken ct = default);

    // ── Fingerprint & Absensi Harian (mobile/admin/fingerprint) ──
    Task<List<PerangkatFpDto>> GetPerangkatFpAsync(CancellationToken ct = default);
    Task<List<PemetaanFpDto>> GetPemetaanFpAsync(string perangkatId, CancellationToken ct = default);
    Task<List<SiswaCariDto>> CariSiswaFpAsync(string q, CancellationToken ct = default);
    Task<MonitoringHarianDto> GetMonitoringHarianAsync(string? tanggal = null, string? q = null, CancellationToken ct = default);
    Task<List<EventFpDto>> GetFpEventsAsync(string? tanggal = null, CancellationToken ct = default);
    Task<List<PermintaanManualFpDto>> GetPermintaanManualAsync(CancellationToken ct = default);
    Task<PerangkatBaruDto?> BuatPerangkatFpAsync(string nama, string? lokasi, CancellationToken ct = default);
    Task<bool> UbahPerangkatFpAsync(string id, string? nama, string? lokasi, string? status, CancellationToken ct = default);
    Task<bool> HapusPerangkatFpAsync(string id, CancellationToken ct = default);
    Task<string?> RotasiApiKeyFpAsync(string id, CancellationToken ct = default);
    Task<bool> TambahPemetaanFpAsync(string perangkatId, string siswaId, string perangkatUserId, CancellationToken ct = default);
    Task<bool> HapusPemetaanFpAsync(string id, CancellationToken ct = default);
    Task<bool> PutuskanPermintaanManualAsync(string permintaanId, string putusan, string? catatan, CancellationToken ct = default);

    // ── Keuangan/Bendahara (mobile/admin/keuangan) ──
    Task<KeuanganDashboardDto> GetKeuanganDashboardAsync(CancellationToken ct = default);
    Task<AntreanKeuanganDto> GetAntreanKeuanganAsync(CancellationToken ct = default);
    Task<List<AkunLaporanDto>> GetAkunLaporanAsync(CancellationToken ct = default);
    Task<List<JurnalUmumDto>> GetJurnalUmumAsync(int take = 50, CancellationToken ct = default);
    Task<bool> VerifikasiTopupAsync(string topupId, bool setujui, string? catatan, CancellationToken ct = default);
    Task<bool> VerifikasiPembayaranTagihanAsync(string pembayaranId, bool setujui, string? catatan, CancellationToken ct = default);
}
