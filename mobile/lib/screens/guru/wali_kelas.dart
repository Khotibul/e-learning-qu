import "package:flutter/material.dart";
import "../../services/api_service.dart";
import "pelanggaran.dart";
import "intervensi.dart";
import "absensi.dart";

/// Wali Kelas — mirror web /guru/wali-kelas (tab Struktur/Kas/Piket/Menu).
/// Kas: iuran/denda/pengeluaran + konfirmasi pembayaran; Piket CRUD;
/// Struktur: atur jabatan siswa; Menu: shortcut ke Pelanggaran/Intervensi/Absensi.
class GuruWaliKelas extends StatefulWidget {
  const GuruWaliKelas({super.key});
  @override
  State<GuruWaliKelas> createState() => _GuruWaliKelasState();
}

class _GuruWaliKelasState extends State<GuruWaliKelas> {
  List<dynamic> kelasList = [];
  bool loading = true;
  String? kelasId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/wali-kelas", useCache: false);
      if (mounted) {
        setState(() {
          kelasList = v is List ? v : [];
          if (kelasId == null && kelasList.isNotEmpty) kelasId = (kelasList.first as Map)["id"] as String?;
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 5,
    child: Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text("Wali Kelas"),
        backgroundColor: Colors.white,
        elevation: 0,
        bottom: const TabBar(
          isScrollable: true,
          labelColor: Color(0xFF0F172A),
          unselectedLabelColor: Colors.black45,
          tabs: [Tab(text: "Struktur"), Tab(text: "Kehadiran"), Tab(text: "Kas"), Tab(text: "Piket"), Tab(text: "Menu")],
        ),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : kelasList.isEmpty
              ? const Center(child: Padding(padding: EdgeInsets.all(24), child: Text("Anda bukan wali kelas mana pun", textAlign: TextAlign.center, style: TextStyle(color: Colors.black54))))
              : Column(children: [
                  if (kelasList.length > 1)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                      child: DropdownButtonFormField<String>(
                        initialValue: kelasId,
                        decoration: const InputDecoration(labelText: "Kelas", border: OutlineInputBorder(), isDense: true),
                        items: kelasList.map((k) => DropdownMenuItem<String>(value: (k as Map)["id"] as String, child: Text("${k["nama"]}"))).toList(),
                        onChanged: (v) => setState(() => kelasId = v),
                      ),
                    ),
                  Expanded(
                    child: TabBarView(children: [
                      _StrukturTab(kelasList: kelasList, onChanged: (msg) { _snack(msg); _load(); }),
                      _KehadiranTab(kelasId: kelasId, onSnack: _snack),
                      _KasTab(kelasId: kelasId, onSnack: _snack),
                      _PiketTab(kelasId: kelasId, onSnack: _snack),
                      const _MenuTab(),
                    ]),
                  ),
                ]),
    ),
  );
}

// ============================== STRUKTUR ==============================

const _jabatanOpts = {
  "": "Tidak ada",
  "KETUA": "Ketua Kelas",
  "WAKIL": "Wakil Ketua",
  "BENDAHARA": "Bendahara",
  "SEKRETARIS": "Sekretaris",
};

class _StrukturTab extends StatelessWidget {
  final List<dynamic> kelasList;
  final void Function(String msg) onChanged;
  const _StrukturTab({required this.kelasList, required this.onChanged});

  Future<void> _setJabatan(BuildContext context, Map siswa) async {
    final pilih = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Padding(padding: EdgeInsets.all(14), child: Text("Atur Jabatan", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14))),
          ..._jabatanOpts.entries.map((e) => ListTile(
            dense: true,
            leading: e.key == (siswa["jabatan"] ?? "") ? const Icon(Icons.check, color: Color(0xFF0EA5E9), size: 18) : const SizedBox(width: 18),
            title: Text(e.value, style: const TextStyle(fontSize: 13)),
            onTap: () => Navigator.pop(ctx, e.key),
          )),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (pilih == null) return;
    try {
      await ApiService.post("/api/mobile/guru/wali-kelas", {"op": "updateJabatan", "siswaId": siswa["id"], "jabatan": pilih});
      onChanged("Jabatan diperbarui");
    } catch (e) {
      onChanged("Gagal: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (kelasList.isEmpty) return const Center(child: Text("Tidak ada kelas", style: TextStyle(color: Colors.black54)));
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: kelasList.length,
      itemBuilder: (_, i) {
        final k = kelasList[i] as Map;
        final siswas = (k["siswas"] as List? ?? []);
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text("${k["nama"] ?? "-"}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14))),
                Text("${k["_count"]?["siswas"] ?? 0} siswa", style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              ]),
              const Divider(height: 18),
              if (siswas.isEmpty)
                const Text("Belum ada siswa", style: TextStyle(fontSize: 12, color: Colors.black54))
              else
                ...siswas.map((s) {
                  final m = s as Map;
                  final jab = (m["jabatan"] ?? "").toString();
                  return ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text("${m["nama"]}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: Text(jab.isEmpty ? (m["nis"]?.toString() ?? "") : "${_jabatanOpts[jab] ?? jab} • NIS ${m["nis"] ?? "-"}", style: const TextStyle(fontSize: 11)),
                    trailing: PopupMenuButton<String>(
                      icon: const Icon(Icons.more_vert, size: 18),
                      onSelected: (_) => _setJabatan(context, m),
                      itemBuilder: (_) => [const PopupMenuItem(value: "edit", child: Text("Atur Jabatan", style: TextStyle(fontSize: 13)))],
                    ),
                    onTap: () => _setJabatan(context, m),
                  );
                }),
            ]),
          ),
        );
      },
    );
  }
}

// ============================== KEHADIRAN ==============================

String _ymd(DateTime d) =>
    "${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}";

class _KehadiranTab extends StatefulWidget {
  final String? kelasId;
  final void Function(String msg, {Color color}) onSnack;
  const _KehadiranTab({required this.kelasId, required this.onSnack});

  @override
  State<_KehadiranTab> createState() => _KehadiranTabState();
}

class _KehadiranTabState extends State<_KehadiranTab> with AutomaticKeepAliveClientMixin {
  bool loading = true;
  String tanggal = _ymd(DateTime.now());
  List<dynamic> rows = [];
  Map<String, dynamic> summary = {};

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _KehadiranTab old) {
    super.didUpdateWidget(old);
    if (old.kelasId != widget.kelasId) _load();
  }

  bool get _tanggalLampau => tanggal.compareTo(_ymd(DateTime.now())) < 0;

  Future<void> _load() async {
    if (widget.kelasId == null) return;
    setState(() => loading = true);
    try {
      final v = await ApiService.get(
        "/api/mobile/guru/wali-kelas?tab=kehadiran&kelasId=${widget.kelasId}&tanggal=$tanggal",
        useCache: false,
      );
      if (!mounted) return;
      setState(() {
        rows = v is Map ? (v["rows"] as List? ?? []) : [];
        summary = v is Map ? Map<String, dynamic>.from(v["summary"] as Map? ?? {}) : {};
        loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => loading = false);
        widget.onSnack("Gagal memuat kehadiran: $e", color: const Color(0xFFEF4444));
      }
    }
  }

  String _status(Map r) {
    final s = (r["statusHarian"] ?? "").toString();
    if (s == "IZIN" || s == "SAKIT" || s == "HADIR") return s;
    if (r["jamMasuk"] != null) return (r["statusMasuk"] ?? "HADIR").toString();
    return "BELUM";
  }

  Color _warna(String s) {
    switch (s) {
      case "HADIR":
        return const Color(0xFF10B981);
      case "TERLAMBAT":
        return const Color(0xFFF59E0B);
      case "IZIN":
        return const Color(0xFF0EA5E9);
      case "SAKIT":
        return const Color(0xFF8B5CF6);
      default:
        return const Color(0xFF94A3B8);
    }
  }

  String _label(String s) {
    switch (s) {
      case "HADIR":
        return "Hadir";
      case "TERLAMBAT":
        return "Terlambat";
      case "IZIN":
        return "Izin";
      case "SAKIT":
        return "Sakit";
      default:
        return "Belum masuk";
    }
  }

  Future<void> _pilihTanggal() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.parse(tanggal),
      firstDate: DateTime(2024),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => tanggal = _ymd(picked));
      _load();
    }
  }

  Future<void> _edit(Map r) async {
    final awalStatus = (r["statusHarian"] ?? "").toString();
    String status = ["HADIR", "IZIN", "SAKIT"].contains(awalStatus) ? awalStatus : "";
    final masuk = TextEditingController(text: (r["jamMasuk"] ?? "").toString());
    final pulang = TextEditingController(text: (r["jamPulang"] ?? "").toString());
    final lampau = _tanggalLampau;

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) {
          final absen = status == "IZIN" || status == "SAKIT";
          return AlertDialog(
            title: Text("${r["nama"]}", style: const TextStyle(fontSize: 15)),
            content: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                DropdownButtonFormField<String>(
                  initialValue: status,
                  decoration: const InputDecoration(labelText: "Status kehadiran", border: OutlineInputBorder(), isDense: true),
                  items: const [
                    DropdownMenuItem(value: "", child: Text("Belum diisi", style: TextStyle(fontSize: 13))),
                    DropdownMenuItem(value: "HADIR", child: Text("Hadir", style: TextStyle(fontSize: 13))),
                    DropdownMenuItem(value: "IZIN", child: Text("Izin", style: TextStyle(fontSize: 13))),
                    DropdownMenuItem(value: "SAKIT", child: Text("Sakit", style: TextStyle(fontSize: 13))),
                  ],
                  onChanged: (v) => setD(() {
                    status = v ?? "";
                    if (absen || v == "IZIN" || v == "SAKIT") {
                      masuk.clear();
                      pulang.clear();
                    }
                  }),
                ),
                const SizedBox(height: 12),
                if (!lampau)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 8),
                    child: Text("Hari ini jam diisi fingerprint/wajah. Anda hanya dapat menandai Izin/Sakit.",
                        style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  ),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: masuk,
                      enabled: lampau && !absen,
                      keyboardType: TextInputType.datetime,
                      decoration: const InputDecoration(labelText: "Jam masuk", hintText: "07:00", border: OutlineInputBorder(), isDense: true),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: pulang,
                      enabled: lampau && !absen,
                      keyboardType: TextInputType.datetime,
                      decoration: const InputDecoration(labelText: "Jam pulang", hintText: "15:00", border: OutlineInputBorder(), isDense: true),
                    ),
                  ),
                ]),
              ]),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan")),
            ],
          );
        },
      ),
    );
    if (ok != true) return;

    final re = RegExp(r"^([01]\d|2[0-3]):[0-5]\d$");
    if (lampau && !(status == "IZIN" || status == "SAKIT")) {
      if (masuk.text.trim().isNotEmpty && !re.hasMatch(masuk.text.trim())) {
        widget.onSnack("Format jam masuk HH:MM", color: const Color(0xFFEF4444));
        return;
      }
      if (pulang.text.trim().isNotEmpty && !re.hasMatch(pulang.text.trim())) {
        widget.onSnack("Format jam pulang HH:MM", color: const Color(0xFFEF4444));
        return;
      }
    }

    try {
      await ApiService.post("/api/mobile/guru/wali-kelas", {
        "op": "simpanAbsensiHarian",
        "kelasId": widget.kelasId,
        "tanggal": tanggal,
        "rows": [
          {
            "siswaId": r["siswaId"],
            "jamMasuk": lampau && !(status == "IZIN" || status == "SAKIT") ? masuk.text.trim() : null,
            "jamPulang": lampau && !(status == "IZIN" || status == "SAKIT") ? pulang.text.trim() : null,
            "statusHarian": status.isEmpty ? null : status,
          }
        ],
      });
      widget.onSnack("Absensi ${r["nama"]} tersimpan");
      await _load();
    } catch (e) {
      widget.onSnack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (widget.kelasId == null) return const Center(child: Text("Pilih kelas", style: TextStyle(color: Colors.black54)));
    if (loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: const Icon(Icons.calendar_today_outlined, size: 18, color: Color(0xFF0EA5E9)),
              title: Text(tanggal, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              subtitle: Text(_tanggalLampau ? "Dapat diisi jam & status" : "Hari ini: hanya status Izin/Sakit", style: const TextStyle(fontSize: 11)),
              trailing: const Icon(Icons.edit, size: 16),
              onTap: _pilihTanggal,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            _chip("Masuk ${summary["masuk"] ?? 0}/${summary["total"] ?? 0}", const Color(0xFF10B981)),
            _chip("Belum ${summary["belumMasuk"] ?? 0}", const Color(0xFF64748B)),
            _chip("Terlambat ${summary["terlambat"] ?? 0}", const Color(0xFFF59E0B)),
            _chip("Izin ${summary["izin"] ?? 0}", const Color(0xFF0EA5E9)),
            _chip("Sakit ${summary["sakit"] ?? 0}", const Color(0xFF8B5CF6)),
          ]),
          const SizedBox(height: 10),
          if (rows.isEmpty)
            const Card(child: Padding(padding: EdgeInsets.all(16), child: Center(child: Text("Tidak ada siswa", style: TextStyle(color: Colors.black54)))))
          else
            ...rows.map((item) {
              final r = item as Map;
              final st = _status(r);
              final riwayat = (r["riwayat"] as List? ?? []);
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  dense: true,
                  leading: CircleAvatar(
                    radius: 16,
                    backgroundColor: _warna(st).withValues(alpha: 0.12),
                    child: Text("${r["nama"]}".isNotEmpty ? "${r["nama"]}"[0].toUpperCase() : "?",
                        style: TextStyle(fontSize: 12, color: _warna(st), fontWeight: FontWeight.bold)),
                  ),
                  title: Text("${r["nama"]}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    "Masuk ${r["jamMasuk"] ?? "-"} • Pulang ${r["jamPulang"] ?? "-"}"
                    "${riwayat.isNotEmpty ? " • diinput ${(riwayat.first as Map)["oleh"] ?? "-"}" : ""}",
                    style: const TextStyle(fontSize: 10),
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: _warna(st).withValues(alpha: 0.14), borderRadius: BorderRadius.circular(20)),
                    child: Text(_label(st), style: TextStyle(fontSize: 10, color: _warna(st), fontWeight: FontWeight.bold)),
                  ),
                  onTap: () => _edit(r),
                ),
              );
            }),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _chip(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
    child: Text(text, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
  );
}

// ============================== KAS ==============================

class _KasTab extends StatefulWidget {
  final String? kelasId;
  final void Function(String msg, {Color color}) onSnack;
  const _KasTab({required this.kelasId, required this.onSnack});

  @override
  State<_KasTab> createState() => _KasTabState();
}

class _KasTabState extends State<_KasTab> with AutomaticKeepAliveClientMixin {
  bool loading = true;
  Map<String, dynamic>? kas;
  List<dynamic> iuran = [], denda = [], pengeluaran = [];

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _KasTab old) {
    super.didUpdateWidget(old);
    if (old.kelasId != widget.kelasId) _load();
  }

  Future<void> _load() async {
    if (widget.kelasId == null) return;
    setState(() => loading = true);
    try {
      final k = widget.kelasId;
      final results = await Future.wait([
        ApiService.get("/api/mobile/guru/wali-kelas?tab=kas&kelasId=$k", useCache: false),
        ApiService.get("/api/mobile/guru/wali-kelas?tab=iuran&kelasId=$k", useCache: false),
        ApiService.get("/api/mobile/guru/wali-kelas?tab=denda&kelasId=$k", useCache: false),
        ApiService.get("/api/mobile/guru/wali-kelas?tab=pengeluaran&kelasId=$k", useCache: false),
      ]);
      if (!mounted) return;
      setState(() {
        kas = results[0] is Map ? Map<String, dynamic>.from(results[0] as Map) : null;
        iuran = results[1] is List ? results[1] as List : [];
        denda = results[2] is List ? results[2] as List : [];
        pengeluaran = results[3] is List ? results[3] as List : [];
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) => widget.onSnack(msg, color: color);

  Future<void> _op(Map<String, dynamic> body) async {
    await ApiService.post("/api/mobile/guru/wali-kelas", {"kelasId": widget.kelasId, ...body});
    await _load();
  }

  Future<void> _hapus(String jenis, String id, String label) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Hapus?"),
        content: Text(label),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Colors.red), onPressed: () => Navigator.pop(ctx, true), child: const Text("Hapus")),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiService.delete("/api/mobile/guru/wali-kelas?jenis=$jenis&id=$id&kelasId=${widget.kelasId}");
      _snack("Dihapus");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _pilihSiswa(void Function(String siswaId, String nama) onPick) async {
    try {
      final v = await ApiService.get("/api/mobile/guru/wali-kelas?tab=siswa&kelasId=${widget.kelasId}", useCache: false);
      if (!mounted) return;
      if (v is! List || v.isEmpty) { _snack("Tidak ada siswa", color: const Color(0xFFEF4444)); return; }
      final picked = await showModalBottomSheet<Map>(
        context: context,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
        builder: (ctx) => SafeArea(
          child: ListView(children: v.map((s) => ListTile(dense: true, title: Text("${s["nama"]}", style: const TextStyle(fontSize: 13)), onTap: () => Navigator.pop(ctx, s))).toList()),
        ),
      );
      if (picked != null) onPick("${picked["id"]}", "${picked["nama"]}");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _formIuran() async {
    final nama = TextEditingController(), nominal = TextEditingController(), tenggat = TextEditingController(), deskripsi = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text("Tambah Iuran"),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: nama, decoration: const InputDecoration(labelText: "Nama", border: OutlineInputBorder(), isDense: true)),
        const SizedBox(height: 10),
        TextField(controller: nominal, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Nominal", border: OutlineInputBorder(), isDense: true)),
        const SizedBox(height: 10),
        TextField(controller: tenggat, decoration: const InputDecoration(labelText: "Tenggat (YYYY-MM-DD, opsional)", border: OutlineInputBorder(), isDense: true)),
        const SizedBox(height: 10),
        TextField(controller: deskripsi, decoration: const InputDecoration(labelText: "Deskripsi (opsional)", border: OutlineInputBorder(), isDense: true)),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan"))],
    ));
    if (ok != true) return;
    try {
      await _op({"op": "createIuran", "nama": nama.text.trim(), "nominal": int.tryParse(nominal.text) ?? 0, "tenggat": tenggat.text.trim(), "deskripsi": deskripsi.text.trim()});
      _snack("Iuran dibuat");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _formDenda() async {
    final nama = TextEditingController(), nominal = TextEditingController(), deskripsi = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text("Tambah Denda"),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: nama, decoration: const InputDecoration(labelText: "Nama", border: OutlineInputBorder(), isDense: true)),
        const SizedBox(height: 10),
        TextField(controller: nominal, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Nominal", border: OutlineInputBorder(), isDense: true)),
        const SizedBox(height: 10),
        TextField(controller: deskripsi, decoration: const InputDecoration(labelText: "Deskripsi (opsional)", border: OutlineInputBorder(), isDense: true)),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan"))],
    ));
    if (ok != true) return;
    try {
      await _op({"op": "createDenda", "nama": nama.text.trim(), "nominal": int.tryParse(nominal.text) ?? 0, "deskripsi": deskripsi.text.trim()});
      _snack("Denda dibuat");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _formPengeluaran() async {
    final ket = TextEditingController(), jumlah = TextEditingController(), tanggal = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text("Tambah Pengeluaran"),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: ket, decoration: const InputDecoration(labelText: "Keterangan", border: OutlineInputBorder(), isDense: true)),
        const SizedBox(height: 10),
        TextField(controller: jumlah, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Jumlah", border: OutlineInputBorder(), isDense: true)),
        const SizedBox(height: 10),
        TextField(controller: tanggal, decoration: const InputDecoration(labelText: "Tanggal (YYYY-MM-DD, opsional)", border: OutlineInputBorder(), isDense: true)),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan"))],
    ));
    if (ok != true) return;
    try {
      await _op({"op": "createPengeluaran", "keterangan": ket.text.trim(), "jumlah": int.tryParse(jumlah.text) ?? 0, "tanggal": tanggal.text.trim()});
      _snack("Pengeluaran dicatat");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  String _rp(num v) => "Rp ${v.toInt().toString().replaceAllMapped(RegExp(r"(?=(\d{3})+(?!\d))"), (m) => ".")}";

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (widget.kelasId == null) return const Center(child: Text("Pilih kelas", style: TextStyle(color: Colors.black54)));
    if (loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (kas != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text("Sisa Kas", style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  Text(_rp((kas!["sisaKas"] as num?) ?? 0), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF10B981))),
                  const SizedBox(height: 8),
                  Wrap(spacing: 8, children: [
                    _pill("Iuran", _rp((kas!["pemasukanIuran"] as num?) ?? 0)),
                    _pill("Denda", _rp((kas!["pemasukanDenda"] as num?) ?? 0)),
                    _pill("Pengeluaran", _rp((kas!["totalPengeluaran"] as num?) ?? 0)),
                  ]),
                ]),
              ),
            ),
          const SizedBox(height: 8),
          _sectionHeader("Iuran", Icons.savings_outlined, _formIuran),
          ...iuran.map((it) { final m = Map<String, dynamic>.from(it as Map); final pays = (m["pembayaran"] as List? ?? []); return Card(
            child: ExpansionTile(
              tilePadding: const EdgeInsets.symmetric(horizontal: 14),
              childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
              title: Text("${m["nama"]}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              subtitle: Text("${_rp((m["nominal"] as num?) ?? 0)} • tenggat ${"${m["tenggat"] ?? "-"}".split("T").first} • ${m["_count"]?["pembayaran"] ?? 0} bayar", style: const TextStyle(fontSize: 11)),
              leading: const Icon(Icons.receipt_long_outlined, size: 20, color: Color(0xFF0EA5E9)),
              trailing: PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert, size: 18),
                onSelected: (v) async {
                  if (v == "hapus") {
                    return _hapus("iuran", "${m["id"]}", "${m["nama"]}");
                  }
                  if (v == "catat") {
                    return _pilihSiswa((sid, _) async {
                      try { await _op({"op": "recordIuran", "iuranId": m["id"], "siswaId": sid}); _snack("Pembayaran dicatat"); } catch (e) { _snack("Gagal: $e", color: const Color(0xFFEF4444)); }
                    });
                  }
                },
                itemBuilder: (_) => const [PopupMenuItem(value: "catat", child: Text("Catat Bayar", style: TextStyle(fontSize: 13))), PopupMenuItem(value: "hapus", child: Text("Hapus", style: TextStyle(fontSize: 13, color: Colors.red)))],
              ),
              children: [
                if (pays.isEmpty) const Padding(padding: EdgeInsets.only(bottom: 8), child: Text("Belum ada pembayaran", style: TextStyle(fontSize: 11, color: Colors.black54))),
                ...pays.map((p) { final pm = p as Map; final st = (pm["status"] ?? "").toString(); return ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text("${pm["siswa"]?["nama"] ?? "-"}", style: const TextStyle(fontSize: 12)),
                  subtitle: Text("${_rp((pm["jumlah"] as num?) ?? 0)} • $st", style: TextStyle(fontSize: 10, color: st == "LUNAS" ? const Color(0xFF10B981) : const Color(0xFFF59E0B))),
                  trailing: st == "LUNAS" ? null : Row(mainAxisSize: MainAxisSize.min, children: [
                    IconButton(icon: const Icon(Icons.check_circle_outline, size: 18, color: Color(0xFF10B981)), tooltip: "Konfirmasi", onPressed: () async { try { await _op({"op": "confirmIuran", "iuranId": m["id"], "siswaId": pm["siswaId"]}); _snack("Dikonfirmasi"); } catch (e) { _snack("Gagal: $e", color: const Color(0xFFEF4444)); } }),
                    IconButton(icon: const Icon(Icons.cancel_outlined, size: 18, color: Color(0xFFEF4444)), tooltip: "Tolak", onPressed: () async { try { await _op({"op": "rejectIuran", "iuranId": m["id"], "siswaId": pm["siswaId"]}); _snack("Ditolak"); } catch (e) { _snack("Gagal: $e", color: const Color(0xFFEF4444)); } }),
                  ]),
                ); }),
              ],
            ),
          ); }),
          const SizedBox(height: 8),
          _sectionHeader("Denda", Icons.attach_money_outlined, _formDenda),
          ...denda.map((it) { final m = Map<String, dynamic>.from(it as Map); final pays = (m["pembayaran"] as List? ?? []); return Card(
            child: ExpansionTile(
              tilePadding: const EdgeInsets.symmetric(horizontal: 14),
              childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
              title: Text("${m["nama"]}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              subtitle: Text("${_rp((m["nominal"] as num?) ?? 0)} • ${m["_count"]?["pembayaran"] ?? 0} bayar", style: const TextStyle(fontSize: 11)),
              leading: const Icon(Icons.gavel_outlined, size: 20, color: Color(0xFFF59E0B)),
              trailing: PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert, size: 18),
                onSelected: (v) async {
                  if (v == "hapus") {
                    return _hapus("denda", "${m["id"]}", "${m["nama"]}");
                  }
                  if (v == "catat") {
                    return _pilihSiswa((sid, _) async {
                      try { await _op({"op": "recordDenda", "dendaId": m["id"], "siswaId": sid, "jumlah": m["nominal"]}); _snack("Pembayaran dicatat"); } catch (e) { _snack("Gagal: $e", color: const Color(0xFFEF4444)); }
                    });
                  }
                },
                itemBuilder: (_) => const [PopupMenuItem(value: "catat", child: Text("Catat Bayar", style: TextStyle(fontSize: 13))), PopupMenuItem(value: "hapus", child: Text("Hapus", style: TextStyle(fontSize: 13, color: Colors.red)))],
              ),
              children: pays.map((p) { final pm = p as Map; return ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text("${pm["siswa"]?["nama"] ?? "-"}", style: const TextStyle(fontSize: 12)),
                subtitle: Text(_rp((pm["jumlah"] as num?) ?? 0), style: const TextStyle(fontSize: 10)),
              ); }).toList(),
            ),
          ); }),
          const SizedBox(height: 8),
          _sectionHeader("Pengeluaran", Icons.receipt_outlined, _formPengeluaran),
          ...pengeluaran.map((it) { final m = Map<String, dynamic>.from(it as Map); return Card(
            child: ListTile(
              dense: true,
              title: Text("${m["keterangan"]}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              subtitle: Text(_rp((m["jumlah"] as num?) ?? 0), style: const TextStyle(fontSize: 11)),
              trailing: IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => _hapus("pengeluaran", "${m["id"]}", "${m["keterangan"]}")),
            ),
          ); }),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title, IconData icon, VoidCallback onAdd) => Padding(
    padding: const EdgeInsets.only(top: 8, bottom: 6),
    child: Row(children: [
      Icon(icon, size: 18, color: const Color(0xFF475569)),
      const SizedBox(width: 6),
      Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
      const Spacer(),
      IconButton(icon: const Icon(Icons.add_circle_outline, size: 22, color: Color(0xFF0EA5E9)), onPressed: onAdd, tooltip: "Tambah $title"),
    ]),
  );

  Widget _pill(String label, String value) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(10)),
    child: Text("$label: $value", style: const TextStyle(fontSize: 11, color: Color(0xFF334155))),
  );
}

// ============================== PIKET ==============================

const _hariList = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

class _PiketTab extends StatefulWidget {
  final String? kelasId;
  final void Function(String msg, {Color color}) onSnack;
  const _PiketTab({required this.kelasId, required this.onSnack});

  @override
  State<_PiketTab> createState() => _PiketTabState();
}

class _PiketTabState extends State<_PiketTab> with AutomaticKeepAliveClientMixin {
  bool loading = true;
  List<dynamic> piket = [];

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _PiketTab old) {
    super.didUpdateWidget(old);
    if (old.kelasId != widget.kelasId) _load();
  }

  Future<void> _load() async {
    if (widget.kelasId == null) return;
    try {
      final v = await ApiService.get("/api/mobile/guru/wali-kelas?tab=piket&kelasId=${widget.kelasId}", useCache: false);
      if (mounted) setState(() { piket = v is List ? v : []; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) => widget.onSnack(msg, color: color);

  Future<void> _tambah() async {
    List<dynamic> siswas = [];
    try {
      final v = await ApiService.get("/api/mobile/guru/wali-kelas?tab=siswa&kelasId=${widget.kelasId}", useCache: false);
      if (v is List) siswas = v;
    } catch (_) {}
    if (!mounted) return;
    if (siswas.isEmpty) { _snack("Tidak ada siswa", color: const Color(0xFFEF4444)); return; }

    String? siswaId;
    String hari = _hariList.first;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
        title: const Text("Tambah Piket"),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          DropdownButtonFormField<String>(
            decoration: const InputDecoration(labelText: "Siswa", border: OutlineInputBorder(), isDense: true),
            items: siswas.map((s) => DropdownMenuItem<String>(value: (s as Map)["id"] as String, child: Text("${s["nama"]}", style: const TextStyle(fontSize: 13)))).toList(),
            onChanged: (v) => setDlg(() => siswaId = v),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: hari,
            decoration: const InputDecoration(labelText: "Hari", border: OutlineInputBorder(), isDense: true),
            items: _hariList.map((h) => DropdownMenuItem(value: h, child: Text(h, style: const TextStyle(fontSize: 13)))).toList(),
            onChanged: (v) => setDlg(() => hari = v ?? hari),
          ),
        ]),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan"))],
      )),
    );
    if (ok != true || siswaId == null) return;
    try {
      await ApiService.post("/api/mobile/guru/wali-kelas", {"op": "createPiket", "kelasId": widget.kelasId, "siswaId": siswaId, "hari": hari});
      _snack("Piket ditambahkan");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _hapus(Map p) async {
    try {
      await ApiService.delete("/api/mobile/guru/wali-kelas?jenis=piket&id=${p["id"]}&kelasId=${widget.kelasId}");
      _snack("Dihapus");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (widget.kelasId == null) return const Center(child: Text("Pilih kelas", style: TextStyle(color: Colors.black54)));
    if (loading) return const Center(child: CircularProgressIndicator());
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(onPressed: _tambah, icon: const Icon(Icons.add), label: const Text("Tambah Piket")),
      body: piket.isEmpty
          ? const Center(child: Text("Belum ada jadwal piket", style: TextStyle(color: Colors.black54)))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                children: _hariList.map((h) {
                  final items = piket.where((p) => (p as Map)["hari"] == h).toList();
                  if (items.isEmpty) return const SizedBox.shrink();
                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(h, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0EA5E9))),
                        const SizedBox(height: 4),
                        ...items.map((p) { final m = p as Map; return ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          title: Text("${m["siswa"]?["nama"] ?? "-"}", style: const TextStyle(fontSize: 13)),
                          trailing: IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => _hapus(m)),
                        ); }),
                      ]),
                    ),
                  );
                }).toList(),
              ),
            ),
    );
  }
}

// ============================== MENU ==============================

class _MenuTab extends StatelessWidget {
  const _MenuTab();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Card(child: ListTile(leading: const Icon(Icons.gavel_outlined, color: Color(0xFFEF4444)), title: const Text("Pelanggaran", style: TextStyle(fontSize: 14)), subtitle: const Text("Catat & hapus pelanggaran siswa", style: TextStyle(fontSize: 11)), trailing: const Icon(Icons.chevron_right, size: 18), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruPelanggaran())))),
      Card(child: ListTile(leading: const Icon(Icons.support_agent_outlined, color: Color(0xFFF97316)), title: const Text("Intervensi", style: TextStyle(fontSize: 14)), subtitle: const Text("Buat & kelola intervensi siswa", style: TextStyle(fontSize: 11)), trailing: const Icon(Icons.chevron_right, size: 18), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruIntervensi())))),
      Card(child: ListTile(leading: const Icon(Icons.fact_check_outlined, color: Color(0xFF10B981)), title: const Text("Absensi", style: TextStyle(fontSize: 14)), subtitle: const Text("Rekap absensi harian & sesi mengajar", style: TextStyle(fontSize: 11)), trailing: const Icon(Icons.chevron_right, size: 18), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruAbsensi())))),
    ],
  );
}
