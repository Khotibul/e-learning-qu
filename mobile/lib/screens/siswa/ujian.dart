import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import 'ujian_detail.dart';

class SiswaUjian extends StatefulWidget {
  const SiswaUjian({super.key});
  @override
  State<SiswaUjian> createState() => _SiswaUjianState();
}

class _SiswaUjianState extends State<SiswaUjian> {
  List<dynamic> data = [];
  bool loading = true;
  String filter = "SEMUA";

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final v = await ApiService.getUjianList();
      if (mounted) setState(() { data = v; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  List<dynamic> get filtered => filter == "SEMUA" ? data : data.where((e) => e["status"] == filter).toList();

  Color _statusColor(String s) {
    switch (s) {
      case "AKTIF": return const Color(0xFF10B981);
      case "SELESAI": return const Color(0xFF6B7280);
      case "DRAFT": return const Color(0xFFF59E0B);
      default: return const Color(0xFF4F46E5);
    }
  }

  String _safeDate(dynamic raw) {
    if (raw == null) return "-";
    try {
      final dt = DateTime.parse(raw.toString());
      try {
        return DateFormat("dd MMM yyyy", "id_ID").format(dt);
      } catch (_) {
        return "${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}";
      }
    } catch (_) {
      return raw.toString().split("T").first;
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Ujian"), backgroundColor: Colors.white, elevation: 0),
    body: Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: ["SEMUA", "AKTIF", "SELESAI", "DRAFT"].map((f) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(f, style: const TextStyle(fontSize: 12)),
                selected: filter == f,
                onSelected: (_) => setState(() => filter = f),
                selectedColor: const Color(0xFF4F46E5),
                labelStyle: TextStyle(color: filter == f ? Colors.white : const Color(0xFF64748B)),
              ),
            )).toList()),
          ),
        ),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : filtered.isEmpty
                  ? const Center(child: Text("Belum ada ujian", style: TextStyle(color: Colors.black54)))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: filtered.length,
                        itemBuilder: (_, i) {
                          final u = filtered[i] as Map;
                          final status = u["status"] as String? ?? "DRAFT";
                          final sudah = u["sudahDikerjakan"] == true;
                          final bisaRetake = u["bisaRetake"] == true;
                          String actionLabel;
                          Color actionColor;
                          bool actionEnabled;
                          IconData actionIcon;
                          if (sudah && bisaRetake) {
                            actionLabel = "Kerjakan Lagi";
                            actionColor = const Color(0xFF4F46E5);
                            actionEnabled = true;
                            actionIcon = Icons.refresh_outlined;
                          } else if (sudah && !bisaRetake) {
                            actionLabel = "Sudah Dikerjakan";
                            actionColor = const Color(0xFF94A3B8);
                            actionEnabled = false;
                            actionIcon = Icons.check_circle_outline;
                          } else if (status == "AKTIF") {
                            actionLabel = "Kerjakan";
                            actionColor = const Color(0xFF10B981);
                            actionEnabled = true;
                            actionIcon = Icons.play_arrow_outlined;
                          } else {
                            actionLabel = status == "DRAFT" ? "Belum Tersedia" : "Selesai";
                            actionColor = const Color(0xFF94A3B8);
                            actionEnabled = false;
                            actionIcon = Icons.block_outlined;
                          }
                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                              boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2))],
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(color: _statusColor(status).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                                    child: Icon(status == "AKTIF" ? Icons.quiz_outlined : Icons.description_outlined, size: 16, color: _statusColor(status)),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(u["nama"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                                    Text("${u["mapel"] ?? "-"} • ${u["kelas"] ?? ""}", style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                                  ])),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(color: _statusColor(status).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                                    child: Text(status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _statusColor(status))),
                                  ),
                                ]),
                                const SizedBox(height: 12),
                                Row(children: [
                                  _Meta(icon: Icons.event_outlined, text: _safeDate(u["tanggal"])),
                                  const SizedBox(width: 12),
                                  _Meta(icon: Icons.schedule_outlined, text: "${u["durasi"] ?? 0} menit"),
                                  const SizedBox(width: 12),
                                  _Meta(icon: Icons.quiz_outlined, text: "${u["jumlahSoal"] ?? 0} soal"),
                                ]),
                                const SizedBox(height: 12),
                                SizedBox(
                                  width: double.infinity,
                                  child: FilledButton.icon(
                                    onPressed: actionEnabled ? () {
                                      Navigator.push(context, MaterialPageRoute(builder: (_) => UjianDetail(ujianId: u["id"] as String)));
                                    } : null,
                                    icon: Icon(actionIcon, size: 16),
                                    label: Text(actionLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                    style: FilledButton.styleFrom(
                                      backgroundColor: actionEnabled ? actionColor : const Color(0xFFF1F5F9),
                                      foregroundColor: actionEnabled ? Colors.white : const Color(0xFF64748B),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                      padding: const EdgeInsets.symmetric(vertical: 10),
                                    ),
                                  ),
                                ),
                                if (bisaRetake) ...[
                                  const SizedBox(height: 6),
                                  const Row(children: [Icon(Icons.replay, size: 12, color: Color(0xFF4F46E5)), SizedBox(width: 4), Text("Dapat dikerjakan ulang", style: TextStyle(fontSize: 10, color: Color(0xFF4F46E5)))]),
                                ],
                              ]),
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    ),
  );
}

class _Meta extends StatelessWidget {
  final IconData icon; final String text;
  const _Meta({required this.icon, required this.text});
  @override
  Widget build(BuildContext context) => Row(children: [Icon(icon, size: 14, color: const Color(0xFF94A3B8)), const SizedBox(width: 4), Text(text, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)))]); 
}
