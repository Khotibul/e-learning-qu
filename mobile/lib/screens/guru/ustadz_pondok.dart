import "package:flutter/material.dart";
import "package:intl/intl.dart";
import "../../services/api_service.dart";

/// Dashboard Ustadz/Ustadzah — mirror web /ustadz.
/// Jadwal, absensi diniyah, setoran tahfidz, rekomendasi izin, dan laporan.
class GuruUstadzPondok extends StatefulWidget {
  const GuruUstadzPondok({super.key});
  @override
  State<GuruUstadzPondok> createState() => _GuruUstadzPondokState();
}

class _GuruUstadzPondokState extends State<GuruUstadzPondok> {
  bool loading = true;
  bool busy = false;
  String? error;
  Map<String, dynamic> dash = {};
  Map<String, dynamic> jadwal = {};
  Map<String, dynamic> diniyahOpts = {};
  Map<String, dynamic> diniyah = {};
  Map<String, dynamic> halaqahOpts = {};
  Map<String, dynamic> capaian = {};
  Map<String, dynamic> izin = {};
  Map<String, dynamic> laporan = {};
  String? selectedKelas;
  String? selectedHalaqah;

  static final _tgl = DateFormat("dd MMM yyyy", "id_ID");
  static const _statusAbsensi = ["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "ALPA", "TIDAK_HADIR"];

  @override
  void initState() {
    super.initState();
    _muatAwal();
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  Future<Map<String, dynamic>> _getTab(String tab, [String extra = ""]) async {
    final d = await ApiService.get("/api/mobile/pondok/ustadz?tab=$tab$extra", useCache: false);
    return d is Map ? Map<String, dynamic>.from(d) : {};
  }

  Future<void> _muatAwal() async {
    try {
      final hasil = await Future.wait([_getTab("dashboard"), _getTab("jadwal")]);
      if (mounted) {
        setState(() {
          dash = hasil[0];
          jadwal = hasil[1];
          loading = false;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() { error = e.toString(); loading = false; });
    }
  }

  Future<void> _muatTab(int i) async {
    setState(() => busy = true);
    try {
      if (i == 1) diniyahOpts = await _getTab("diniyah");
      if (i == 2) halaqahOpts = await _getTab("halaqah");
      if (i == 3) izin = await _getTab("izin");
      if (i == 4) laporan = await _getTab("laporan");
    } catch (e) {
      _snack("Gagal memuat: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _ambilDiniyah(String kelasId, {DateTime? tanggal}) async {
    setState(() { busy = true; selectedKelas = kelasId; });
    try {
      final t = tanggal ?? DateTime.now();
      final tgl = "${t.year}-${t.month.toString().padLeft(2, "0")}-${t.day.toString().padLeft(2, "0")}";
      diniyah = await _getTab("diniyah", "&kelasId=$kelasId&tanggal=$tgl");
      final rows = (diniyah["rows"] as List?) ?? [];
      for (final r in rows) {
        (r as Map)["status"] = r["status"] ?? "HADIR";
      }
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _simpanAbsensi() async {
    final kelas = diniyah["kelas"] as Map?;
    final rows = (diniyah["rows"] as List?) ?? [];
    if (kelas == null || rows.isEmpty) return;
    setState(() => busy = true);
    try {
      await ApiService.post("/api/mobile/pondok/ustadz", {
        "op": "simpanAbsensiDiniyah",
        "kelasId": kelas["id"],
        "tanggal": diniyah["tanggal"],
        "rows": rows.map((r) => {"santriId": (r as Map)["santriId"], "status": r["status"]}).toList(),
      });
      _snack("Absensi diniyah tersimpan");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _ambilCapaian(String halaqahId) async {
    setState(() { busy = true; selectedHalaqah = halaqahId; });
    try {
      capaian = await _getTab("halaqah", "&halaqahId=$halaqahId&mode=capaian");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _catatSetoran(String halaqahId, Map santri) async {
    final hasil = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _DialogSetoran(halaqahId: halaqahId, santri: santri),
    );
    if (hasil == null) return;
    setState(() => busy = true);
    try {
      await ApiService.post("/api/mobile/pondok/ustadz", {"op": "catatSetoran", ...hasil});
      _snack("Setoran tercatat");
      await _ambilCapaian(halaqahId);
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _buatKelas() async {
    final hasil = await showDialog<Map<String, dynamic>>(context: context, builder: (_) => const _DialogKelas());
    if (hasil == null) return;
    setState(() => busy = true);
    try {
      await ApiService.post("/api/mobile/pondok/ustadz", {"op": "createKelasDiniyah", ...hasil});
      _snack("Kelas diniyah dibuat & Anda menjadi pengampu");
      await _muatAwal();
      diniyahOpts = await _getTab("diniyah");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _buatHalaqah() async {
    final hasil = await showDialog<Map<String, dynamic>>(context: context, builder: (_) => const _DialogHalaqah());
    if (hasil == null) return;
    setState(() => busy = true);
    try {
      await ApiService.post("/api/mobile/pondok/ustadz", {"op": "createHalaqah", ...hasil});
      _snack("Halaqah dibuat & Anda menjadi pembina");
      await _muatAwal();
      halaqahOpts = await _getTab("halaqah");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _rekomendasiIzin(String izinId, String mode) async {
    final ctrl = TextEditingController();
    final catatan = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("Rekomendasi Izin (${mode == "SETUJUI" ? "Setujui" : "Tidak Setujui"})"),
        content: TextField(controller: ctrl, maxLines: 3, decoration: const InputDecoration(labelText: "Catatan rekomendasi (min. 5 karakter)", border: OutlineInputBorder())),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text("Kirim")),
        ],
      ),
    );
    ctrl.dispose();
    if (catatan == null) return;
    if (catatan.length < 5) { _snack("Catatan minimal 5 karakter", color: const Color(0xFFEF4444)); return; }
    setState(() => busy = true);
    try {
      await ApiService.post("/api/mobile/pondok/ustadz", {"op": "rekomendasiIzin", "izinId": izinId, "rekomendasi": mode, "catatan": catatan});
      _snack("Rekomendasi tercatat");
      izin = await _getTab("izin");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Scaffold(
        appBar: AppBar(title: const Text("Ustadz / Ustadzah"), backgroundColor: Colors.white, elevation: 0),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text("Ustadz / Ustadzah"), backgroundColor: Colors.white, elevation: 0),
        body: Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.school_outlined, size: 44, color: Color(0xFF94A3B8)),
          const SizedBox(height: 8),
          const Text("Halaman ini khusus Ustadz/Ustadzah dengan penugasan aktif.", textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text("$error", textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: () { setState(() => loading = true); _muatAwal(); }, child: const Text("Coba Lagi")),
        ]))),
      );
    }

    return DefaultTabController(
      length: 5,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text("Ustadz / Ustadzah"),
          backgroundColor: Colors.white,
          elevation: 0,
          actions: [
            if (busy) const Padding(padding: EdgeInsets.all(14), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))),
            IconButton(onPressed: busy ? null : _muatAwal, icon: const Icon(Icons.refresh, size: 20)),
          ],
          bottom: TabBar(
            isScrollable: true,
            labelColor: const Color(0xFF4F46E5),
            unselectedLabelColor: const Color(0xFF64748B),
            onTap: _muatTab,
            tabs: const [Tab(text: "Jadwal"), Tab(text: "Absensi Diniyah"), Tab(text: "Tahfidz"), Tab(text: "Perizinan"), Tab(text: "Laporan")],
          ),
        ),
        body: TabBarView(children: [_tabJadwal(), _tabAbsensi(), _tabTahfidz(), _tabIzin(), _tabLaporan()]),
      ),
    );
  }

  Widget _tabJadwal() {
    final kelas = (jadwal["kelas"] as List?) ?? [];
    final halaqah = (jadwal["halaqah"] as List?) ?? [];
    final kegiatan = (jadwal["kegiatanHariIni"] as List?) ?? [];
    final stats = [
      ["Kelas Diniyah", "${(dash["kelasSaya"] as List?)?.length ?? 0}"],
      ["Halaqah", "${(dash["halaqahSaya"] as List?)?.length ?? 0}"],
      ["Santri Binaan", "${dash["santriBinaan"] ?? 0}"],
      ["Absensi Belum", "${dash["absensiBelumDiniyah"] ?? 0}"],
      ["Setoran Terbaru", "${(dash["setoranTerbaru"] as List?)?.length ?? 0}"],
      ["Izin Terkait", "${(dash["izinTerkait"] as List?)?.length ?? 0}"],
    ];
    return RefreshIndicator(
      onRefresh: _muatAwal,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 3,
            childAspectRatio: 1.5,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            children: stats.map((s) => _stat(s[0], s[1])).toList(),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Expanded(child: Text("Kelas Diniyah", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                  TextButton.icon(onPressed: busy ? null : _buatKelas, icon: const Icon(Icons.add, size: 15), label: const Text("Kelas Baru", style: TextStyle(fontSize: 11))),
                ]),
                if (kelas.isEmpty) const Text("Belum ada kelas diampu.", style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ...kelas.cast<Map>().map((k) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.menu_book_outlined, size: 18, color: Color(0xFF0EA5E9)),
                  title: Text("${k["nama"]}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  subtitle: Text("${k["hari"] ?? "-"} ${k["jam"] ?? ""}", style: const TextStyle(fontSize: 10)),
                )),
              ]),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Expanded(child: Text("Halaqah Tahfidz", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                  TextButton.icon(onPressed: busy ? null : _buatHalaqah, icon: const Icon(Icons.add, size: 15), label: const Text("Halaqah Baru", style: TextStyle(fontSize: 11))),
                ]),
                if (halaqah.isEmpty) const Text("Belum ada halaqah dibina.", style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ...halaqah.cast<Map>().map((h) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.auto_stories_outlined, size: 18, color: Color(0xFF10B981)),
                  title: Text("${h["nama"]}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  subtitle: Text("${h["jumlahSantri"] ?? 0} santri • target ${h["targetSurah"] ?? "-"}", style: const TextStyle(fontSize: 10)),
                )),
              ]),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text("Kegiatan Ditugaskan Hari Ini", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 4),
                if (kegiatan.isEmpty) const Text("Tidak ada kegiatan ditugaskan hari ini.", style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ...kegiatan.cast<Map>().map((k) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event_outlined, size: 18, color: Color(0xFFF59E0B)),
                  title: Text("${k["nama"]}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  subtitle: Text("${k["jamMulai"] ?? "-"} • ${k["lokasi"] ?? "-"}", style: const TextStyle(fontSize: 10)),
                )),
              ]),
            ),
          ),
          if (((dash["izinTerkait"] as List?) ?? []).isNotEmpty) ...[
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text("Izin Santri Binaan", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  const SizedBox(height: 6),
                  Wrap(spacing: 6, runSpacing: 6, children: ((dash["izinTerkait"] as List?) ?? []).map((i) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8)),
                    child: Text("${(i as Map)["nama"]} — ${i["jenis"]} (${i["status"]})", style: const TextStyle(fontSize: 10, color: Color(0xFF92400E))),
                  )).toList()),
                ]),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _tabAbsensi() {
    final kelas = (diniyahOpts["kelas"] as List?) ?? [];
    final rows = (diniyah["rows"] as List?) ?? [];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Text("Ambil Absensi Diniyah", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: selectedKelas,
                decoration: const InputDecoration(labelText: "Kelas", border: OutlineInputBorder(), isDense: true),
                items: kelas.map((k) => DropdownMenuItem(value: "${(k as Map)["id"]}", child: Text("${k["nama"]}", style: const TextStyle(fontSize: 12)))).toList(),
                onChanged: busy ? null : (v) { if (v != null) _ambilDiniyah(v); },
              ),
              if (selectedKelas != null && rows.isNotEmpty) ...[
                const SizedBox(height: 10),
                ...rows.map((r) {
                  final m = r as Map;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(children: [
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text("${m["nama"]}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        Text("${m["nisNo"] ?? "-"} • ${m["keberadaan"] ?? "-"}", style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
                      ])),
                      SizedBox(
                        width: 130,
                        child: DropdownButtonFormField<String>(
                          initialValue: "${m["status"] ?? "HADIR"}",
                          decoration: const InputDecoration(isDense: true, border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8)),
                          items: _statusAbsensi.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 10)))).toList(),
                          onChanged: (v) => setState(() => m["status"] = v),
                        ),
                      ),
                    ]),
                  );
                }),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: busy ? null : _simpanAbsensi,
                  icon: const Icon(Icons.save_outlined, size: 15),
                  label: const Text("Simpan Absensi", style: TextStyle(fontSize: 12)),
                ),
              ],
              if (selectedKelas != null && rows.isEmpty && !busy)
                const Padding(padding: EdgeInsets.only(top: 8), child: Text("Belum ada santri di kelas ini.", style: TextStyle(fontSize: 11, color: Color(0xFF64748B)))),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _tabTahfidz() {
    final halaqah = (halaqahOpts["halaqah"] as List?) ?? [];
    final rows = (capaian["rows"] as List?) ?? [];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Text("Setoran / Murajaah", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: selectedHalaqah,
                decoration: const InputDecoration(labelText: "Halaqah", border: OutlineInputBorder(), isDense: true),
                items: halaqah.map((h) => DropdownMenuItem(value: "${(h as Map)["id"]}", child: Text("${h["nama"]}", style: const TextStyle(fontSize: 12)))).toList(),
                onChanged: busy ? null : (v) { if (v != null) _ambilCapaian(v); },
              ),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        if (selectedHalaqah != null && rows.isEmpty && !busy)
          const Center(child: Padding(padding: EdgeInsets.all(24), child: Text("Belum ada santri di halaqah ini.", style: TextStyle(color: Color(0xFF64748B))))),
        ...rows.cast<Map>().map((c) {
          final terakhir = c["terakhir"] as Map?;
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text("${c["nama"]} (${c["nisNo"] ?? "-"})", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
                  Text("${c["jumlahSetoran"] ?? 0} setoran", style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                ]),
                if (terakhir != null) Text("Terakhir: ${terakhir["surah"]} ${terakhir["ayat"]} (${terakhir["status"]})", style: const TextStyle(fontSize: 10, color: Color(0xFF475569))),
                Text("Tajwid ${c["rataTajwid"] ?? "-"} • Kelancaran ${c["rataKelancaran"] ?? "-"}", style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                OutlinedButton(
                  onPressed: busy ? null : () => _catatSetoran(selectedHalaqah!, c),
                  child: const Text("Catat Setoran", style: TextStyle(fontSize: 11)),
                ),
              ]),
            ),
          );
        }),
      ],
    );
  }

  Widget _tabIzin() {
    final rows = (izin["rows"] as List?) ?? [];
    final statusLabel = (izin["statusLabel"] as Map?) ?? {};
    final jenisLabel = (izin["jenisLabel"] as Map?) ?? {};
    return RefreshIndicator(
      onRefresh: () async { izin = await _getTab("izin"); if (mounted) setState(() {}); },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text("Izin Santri Binaan (rekomendasi, bukan persetujuan final)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          if (rows.isEmpty && !busy) const Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada data izin santri binaan.", style: TextStyle(color: Color(0xFF64748B))))),
          ...rows.cast<Map>().map((r) {
            final status = "${r["status"]}";
            return Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text("${r["santri"]?["nama"] ?? "-"} (${r["santri"]?["nisNo"] ?? "-"})", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
                    _badge("${statusLabel[status] ?? status}", const Color(0xFFF59E0B)),
                  ]),
                  Text("${jenisLabel["${r["jenis"]}"] ?? r["jenis"]}", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF4F46E5))),
                  Text("${r["alasan"] ?? ""}", style: const TextStyle(fontSize: 11, color: Color(0xFF475569))),
                  Text("Keluar: ${_fmt(r["rencanaKeluar"])} → ${_fmt(r["rencanaKembali"])}", style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                  const SizedBox(height: 6),
                  Wrap(spacing: 8, children: [
                    OutlinedButton(onPressed: busy ? null : () => _rekomendasiIzin("${r["id"]}", "SETUJUI"), child: const Text("Setujui", style: TextStyle(fontSize: 11))),
                    TextButton(onPressed: busy ? null : () => _rekomendasiIzin("${r["id"]}", "TIDAK_SETUJUI"), child: const Text("Tidak Setujui", style: TextStyle(fontSize: 11, color: Color(0xFFEF4444)))),
                  ]),
                ]),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _tabLaporan() {
    final kehadiran = (laporan["kehadiranDiniyah"] as List?) ?? [];
    final setoran = (laporan["setoran"] as List?) ?? [];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text("Kehadiran Diniyah (bulan ini)", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 6),
              if (kehadiran.isEmpty) const Text("Belum ada data.", style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              ...kehadiran.cast<Map>().map((k) => _baris("${k["status"]}", "${k["jumlah"] ?? 0}")),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text("Setoran Tahfidz (bulan ini)", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 6),
              if (setoran.isEmpty) const Text("Belum ada data.", style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              ...setoran.cast<Map>().map((s) => _baris("${s["status"]}", "${s["jumlah"] ?? 0}")),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text("Penilaian", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 4),
              _baris("Rata Tajwid", "${laporan["rataTajwid"] ?? "-"}"),
              _baris("Rata Kelancaran", "${laporan["rataKelancaran"] ?? "-"}"),
              _baris("Jumlah Dinilai", "${laporan["jumlahDinilai"] ?? 0}"),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _stat(String label, String value) => Container(
    padding: const EdgeInsets.all(8),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF4F46E5))),
      Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, color: Color(0xFF64748B))),
    ]),
  );

  Widget _baris(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(children: [
      Expanded(child: Text(label, style: const TextStyle(fontSize: 12))),
      Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
    ]),
  );

  Widget _badge(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
    child: Text(text, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color)),
  );

  static String _fmt(dynamic v) {
    final d = DateTime.tryParse("$v");
    return d == null ? "-" : _tgl.format(d.toLocal());
  }
}

class _DialogKelas extends StatefulWidget {
  const _DialogKelas();
  @override
  State<_DialogKelas> createState() => _DialogKelasState();
}

class _DialogKelasState extends State<_DialogKelas> {
  final nama = TextEditingController();
  final tingkat = TextEditingController();
  final hari = TextEditingController();
  final jam = TextEditingController();
  @override
  void dispose() { nama.dispose(); tingkat.dispose(); hari.dispose(); jam.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text("Kelas Diniyah Baru"),
    content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      TextField(controller: nama, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: "Nama kelas", border: OutlineInputBorder())),
      const SizedBox(height: 8),
      TextField(controller: tingkat, decoration: const InputDecoration(labelText: "Tingkat (opsional)", border: OutlineInputBorder())),
      const SizedBox(height: 8),
      TextField(controller: hari, decoration: const InputDecoration(labelText: "Hari (opsional)", border: OutlineInputBorder())),
      const SizedBox(height: 8),
      TextField(controller: jam, decoration: const InputDecoration(labelText: "Jam (opsional)", border: OutlineInputBorder())),
    ])),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text("Batal")),
      FilledButton(
        onPressed: nama.text.trim().length < 3
            ? null
            : () => Navigator.pop(context, {"nama": nama.text.trim(), "tingkat": tingkat.text.trim(), "hari": hari.text.trim(), "jam": jam.text.trim()}),
        child: const Text("Simpan"),
      ),
    ],
  );
}

class _DialogHalaqah extends StatefulWidget {
  const _DialogHalaqah();
  @override
  State<_DialogHalaqah> createState() => _DialogHalaqahState();
}

class _DialogHalaqahState extends State<_DialogHalaqah> {
  final nama = TextEditingController();
  final target = TextEditingController();
  @override
  void dispose() { nama.dispose(); target.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text("Halaqah Baru"),
    content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      TextField(controller: nama, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: "Nama halaqah", border: OutlineInputBorder())),
      const SizedBox(height: 8),
      TextField(controller: target, decoration: const InputDecoration(labelText: "Target surah (opsional)", border: OutlineInputBorder())),
    ])),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text("Batal")),
      FilledButton(
        onPressed: nama.text.trim().length < 2
            ? null
            : () => Navigator.pop(context, {"nama": nama.text.trim(), "targetSurah": target.text.trim()}),
        child: const Text("Simpan"),
      ),
    ],
  );
}

class _DialogSetoran extends StatefulWidget {
  final String halaqahId;
  final Map santri;
  const _DialogSetoran({required this.halaqahId, required this.santri});
  @override
  State<_DialogSetoran> createState() => _DialogSetoranState();
}

class _DialogSetoranState extends State<_DialogSetoran> {
  final surah = TextEditingController();
  final ayatMulai = TextEditingController();
  final ayatAkhir = TextEditingController();
  final tajwid = TextEditingController();
  final kelancaran = TextEditingController();
  final catatan = TextEditingController();
  String tipe = "SETORAN";
  String status = "DITERIMA";

  @override
  void dispose() {
    surah.dispose(); ayatMulai.dispose(); ayatAkhir.dispose(); tajwid.dispose(); kelancaran.dispose(); catatan.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text("Catat Setoran — ${widget.santri["nama"] ?? ""}"),
    content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      TextField(controller: surah, decoration: const InputDecoration(labelText: "Surah", border: OutlineInputBorder())),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: TextField(controller: ayatMulai, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Ayat mulai", border: OutlineInputBorder()))),
        const SizedBox(width: 8),
        Expanded(child: TextField(controller: ayatAkhir, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Ayat akhir", border: OutlineInputBorder()))),
      ]),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: DropdownButtonFormField<String>(
          initialValue: tipe,
          decoration: const InputDecoration(labelText: "Tipe", border: OutlineInputBorder(), isDense: true),
          items: const [DropdownMenuItem(value: "SETORAN", child: Text("Setoran")), DropdownMenuItem(value: "MURAJAAH", child: Text("Murajaah"))],
          onChanged: (v) => setState(() => tipe = v ?? "SETORAN"),
        )),
        const SizedBox(width: 8),
        Expanded(child: DropdownButtonFormField<String>(
          initialValue: status,
          decoration: const InputDecoration(labelText: "Status", border: OutlineInputBorder(), isDense: true),
          items: const [DropdownMenuItem(value: "DITERIMA", child: Text("Diterima")), DropdownMenuItem(value: "ULANG", child: Text("Ulang")), DropdownMenuItem(value: "BERKELANJUTAN", child: Text("Berlanjut"))],
          onChanged: (v) => setState(() => status = v ?? "DITERIMA"),
        )),
      ]),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: TextField(controller: tajwid, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Tajwid 0–100", border: OutlineInputBorder()))),
        const SizedBox(width: 8),
        Expanded(child: TextField(controller: kelancaran, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Kelancaran 0–100", border: OutlineInputBorder()))),
      ]),
      const SizedBox(height: 8),
      TextField(controller: catatan, maxLines: 2, decoration: const InputDecoration(labelText: "Catatan", border: OutlineInputBorder())),
    ])),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text("Batal")),
      FilledButton(
        onPressed: () {
          final a = int.tryParse(ayatMulai.text);
          final b = int.tryParse(ayatAkhir.text);
          if (surah.text.trim().isEmpty || a == null || b == null || b < a) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Surah & range ayat wajib valid"), backgroundColor: Color(0xFFEF4444)));
            return;
          }
          Navigator.pop(context, {
            "halaqahId": widget.halaqahId,
            "santriId": widget.santri["santriId"],
            "surah": surah.text.trim(),
            "ayatMulai": a,
            "ayatAkhir": b,
            "tipe": tipe,
            "status": status,
            if (tajwid.text.trim().isNotEmpty) "tajwid": int.tryParse(tajwid.text.trim()),
            if (kelancaran.text.trim().isNotEmpty) "kelancaran": int.tryParse(kelancaran.text.trim()),
            if (catatan.text.trim().isNotEmpty) "catatan": catatan.text.trim(),
          });
        },
        child: const Text("Simpan Setoran"),
      ),
    ],
  );
}
