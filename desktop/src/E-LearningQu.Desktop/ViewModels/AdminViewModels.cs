using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using E_LearningQu.Application.Abstractions;
using E_LearningQu.Contracts.Admin;
using E_LearningQu.Contracts.Common;

namespace E_LearningQu.Desktop.ViewModels;

// ─── BASE: daftar paginasi + search ──────────────────────────────────────────
public abstract partial class AdminPagedViewModel<TDto> : ObservableObject
{
    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private string statusMessage = "";
    [ObservableProperty] private string searchText = "";
    [ObservableProperty] private int page = 1;
    [ObservableProperty] private int totalPages = 1;
    [ObservableProperty] private int total;
    [ObservableProperty] private bool includeDeleted;
    [ObservableProperty] private bool isBusy;

    public ObservableCollection<TDto> Items { get; } = new();

    protected CancellationTokenSource? SearchCts;

    protected abstract Task<PagedResult<TDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct);

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        if (IsBusy) return;
        IsBusy = true; IsLoading = true; ErrorMessage = null;
        try
        {
            var result = await FetchAsync(null, Page, IncludeDeleted, ct);
            Items.Clear();
            foreach (var item in result.Data) Items.Add(item);
            Total = result.Total; TotalPages = Math.Max(1, result.TotalPages);
            StatusMessage = $"{result.Total} data";
            DesktopLog.Log($"Load {GetType().Name}: total={result.Total} data={result.Data.Count} items={Items.Count} page={Page}");
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
            DesktopLog.Log($"Load FAIL {GetType().Name}: {ex}");
        }
        finally { IsLoading = false; IsBusy = false; }
    }

    [RelayCommand]
    public async Task SearchAsync(CancellationToken ct = default)
    {
        SearchCts?.Cancel();
        SearchCts = new CancellationTokenSource();
        try
        {
            await Task.Delay(300, SearchCts.Token);
            Page = 1;
            await LoadAsync(SearchCts.Token);
        }
        catch (OperationCanceledException) { }
    }

    [RelayCommand]
    public async Task NextPageAsync(CancellationToken ct = default)
    {
        if (Page >= TotalPages) return;
        Page++; await LoadAsync(ct);
    }

    [RelayCommand]
    public async Task PrevPageAsync(CancellationToken ct = default)
    {
        if (Page <= 1) return;
        Page--; await LoadAsync(ct);
    }

    [RelayCommand]
    public async Task HapusAsync(TDto item, CancellationToken ct = default)
    {
        if (IsBusy) return;
        try
        {
            // Confirm before delete — subclass can override
            if (await ConfirmDeleteAsync(item, ct))
            {
                IsBusy = true;
                await DeleteCoreAsync(item, ct);
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsBusy = false; }
    }

    [RelayCommand]
    public async Task PulihkanAsync(TDto item, CancellationToken ct = default)
    {
        if (IsBusy) return;
        try
        {
            IsBusy = true;
            await RestoreCoreAsync(item, ct);
            await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsBusy = false; }
    }

    protected virtual Task<bool> ConfirmDeleteAsync(TDto item, CancellationToken ct) =>
        DialogService.ConfirmAsync("Hapus Data", "Yakin hapus data ini? Tindakan ini tidak bisa dibatalkan.", "Ya, Hapus");

    protected virtual Task DeleteCoreAsync(TDto item, CancellationToken ct) => Task.CompletedTask;
    protected virtual Task RestoreCoreAsync(TDto item, CancellationToken ct) => Task.CompletedTask;

    // ── CRUD (subclass override; default no-op) ─────────────────────────────
    public virtual bool SupportsCrud => false;
    protected virtual string FormTitle => "Data";

    protected virtual Task<IReadOnlyList<FormFieldDef>> GetCreateFormFieldsAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<FormFieldDef>>(Array.Empty<FormFieldDef>());

    protected virtual Task<IReadOnlyList<FormFieldDef>> GetEditFormFieldsAsync(TDto item, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<FormFieldDef>>(Array.Empty<FormFieldDef>());

    protected virtual object? BuildCreateRequest(IReadOnlyDictionary<string, string?> values) => null;
    protected virtual object? BuildEditRequest(TDto item, IReadOnlyDictionary<string, string?> values) => null;
    protected virtual Task<bool> SaveCreateAsync(object request, CancellationToken ct) => Task.FromResult(false);
    protected virtual Task<bool> SaveEditAsync(string id, object request, CancellationToken ct) => Task.FromResult(false);

    [RelayCommand]
    public async Task TambahAsync(CancellationToken ct = default)
    {
        if (!SupportsCrud || IsBusy) return;
        try
        {
            IsBusy = true;
            var fields = await GetCreateFormFieldsAsync(ct);
            if (fields.Count == 0) return;
            var values = await DialogService.FormAsync($"Tambah {FormTitle}", fields, subtitle: $"Isi data {FormTitle.ToLower()} lalu simpan.", saveText: "Simpan");
            if (values is null) return;
            var request = BuildCreateRequest(values);
            if (request is null) return;
            if (await SaveCreateAsync(request, ct))
            {
                StatusMessage = $"{FormTitle} ditambahkan";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsBusy = false; }
    }

    [RelayCommand]
    public async Task EditAsync(TDto item, CancellationToken ct = default)
    {
        if (!SupportsCrud || IsBusy || item is null) return;
        try
        {
            IsBusy = true;
            var fields = await GetEditFormFieldsAsync(item, ct);
            if (fields.Count == 0) return;
            var values = await DialogService.FormAsync($"Edit {FormTitle}", fields, subtitle: $"Ubah data {FormTitle.ToLower()} lalu simpan.", saveText: "Simpan Perubahan");
            if (values is null) return;
            var request = BuildEditRequest(item, values);
            if (request is null) return;
            var id = item!.GetType().GetProperty("Id")?.GetValue(item) as string ?? "";
            if (await SaveEditAsync(id, request, ct))
            {
                StatusMessage = $"{FormTitle} diperbarui";
                await LoadAsync(ct);
            }
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsBusy = false; }
    }

    partial void OnSearchTextChanged(string value) => _ = SearchAsync();
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
public partial class AdminDashboardViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private AdminDashboardStatsDto stats = new();
    [ObservableProperty] private string statusMessage = "";

    public AdminDashboardViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            Stats = await _admin.GetDashboardStatsAsync(ct);
            StatusMessage = "Statistik sistem";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}

// ─── GURU ────────────────────────────────────────────────────────────────────
public partial class AdminGuruViewModel : AdminPagedViewModel<AdminUserDto>
{
    private readonly IAdminService _admin;

    public AdminGuruViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<AdminUserDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetGurusAsync(search, page, 10, includeDeleted, ct);

    public override bool SupportsCrud => true;
    protected override string FormTitle => "Guru";

    protected override Task<IReadOnlyList<FormFieldDef>> GetCreateFormFieldsAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<FormFieldDef>>(new[]
        {
            new FormFieldDef { Key = "nama", Label = "Nama", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "email", Label = "Email", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "password", Label = "Password", Kind = FormFieldKind.Password, Required = true },
            new FormFieldDef { Key = "jabatan", Label = "Jabatan", Kind = FormFieldKind.Text },
            new FormFieldDef { Key = "nip", Label = "NIP", Kind = FormFieldKind.Text },
        });

    protected override Task<IReadOnlyList<FormFieldDef>> GetEditFormFieldsAsync(AdminUserDto item, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<FormFieldDef>>(new[]
        {
            new FormFieldDef { Key = "nama", Label = "Nama", Kind = FormFieldKind.Text, Required = true, Value = item.Nama },
            new FormFieldDef { Key = "jabatan", Label = "Jabatan", Kind = FormFieldKind.Text, Value = item.Jabatan },
            new FormFieldDef { Key = "nip", Label = "NIP", Kind = FormFieldKind.Text, Value = item.Nip },
            new FormFieldDef { Key = "noTelp", Label = "No. Telp", Kind = FormFieldKind.Text, Value = item.NoTelp },
            new FormFieldDef { Key = "alamat", Label = "Alamat", Kind = FormFieldKind.Memo, Value = item.Alamat },
        });

    protected override object? BuildCreateRequest(IReadOnlyDictionary<string, string?> v) => new AdminCreateUserRequest
    {
        Nama = v.GetValueOrDefault("nama") ?? "",
        Email = v.GetValueOrDefault("email") ?? "",
        Password = v.GetValueOrDefault("password"),
        Jabatan = v.GetValueOrDefault("jabatan"),
        Nip = v.GetValueOrDefault("nip"),
    };

    protected override object? BuildEditRequest(AdminUserDto item, IReadOnlyDictionary<string, string?> v) => new AdminUpdateUserRequest
    {
        Nama = v.GetValueOrDefault("nama"),
        Jabatan = v.GetValueOrDefault("jabatan"),
        Nip = v.GetValueOrDefault("nip"),
        NoTelp = v.GetValueOrDefault("noTelp"),
        Alamat = v.GetValueOrDefault("alamat"),
    };

    protected override async Task<bool> SaveCreateAsync(object request, CancellationToken ct) =>
        await _admin.CreateGuruAsync((AdminCreateUserRequest)request, ct) is not null;

    protected override async Task<bool> SaveEditAsync(string id, object request, CancellationToken ct) =>
        await _admin.UpdateGuruAsync(id, (AdminUpdateUserRequest)request, ct) is not null;

    protected override async Task<bool> ConfirmDeleteAsync(AdminUserDto item, CancellationToken ct) =>
        await DialogService.ConfirmAsync("Hapus Guru", $"Yakin hapus guru \"{item.Nama}\"? Data dapat dipulihkan.");

    protected override async Task DeleteCoreAsync(AdminUserDto item, CancellationToken ct) =>
        await _admin.DeleteGuruAsync(item.Id, ct);

    protected override async Task RestoreCoreAsync(AdminUserDto item, CancellationToken ct) =>
        await _admin.RestoreGuruAsync(item.Id, ct);

    [RelayCommand]
    public async Task ResetPasswordAsync(AdminUserDto item, CancellationToken ct = default)
    {
        if (IsBusy) return;
        if (!await DialogService.ConfirmAsync("Reset Password", $"Reset password {item.Nama} ke default?")) return;
        try
        {
            IsBusy = true;
            if (await _admin.ResetGuruPasswordAsync(item.Id, ct))
                StatusMessage = $"Password {item.Nama} direset ke default";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsBusy = false; }
    }
}

// ─── MURID ───────────────────────────────────────────────────────────────────
public partial class AdminMuridViewModel : AdminPagedViewModel<AdminUserDto>
{
    private readonly IAdminService _admin;

    public AdminMuridViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<AdminUserDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetMuridsAsync(search, page, 10, includeDeleted, null, ct);

    [ObservableProperty] private AdminRefsDto refs = new();
    public async Task LoadRefsAsync(CancellationToken ct = default)
    {
        try { Refs = await _admin.GetRefsAsync(ct); } catch { }
    }

    public override bool SupportsCrud => true;
    protected override string FormTitle => "Murid";

    protected override async Task<IReadOnlyList<FormFieldDef>> GetCreateFormFieldsAsync(CancellationToken ct = default)
    {
        await LoadRefsAsync(ct);
        return new[]
        {
            new FormFieldDef { Key = "nama", Label = "Nama", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "email", Label = "Email", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "password", Label = "Password", Kind = FormFieldKind.Password, Required = true },
            new FormFieldDef { Key = "nis", Label = "NIS", Kind = FormFieldKind.Text },
            new FormFieldDef { Key = "nisn", Label = "NISN", Kind = FormFieldKind.Text },
            new FormFieldDef { Key = "kelasId", Label = "Kelas", Kind = FormFieldKind.Combo, Options = Refs.Kelas.Select(k => new ComboOption(k.Id, k.Nama)).ToList() },
        };
    }

    protected override async Task<IReadOnlyList<FormFieldDef>> GetEditFormFieldsAsync(AdminUserDto item, CancellationToken ct = default)
    {
        await LoadRefsAsync(ct);
        return new[]
        {
            new FormFieldDef { Key = "nama", Label = "Nama", Kind = FormFieldKind.Text, Required = true, Value = item.Nama },
            new FormFieldDef { Key = "nis", Label = "NIS", Kind = FormFieldKind.Text, Value = item.Nis },
            new FormFieldDef { Key = "nisn", Label = "NISN", Kind = FormFieldKind.Text, Value = item.Nisn },
            new FormFieldDef { Key = "kelasId", Label = "Kelas", Kind = FormFieldKind.Combo, Options = Refs.Kelas.Select(k => new ComboOption(k.Id, k.Nama)).ToList(), Value = item.KelasId },
            new FormFieldDef { Key = "alamat", Label = "Alamat", Kind = FormFieldKind.Memo, Value = item.Alamat },
            new FormFieldDef { Key = "noTelp", Label = "No. Telp", Kind = FormFieldKind.Text, Value = item.NoTelp },
        };
    }

    protected override object? BuildCreateRequest(IReadOnlyDictionary<string, string?> v) => new AdminCreateUserRequest
    {
        Nama = v.GetValueOrDefault("nama") ?? "",
        Email = v.GetValueOrDefault("email") ?? "",
        Password = v.GetValueOrDefault("password"),
        Nis = v.GetValueOrDefault("nis"),
        Nisn = v.GetValueOrDefault("nisn"),
        KelasId = v.GetValueOrDefault("kelasId"),
    };

    protected override object? BuildEditRequest(AdminUserDto item, IReadOnlyDictionary<string, string?> v) => new AdminUpdateUserRequest
    {
        Nama = v.GetValueOrDefault("nama"),
        Nis = v.GetValueOrDefault("nis"),
        Nisn = v.GetValueOrDefault("nisn"),
        KelasId = v.GetValueOrDefault("kelasId"),
        Alamat = v.GetValueOrDefault("alamat"),
        NoTelp = v.GetValueOrDefault("noTelp"),
    };

    protected override async Task<bool> SaveCreateAsync(object request, CancellationToken ct) =>
        await _admin.CreateMuridAsync((AdminCreateUserRequest)request, ct) is not null;

    protected override async Task<bool> SaveEditAsync(string id, object request, CancellationToken ct) =>
        await _admin.UpdateMuridAsync(id, (AdminUpdateUserRequest)request, ct) is not null;

    protected override async Task<bool> ConfirmDeleteAsync(AdminUserDto item, CancellationToken ct) =>
        await DialogService.ConfirmAsync("Hapus Murid", $"Yakin hapus murid \"{item.Nama}\"? Data dapat dipulihkan.");

    protected override async Task DeleteCoreAsync(AdminUserDto item, CancellationToken ct) =>
        await _admin.DeleteMuridAsync(item.Id, ct);

    protected override async Task RestoreCoreAsync(AdminUserDto item, CancellationToken ct) =>
        await _admin.RestoreMuridAsync(item.Id, ct);

    [RelayCommand]
    public async Task ResetPasswordAsync(AdminUserDto item, CancellationToken ct = default)
    {
        if (IsBusy) return;
        if (!await DialogService.ConfirmAsync("Reset Password", $"Reset password {item.Nama} ke default?")) return;
        try
        {
            IsBusy = true;
            if (await _admin.ResetMuridPasswordAsync(item.Id, ct))
                StatusMessage = $"Password {item.Nama} direset ke default";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsBusy = false; }
    }
}

// ─── KELAS ───────────────────────────────────────────────────────────────────
public partial class AdminKelasViewModel : AdminPagedViewModel<KelasDto>
{
    private readonly IAdminService _admin;

    [ObservableProperty] private AdminRefsDto refs = new();

    public AdminKelasViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<KelasDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetKelassAsync(search, page, 10, ct);

    public async Task LoadRefsAsync(CancellationToken ct = default)
    {
        try { Refs = await _admin.GetRefsAsync(ct); } catch { /* refs opsional */ }
    }

    public override bool SupportsCrud => true;
    protected override string FormTitle => "Kelas";

    private static List<ComboOption> GuruOptions(AdminRefsDto refs) =>
        refs.Guru.Select(g => new ComboOption(g.Id, g.Nama)).ToList();

    protected override async Task<IReadOnlyList<FormFieldDef>> GetCreateFormFieldsAsync(CancellationToken ct = default)
    {
        await LoadRefsAsync(ct);
        return new[]
        {
            new FormFieldDef { Key = "nama", Label = "Nama Kelas", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "tingkat", Label = "Tingkat", Kind = FormFieldKind.Int, Required = true, Placeholder = "1-3" },
            new FormFieldDef { Key = "guruId", Label = "Wali Kelas (Guru)", Kind = FormFieldKind.Combo, Options = GuruOptions(Refs) },
        };
    }

    protected override async Task<IReadOnlyList<FormFieldDef>> GetEditFormFieldsAsync(KelasDto item, CancellationToken ct = default)
    {
        await LoadRefsAsync(ct);
        return new[]
        {
            new FormFieldDef { Key = "nama", Label = "Nama Kelas", Kind = FormFieldKind.Text, Required = true, Value = item.Nama },
            new FormFieldDef { Key = "tingkat", Label = "Tingkat", Kind = FormFieldKind.Int, Required = true, Value = item.Tingkat?.ToString() ?? "" },
            new FormFieldDef { Key = "guruId", Label = "Wali Kelas (Guru)", Kind = FormFieldKind.Combo, Options = GuruOptions(Refs), Value = item.GuruId },
        };
    }

    protected override object? BuildCreateRequest(IReadOnlyDictionary<string, string?> v) => new KelasCreateRequest
    {
        Nama = v.GetValueOrDefault("nama") ?? "",
        Tingkat = int.TryParse(v.GetValueOrDefault("tingkat"), out var t) ? t : 0,
        GuruId = v.GetValueOrDefault("guruId"),
    };

    protected override object? BuildEditRequest(KelasDto item, IReadOnlyDictionary<string, string?> v) => new KelasUpdateRequest
    {
        Nama = v.GetValueOrDefault("nama"),
        Tingkat = int.TryParse(v.GetValueOrDefault("tingkat"), out var t) ? t : null,
        GuruId = v.GetValueOrDefault("guruId"),
    };

    protected override async Task<bool> SaveCreateAsync(object request, CancellationToken ct) =>
        await _admin.CreateKelasAsync((KelasCreateRequest)request, ct) is not null;

    protected override async Task<bool> SaveEditAsync(string id, object request, CancellationToken ct) =>
        await _admin.UpdateKelasAsync(id, (KelasUpdateRequest)request, ct) is not null;

    [RelayCommand]
    public async Task DeleteAsync(KelasDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeleteKelasAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── MAPEL ───────────────────────────────────────────────────────────────────
public partial class AdminMapelViewModel : AdminPagedViewModel<MapelDto>
{
    private readonly IAdminService _admin;

    public AdminMapelViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<MapelDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetMapelsAsync(search, page, 10, ct);

    [ObservableProperty] private AdminRefsDto refs = new();
    public async Task LoadRefsAsync(CancellationToken ct = default)
    {
        try { Refs = await _admin.GetRefsAsync(ct); } catch { }
    }

    public override bool SupportsCrud => true;
    protected override string FormTitle => "Mata Pelajaran";

    protected override async Task<IReadOnlyList<FormFieldDef>> GetCreateFormFieldsAsync(CancellationToken ct = default)
    {
        await LoadRefsAsync(ct);
        return new[]
        {
            new FormFieldDef { Key = "kode", Label = "Kode", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "nama", Label = "Nama Mapel", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "deskripsi", Label = "Deskripsi", Kind = FormFieldKind.Memo },
            new FormFieldDef { Key = "guruId", Label = "Guru Pengampu", Kind = FormFieldKind.Combo, Required = true, Options = Refs.Guru.Select(g => new ComboOption(g.Id, g.Nama)).ToList() },
            new FormFieldDef { Key = "semesterId", Label = "Semester", Kind = FormFieldKind.Combo, Required = true, Options = Refs.Semester.Select(s => new ComboOption(s.Id, s.Nama)).ToList() },
        };
    }

    protected override async Task<IReadOnlyList<FormFieldDef>> GetEditFormFieldsAsync(MapelDto item, CancellationToken ct = default)
    {
        await LoadRefsAsync(ct);
        return new[]
        {
            new FormFieldDef { Key = "kode", Label = "Kode", Kind = FormFieldKind.Text, Required = true, Value = item.Kode },
            new FormFieldDef { Key = "nama", Label = "Nama Mapel", Kind = FormFieldKind.Text, Required = true, Value = item.Nama },
            new FormFieldDef { Key = "deskripsi", Label = "Deskripsi", Kind = FormFieldKind.Memo, Value = item.Deskripsi },
            new FormFieldDef { Key = "semesterId", Label = "Semester", Kind = FormFieldKind.Combo, Options = Refs.Semester.Select(s => new ComboOption(s.Id, s.Nama)).ToList(), Value = item.SemesterId },
        };
    }

    protected override object? BuildCreateRequest(IReadOnlyDictionary<string, string?> v) => new MapelCreateRequest
    {
        Kode = v.GetValueOrDefault("kode") ?? "",
        Nama = v.GetValueOrDefault("nama") ?? "",
        Deskripsi = v.GetValueOrDefault("deskripsi"),
        GuruId = v.GetValueOrDefault("guruId") ?? "",
        SemesterId = v.GetValueOrDefault("semesterId") ?? "",
    };

    protected override object? BuildEditRequest(MapelDto item, IReadOnlyDictionary<string, string?> v) => new MapelUpdateRequest
    {
        Kode = v.GetValueOrDefault("kode"),
        Nama = v.GetValueOrDefault("nama"),
        Deskripsi = v.GetValueOrDefault("deskripsi"),
        SemesterId = v.GetValueOrDefault("semesterId"),
    };

    protected override async Task<bool> SaveCreateAsync(object request, CancellationToken ct) =>
        await _admin.CreateMapelAsync((MapelCreateRequest)request, ct) is not null;

    protected override async Task<bool> SaveEditAsync(string id, object request, CancellationToken ct) =>
        await _admin.UpdateMapelAsync(id, (MapelUpdateRequest)request, ct) is not null;

    [RelayCommand]
    public async Task DeleteAsync(MapelDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeleteMapelAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── TAHUN AJARAN ────────────────────────────────────────────────────────────
public partial class AdminTahunAjaranViewModel : AdminPagedViewModel<TahunAjaranDto>
{
    private readonly IAdminService _admin;

    public AdminTahunAjaranViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<TahunAjaranDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetTahunAjaransAsync(search, page, 10, ct);

    public override bool SupportsCrud => true;
    protected override string FormTitle => "Tahun Ajaran";

    protected override Task<IReadOnlyList<FormFieldDef>> GetCreateFormFieldsAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<FormFieldDef>>(new[]
        {
            new FormFieldDef { Key = "nama", Label = "Nama (cth: 2025/2026)", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "tahunMulai", Label = "Tahun Mulai", Kind = FormFieldKind.Int, Required = true },
            new FormFieldDef { Key = "tahunSelesai", Label = "Tahun Selesai", Kind = FormFieldKind.Int, Required = true },
            new FormFieldDef { Key = "isAktif", Label = "Jadikan Aktif", Kind = FormFieldKind.Bool },
        });

    protected override Task<IReadOnlyList<FormFieldDef>> GetEditFormFieldsAsync(TahunAjaranDto item, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<FormFieldDef>>(new[]
        {
            new FormFieldDef { Key = "nama", Label = "Nama", Kind = FormFieldKind.Text, Required = true, Value = item.Nama },
            new FormFieldDef { Key = "tahunMulai", Label = "Tahun Mulai", Kind = FormFieldKind.Int, Required = true, Value = item.TahunMulai.ToString() },
            new FormFieldDef { Key = "tahunSelesai", Label = "Tahun Selesai", Kind = FormFieldKind.Int, Required = true, Value = item.TahunSelesai.ToString() },
            new FormFieldDef { Key = "isAktif", Label = "Jadikan Aktif", Kind = FormFieldKind.Bool, Value = item.IsAktif ? "true" : "false" },
        });

    protected override object? BuildCreateRequest(IReadOnlyDictionary<string, string?> v) => new TahunAjaranCreateRequest
    {
        Nama = v.GetValueOrDefault("nama") ?? "",
        TahunMulai = int.TryParse(v.GetValueOrDefault("tahunMulai"), out var a) ? a : 0,
        TahunSelesai = int.TryParse(v.GetValueOrDefault("tahunSelesai"), out var b) ? b : 0,
        IsAktif = v.GetValueOrDefault("isAktif") == "true",
    };

    protected override object? BuildEditRequest(TahunAjaranDto item, IReadOnlyDictionary<string, string?> v) => new TahunAjaranUpdateRequest
    {
        Nama = v.GetValueOrDefault("nama"),
        TahunMulai = int.TryParse(v.GetValueOrDefault("tahunMulai"), out var a) ? a : null,
        TahunSelesai = int.TryParse(v.GetValueOrDefault("tahunSelesai"), out var b) ? b : null,
        IsAktif = v.GetValueOrDefault("isAktif") == "true" ? true : null,
    };

    protected override async Task<bool> SaveCreateAsync(object request, CancellationToken ct) =>
        await _admin.CreateTahunAjaranAsync((TahunAjaranCreateRequest)request, ct) is not null;

    protected override async Task<bool> SaveEditAsync(string id, object request, CancellationToken ct) =>
        await _admin.UpdateTahunAjaranAsync(id, (TahunAjaranUpdateRequest)request, ct) is not null;

    [RelayCommand]
    public async Task SetActiveAsync(TahunAjaranDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.SetActiveTahunAjaranAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task DeleteAsync(TahunAjaranDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeleteTahunAjaranAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── SEMESTER ────────────────────────────────────────────────────────────────
public partial class AdminSemesterViewModel : AdminPagedViewModel<SemesterDto>
{
    private readonly IAdminService _admin;

    public AdminSemesterViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<SemesterDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetSemestersAsync(search, page, 10, null, ct);

    [ObservableProperty] private AdminRefsDto refs = new();
    public async Task LoadRefsAsync(CancellationToken ct = default)
    {
        try { Refs = await _admin.GetRefsAsync(ct); } catch { }
    }

    public override bool SupportsCrud => true;
    protected override string FormTitle => "Semester";

    protected override async Task<IReadOnlyList<FormFieldDef>> GetCreateFormFieldsAsync(CancellationToken ct = default)
    {
        await LoadRefsAsync(ct);
        return new[]
        {
            new FormFieldDef { Key = "nama", Label = "Nama (cth: Ganjil)", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "tahunAjaranId", Label = "Tahun Ajaran", Kind = FormFieldKind.Combo, Required = true, Options = Refs.TahunAjaran.Select(t => new ComboOption(t.Id, t.Nama)).ToList() },
            new FormFieldDef { Key = "isAktif", Label = "Jadikan Aktif", Kind = FormFieldKind.Bool },
        };
    }

    protected override async Task<IReadOnlyList<FormFieldDef>> GetEditFormFieldsAsync(SemesterDto item, CancellationToken ct = default)
    {
        await LoadRefsAsync(ct);
        return new[]
        {
            new FormFieldDef { Key = "nama", Label = "Nama", Kind = FormFieldKind.Text, Required = true, Value = item.Nama },
            new FormFieldDef { Key = "tahunAjaranId", Label = "Tahun Ajaran", Kind = FormFieldKind.Combo, Options = Refs.TahunAjaran.Select(t => new ComboOption(t.Id, t.Nama)).ToList(), Value = item.TahunAjaranId },
            new FormFieldDef { Key = "isAktif", Label = "Jadikan Aktif", Kind = FormFieldKind.Bool, Value = item.IsAktif ? "true" : "false" },
        };
    }

    protected override object? BuildCreateRequest(IReadOnlyDictionary<string, string?> v) => new SemesterCreateRequest
    {
        Nama = v.GetValueOrDefault("nama") ?? "",
        TahunAjaranId = v.GetValueOrDefault("tahunAjaranId") ?? "",
        IsAktif = v.GetValueOrDefault("isAktif") == "true",
    };

    protected override object? BuildEditRequest(SemesterDto item, IReadOnlyDictionary<string, string?> v) => new SemesterUpdateRequest
    {
        Nama = v.GetValueOrDefault("nama"),
        TahunAjaranId = v.GetValueOrDefault("tahunAjaranId"),
        IsAktif = v.GetValueOrDefault("isAktif") == "true" ? true : null,
    };

    protected override async Task<bool> SaveCreateAsync(object request, CancellationToken ct) =>
        await _admin.CreateSemesterAsync((SemesterCreateRequest)request, ct) is not null;

    protected override async Task<bool> SaveEditAsync(string id, object request, CancellationToken ct) =>
        await _admin.UpdateSemesterAsync(id, (SemesterUpdateRequest)request, ct) is not null;

    [RelayCommand]
    public async Task SetActiveAsync(SemesterDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.SetActiveSemesterAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }

    [RelayCommand]
    public async Task DeleteAsync(SemesterDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeleteSemesterAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── JURUSAN ─────────────────────────────────────────────────────────────────
public partial class AdminJurusanViewModel : AdminPagedViewModel<JurusanDto>
{
    private readonly IAdminService _admin;

    public AdminJurusanViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<JurusanDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetJurussansAsync(search, page, 10, ct);

    public override bool SupportsCrud => true;
    protected override string FormTitle => "Jurusan";

    protected override Task<IReadOnlyList<FormFieldDef>> GetCreateFormFieldsAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<FormFieldDef>>(new[]
        {
            new FormFieldDef { Key = "kode", Label = "Kode", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "nama", Label = "Nama Jurusan", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "deskripsi", Label = "Deskripsi", Kind = FormFieldKind.Memo },
        });

    protected override Task<IReadOnlyList<FormFieldDef>> GetEditFormFieldsAsync(JurusanDto item, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<FormFieldDef>>(new[]
        {
            new FormFieldDef { Key = "kode", Label = "Kode", Kind = FormFieldKind.Text, Required = true, Value = item.Kode },
            new FormFieldDef { Key = "nama", Label = "Nama Jurusan", Kind = FormFieldKind.Text, Required = true, Value = item.Nama },
            new FormFieldDef { Key = "deskripsi", Label = "Deskripsi", Kind = FormFieldKind.Memo, Value = item.Deskripsi },
        });

    protected override object? BuildCreateRequest(IReadOnlyDictionary<string, string?> v) => new JurusanCreateRequest
    {
        Kode = v.GetValueOrDefault("kode") ?? "",
        Nama = v.GetValueOrDefault("nama") ?? "",
        Deskripsi = v.GetValueOrDefault("deskripsi"),
    };

    protected override object? BuildEditRequest(JurusanDto item, IReadOnlyDictionary<string, string?> v) => new JurusanUpdateRequest
    {
        Kode = v.GetValueOrDefault("kode"),
        Nama = v.GetValueOrDefault("nama"),
        Deskripsi = v.GetValueOrDefault("deskripsi"),
    };

    protected override async Task<bool> SaveCreateAsync(object request, CancellationToken ct) =>
        await _admin.CreateJurusanAsync((JurusanCreateRequest)request, ct) is not null;

    protected override async Task<bool> SaveEditAsync(string id, object request, CancellationToken ct) =>
        await _admin.UpdateJurusanAsync(id, (JurusanUpdateRequest)request, ct) is not null;

    [RelayCommand]
    public async Task DeleteAsync(JurusanDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeleteJurusanAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── KOMPETENSI ──────────────────────────────────────────────────────────────
public partial class AdminKompetensiViewModel : AdminPagedViewModel<KompetensiDto>
{
    private readonly IAdminService _admin;

    public AdminKompetensiViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<KompetensiDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetKompetensisAsync(search, page, 10, null, null, ct);

    [ObservableProperty] private AdminRefsDto refs = new();
    public async Task LoadRefsAsync(CancellationToken ct = default)
    {
        try { Refs = await _admin.GetRefsAsync(ct); } catch { }
    }

    public override bool SupportsCrud => true;
    protected override string FormTitle => "Kompetensi";

    protected override async Task<IReadOnlyList<FormFieldDef>> GetCreateFormFieldsAsync(CancellationToken ct = default)
    {
        await LoadRefsAsync(ct);
        return new[]
        {
            new FormFieldDef { Key = "kode", Label = "Kode", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "nama", Label = "Nama Kompetensi", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "deskripsi", Label = "Deskripsi", Kind = FormFieldKind.Memo },
            new FormFieldDef { Key = "jurusanId", Label = "Jurusan", Kind = FormFieldKind.Combo, Required = true, Options = Refs.Jurusan.Select(j => new ComboOption(j.Id, j.Nama)).ToList() },
            new FormFieldDef { Key = "mataPelajaranId", Label = "Mata Pelajaran", Kind = FormFieldKind.Combo, Options = Refs.Mapel.Select(m => new ComboOption(m.Id, m.Nama)).ToList() },
            new FormFieldDef { Key = "tingkat", Label = "Tingkat", Kind = FormFieldKind.Int },
            new FormFieldDef { Key = "urutan", Label = "Urutan", Kind = FormFieldKind.Int },
        };
    }

    protected override async Task<IReadOnlyList<FormFieldDef>> GetEditFormFieldsAsync(KompetensiDto item, CancellationToken ct = default)
    {
        await LoadRefsAsync(ct);
        return new[]
        {
            new FormFieldDef { Key = "kode", Label = "Kode", Kind = FormFieldKind.Text, Required = true, Value = item.Kode },
            new FormFieldDef { Key = "nama", Label = "Nama Kompetensi", Kind = FormFieldKind.Text, Required = true, Value = item.Nama },
            new FormFieldDef { Key = "deskripsi", Label = "Deskripsi", Kind = FormFieldKind.Memo, Value = item.Deskripsi },
            new FormFieldDef { Key = "jurusanId", Label = "Jurusan", Kind = FormFieldKind.Combo, Options = Refs.Jurusan.Select(j => new ComboOption(j.Id, j.Nama)).ToList(), Value = item.JurusanId },
            new FormFieldDef { Key = "mataPelajaranId", Label = "Mata Pelajaran", Kind = FormFieldKind.Combo, Options = Refs.Mapel.Select(m => new ComboOption(m.Id, m.Nama)).ToList(), Value = item.MataPelajaranId },
            new FormFieldDef { Key = "tingkat", Label = "Tingkat", Kind = FormFieldKind.Int, Value = item.Tingkat?.ToString() },
            new FormFieldDef { Key = "urutan", Label = "Urutan", Kind = FormFieldKind.Int, Value = item.Urutan?.ToString() },
        };
    }

    protected override object? BuildCreateRequest(IReadOnlyDictionary<string, string?> v) => new KompetensiCreateRequest
    {
        Kode = v.GetValueOrDefault("kode") ?? "",
        Nama = v.GetValueOrDefault("nama") ?? "",
        Deskripsi = v.GetValueOrDefault("deskripsi"),
        JurusanId = v.GetValueOrDefault("jurusanId") ?? "",
        MataPelajaranId = v.GetValueOrDefault("mataPelajaranId"),
        Tingkat = int.TryParse(v.GetValueOrDefault("tingkat"), out var t) ? t : null,
        Urutan = int.TryParse(v.GetValueOrDefault("urutan"), out var u) ? u : null,
    };

    protected override object? BuildEditRequest(KompetensiDto item, IReadOnlyDictionary<string, string?> v) => new KompetensiUpdateRequest
    {
        Kode = v.GetValueOrDefault("kode"),
        Nama = v.GetValueOrDefault("nama"),
        Deskripsi = v.GetValueOrDefault("deskripsi"),
        JurusanId = v.GetValueOrDefault("jurusanId"),
        MataPelajaranId = v.GetValueOrDefault("mataPelajaranId"),
        Tingkat = int.TryParse(v.GetValueOrDefault("tingkat"), out var t) ? t : null,
        Urutan = int.TryParse(v.GetValueOrDefault("urutan"), out var u) ? u : null,
    };

    protected override async Task<bool> SaveCreateAsync(object request, CancellationToken ct) =>
        await _admin.CreateKompetensiAsync((KompetensiCreateRequest)request, ct) is not null;

    protected override async Task<bool> SaveEditAsync(string id, object request, CancellationToken ct) =>
        await _admin.UpdateKompetensiAsync(id, (KompetensiUpdateRequest)request, ct) is not null;

    [RelayCommand]
    public async Task DeleteAsync(KompetensiDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeleteKompetensiAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── PENGUMUMAN ──────────────────────────────────────────────────────────────
public partial class AdminPengumumanViewModel : AdminPagedViewModel<PengumumanDto>
{
    private readonly IAdminService _admin;

    public AdminPengumumanViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<PengumumanDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetPengumumenAsync(page, 10, ct);

    [ObservableProperty] private AdminRefsDto refs = new();
    public async Task LoadRefsAsync(CancellationToken ct = default)
    {
        try { Refs = await _admin.GetRefsAsync(ct); } catch { }
    }

    public override bool SupportsCrud => true;
    protected override string FormTitle => "Pengumuman";

    protected override async Task<IReadOnlyList<FormFieldDef>> GetCreateFormFieldsAsync(CancellationToken ct = default)
    {
        await LoadRefsAsync(ct);
        return new[]
        {
            new FormFieldDef { Key = "judul", Label = "Judul", Kind = FormFieldKind.Text, Required = true },
            new FormFieldDef { Key = "isi", Label = "Isi", Kind = FormFieldKind.Memo, Required = true },
            new FormFieldDef { Key = "tipe", Label = "Tipe", Kind = FormFieldKind.Combo,
                Options = new[] { new ComboOption("UMUM", "Umum"), new ComboOption("KELAS", "Kelas") } },
            new FormFieldDef { Key = "kelasId", Label = "Kelas (jika tipe Kelas)", Kind = FormFieldKind.Combo,
                Options = Refs.Kelas.Select(k => new ComboOption(k.Id, k.Nama)).ToList() },
        };
    }

    protected override object? BuildCreateRequest(IReadOnlyDictionary<string, string?> v) => new PengumumanCreateRequest
    {
        Judul = v.GetValueOrDefault("judul") ?? "",
        Isi = v.GetValueOrDefault("isi") ?? "",
        Tipe = v.GetValueOrDefault("tipe"),
        KelasId = v.GetValueOrDefault("kelasId"),
    };

    protected override async Task<bool> SaveCreateAsync(object request, CancellationToken ct) =>
        await _admin.CreatePengumumanAsync((PengumumanCreateRequest)request, ct) is not null;

    [RelayCommand]
    public async Task DeleteAsync(PengumumanDto item, CancellationToken ct = default)
    {
        try
        {
            if (await _admin.DeletePengumumanAsync(item.Id, ct)) await LoadAsync(ct);
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
    }
}

// ─── NILAI ───────────────────────────────────────────────────────────────────
public partial class AdminNilaiViewModel : AdminPagedViewModel<AdminNilaiDto>
{
    private readonly IAdminService _admin;

    public AdminNilaiViewModel(IAdminService admin) => _admin = admin;

    protected override Task<PagedResult<AdminNilaiDto>> FetchAsync(string? search, int page, bool includeDeleted, CancellationToken ct) =>
        _admin.GetNilaisAsync(null, null, null, page, 20, ct);
}

// ─── STATISTIK ───────────────────────────────────────────────────────────────
public partial class AdminStatistikViewModel : ObservableObject
{
    private readonly IAdminService _admin;

    [ObservableProperty] private bool isLoading;
    [ObservableProperty] private string? errorMessage;
    [ObservableProperty] private StatistikGuruMuridDto guruMurid = new();
    [ObservableProperty] private string statusMessage = "";

    public ObservableCollection<StatistikBarDto> PerKelas { get; } = new();
    public ObservableCollection<StatistikBarDto> PerMapel { get; } = new();

    public AdminStatistikViewModel(IAdminService admin) => _admin = admin;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        IsLoading = true; ErrorMessage = null;
        try
        {
            GuruMurid = await _admin.GetStatistikGuruMuridAsync(ct);
            var perKelas = await _admin.GetStatistikPerKelasAsync(ct);
            var perMapel = await _admin.GetStatistikPerMapelAsync(ct);
            PerKelas.Clear(); foreach (var k in perKelas) PerKelas.Add(k);
            PerMapel.Clear(); foreach (var m in perMapel) PerMapel.Add(m);
            StatusMessage = "Statistik akademik";
        }
        catch (Exception ex) { ErrorMessage = ex.Message; }
        finally { IsLoading = false; }
    }
}
