import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Kelola ujian guru — buat (dengan pilihan soal), mulai, hentikan, reset, hapus.
/// Mirror web /guru/ujian via POST/DELETE /api/mobile/guru/ujian.
class GuruUjian extends StatefulWidget {
  const GuruUjian({super.key});
  @override
  State<GuruUjian> createState() => _GuruUjianState();
}

class _GuruUjianState extends State<GuruUjian> {
  List<dynamic> data = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/guru/ujian", useCache: false);
      if (mounted) setState(() { data = v is List ? v : []; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  Future<void> _op(String op, String id) async {
    try {
      await ApiService.post("/api/mobile/guru/ujian", {"op": op, "id": id});
      _snack(op == "startUjian" ? "Ujian dimulai" : op == "stopUjian" ? "Ujian dihentikan" : "Ujian direset ke DRAFT");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _hapus(String id) async {
    try {
      await ApiService.delete("/api/mobile/guru/ujian?id=$id");
      _snack("Ujian dihapus");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Future<void> _confirm(String label, Future<void> Function() action) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Konfirmasi"),
        content: Text("$label ujian ini?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Ya")),
        ],
      ),
    );
    if (ok == true) await action();
  }

  Future<void> _buatUjian() async {
    Map<String, dynamic>? refs;
    try {
      final v = await ApiService.get("/api/mobile/guru/ujian?tab=refs", useCache: false);
      if (v is Map) refs = Map<String, dynamic>.from(v);
    } catch (_) {}
    if (refs == null || !mounted) { _snack("Gagal memuat referensi", color: const Color(0xFFEF4444)); return; }

    final kelasList = (refs["kelas"] as List?) ?? [];
    final mapelList = (refs["mapels"] as List?) ?? [];
    final pairs = (refs["pengajaran"] as List?) ?? [];
    final soals = (refs["soals"] as List?) ?? [];
    if (kelasList.isEmpty || mapelList.isEmpty) { _snack("Pengampuan belum diatur", color: const Color(0xFFEF4444)); return; }

    final nama = TextEditingController();
    final jamMulai = TextEditingController(text: "07:00");
    final jamSelesai = TextEditingController(text: "09:00");
    final durasi = TextEditingController(text: "60");
    final kkm = TextEditingController(text: "70");
    String? kelasId = kelasList.first["id"] as String?;
    String? mapelId = mapelList.first["id"] as String?;
    DateTime tanggal = DateTime.now();
    bool isLatihan = false;
    final pilihSoal = <String>{};

    bool validPair() => pairs.any((p) => p["kelasId"] == kelasId && p["mataPelajaranId"] == mapelId);

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
        title: const Text("Buat Ujian"),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: nama, decoration: const InputDecoration(labelText: "Nama ujian", border: OutlineInputBorder())),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: mapelId,
              decoration: const InputDecoration(labelText: "Mata Pelajaran", border: OutlineInputBorder()),
              items: mapelList.map((m) => DropdownMenuItem<String>(value: m["id"] as String, child: Text("${m["nama"]}", style: const TextStyle(fontSize: 13)))).toList(),
              onChanged: (v) => setDlg(() => mapelId = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: kelasId,
              decoration: const InputDecoration(labelText: "Kelas", border: OutlineInputBorder()),
              items: kelasList.map((k) => DropdownMenuItem<String>(value: k["id"] as String, child: Text("${k["nama"]}", style: const TextStyle(fontSize: 13)))).toList(),
              onChanged: (v) => setDlg(() => kelasId = v),
            ),
            if (!validPair()) const Padding(padding: EdgeInsets.only(top: 6), child: Text("Kombinasi mapel+kelas tidak Anda ampu", style: TextStyle(fontSize: 11, color: Color(0xFFEF4444)))),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: Text("Tanggal: ${tanggal.toString().substring(0, 10)}", style: const TextStyle(fontSize: 13))),
              TextButton(onPressed: () async {
                final d = await showDatePicker(context: ctx, initialDate: tanggal, firstDate: DateTime(2024), lastDate: DateTime(2031));
                if (d != null) setDlg(() => tanggal = d);
              }, child: const Text("Ubah")),
            ]),
            Row(children: [
              Expanded(child: TextField(controller: jamMulai, decoration: const InputDecoration(labelText: "Mulai (HH:MM)", border: OutlineInputBorder(), isDense: true))),
              const SizedBox(width: 8),
              Expanded(child: TextField(controller: jamSelesai, decoration: const InputDecoration(labelText: "Selesai (HH:MM)", border: OutlineInputBorder(), isDense: true))),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: durasi, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Durasi (menit)", border: OutlineInputBorder(), isDense: true))),
              const SizedBox(width: 8),
              Expanded(child: TextField(controller: kkm, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Nilai minimum", border: OutlineInputBorder(), isDense: true))),
            ]),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text("Latihan (bukan ujian)", style: TextStyle(fontSize: 13)),
              value: isLatihan,
              onChanged: (v) => setDlg(() => isLatihan = v),
            ),
            Text("Pilih Soal (${pilihSoal.length} dipilih, opsional)", style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
            ...soals.map((raw) {
              final s = raw as Map;
              return CheckboxListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: pilihSoal.contains(s["id"]),
                title: Text("${s["pertanyaan"]}", maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)),
                subtitle: Text("${s["jenisSoal"]} • ${s["poin"]} poin", style: const TextStyle(fontSize: 10)),
                onChanged: (v) => setDlg(() => v == true ? pilihSoal.add(s["id"] as String) : pilihSoal.remove(s["id"])),
              );
            }),
            if (soals.isEmpty) const Text("Bank soal kosong — ujian dibuat tanpa soal (isi via web)", style: TextStyle(fontSize: 11, color: Colors.black45)),
          ])),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Simpan DRAFT")),
        ],
      )),
    );
    if (ok != true) return;
    if (nama.text.trim().isEmpty || !validPair()) { _snack("Nama wajib & kombinasi mapel+kelas harus valid", color: const Color(0xFFEF4444)); return; }
    try {
      await ApiService.post("/api/mobile/guru/ujian", {
        "op": "createUjian",
        "nama": nama.text.trim(),
        "mataPelajaranId": mapelId,
        "kelasId": kelasId,
        "tanggal": tanggal.toString().substring(0, 10),
        "jamMulai": jamMulai.text.trim(),
        "jamSelesai": jamSelesai.text.trim(),
        "durasi": int.tryParse(durasi.text) ?? 60,
        "nilaiMinimum": int.tryParse(kkm.text) ?? 70,
        "jumlahSoal": pilihSoal.length,
        "isLatihan": isLatihan,
        "soalIds": pilihSoal.toList(),
      });
      _snack("Ujian DRAFT dibuat");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Color _stColor(String s) => s == "AKTIF" ? const Color(0xFF10B981) : s == "DRAFT" ? const Color(0xFF64748B) : const Color(0xFF0EA5E9);

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(title: const Text("Kelola Ujian"), backgroundColor: Colors.white, elevation: 0),
        floatingActionButton: FloatingActionButton.extended(onPressed: _buatUjian, icon: const Icon(Icons.add), label: const Text("Buat")),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: data.isEmpty
                    ? ListView(children: const [Padding(padding: EdgeInsets.all(48), child: Center(child: Text("Belum ada ujian", style: TextStyle(color: Colors.black54))))])
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                        itemCount: data.length,
                        itemBuilder: (_, i) {
                          final u = data[i] as Map;
                          final st = (u["status"] ?? "").toString();
                          return Card(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              leading: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(color: _stColor(st).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                                child: Icon(st == "AKTIF" ? Icons.play_circle : st == "SELESAI" ? Icons.check_circle : Icons.edit_note, size: 18, color: _stColor(st)),
                              ),
                              title: Text(u["nama"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                              subtitle: Text("${u["mataPelajaran"]?["nama"] ?? "-"} • ${u["kelas"]?["nama"] ?? "-"} • ${u["jumlahSoal"] ?? 0} soal • ${u["durasi"] ?? 0}m", style: const TextStyle(fontSize: 11)),
                              trailing: PopupMenuButton<String>(
                                onSelected: (v) {
                                  final id = u["id"].toString();
                                  if (v == "start") _confirm("Mulai", () => _op("startUjian", id));
                                  if (v == "stop") _confirm("Hentikan", () => _op("stopUjian", id));
                                  if (v == "reset") _confirm("Reset", () => _op("resetUjian", id));
                                  if (v == "hapus") _confirm("Hapus", () => _hapus(id));
                                },
                                itemBuilder: (_) => [
                                  if (st == "DRAFT" || st == "SELESAI") const PopupMenuItem(value: "start", child: Text("Mulai")),
                                  if (st == "AKTIF") const PopupMenuItem(value: "stop", child: Text("Hentikan")),
                                  if (st == "SELESAI") const PopupMenuItem(value: "reset", child: Text("Reset ke DRAFT")),
                                  const PopupMenuItem(value: "hapus", child: Text("Hapus", style: TextStyle(color: Colors.red))),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
      );
}
