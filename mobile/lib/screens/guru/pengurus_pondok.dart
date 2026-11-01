import "package:flutter/material.dart";
import "package:intl/intl.dart";
import "../../services/api_service.dart";

/// Dashboard Pengurus Pondok — mirror web /pengurus.
/// Perizinan, data santri, kegiatan & absensi, asrama, pembinaan,
/// pengumuman, dan laporan bulanan.
class GuruPengurusPondok extends StatefulWidget {
  const GuruPengurusPondok({super.key});
  @override
  State<GuruPengurusPondok> createState() => _GuruPengurusPondokState();
}

class _GuruPengurusPondokState extends State<GuruPengurusPondok> {
  bool loading = true;
  bool busy = false;
  String? error;
  Map<String, dynamic> dash = {};
  Map<String, dynamic> antrean = {};
  Map<String, dynamic> pulang = {};
  Map<String, dynamic> santri = {};
  Map<String, dynamic> kegiatan = {};
  Map<String, dynamic> asrama = {};
  Map<String, dynamic> pembinaan = {};
  Map<String, dynamic> pengumuman = {};
  Map<String, dynamic> laporan = {};

  static final _tgl = DateFormat("dd MMM yyyy", "id_ID");
  static final _tglJam = DateFormat("dd MMM yyyy HH:mm", "id_ID");
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
    final d = await ApiService.get("/api/mobile/pondok/pengurus?tab=$tab$extra", useCache: false);
    return d is Map ? Map<String, dynamic>.from(d) : {};
  }

  Future<void> _muatAwal() async {
    try {
      final hasil = await Future.wait([_getTab("dashboard"), _getTab("izin"), _getTab("izin", "&mode=pulang")]);
      final izinRows = (hasil[1]["rows"] as List?) ?? [];
      if (mounted) {
        setState(() {
          dash = hasil[0];
          antrean = {...hasil[1], "rows": izinRows};
          pulang = hasil[2];
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
      if (i == 0) {
        final hasil = await Future.wait([_getTab("izin"), _getTab("izin", "&mode=pulang")]);
        antrean = hasil[0];
        pulang = hasil[1];
      }
      if (i == 1) santri = await _getTab("santri");
      if (i == 2) kegiatan = await _getTab("kegiatan");
      if (i == 3) asrama = await _getTab("asrama");
      if (i == 4) {
        final hasil = await Future.wait([_getTab("pembinaan"), _getTab("santri")]);
        pembinaan = hasil[0];
        santri = hasil[1];
      }
      if (i == 5) pengumuman = await _getTab("pengumuman");
      if (i == 6) laporan = await _getTab("laporan");
    } catch (e) {
      _snack("Gagal memuat: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _validasiIzin(String id, String mode) async {
    final ctrl = TextEditingController();
    final teks = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(mode == "setuju" ? "Validasi Kelengkapan Izin" : "Tolak Izin"),
        content: TextField(controller: ctrl, maxLines: 3, decoration: InputDecoration(labelText: mode == "setuju" ? "Catatan validasi (opsional)" : "Alasan penolakan (min. 5 karakter)", border: const OutlineInputBorder())),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Batal")),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: mode == "tolak" ? const Color(0xFFEF4444) : const Color(0xFF4F46E5)),
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            child: const Text("Konfirmasi"),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (teks == null) return;
    if (mode == "tolak" && teks.length < 5) { _snack("Alasan minimal 5 karakter", color: const Color(0xFFEF4444)); return; }
    setState(() => busy = true);
    try {
      await ApiService.post("/api/mobile/pondok/pengurus", {
        "op": mode == "setuju" ? "setujuiIzin" : "tolakIzin",
        "izinId": id,
        if (mode == "setuju") "catatan": teks.isEmpty ? null : teks,
        if (mode == "tolak") "alasan": teks,
      });
      _snack(mode == "setuju" ? "Validasi lolos — lanjut ke tahap berikutnya" : "Izin ditolak");
      await _muatTab(0);
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _buatKegiatan() async {
    final hasil = await showDialog<Map<String, dynamic>>(context: context, builder: (_) => const _DialogKegiatan());
    if (hasil == null) return;
    setState(() => busy = true);
    try {
      await ApiService.post("/api/mobile/pondok/pengurus", {"op": "createKegiatan", ...hasil});
      _snack("Kegiatan dibuat");
      kegiatan = await _getTab("kegiatan");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _hapusKegiatan(String id) async {
    setState(() => busy = true);
    try {
      await ApiService.post("/api/mobile/pondok/pengurus", {"op": "deleteKegiatan", "id": id});
      _snack("Kegiatan dihapus");
      kegiatan = await _getTab("kegiatan");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _absensiKegiatan(Map k) async {
    setState(() => busy = true);
    try {
      final tanggal = "${k["tanggal"]}".substring(0, 10);
      final detail = await _getTab("kegiatan", "&kegiatanId=${k["id"]}&tanggal=$tanggal");
      final rows = (detail["absensiRows"] as List?) ?? [];
      for (final r in rows) {
        (r as Map)["status"] = r["status"] ?? "HADIR";
      }
      if (!mounted) return;
      final simpan = await showDialog<bool>(
        context: context,
        builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
          title: Text("Absensi — ${k["nama"]}"),
          content: SizedBox(
            width: double.maxFinite,
            height: 420,
            child: rows.isEmpty
                ? const Center(child: Text("Belum ada santri dalam cakupan Anda."))
                : ListView(children: rows.map((r) {
                    final m = r as Map;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(children: [
                        Expanded(child: Text("${m["nama"]} (${m["nisNo"] ?? "-"})", style: const TextStyle(fontSize: 12))),
                        SizedBox(width: 128, child: DropdownButtonFormField<String>(
                          initialValue: "${m["status"] ?? "HADIR"}",
                          decoration: const InputDecoration(isDense: true, border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8)),
                          items: _statusAbsensi.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 9)))).toList(),
                          onChanged: (v) => setDlg(() => m["status"] = v),
                        )),
                      ]),
                    );
                  }).toList()),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
            FilledButton(
              onPressed: rows.isEmpty ? null : () => Navigator.pop(ctx, true),
              child: const Text("Simpan Absensi"),
            ),
          ],
        )),
      );
      if (simpan == true) {
        await ApiService.post("/api/mobile/pondok/pengurus", {
          "op": "simpanAbsensiKegiatan",
          "kegiatanId": k["id"],
          "tanggal": detail["tanggal"],
          "rows": rows.map((r) => {"santriId": (r as Map)["santriId"], "status": r["status"]}).toList(),
        });
        _snack("Absensi kegiatan tersimpan");
        kegiatan = await _getTab("kegiatan");
      }
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _catatPembinaan() async {
    final opsiSantri = (santri["rows"] as List?) ?? [];
    if (opsiSantri.isEmpty) { _snack("Muat Data Santri terlebih dahulu", color: const Color(0xFFEF4444)); return; }
    final hasil = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _DialogPembinaan(santri: opsiSantri),
    );
    if (hasil == null) return;
    setState(() => busy = true);
    try {
      await ApiService.post("/api/mobile/pondok/pengurus", {"op": "createPembinaan", ...hasil});
      _snack("Pembinaan dicatat");
      pembinaan = await _getTab("pembinaan");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _buatPengumuman() async {
    final hasil = await showDialog<Map<String, dynamic>>(context: context, builder: (_) => const _DialogPengumuman());
    if (hasil == null) return;
    setState(() => busy = true);
    try {
      final row = await ApiService.post("/api/mobile/pondok/pengurus", {"op": "createDraftPengumuman", ...hasil});
      if (row is Map && row["id"] != null) {
        await ApiService.post("/api/mobile/pondok/pengurus", {"op": "kirimPengumuman", "id": row["id"]});
      }
      _snack("Pengumuman dikirim untuk disetujui");
      pengumuman = await _getTab("pengumuman");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Scaffold(appBar: AppBar(title: const Text("Pengurus Pondok"), backgroundColor: Colors.white, elevation: 0), body: const Center(child: CircularProgressIndicator()));
    }
    if (error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text("Pengurus Pondok"), backgroundColor: Colors.white, elevation: 0),
        body: Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.groups_outlined, size: 44, color: Color(0xFF94A3B8)),
          const SizedBox(height: 8),
          const Text("Halaman ini khusus Pengurus Pondok dengan penugasan aktif.", textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text("$error", textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: () { setState(() => loading = true); _muatAwal(); }, child: const Text("Coba Lagi")),
        ]))),
      );
    }

    return DefaultTabController(
      length: 7,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text("Pengurus Pondok"),
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
            tabs: const [
              Tab(text: "Perizinan"), Tab(text: "Santri"), Tab(text: "Kegiatan"),
              Tab(text: "Asrama"), Tab(text: "Pembinaan"), Tab(text: "Pengumuman"), Tab(text: "Laporan"),
            ],
          ),
        ),
        body: TabBarView(children: [_tabIzin(), _tabSantri(), _tabKegiatan(), _tabAsrama(), _tabPembinaan(), _tabPengumuman(), _tabLaporan()]),
      ),
    );
  }

  Widget _tabIzin() {
    final rows = (antrean["rows"] as List?) ?? [];
    final pulangRows = (pulang["rows"] as List?) ?? [];
    final jenisLabel = (antrean["jenisLabel"] as Map?) ?? {};
    return RefreshIndicator(
      onRefresh: () => _muatTab(0),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Wrap(spacing: 8, runSpacing: 8, children: _statistik()),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text("Antrean Validasi Izin (${rows.length})", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 6),
                if (rows.isEmpty) const Text("Tidak ada pengajuan izin menunggu validasi.", style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ...rows.cast<Map>().map((r) => Card(
                  elevation: 0,
                  color: const Color(0xFFF8FAFC),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text("${r["santri"]?["nama"] ?? "-"}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
                        _badge("${r["jenisLabel"] ?? jenisLabel["${r["jenis"]}"] ?? r["jenis"]}", const Color(0xFF4F46E5)),
                      ]),
                      Text("${r["santri"]?["asrama"]?["nama"] ?? "-"} • ${r["santri"]?["nisNo"] ?? "-"}", style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                      Text("${r["alasan"] ?? ""}", style: const TextStyle(fontSize: 11, color: Color(0xFF475569))),
                      Text("${_fmtJam(r["rencanaKeluar"])} → ${_fmtJam(r["rencanaKembali"])}", style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                      const SizedBox(height: 6),
                      Wrap(spacing: 8, children: [
                        FilledButton(onPressed: busy ? null : () => _validasiIzin("${r["id"]}", "setuju"), child: const Text("Validasi Lolos", style: TextStyle(fontSize: 11))),
                        TextButton(onPressed: busy ? null : () => _validasiIzin("${r["id"]}", "tolak"), child: const Text("Tolak", style: TextStyle(fontSize: 11, color: Color(0xFFEF4444)))),
                      ]),
                    ]),
                  ),
                )),
              ]),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text("Santri Sedang Pulang (${pulangRows.length})", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 6),
                if (pulangRows.isEmpty) const Text("Tidak ada santri sedang pulang.", style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ...pulangRows.cast<Map>().map((r) {
                  final telat = DateTime.tryParse("${r["rencanaKembali"]}")?.isBefore(DateTime.now()) == true;
                  return ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text("${r["santri"]?["nama"] ?? "-"}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    subtitle: Text("Keluar: ${_fmtJam(r["checkoutAt"])}\nBatas kembali: ${_fmtJam(r["rencanaKembali"])}", style: const TextStyle(fontSize: 10)),
                    isThreeLine: true,
                    trailing: telat ? _badge("TERLAMBAT", const Color(0xFFEF4444)) : null,
                  );
                }),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tabSantri() {
    final rows = (santri["rows"] as List?) ?? [];
    return RefreshIndicator(
      onRefresh: () => _muatTab(1),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text("Data Santri (${rows.length})", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 6),
          if (rows.isEmpty && !busy) const Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Tidak ada santri dalam cakupan penugasan Anda.", style: TextStyle(color: Color(0xFF64748B))))),
          ...rows.cast<Map>().map((s) => Card(
            child: ListTile(
              dense: true,
              title: Text("${s["nama"]} (${s["nisNo"] ?? "-"})", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              subtitle: Text("${s["asrama"]?["nama"] ?? "-"} / ${s["kamar"]?["nama"] ?? "-"}\n${s["keberadaan"] ?? "-"} • ${s["halaqah"]?["nama"] ?? "-"} • ${s["kelasDiniyah"]?["nama"] ?? "-"}", style: const TextStyle(fontSize: 10)),
              isThreeLine: true,
              trailing: OutlinedButton(
                onPressed: busy ? null : () {
                  setState(() => pembinaan = {"rows": []});
                  showDialog<Map<String, dynamic>>(context: context, builder: (_) => _DialogPembinaan(santri: [s])).then((hasil) async {
                    if (hasil == null) return;
                    setState(() => busy = true);
                    try {
                      await ApiService.post("/api/mobile/pondok/pengurus", {"op": "createPembinaan", ...hasil});
                      _snack("Pembinaan dicatat");
                    } catch (e) {
                      _snack("Gagal: $e", color: const Color(0xFFEF4444));
                    } finally {
                      if (mounted) setState(() => busy = false);
                    }
                  });
                },
                child: const Text("Catat", style: TextStyle(fontSize: 10)),
              ),
            ),
          )),
        ],
      ),
    );
  }

  Widget _tabKegiatan() {
    final rows = (kegiatan["rows"] as List?) ?? [];
    return RefreshIndicator(
      onRefresh: () => _muatTab(2),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                const Expanded(child: Text("Kegiatan Pondok", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                FilledButton.icon(onPressed: busy ? null : _buatKegiatan, icon: const Icon(Icons.add, size: 15), label: const Text("Buat Kegiatan", style: TextStyle(fontSize: 11))),
              ]),
            ),
          ),
          const SizedBox(height: 8),
          if (rows.isEmpty && !busy) const Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada kegiatan.", style: TextStyle(color: Color(0xFF64748B))))),
          ...rows.cast<Map>().map((k) => Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text("${k["nama"]}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
                  if (k["wajib"] == true) _badge("WAJIB", const Color(0xFFEF4444)) else _badge("OPSIONAL", const Color(0xFF94A3B8)),
                ]),
                Text("${_fmtTanggal(k["tanggal"])} • ${k["jamMulai"] ?? "-"}–${k["jamSelesai"] ?? "-"} • ${k["lokasi"] ?? "-"}", style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                Text("Absensi tercatat: ${k["jumlahAbsensi"] ?? 0}", style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                const SizedBox(height: 6),
                Wrap(spacing: 8, children: [
                  OutlinedButton(onPressed: busy ? null : () => _absensiKegiatan(k), child: const Text("Absensi", style: TextStyle(fontSize: 11))),
                  TextButton(onPressed: busy ? null : () => _hapusKegiatan("${k["id"]}"), child: const Text("Hapus", style: TextStyle(fontSize: 11, color: Color(0xFFEF4444)))),
                ]),
              ]),
            ),
          )),
        ],
      ),
    );
  }

  Widget _tabAsrama() {
    final rows = (asrama["rows"] as List?) ?? [];
    return RefreshIndicator(
      onRefresh: () => _muatTab(3),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (rows.isEmpty && !busy) const Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada asrama dalam cakupan Anda.", style: TextStyle(color: Color(0xFF64748B))))),
          ...rows.cast<Map>().map((a) => Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text("${a["nama"]}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
                  Text("${a["totalPenghuni"] ?? 0} penghuni", style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                ]),
                Text("Musyrif: ${a["musyrif"] ?? "-"}", style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                const SizedBox(height: 6),
                Wrap(spacing: 6, runSpacing: 6, children: ((a["kamars"] as List?) ?? []).map((k) {
                  final m = k as Map;
                  final penuh = m["kapasitas"] != null && (m["terisi"] as num? ?? 0) >= (m["kapasitas"] as num);
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                    decoration: BoxDecoration(color: penuh ? const Color(0xFFFEE2E2) : const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(8)),
                    child: Text("${m["nama"]}: ${m["terisi"] ?? 0}/${m["kapasitas"] ?? "?"}${penuh ? " PENUH" : ""}", style: TextStyle(fontSize: 10, color: penuh ? const Color(0xFFB91C1C) : const Color(0xFF334155))),
                  );
                }).toList()),
              ]),
            ),
          )),
        ],
      ),
    );
  }

  Widget _tabPembinaan() {
    final rows = (pembinaan["rows"] as List?) ?? [];
    return RefreshIndicator(
      onRefresh: () => _muatTab(4),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          FilledButton.icon(onPressed: busy ? null : _catatPembinaan, icon: const Icon(Icons.add, size: 16), label: const Text("Catat Pembinaan / Prestasi")),
          const SizedBox(height: 8),
          if (rows.isEmpty && !busy) const Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada catatan pembinaan.", style: TextStyle(color: Color(0xFF64748B))))),
          ...rows.cast<Map>().map((p) => Card(
            child: ListTile(
              dense: true,
              leading: Icon(p["tipe"] == "PRESTASI" ? Icons.emoji_events_outlined : Icons.note_alt_outlined, size: 18, color: p["tipe"] == "PRESTASI" ? const Color(0xFFF59E0B) : const Color(0xFF4F46E5)),
              title: Text("${p["judul"] ?? "-"}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              subtitle: Text("${p["santri"]?["nama"] ?? "-"} • ${p["tipe"] ?? "-"}\n${p["deskripsi"] ?? "-"}", style: const TextStyle(fontSize: 10)),
              isThreeLine: true,
              trailing: Text("${_fmtTanggal(p["tanggal"])}", style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
            ),
          )),
        ],
      ),
    );
  }

  Widget _tabPengumuman() {
    final rows = (pengumuman["rows"] as List?) ?? [];
    return RefreshIndicator(
      onRefresh: () => _muatTab(5),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          FilledButton.icon(onPressed: busy ? null : _buatPengumuman, icon: const Icon(Icons.campaign_outlined, size: 16), label: const Text("Buat Pengumuman")),
          const SizedBox(height: 8),
          if (rows.isEmpty && !busy) const Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada pengumuman.", style: TextStyle(color: Color(0xFF64748B))))),
          ...rows.cast<Map>().map((p) {
            final status = "${p["status"]}";
            final color = status == "TERBIT" ? const Color(0xFF10B981) : status == "MENUNGGU" ? const Color(0xFFF59E0B) : const Color(0xFF94A3B8);
            return Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text("${p["judul"]}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
                    _badge(status, color),
                  ]),
                  Text("${p["isi"]}", maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: Color(0xFF475569))),
                  Text("${p["pembuat"] ?? "-"} • ${_fmtTanggal(p["createdAt"])}", style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
                ]),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _tabLaporan() {
    final kehadiran = (laporan["kehadiran"] as List?) ?? [];
    final izinRows = (laporan["izin"] as List?) ?? [];
    final pembinaanRows = (laporan["pembinaan"] as List?) ?? [];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _kartuLaporan("Kehadiran Kegiatan (bulan ini)", kehadiran),
        const SizedBox(height: 8),
        _kartuLaporan("Izin (bulan ini)", izinRows),
        const SizedBox(height: 8),
        _kartuLaporan("Pembinaan (bulan ini)", pembinaanRows),
      ],
    );
  }

  Widget _kartuLaporan(String judul, List rows) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(judul, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        const SizedBox(height: 6),
        if (rows.isEmpty) const Text("Belum ada data.", style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
        ...rows.cast<Map>().map((r) {
          final label = "${r["status"] ?? r["tipe"] ?? "-"}";
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(children: [
              Expanded(child: Text(label, style: const TextStyle(fontSize: 12))),
              Text("${r["jumlah"] ?? 0}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            ]),
          );
        }),
      ]),
    ),
  );

  List<Widget> _statistik() {
    final items = <List<Object>>[
      ["Tanggung Jawab", "${dash["tanggungJawab"] ?? 0}"],
      ["Di Pondok", "${dash["diPondok"] ?? 0}"],
      ["Sedang Pulang", "${dash["sedangPulang"] ?? 0}"],
      ["Terlambat", "${dash["terlambat"] ?? 0}"],
      ["Izin Menunggu", "${dash["izinMenunggu"] ?? 0}"],
      ["Izin Aktif", "${dash["izinAktif"] ?? 0}"],
      ["Kegiatan Hari Ini", "${dash["kegiatanHariIni"] ?? 0}"],
      ["Absensi Belum", "${dash["absensiBelumLengkap"] ?? 0}"],
    ];
    return items.map((i) => Container(
      width: 105,
      padding: const EdgeInsets.all(9),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(children: [
        Text("${i[1]}", style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF4F46E5))),
        Text("${i[0]}", textAlign: TextAlign.center, style: const TextStyle(fontSize: 8, color: Color(0xFF64748B))),
      ]),
    )).toList();
  }

  Widget _badge(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
    child: Text(text, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color)),
  );

  static String _fmtJam(dynamic v) {
    final d = DateTime.tryParse("$v");
    return d == null ? "-" : _tglJam.format(d.toLocal());
  }

  static String _fmtTanggal(dynamic v) {
    final d = DateTime.tryParse("$v");
    return d == null ? "-" : _tgl.format(d.toLocal());
  }
}

class _DialogKegiatan extends StatefulWidget {
  const _DialogKegiatan();
  @override
  State<_DialogKegiatan> createState() => _DialogKegiatanState();
}

class _DialogKegiatanState extends State<_DialogKegiatan> {
  final nama = TextEditingController();
  final lokasi = TextEditingController();
  final jamMulai = TextEditingController();
  final jamSelesai = TextEditingController();
  DateTime tanggal = DateTime.now();
  bool wajib = false;

  @override
  void dispose() { nama.dispose(); lokasi.dispose(); jamMulai.dispose(); jamSelesai.dispose(); super.dispose(); }

  Future<void> _pilihTanggal() async {
    final d = await showDatePicker(context: context, initialDate: tanggal, firstDate: DateTime(DateTime.now().year - 1), lastDate: DateTime(DateTime.now().year + 2));
    if (d != null) setState(() => tanggal = d);
  }

  String get _ymd => "${tanggal.year}-${tanggal.month.toString().padLeft(2, "0")}-${tanggal.day.toString().padLeft(2, "0")}";

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text("Buat Kegiatan"),
    content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      TextField(controller: nama, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: "Nama kegiatan", border: OutlineInputBorder())),
      const SizedBox(height: 8),
      OutlinedButton.icon(onPressed: _pilihTanggal, icon: const Icon(Icons.calendar_today, size: 15), label: Text(DateFormat("dd MMM yyyy", "id_ID").format(tanggal))),
      const SizedBox(height: 8),
      TextField(controller: lokasi, decoration: const InputDecoration(labelText: "Lokasi (opsional)", border: OutlineInputBorder())),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: TextField(controller: jamMulai, decoration: const InputDecoration(labelText: "Jam mulai (HH:mm)", border: OutlineInputBorder()))),
        const SizedBox(width: 8),
        Expanded(child: TextField(controller: jamSelesai, decoration: const InputDecoration(labelText: "Jam selesai (HH:mm)", border: OutlineInputBorder()))),
      ]),
      SwitchListTile(
        contentPadding: EdgeInsets.zero,
        value: wajib,
        onChanged: (v) => setState(() => wajib = v),
        title: const Text("Kegiatan wajib", style: TextStyle(fontSize: 12)),
      ),
    ])),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text("Batal")),
      FilledButton(
        onPressed: nama.text.trim().length < 3 ? null : () => Navigator.pop(context, {
          "nama": nama.text.trim(),
          "tanggal": _ymd,
          "jamMulai": jamMulai.text.trim(),
          "jamSelesai": jamSelesai.text.trim(),
          "lokasi": lokasi.text.trim(),
          "wajib": wajib,
        }),
        child: const Text("Simpan"),
      ),
    ],
  );
}

class _DialogPembinaan extends StatefulWidget {
  final List santri;
  const _DialogPembinaan({required this.santri});
  @override
  State<_DialogPembinaan> createState() => _DialogPembinaanState();
}

class _DialogPembinaanState extends State<_DialogPembinaan> {
  String? santriId;
  String tipe = "CATATAN";
  final judul = TextEditingController();
  final deskripsi = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (widget.santri.isNotEmpty) santriId = "${(widget.santri.first as Map)["id"]}";
  }

  @override
  void dispose() { judul.dispose(); deskripsi.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text("Catat Pembinaan / Prestasi"),
    content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      DropdownButtonFormField<String>(
        initialValue: santriId,
        decoration: const InputDecoration(labelText: "Santri", border: OutlineInputBorder(), isDense: true),
        items: widget.santri.map((s) => DropdownMenuItem(value: "${(s as Map)["id"]}", child: Text("${s["nama"]}", style: const TextStyle(fontSize: 11)))).toList(),
        onChanged: (v) => setState(() => santriId = v),
      ),
      const SizedBox(height: 8),
      DropdownButtonFormField<String>(
        initialValue: tipe,
        decoration: const InputDecoration(labelText: "Jenis", border: OutlineInputBorder(), isDense: true),
        items: const [
          DropdownMenuItem(value: "CATATAN", child: Text("Catatan Perkembangan")),
          DropdownMenuItem(value: "PRESTASI", child: Text("Prestasi")),
          DropdownMenuItem(value: "PELANGGARAN", child: Text("Pelanggaran")),
          DropdownMenuItem(value: "TINDAK_LANJUT", child: Text("Tindak Lanjut")),
        ],
        onChanged: (v) => setState(() => tipe = v ?? "CATATAN"),
      ),
      const SizedBox(height: 8),
      TextField(controller: judul, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: "Judul", border: OutlineInputBorder())),
      const SizedBox(height: 8),
      TextField(controller: deskripsi, maxLines: 3, decoration: const InputDecoration(labelText: "Deskripsi", border: OutlineInputBorder())),
    ])),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text("Batal")),
      FilledButton(
        onPressed: santriId == null || judul.text.trim().length < 3 ? null : () => Navigator.pop(context, {
          "santriId": santriId,
          "tipe": tipe,
          "judul": judul.text.trim(),
          "deskripsi": deskripsi.text.trim(),
        }),
        child: const Text("Simpan"),
      ),
    ],
  );
}

class _DialogPengumuman extends StatefulWidget {
  const _DialogPengumuman();
  @override
  State<_DialogPengumuman> createState() => _DialogPengumumanState();
}

class _DialogPengumumanState extends State<_DialogPengumuman> {
  final judul = TextEditingController();
  final isi = TextEditingController();
  @override
  void dispose() { judul.dispose(); isi.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text("Buat Pengumuman"),
    content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      TextField(controller: judul, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: "Judul", border: OutlineInputBorder())),
      const SizedBox(height: 8),
      TextField(controller: isi, maxLines: 4, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: "Isi pengumuman", border: OutlineInputBorder())),
      const SizedBox(height: 6),
      const Text("Draft akan langsung dikirim untuk disetujui Kepala Pondok.", style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
    ])),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text("Batal")),
      FilledButton(
        onPressed: judul.text.trim().length < 3 || isi.text.trim().length < 5 ? null : () => Navigator.pop(context, {"judul": judul.text.trim(), "isi": isi.text.trim(), "tipe": "UMUM"}),
        child: const Text("Kirim untuk Disetujui"),
      ),
    ],
  );
}
