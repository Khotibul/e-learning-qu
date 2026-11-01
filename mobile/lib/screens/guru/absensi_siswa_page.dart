import 'package:flutter/material.dart';

import '../../services/api_service.dart';

/// Absensi siswa per SESI mata pelajaran.
/// Selaras dengan website: terkunci sampai guru melakukan Absen Masuk pada sesi
/// tersebut, mendukung status TERLAMBAT dan keterangan per siswa.
class MuridAbsensiPage extends StatefulWidget {
  final String kelasId;
  final String kelasNama;
  final String mataPelajaranId;
  final String mataPelajaranNama;
  final String tanggal;
  final String jadwalId;
  final String jamMulai;
  final String jamSelesai;
  final bool guruSudahMasuk;

  const MuridAbsensiPage({
    super.key,
    required this.kelasId,
    required this.kelasNama,
    required this.mataPelajaranId,
    required this.mataPelajaranNama,
    required this.tanggal,
    required this.jadwalId,
    required this.jamMulai,
    required this.jamSelesai,
    required this.guruSudahMasuk,
  });

  @override
  State<MuridAbsensiPage> createState() => _MuridAbsensiPageState();
}

class _MuridAbsensiPageState extends State<MuridAbsensiPage> {
  List<dynamic> siswas = [];
  List<dynamic> filtered = [];
  Map<String, String> statusMap = {};
  Map<String, String> keteranganMap = {};
  bool loading = true;
  bool saving = false;
  bool saved = false;
  bool guruSudahMasuk = false;
  final searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    guruSudahMasuk = widget.guruSudahMasuk;
    searchCtrl.addListener(_filter);
    _load();
  }

  @override
  void dispose() {
    searchCtrl.dispose();
    super.dispose();
  }

  void _filter() {
    final q = searchCtrl.text.toLowerCase();
    setState(() {
      filtered = q.isEmpty
          ? siswas
          : siswas
              .where((s) =>
                  (s["nama"] ?? "").toString().toLowerCase().contains(q) ||
                  (s["nis"] ?? "").toString().toLowerCase().contains(q))
              .toList();
    });
  }

  Future<void> _load() async {
    try {
      final data = await ApiService.get(
        "/api/mobile/guru/absensi/siswa?kelasId=${widget.kelasId}&mataPelajaranId=${widget.mataPelajaranId}&jadwalPelajaranId=${widget.jadwalId}&tanggal=${widget.tanggal}",
        useCache: false,
      );
      if (mounted) {
        setState(() {
          siswas = data["siswas"] as List? ?? <dynamic>[];
          filtered = siswas;
          statusMap = {};
          keteranganMap = {};
          for (final s in siswas) {
            final id = (s["siswaId"] ?? s["id"]).toString();
            statusMap[id] = s["status"] ?? "HADIR";
            keteranganMap[id] = (s["keterangan"] ?? "").toString();
          }
          saved = data["absensi"] != null;
          guruSudahMasuk = data["guruAbsen"] == true || widget.guruSudahMasuk;
          loading = false;
        });
        _filter();
      }
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _save() async {
    if (!guruSudahMasuk) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Absen Masuk sesi ini terlebih dahulu sebelum mengabsensi siswa")),
      );
      return;
    }
    setState(() => saving = true);
    try {
      final siswaStatus = siswas.map((s) {
        final id = (s["siswaId"] ?? s["id"]).toString();
        final ket = (keteranganMap[id] ?? "").trim();
        return {
          "siswaId": id,
          "status": statusMap[id] ?? "HADIR",
          if (ket.isNotEmpty) "keterangan": ket,
        };
      }).toList();
      await ApiService.post("/api/mobile/guru/absensi/siswa", {
        "kelasId": widget.kelasId,
        "mataPelajaranId": widget.mataPelajaranId,
        "jadwalPelajaranId": widget.jadwalId,
        "tanggal": widget.tanggal,
        "siswaStatus": siswaStatus,
      });
      if (mounted) {
        setState(() => saved = true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Absensi siswa tersimpan — 1x per sesi mapel per hari")),
        );
      }
    } catch (e) {
      final msg = e.toString().replaceFirst("Exception: ", "");
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text("${widget.kelasNama} • ${widget.mataPelajaranNama}", style: const TextStyle(fontSize: 15)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : Column(children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: TextField(
                  controller: searchCtrl,
                  decoration: InputDecoration(
                    hintText: "Cari siswa (nama/NIS)...",
                    prefixIcon: const Icon(Icons.search, size: 18),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
              ),
              if (!guruSudahMasuk)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.symmetric(horizontal: 12),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: const Row(children: [
                    Icon(Icons.lock_outline, size: 16, color: Color(0xFFB45309)),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "Terkunci — lakukan Absen Masuk sesi ini dulu. Setelah itu absensi siswa dapat diisi.",
                        style: TextStyle(fontSize: 11, color: Color(0xFFB45309)),
                      ),
                    ),
                  ]),
                ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: saved || !guruSudahMasuk
                          ? null
                          : () => setState(() {
                                for (final s in siswas) {
                                  statusMap[(s["siswaId"] ?? s["id"]).toString()] = "HADIR";
                                }
                              }),
                      child: const Text("Semua Hadir", style: TextStyle(fontSize: 12)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton(
                      onPressed: saving || !guruSudahMasuk ? null : _save,
                      style: FilledButton.styleFrom(
                          backgroundColor: saved ? const Color(0xFF10B981) : const Color(0xFF4F46E5)),
                      child: saving
                          ? const SizedBox(
                              height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(saved ? "Tersimpan" : "Simpan", style: const TextStyle(fontSize: 12)),
                    ),
                  ),
                ]),
              ),
              Text(
                "${filtered.length} siswa • ${widget.jamMulai}-${widget.jamSelesai}${saved ? " • sudah tersimpan" : ""}",
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 4),
              Expanded(
                child: filtered.isEmpty
                    ? const Center(child: Text("Tidak ada siswa", style: TextStyle(color: Colors.black54)))
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: filtered.length,
                        itemBuilder: (_, i) {
                          final s = filtered[i];
                          final id = (s["siswaId"] ?? s["id"]).toString();
                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  Expanded(
                                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Text(s["nama"] ?? "-",
                                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                      Text(s["nis"] ?? "",
                                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                    ]),
                                  ),
                                  DropdownButton<String>(
                                    value: statusMap[id] ?? "HADIR",
                                    items: ["HADIR", "TERLAMBAT", "SAKIT", "IZIN", "ALPA"]
                                        .map((v) => DropdownMenuItem(
                                            value: v, child: Text(v, style: const TextStyle(fontSize: 12))))
                                        .toList(),
                                    onChanged: guruSudahMasuk
                                        ? (v) => setState(() {
                                              statusMap[id] = v!;
                                              saved = false;
                                            })
                                        : null,
                                  ),
                                ]),
                                TextFormField(
                                  key: ValueKey("keterangan-$id"),
                                  initialValue: keteranganMap[id] ?? "",
                                  enabled: guruSudahMasuk,
                                  style: const TextStyle(fontSize: 12),
                                  decoration: const InputDecoration(
                                    hintText: "Keterangan (opsional)",
                                    isDense: true,
                                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  ),
                                  onChanged: (v) => setState(() {
                                    keteranganMap[id] = v;
                                    saved = false;
                                  }),
                                ),
                              ]),
                            ),
                          );
                        },
                      ),
              ),
            ]),
    );
  }
}
