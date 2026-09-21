import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class GuruAbsensi extends StatefulWidget {
  const GuruAbsensi({super.key});
  @override
  State<GuruAbsensi> createState() => _GuruAbsensiState();
}

class _GuruAbsensiState extends State<GuruAbsensi> {
  String tanggal = DateTime.now().toIso8601String().split("T")[0];
  List<dynamic> jadwal = [];
  bool loading = true;
  String guruStatus = "HADIR";
  bool guruSaved = false;
  bool savingGuru = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final j = await ApiService.get("/api/mobile/guru/jadwal?tanggal=$tanggal");
      final gAbs = await ApiService.get("/api/mobile/guru/absensi?tanggal=$tanggal").catchError((_) => null);
      if (mounted) setState(() {
        jadwal = j is List ? j : [];
        if (gAbs != null && gAbs is Map && gAbs["status"] != null) {
          guruStatus = gAbs["status"];
          guruSaved = true;
        } else {
          guruSaved = false;
        }
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _saveGuruAbsensi() async {
    setState(() => savingGuru = true);
    try {
      await ApiService.post("/api/mobile/guru/absensi", {"tanggal": tanggal, "status": guruStatus});
      if (mounted) {
        setState(() => guruSaved = true);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Absensi Anda tersimpan")));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Gagal: $e")));
    } finally {
      if (mounted) setState(() => savingGuru = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Absensi"), backgroundColor: Colors.white, elevation: 0),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Tanggal picker
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(children: [
                    const Icon(Icons.calendar_today_outlined, size: 18, color: Color(0xFF4F46E5)),
                    const SizedBox(width: 8),
                    const Text("Tanggal:", style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    const Spacer(),
                    Text(tanggal, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    IconButton(icon: const Icon(Icons.edit, size: 16), onPressed: () async {
                      final picked = await showDatePicker(context: context, initialDate: DateTime.parse(tanggal), firstDate: DateTime(2024), lastDate: DateTime(2027));
                      if (picked != null) setState(() { tanggal = picked.toIso8601String().split("T")[0]; }); _load();
                    }),
                  ]),
                ),
              ),
              const SizedBox(height: 12),
              // Absensi Guru Sendiri
              Card(
                color: guruSaved ? const Color(0xFFF0FDF4) : Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: guruSaved ? const Color(0xFFBBF7D0) : const Color(0xFFE2E8F0))),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: const Color(0xFF4F46E5).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.verified_user_outlined, size: 16, color: Color(0xFF4F46E5))),
                      const SizedBox(width: 8),
                      const Text("Kehadiran Anda", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      const Spacer(),
                      if (guruSaved) Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: const Color(0xFF10B981), borderRadius: BorderRadius.circular(20)), child: const Text("Tersimpan", style: TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold))),
                    ]),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: guruStatus,
                      decoration: InputDecoration(border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)), contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
                      items: ["HADIR", "IZIN", "SAKIT", "ALPA"].map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 13)))).toList(),
                      onChanged: guruSaved ? null : (v) => setState(() => guruStatus = v!),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: guruSaved || savingGuru ? null : _saveGuruAbsensi,
                        style: FilledButton.styleFrom(backgroundColor: guruSaved ? const Color(0xFF10B981) : const Color(0xFF4F46E5)),
                        child: savingGuru ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(guruSaved ? "Tersimpan" : "Simpan Kehadiran"),
                      ),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: 12),
              Text("Jadwal Mengajar Anda — ${jadwal.length} mapel", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 8),
              if (jadwal.isEmpty)
                const Card(child: Padding(padding: EdgeInsets.all(16), child: Center(child: Text("Tidak ada jadwal mengajar hari ini", style: TextStyle(color: Colors.black54))))),
              ...jadwal.map((j) => Card(
                    child: ListTile(
                      leading: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: const Color(0xFF4F46E5).withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.class_outlined, size: 16, color: Color(0xFF4F46E5))),
                      title: Text("${j["mataPelajaran"]?["nama"] ?? "-"}", style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      subtitle: Text("${j["kelas"]?["nama"] ?? ""} • ${j["jamMulai"] ?? ""}-${j["jamSelesai"] ?? ""}", style: const TextStyle(fontSize: 11, color: Colors.black54)),
                      trailing: const Icon(Icons.chevron_right, size: 16, color: Color(0xFF94A3B8)),
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Buka absensi ${j["kelas"]?["nama"]} - ${j["mataPelajaran"]?["nama"]}")));
                      },
                    ),
                  )),
            ],
          ),
  );
}
