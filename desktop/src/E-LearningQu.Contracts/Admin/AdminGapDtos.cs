namespace E_LearningQu.Contracts.Admin;

// ═══════════════════════════════════════════════════════════════════════
// DTO untuk mobile admin routes: absensi-guru, fingerprint, keuangan.
// Mirror dari response route.ts (camelCase) — JsonSerializerDefaults.Web.
// ═══════════════════════════════════════════════════════════════════════

// ─── ABSENSI GURU ─────────────────────────────────────────────────────

public sealed class AbsensiGuruBarisDto
{
    public string? SesiId { get; set; }
    public string GuruId { get; set; } = "";
    public string GuruNama { get; set; } = "";
    public string JadwalId { get; set; } = "";
    public string KelasNama { get; set; } = "";
    public string MataPelajaranNama { get; set; } = "";
    public string JamMulai { get; set; } = "";
    public string JamSelesai { get; set; } = "";
    public string Status { get; set; } = "";
    public string Fase { get; set; } = "";
    public string? JamMasuk { get; set; }
    public string? JamKeluar { get; set; }
    public int? DurasiMenit { get; set; }
    public int? TerlambatMenit { get; set; }
    public string? Keterangan { get; set; }
    public string? KoreksiAlasan { get; set; }
    public string? PenggantiNama { get; set; }
    public string? Metode { get; set; }
    public bool SidikJariVerified { get; set; }
}

public sealed class AbsensiGuruRingkasanDto
{
    public int Total { get; set; }
    public int Hadir { get; set; }
    public int Terlambat { get; set; }
    public int Izin { get; set; }
    public int Sakit { get; set; }
    public int TidakHadir { get; set; }
    public int BelumAbsen { get; set; }
    public int Aktif { get; set; }
}

public sealed class AbsensiGuruMonitoringDto
{
    public string Tanggal { get; set; } = "";
    public string Hari { get; set; } = "";
    public List<AbsensiGuruBarisDto> Rows { get; set; } = new();
    public AbsensiGuruRingkasanDto Summary { get; set; } = new();
}

public sealed class AbsensiGuruRekapBarisDto
{
    public string Id { get; set; } = "";
    public string Tanggal { get; set; } = "";
    public string GuruId { get; set; } = "";
    public string GuruNama { get; set; } = "";
    public string Status { get; set; } = "";
    public string? JamMasuk { get; set; }
    public string? JamSelesai { get; set; }
    public int? TerlambatMenit { get; set; }
    public string KelasNama { get; set; } = "";
    public string MataPelajaranNama { get; set; } = "";
    public string JamMulai { get; set; } = "";
}

public sealed class RekapPerGuruDto
{
    public string GuruId { get; set; } = "";
    public string GuruNama { get; set; } = "";
    public int TotalSesi { get; set; }
    public int Hadir { get; set; }
    public int Terlambat { get; set; }
    public int Izin { get; set; }
    public int Sakit { get; set; }
    public int TidakHadir { get; set; }
    public int BelumAbsen { get; set; }
    public double RataKehadiranPersen { get; set; }
    public int TotalTerlambatMenit { get; set; }
}

public sealed class AbsensiGuruRekapDto
{
    public List<AbsensiGuruRekapBarisDto> Rows { get; set; } = new();
    public List<RekapPerGuruDto> RekapPerGuru { get; set; } = new();
    public RekapPerGuruDto Total { get; set; } = new();
}

public sealed class PenggantiDto
{
    public string Id { get; set; } = "";
    public string Tanggal { get; set; } = "";
    public string? Alasan { get; set; }
    public string Status { get; set; } = "";
    public string AsliGuruId { get; set; } = "";
    public string AsliGuruNama { get; set; } = "";
    public string PenggantiNama { get; set; } = "";
    public string Hari { get; set; } = "";
    public string JamMulai { get; set; } = "";
    public string JamSelesai { get; set; } = "";
    public string KelasNama { get; set; } = "";
    public string MataPelajaranNama { get; set; } = "";
}

public sealed class GapRefDto
{
    public string Id { get; set; } = "";
    public string Nama { get; set; } = "";
}

public sealed class AbsensiGuruPendukungDto
{
    public List<GapRefDto> Guru { get; set; } = new();
    public List<GapRefDto> Kelas { get; set; } = new();
    public List<GapRefDto> Mapel { get; set; } = new();
}

// ─── FINGERPRINT ──────────────────────────────────────────────────────

public sealed class PerangkatFpDto
{
    public string Id { get; set; } = "";
    public string Kode { get; set; } = "";
    public string Nama { get; set; } = "";
    public string? Lokasi { get; set; }
    public string Status { get; set; } = "";
    public string? LastSeenAt { get; set; }
    public string? LastSyncAt { get; set; }
    public int JumlahSiswa { get; set; }
    public int TotalEvent { get; set; }
    public int ScanHariIni { get; set; }
    public string? CreatedAt { get; set; }
}

public sealed class PemetaanFpDto
{
    public string Id { get; set; } = "";
    public string PerangkatUserId { get; set; } = "";
    public string SiswaId { get; set; } = "";
    public string Nama { get; set; } = "";
    public string? Nis { get; set; }
    public string Kelas { get; set; } = "";
    public string? CreatedAt { get; set; }
}

public sealed class SiswaCariDto
{
    public string Id { get; set; } = "";
    public string Nama { get; set; } = "";
    public string? Nis { get; set; }
    public string Kelas { get; set; } = "";
}

public sealed class MonitoringHarianBarisDto
{
    public string? Id { get; set; }
    public string SiswaId { get; set; } = "";
    public string Nama { get; set; } = "";
    public string? Nis { get; set; }
    public string? KelasId { get; set; }
    public string Kelas { get; set; } = "";
    public string? JamMasuk { get; set; }
    public string? JamPulang { get; set; }
    public string? StatusMasuk { get; set; }
    public string? StatusPulang { get; set; }
    public int? TerlambatMenit { get; set; }
    public string? SumberMasuk { get; set; }
    public string? SumberPulang { get; set; }
    public string? PerangkatMasuk { get; set; }
    public string? PerangkatPulang { get; set; }
    public string? KoreksiAlasan { get; set; }
}

public sealed class MonitoringHarianRingkasanDto
{
    public int TotalSiswa { get; set; }
    public int Masuk { get; set; }
    public int BelumMasuk { get; set; }
    public int Terlambat { get; set; }
    public int Pulang { get; set; }
    public int PulangAwal { get; set; }
}

public sealed class MonitoringHarianDto
{
    public string Tanggal { get; set; } = "";
    public List<MonitoringHarianBarisDto> Rows { get; set; } = new();
    public MonitoringHarianRingkasanDto Summary { get; set; } = new();
}

public sealed class EventFpDto
{
    public string Id { get; set; } = "";
    public string EventKey { get; set; } = "";
    public string Perangkat { get; set; } = "";
    public string Kode { get; set; } = "";
    public string Nama { get; set; } = "";
    public string? Nis { get; set; }
    public string Tipe { get; set; } = "";
    public string Status { get; set; } = "";
    public string? Pesan { get; set; }
    public string? DeviceAt { get; set; }
    public string ServerAt { get; set; } = "";
}

public sealed class PerangkatBaruDto
{
    public string Id { get; set; } = "";
    public string Kode { get; set; } = "";
    public string ApiKey { get; set; } = "";
}

public sealed class PermintaanManualFpDto
{
    public string Id { get; set; } = "";
    public string Nama { get; set; } = "";
    public string? Nis { get; set; }
    public string Kelas { get; set; } = "";
    public string Tanggal { get; set; } = "";
    public string Tipe { get; set; } = "";
    public string? Alasan { get; set; }
    public string Status { get; set; } = "";
    public string? CatatanAdmin { get; set; }
    public string? CreatedAt { get; set; }
}

// ─── KEUANGAN (BENDAHARA) ─────────────────────────────────────────────

public sealed class KeuanganDashboardDto
{
    public int TopupMenunggu { get; set; }
    public int TagihanPending { get; set; }
    public int TotalSaldoDompet { get; set; }
    public int JumlahDompet { get; set; }
    public int KewajibanDompet { get; set; }
    public int PendapatanKantin { get; set; }
    public int Hpp { get; set; }
    public int TransaksiHariIni { get; set; }
    public int InvoiceBelumLunas { get; set; }
}

public sealed class TopupRequestDto
{
    public string Id { get; set; } = "";
    public int Nominal { get; set; }
    public string? BuktiUrl { get; set; }
    public string? Catatan { get; set; }
    public string? CreatedAt { get; set; }
    public string Nomor { get; set; } = "";
    public string Nama { get; set; } = "";
}

public sealed class PembayaranPendingDto
{
    public string Id { get; set; } = "";
    public int Jumlah { get; set; }
    public string? BuktiUrl { get; set; }
    public string? CreatedAt { get; set; }
    public string InvoiceKode { get; set; } = "";
    public string Periode { get; set; } = "";
    public string JenisNama { get; set; } = "";
}

public sealed class AntreanKeuanganDto
{
    public List<TopupRequestDto> Topups { get; set; } = new();
    public List<PembayaranPendingDto> Pembayaran { get; set; } = new();
}

public sealed class AkunLaporanDto
{
    public string Id { get; set; } = "";
    public string Kode { get; set; } = "";
    public string Nama { get; set; } = "";
    public string Tipe { get; set; } = "";
    public int Saldo { get; set; }
    public bool Aktif { get; set; }
}

public sealed class JurnalItemDto
{
    public string? AkunKode { get; set; }
    public string? AkunNama { get; set; }
    public int Debit { get; set; }
    public int Kredit { get; set; }
}

public sealed class JurnalUmumDto
{
    public string Id { get; set; } = "";
    public string Tanggal { get; set; } = "";
    public string Nomor { get; set; } = "";
    public string Keterangan { get; set; } = "";
    public List<JurnalItemDto> Item { get; set; } = new();
}
