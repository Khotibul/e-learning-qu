import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Panel Sekretaris — piket & jadwal pelajaran (mirror web /siswa/sekretaris)
/// via /api/mobile/siswa/sekretaris (guard jabatan SEKRETARIS di backend).
class SiswaSekretaris extends StatefulWidget {
  const SiswaSekretaris({super.key});
  @override
  State<SiswaSekretaris> createState() => _SiswaSekretarisState();
}

class _SiswaSekretarisState extends State<SiswaSekretaris> {
  List<dynamic> piket = [];
  List<dynamic> jadwal = [];
  bool loading = true;

  static const _hari = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Future.wait([
        ApiService.get("/api/mobile/siswa/sekretaris?tab=piket", useCache: false),
        ApiService.get("/api/mobile/siswa/sekretaris?tab=jadwal", useCache: false),
      ]);
      if (mounted) {
        setState(() {
          piket = r[0] is List ? r[0] as List : [];
          jadwal = r[1] is List ? r[1] as List : [];
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

  Future<void> _op(Map<String, dynamic> body) async {
    await ApiService.post("/api/mobile/siswa/sekretaris", body);
    await _load();
  }

  Future<void> _hapus(String jenis, String id, String label) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Hapus?"),
        content: Text("\"$label\" akan dihapus."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Colors.red), onPressed: () => Navigator.pop(ctx, true), child: const Text("Hapus")),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiService.delete("/api/mobile/siswa/sekretaris?jenis=$jenis&id=$id");
      _snack("$label dihapus");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _tambahPiket() async {
    try {
      final siswas = await ApiService.get("/api/mobile/siswa/sekretaris?tab=siswa", useCache: false);
      if (siswas is! List || siswas.isEmpty || !mounted) return;
      String? siswaId;
      String hari = _hari.first;
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
          title: const Text("Tambah Piket"),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: "Siswa", border: OutlineInputBorder()),
              items: siswas.map((s) => DropdownMenuItem<String>(value: s["id"] as String, child: Text("${s["nama"]}", overflow: TextOverflow.ellipsis))).toList(),
              onChanged: (v) => setDlg(() => siswaId = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: hari,
              decoration: const InputDecoration(labelText: "Hari", border: OutlineInputBorder()),
              items: _hari.map((h) => DropdownMenuItem<String>(value: h, child: Text(h))).toList(),
              onChanged: (v) => setDlg(() => hari = v ?? hari),
            ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan")),
          ],
        )),
      );
      if (ok != true) return;
      if (siswaId == null) { _snack("Pilih siswa", color: const Color(0xFFEF4444)); return; }
      await _op({"op": "createPiket", "siswaId": siswaId, "hari": hari});
      _snack("Piket ditambahkan");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _formJadwal([Map? existing]) async {
    try {
      final mapels = await ApiService.get("/api/mobile/siswa/sekretaris?tab=mapel", useCache: false);
      if (mapels is! List || mapels.isEmpty || !mounted) return;
      String? mapelId = existing?["mataPelajaranId"] as String?;
      String hari = (existing?["hari"] as String?) ?? _hari.first;
      final mulai = TextEditingController(text: existing?["jamMulai"]?.toString() ?? "");
      final selesai = TextEditingController(text: existing?["jamSelesai"]?.toString() ?? "");
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
          title: Text(existing == null ? "Tambah Jadwal" : "Edit Jadwal"),
          content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            DropdownButtonFormField<String>(
              initialValue: mapelId,
              decoration: const InputDecoration(labelText: "Mata Pelajaran", border: OutlineInputBorder()),
              items: mapels.map((m) => DropdownMenuItem<String>(value: m["id"] as String, child: Text("${m["nama"]}", overflow: TextOverflow.ellipsis))).toList(),
              onChanged: (v) => setDlg(() => mapelId = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: hari,
              decoration: const InputDecoration(labelText: "Hari", border: OutlineInputBorder()),
              items: _hari.map((h) => DropdownMenuItem<String>(value: h, child: Text(h))).toList(),
              onChanged: (v) => setDlg(() => hari = v ?? hari),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: mulai, decoration: const InputDecoration(labelText: "Mulai (HH:MM)", border: OutlineInputBorder()))),
              const SizedBox(width: 8),
              Expanded(child: TextField(controller: selesai, decoration: const InputDecoration(labelText: "Selesai (HH:MM)", border: OutlineInputBorder()))),
            ]),
          ])),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan")),
          ],
        )),
      );
      if (ok != true) return;
      if (mapelId == null) { _snack("Pilih mata pelajaran", color: const Color(0xFFEF4444)); return; }
      await _op({
        "op": existing == null ? "createJadwal" : "updateJadwal",
        if (existing != null) "id": existing["id"],
        "mataPelajaranId": mapelId,
        "hari": hari,
        "jamMulai": mulai.text.trim(),
        "jamSelesai": selesai.text.trim(),
      });
      _snack("Jadwal tersimpan");
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: 2,
        child: Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          appBar: AppBar(
            title: const Text("Sekretaris"),
            backgroundColor: Colors.white,
            elevation: 0,
            bottom: const TabBar(
              labelColor: Color(0xFF4F46E5),
              unselectedLabelColor: Colors.black54,
              indicatorColor: Color(0xFF4F46E5),
              tabs: [Tab(text: "Jadwal Piket"), Tab(text: "Jadwal Pelajaran")],
            ),
          ),
          body: loading
              ? const Center(child: CircularProgressIndicator())
              : TabBarView(children: [
                  // ─── PIKET ───
                  RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.all(16), children: [
                      Row(children: [
                        Expanded(child: Text("Piket (${piket.length})", style: const TextStyle(fontWeight: FontWeight.w700))),
                        FilledButton.tonal(onPressed: _tambahPiket, child: const Text("+ Tambah")),
                      ]),
                      const SizedBox(height: 8),
                      ..._hari.where((h) => piket.any((p) => (p as Map)["hari"] == h)).map((h) {
                        final items = piket.where((p) => (p as Map)["hari"] == h).toList();
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: ExpansionTile(
                            shape: const Border(),
                            title: Text(h, style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text("${items.length} siswa"),
                            leading: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: const Color(0xFFF59E0B).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.cleaning_services_outlined, size: 16, color: Color(0xFFF59E0B))),
                            children: items.map((raw) {
                              final p = raw as Map;
                              return ListTile(
                                dense: true,
                                title: Text(p["siswa"]?["nama"] ?? "-"),
                                trailing: IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => _hapus("piket", p["id"], "Piket ${p["siswa"]?["nama"] ?? ""} $h")),
                              );
                            }).toList(),
                          ),
                        );
                      }),
                      if (piket.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text("Belum ada jadwal piket", textAlign: TextAlign.center, style: TextStyle(color: Colors.black45))),
                    ]),
                  ),
                  // ─── JADWAL PELAJARAN ───
                  RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.all(16), children: [
                      Row(children: [
                        Expanded(child: Text("Jadwal Pelajaran (${jadwal.length})", style: const TextStyle(fontWeight: FontWeight.w700))),
                        FilledButton.tonal(onPressed: () => _formJadwal(), child: const Text("+ Tambah")),
                      ]),
                      const SizedBox(height: 8),
                      ...jadwal.map((raw) {
                        final j = raw as Map;
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: ListTile(
                            leading: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: const Color(0xFF0EA5E9).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.schedule_outlined, size: 16, color: Color(0xFF0EA5E9))),
                            title: Text("${j["mataPelajaran"]?["nama"] ?? "-"}", style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text("${j["hari"]} • ${j["jamMulai"]}–${j["jamSelesai"]}"),
                            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                              IconButton(icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF4F46E5)), onPressed: () => _formJadwal(j)),
                              IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => _hapus("jadwal", j["id"], "${j["mataPelajaran"]?["nama"] ?? "Jadwal"}")),
                            ]),
                          ),
                        );
                      }),
                      if (jadwal.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text("Belum ada jadwal pelajaran", textAlign: TextAlign.center, style: TextStyle(color: Colors.black45))),
                    ]),
                  ),
                ]),
        ),
      );
}
