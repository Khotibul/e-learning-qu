using System.Text.Json.Serialization;

namespace E_LearningQu.Contracts.Admin;

// ═══════════════════════════════════════════════════════════════════════
// DTO batch akhir: siswa-dompet, santri-izin, guru-izin-musyrif, kantin.
// ═══════════════════════════════════════════════════════════════════════

public sealed class DompetSayaDto
{
    [JsonPropertyName("dompet")] public DompetAccountDto? Dompet { get; set; }
    [JsonPropertyName("riwayat")] public List<WalletLedgerDto> Riwayat { get; set; } = new();
}

public sealed class DompetAccountDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nomor")] public string Nomor { get; set; } = "";
    [JsonPropertyName("saldo")] public int Saldo { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("nama")] public string? Nama { get; set; }
}

public sealed class WalletLedgerDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("tipe")] public string Tipe { get; set; } = "";
    [JsonPropertyName("jumlah")] public int Jumlah { get; set; }
    [JsonPropertyName("saldoSesudah")] public int SaldoSesudah { get; set; }
    [JsonPropertyName("deskripsi")] public string? Deskripsi { get; set; }
    [JsonPropertyName("refType")] public string? RefType { get; set; }
    [JsonPropertyName("createdAt")] public DateTime CreatedAt { get; set; }
}

public sealed class KantinRiwayatResponseDto
{
    [JsonPropertyName("rows")] public List<KantinTransaksiDto> Rows { get; set; } = new();
}

public sealed class KantinTransaksiDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nomorStruk")] public string NomorStruk { get; set; } = "";
    [JsonPropertyName("metode")] public string Metode { get; set; } = "";
    [JsonPropertyName("subtotal")] public int Subtotal { get; set; }
    [JsonPropertyName("diskon")] public int Diskon { get; set; }
    [JsonPropertyName("total")] public int Total { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("createdAt")] public DateTime CreatedAt { get; set; }
    [JsonPropertyName("outlet")] public NamaBriefDto? Outlet { get; set; }
    [JsonPropertyName("item")] public List<KantinItemDto> Item { get; set; } = new();
}

public sealed class KantinItemDto
{
    [JsonPropertyName("namaSnapshot")] public string NamaSnapshot { get; set; } = "";
    [JsonPropertyName("qty")] public int Qty { get; set; }
    [JsonPropertyName("subtotal")] public int Subtotal { get; set; }
}

public sealed class TagihanResponseDto
{
    [JsonPropertyName("rows")] public List<TagihanDto> Rows { get; set; } = new();
}

public sealed class TagihanDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("kode")] public string Kode { get; set; } = "";
    [JsonPropertyName("periode")] public string Periode { get; set; } = "";
    [JsonPropertyName("nominal")] public int Nominal { get; set; }
    [JsonPropertyName("total")] public int Total { get; set; }
    [JsonPropertyName("sisa")] public int Sisa { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "";
    [JsonPropertyName("jatuhTempo")] public DateTime? JatuhTempo { get; set; }
    [JsonPropertyName("jenis")] public NamaBriefDto? Jenis { get; set; }
}

// ── Izin (santri side) ──────────────────────────────────────────────────

public sealed class IzinSayaResponseDto
{
    [JsonPropertyName("santri")] public SantriIzinBriefDto? Santri { get; set; }
    [JsonPropertyName("rows")] public List<IzinAntreanDto> Rows { get; set; } = new();
}

public sealed class SantriIzinBriefDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("keberadaan")] public string Keberadaan { get; set; } = "";
}

public sealed class IzinAjukanRequest
{
    [JsonPropertyName("jenis")] public string Jenis { get; set; } = "";
    [JsonPropertyName("alasan")] public string Alasan { get; set; } = "";
    [JsonPropertyName("rencanaKeluar")] public string RencanaKeluar { get; set; } = "";
    [JsonPropertyName("rencanaKembali")] public string RencanaKembali { get; set; } = "";
    [JsonPropertyName("alamatTujuan")] public string AlamatTujuan { get; set; } = "";
    [JsonPropertyName("namaPenjemput")] public string NamaPenjemput { get; set; } = "";
    [JsonPropertyName("hubunganPenjemput")] public string HubunganPenjemput { get; set; } = "";
    [JsonPropertyName("noTelpPenjemput")] public string NoTelpPenjemput { get; set; } = "";
    [JsonPropertyName("lampiranId")] public string? LampiranId { get; set; }
    [JsonPropertyName("draftId")] public string? DraftId { get; set; }
}

// ── Izin musyrif ────────────────────────────────────────────────────────

public sealed class MusyrifMonitoringDto
{
    [JsonPropertyName("statistik")] public IzinStatistikDto? Statistik { get; set; }
    [JsonPropertyName("diPondok")] public List<SantriMonitoringDto> DiPondok { get; set; } = new();
    [JsonPropertyName("sedangIzin")] public List<SantriMonitoringDto> SedangIzin { get; set; } = new();
    [JsonPropertyName("terlambat")] public List<SantriMonitoringDto> Terlambat { get; set; } = new();
}

public sealed class SantriMonitoringDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("nisNo")] public string? NisNo { get; set; }
    [JsonPropertyName("keberadaan")] public string? Keberadaan { get; set; }
    [JsonPropertyName("asrama")] public NamaBriefDto? Asrama { get; set; }
    [JsonPropertyName("kamar")] public NamaBriefDto? Kamar { get; set; }
    [JsonPropertyName("izins")] public List<IzinBriefDto> Izins { get; set; } = new();
}

public sealed class IzinBriefDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("rencanaKembali")] public DateTime RencanaKembali { get; set; }
    [JsonPropertyName("suratNomor")] public string? SuratNomor { get; set; }
    [JsonPropertyName("jenis")] public string? Jenis { get; set; }
}

// ── Kantin (kasir) ──────────────────────────────────────────────────────

public sealed class KantinOutletDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("kode")] public string Kode { get; set; } = "";
    [JsonPropertyName("lokasi")] public string? Lokasi { get; set; }
}

public sealed class KantinProdukDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nama")] public string Nama { get; set; } = "";
    [JsonPropertyName("sku")] public string? Sku { get; set; }
    [JsonPropertyName("hargaJual")] public int HargaJual { get; set; }
    [JsonPropertyName("stok")] public int Stok { get; set; }
    [JsonPropertyName("satuan")] public string Satuan { get; set; } = "";
    [JsonPropertyName("aktif")] public bool Aktif { get; set; }
    [JsonPropertyName("kategori")] public NamaBriefDto? Kategori { get; set; }
}

public sealed class KantinShiftDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("nomorShift")] public int NomorShift { get; set; }
    [JsonPropertyName("saldoAwal")] public int SaldoAwal { get; set; }
}

public sealed class KantinCheckoutRequest
{
    [JsonPropertyName("outletId")] public string OutletId { get; set; } = "";
    [JsonPropertyName("shiftId")] public string? ShiftId { get; set; }
    [JsonPropertyName("items")] public List<KantinItemRequest> Items { get; set; } = new();
    [JsonPropertyName("metode")] public string Metode { get; set; } = "EWALLET";
    [JsonPropertyName("accountId")] public string? AccountId { get; set; }
    [JsonPropertyName("diskon")] public int Diskon { get; set; }
}

public sealed class KantinItemRequest
{
    [JsonPropertyName("produkId")] public string ProdukId { get; set; } = "";
    [JsonPropertyName("qty")] public int Qty { get; set; }
}

public sealed class KantinCheckoutResultDto
{
    [JsonPropertyName("transaksiId")] public string? TransaksiId { get; set; }
    [JsonPropertyName("nomorStruk")] public string? NomorStruk { get; set; }
    [JsonPropertyName("total")] public int? Total { get; set; }
    [JsonPropertyName("saldoSesudah")] public int? SaldoSesudah { get; set; }
}
