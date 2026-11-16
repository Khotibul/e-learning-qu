import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
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
      case "AKTIF": return AppColors.success;
      case "SELESAI": return AppColors.inkSoft;
      case "DRAFT": return AppColors.warning;
      default: return AppColors.primary;
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
    backgroundColor: AppColors.surface,
    appBar: AppBar(title: const Text("Ujian")),
    body: Column(
      children: [
        Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: ["SEMUA", "AKTIF", "SELESAI", "DRAFT"].map((f) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(f, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600)),
                selected: filter == f,
                showCheckmark: false,
                onSelected: (_) => setState(() => filter = f),
                selectedColor: AppColors.primary,
                backgroundColor: Colors.white,
                side: const BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                labelStyle: TextStyle(color: filter == f ? Colors.white : AppColors.inkSoft),
              ),
            )).toList()),
          ),
        ),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : filtered.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.inbox_outlined, size: 44, color: AppColors.borderStrong),
                          SizedBox(height: 8),
                          Text("Belum ada ujian", style: TextStyle(color: AppColors.inkMuted, fontSize: 13)),
                        ],
                      ),
                    )
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
                            actionColor = AppColors.primary;
                            actionEnabled = true;
                            actionIcon = Icons.refresh_outlined;
                          } else if (sudah && !bisaRetake) {
                            actionLabel = "Sudah Dikerjakan";
                            actionColor = AppColors.inkMuted;
                            actionEnabled = false;
                            actionIcon = Icons.check_circle_outline;
                          } else if (status == "AKTIF") {
                            actionLabel = "Kerjakan";
                            actionColor = AppColors.success;
                            actionEnabled = true;
                            actionIcon = Icons.play_arrow_outlined;
                          } else {
                            actionLabel = status == "DRAFT" ? "Belum Tersedia" : "Selesai";
                            actionColor = AppColors.inkMuted;
                            actionEnabled = false;
                            actionIcon = Icons.block_outlined;
                          }
                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: AppColors.border),
                              boxShadow: AppShadows.soft,
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
                                  // Status dipindah ke baris mapel agar judul punya lebar penuh
                                  // (sebelumnya "Penilaian Tengah Semester…" terpotong).
                                  Expanded(
                                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Text(u["nama"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.ink, height: 1.3), maxLines: 2, overflow: TextOverflow.ellipsis),
                                      const SizedBox(height: 3),
                                      Row(children: [
                                        Flexible(
                                          child: Text(
                                            "${u["mapel"] ?? "-"} • ${u["kelas"] ?? ""}",
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(fontSize: 11.5, color: AppColors.inkMuted),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(color: _statusColor(status).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                                          child: Text(status, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: _statusColor(status))),
                                        ),
                                      ]),
                                    ]),
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
                                      backgroundColor: actionEnabled ? actionColor : AppColors.surface,
                                      foregroundColor: actionEnabled ? Colors.white : AppColors.inkMuted,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                      minimumSize: const Size.fromHeight(44),
                                    ),
                                  ),
                                ),
                                if (bisaRetake) ...[
                                  const SizedBox(height: 6),
                                  const Row(children: [Icon(Icons.replay, size: 12, color: AppColors.primary), SizedBox(width: 4), Text("Dapat dikerjakan ulang", style: TextStyle(fontSize: 10, color: AppColors.primary))]),
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
  Widget build(BuildContext context) => Row(children: [Icon(icon, size: 14, color: AppColors.inkMuted), const SizedBox(width: 4), Text(text, style: const TextStyle(fontSize: 11, color: AppColors.inkSoft))]);
}
