import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import 'ujian_detail.dart';

class SiswaLatihan extends StatefulWidget {
  const SiswaLatihan({super.key});
  @override
  State<SiswaLatihan> createState() => _SiswaLatihanState();
}

class _SiswaLatihanState extends State<SiswaLatihan> {
  List<dynamic> data = [];
  bool loading = true;
  @override
  void initState() {
    super.initState();
    ApiService.getLatihanList().then((v) {
      if (mounted) setState(() { data = v; loading = false; });
    }).catchError((_) {
      if (mounted) setState(() => loading = false);
    });
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Latihan"), backgroundColor: Colors.white, elevation: 0),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : data.isEmpty
            ? const Center(child: Text("Belum ada latihan", style: TextStyle(color: Colors.black54)))
            : RefreshIndicator(
                onRefresh: () async {
                  final v = await ApiService.getLatihanList();
                  if (mounted) setState(() => data = v);
                },
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: data.length,
                  itemBuilder: (_, i) {
                    final l = data[i] as Map;
                    final sudah = l["sudahDikerjakan"] == true;
                    final bisaRetake = l["bisaRetake"] == true;
                    final status = l["status"] ?? "AKTIF";
                    String label;
                    Color color;
                    bool enabled;
                    if (sudah && bisaRetake) {
                      label = "Kerjakan Lagi";
                      color = const Color(0xFF4F46E5);
                      enabled = true;
                    } else if (sudah) {
                      label = "Sudah Dikerjakan";
                      color = const Color(0xFF94A3B8);
                      enabled = false;
                    } else {
                      label = "Kerjakan";
                      color = const Color(0xFF10B981);
                      enabled = status == "AKTIF";
                    }
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: const Color(0xFF6366F1).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.menu_book_outlined, size: 16, color: Color(0xFF6366F1))),
                            const SizedBox(width: 12),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(l["nama"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)), Text("${l["mapel"] ?? "-"}", style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)))])),
                          ]),
                          const SizedBox(height: 12),
                          Row(children: [
                            _Meta(icon: Icons.timer_outlined, text: "${l["durasi"] ?? 0} menit"),
                            const SizedBox(width: 12),
                            _Meta(icon: Icons.quiz_outlined, text: "${l["jumlahSoal"] ?? 0} soal"),
                          ]),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              onPressed: enabled ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => UjianDetail(ujianId: l["id"] as String))) : null,
                              style: FilledButton.styleFrom(backgroundColor: enabled ? color : const Color(0xFFF1F5F9), foregroundColor: enabled ? Colors.white : const Color(0xFF64748B)),
                              child: Text(label),
                            ),
                          ),
                        ]),
                      ),
                    );
                  },
                ),
              ),
  );
}

class _Meta extends StatelessWidget {
  final IconData icon; final String text;
  const _Meta({required this.icon, required this.text});
  @override
  Widget build(BuildContext context) => Row(children: [Icon(icon, size: 14, color: const Color(0xFF94A3B8)), const SizedBox(width: 4), Text(text, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)))]);
}
