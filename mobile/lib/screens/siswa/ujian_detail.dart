import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_ui.dart';

class UjianDetail extends StatefulWidget {
  final String ujianId;
  const UjianDetail({super.key, required this.ujianId});
  @override
  State<UjianDetail> createState() => _UjianDetailState();
}

/// Gaya tombol navigasi bawah: rapat agar tiga tombol tetap muat di 320dp.
const ButtonStyle _tombolNavigasi = ButtonStyle(
  padding: WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 8)),
  textStyle: WidgetStatePropertyAll(TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
  minimumSize: WidgetStatePropertyAll(Size(0, 48)),
);

class _UjianDetailState extends State<UjianDetail> {
  Map<String, dynamic>? ujian;
  bool loading = true;
  bool hasStarted = false;
  bool showKonfirmasi = true;
  int currentNomor = 1;
  Map<String, String> answers = {};
  List<String> raguRagu = [];
  int waktuTersisa = 0;
  Timer? timer;
  Timer? autoSaveTimer;
  bool isSubmitting = false;
  Map<String, dynamic>? hasil;
  bool showReview = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiService.getUjianDetail(widget.ujianId);
      if (mounted) setState(() { ujian = data; loading = false; waktuTersisa = (data["durasi"] as int? ?? 0) * 60; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _start() async {
    try {
      final res = await ApiService.startUjian(widget.ujianId);
      if (res["savedAnswers"] != null) {
        final map = Map<String, String>.from(res["savedAnswers"] as Map);
        setState(() => answers = map);
      }
      if (res["savedRagu"] is List) setState(() => raguRagu = List<String>.from(res["savedRagu"]));
      setState(() { showKonfirmasi = false; hasStarted = true; });
      _startTimer();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Gagal memulai: $e")));
    }
  }

  void _startTimer() {
    timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (waktuTersisa <= 1) {
        t.cancel();
        _submit();
      } else {
        setState(() => waktuTersisa--);
      }
    });
    // Auto-save tiap 30 detik — disimpan agar bisa dibatalkan saat layar ditutup
    // (sebelumnya timer ini tak pernah dibatalkan dan terus memanggil server).
    autoSaveTimer?.cancel();
    autoSaveTimer = Timer.periodic(const Duration(seconds: 30), (t) {
      if (!hasStarted || hasil != null) { t.cancel(); return; }
      ApiService.autoSaveUjian(widget.ujianId, answers, raguRagu).catchError((_) {});
    });
  }

  Future<void> _submit() async {
    setState(() => isSubmitting = true);
    try {
      final res = await ApiService.submitUjian(widget.ujianId, answers, raguRagu);
      setState(() { hasil = res; isSubmitting = false; });
      timer?.cancel();
      autoSaveTimer?.cancel();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Gagal submit: $e")));
      setState(() => isSubmitting = false);
    }
  }

  String _formatTime(int s) {
    final m = s ~/ 60;
    final sec = s % 60;
    return "${m.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}";
  }

  @override
  void dispose() {
    timer?.cancel();
    autoSaveTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return Scaffold(appBar: AppBar(title: const Text("Ujian")), body: const Center(child: CircularProgressIndicator()));
    if (hasil != null) {
      final bisaRetake = ujian?["bisaRetake"] == true;
      final hasilSoal = (hasil!["hasilSoal"] as List?)?.cast<Map<String, dynamic>>() ?? [];
      return Scaffold(
        backgroundColor: AppColors.surface,
        appBar: AppBar(title: Text(ujian?["isLatihan"] == true ? "Hasil Latihan" : "Hasil Ujian")),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  Container(
                    width: 96,
                    height: 96,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: AppGradients.brand,
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: AppShadows.brand,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text("${hasil!["nilai"]}", style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800, color: Colors.white, height: 1.0)),
                        const SizedBox(height: 2),
                        Text("NILAI", style: TextStyle(fontSize: 9, letterSpacing: 1.2, color: Colors.white.withValues(alpha: 0.8), fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text("${hasil!["jumlahBenar"]}/${hasil!["jumlahSoal"]} benar • ${hasil!["perolehPoin"]}/${hasil!["totalPoin"]} poin", style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: AppColors.inkSoft)),
                  const SizedBox(height: 12),
                  ClipRRect(borderRadius: BorderRadius.circular(8), child: LinearProgressIndicator(value: (hasil!["nilai"] as int) / 100, minHeight: 8, backgroundColor: const Color(0xFFEFF1F8), color: (hasil!["nilai"] as int) >= 75 ? AppColors.success : (hasil!["nilai"] as int) >= 60 ? AppColors.warning : AppColors.danger)),
                  const SizedBox(height: 8),
                  Text((hasil!["nilai"] as int) >= 75 ? "Lulus" : "Belum lulus", style: TextStyle(fontSize: 12, color: (hasil!["nilai"] as int) >= 75 ? AppColors.success : AppColors.danger, fontWeight: FontWeight.w700)),
                ]),
              ),
            ),
            const SizedBox(height: 12),
            // Rincian per soal — benar / salah
            Row(children: [
              Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(20)), child: Row(children: [const Icon(Icons.check_circle, size: 14, color: AppColors.success), const SizedBox(width: 4), Text("${hasilSoal.where((e) => e["isCorrect"] == true).length} Benar", style: const TextStyle(fontSize: 11, color: AppColors.success, fontWeight: FontWeight.w600))])),
              const SizedBox(width: 8),
              Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: AppColors.danger.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(20)), child: Row(children: [const Icon(Icons.cancel, size: 14, color: AppColors.danger), const SizedBox(width: 4), Text("${hasilSoal.where((e) => e["isCorrect"] != true).length} Salah", style: const TextStyle(fontSize: 11, color: AppColors.danger, fontWeight: FontWeight.w600))])),
            ]),
            const SizedBox(height: 12),
            ...hasilSoal.map((h) {
              final isCorrect = h["isCorrect"] == true;
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: isCorrect ? AppColors.success.withValues(alpha: 0.3) : AppColors.danger.withValues(alpha: 0.3))),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(color: isCorrect ? AppColors.success.withValues(alpha: 0.12) : AppColors.danger.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                        child: Icon(isCorrect ? Icons.check : Icons.close, size: 14, color: isCorrect ? AppColors.success : AppColors.danger),
                      ),
                      const SizedBox(width: 8),
                      Text("Soal ${h["nomor"]}", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: isCorrect ? AppColors.success : const Color(0xFFEFF1F8), borderRadius: BorderRadius.circular(20)),
                        child: Text(isCorrect ? "+${h["poin"]}" : "0", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isCorrect ? Colors.white : AppColors.inkSoft)),
                      ),
                    ]),
                    const SizedBox(height: 8),
                    if (h["jawaban"] != null) ...[
                      Text("Jawaban Anda:", style: const TextStyle(fontSize: 10, color: AppColors.inkMuted, fontWeight: FontWeight.w600)),
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(top: 4),
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: isCorrect ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(8), border: Border.all(color: isCorrect ? const Color(0xFFBBF7D0) : const Color(0xFFFECACA))),
                        child: Text(h["jawaban"]?.toString().isEmpty ?? true ? "-" : h["jawaban"].toString(), style: TextStyle(fontSize: 12, color: isCorrect ? const Color(0xFF166534) : const Color(0xFF991B1B))),
                      ),
                    ],
                    if (!isCorrect) ...[
                      const SizedBox(height: 6),
                      Text("Kunci:", style: const TextStyle(fontSize: 10, color: AppColors.inkMuted, fontWeight: FontWeight.w600)),
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(top: 4),
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFBBF7D0))),
                        child: Text(h["jawabanBenar"]?.toString() ?? "-", style: const TextStyle(fontSize: 12, color: Color(0xFF166534))),
                      ),
                    ],
                  ]),
                ),
              );
            }),
            const SizedBox(height: 12),
            if (bisaRetake)
              SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: () => setState(() { hasil = null; hasStarted = false; showKonfirmasi = true; answers = {}; raguRagu = []; currentNomor = 1; }), icon: const Icon(Icons.refresh, size: 16), label: const Text("Kerjakan Lagi"))),
            const SizedBox(height: 10),
            SizedBox(width: double.infinity, child: OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text("Kembali ke Daftar"))),
            const SizedBox(height: 16),
          ],
        ),
      );
    }
    if (showKonfirmasi && ujian != null) {
      return Scaffold(
        body: AppBackdrop(
          child: Center(
            child: Container(
              margin: const EdgeInsets.all(20),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: AppColors.border),
                boxShadow: AppShadows.lift,
              ),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(gradient: AppGradients.indigo, borderRadius: BorderRadius.circular(18)),
                  child: const Icon(Icons.assignment_outlined, color: Colors.white, size: 26),
                ),
                const SizedBox(height: 14),
                Text(
                  ujian!["nama"] ?? "-",
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.ink, letterSpacing: -0.3),
                ),
                const SizedBox(height: 4),
                Text(
                  "${ujian!["mapel"] ?? ""} • ${ujian!["jumlahSoal"]} soal • ${ujian!["durasi"]} menit",
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: AppColors.inkMuted),
                ),
                const SizedBox(height: 14),
                const InfoBanner(
                  icon: Icons.timer_outlined,
                  text: "Timer berjalan begitu ujian dimulai dan jawaban tersimpan otomatis tiap 30 detik.",
                  color: AppColors.warning,
                ),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text("Batal"))),
                  const SizedBox(width: 10),
                  Expanded(child: FilledButton(onPressed: _start, child: const Text("Mulai"))),
                ]),
              ]),
            ),
          ),
        ),
      );
    }
    if (ujian == null) return Scaffold(appBar: AppBar(title: const Text("Ujian")), body: const Center(child: Text("Ujian tidak ditemukan")));
    final soalList = (ujian!["soal"] as List).cast<Map<String, dynamic>>();
    final currentSoal = soalList.firstWhere((s) => s["nomor"] == currentNomor, orElse: () => soalList.first);
    final answeredCount = answers.values.where((v) => v.trim().isNotEmpty).length;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 4,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(ujian!["nama"], maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            Text("${ujian!["mapel"]}", style: const TextStyle(fontSize: 11, color: AppColors.inkMuted)),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 14),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: waktuTersisa < 300 ? AppColors.danger : AppColors.primary,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [BoxShadow(color: (waktuTersisa < 300 ? AppColors.danger : AppColors.primary).withValues(alpha: 0.30), blurRadius: 12, offset: const Offset(0, 4))],
            ),
            child: Text(_formatTime(waktuTersisa), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12.5)),
          ),
        ],
      ),
      body: Column(
        children: [
          LinearProgressIndicator(value: answeredCount / (soalList.length), minHeight: 6),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 10, 4),
            child: Row(
              children: [
                Text("$answeredCount/${soalList.length} terjawab", style: const TextStyle(fontSize: 11.5, color: AppColors.inkMuted, fontWeight: FontWeight.w600)),
                const Spacer(),
                TextButton.icon(
                  onPressed: () => setState(() => showReview = true),
                  icon: const Icon(Icons.grid_view_rounded, size: 15),
                  label: const Text("Review", style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(8)),
                        child: Text("Soal ${currentSoal["nomor"]}", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5, color: AppColors.primary)),
                      ),
                      const Spacer(),
                      if (raguRagu.contains(currentSoal["id"]))
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(color: AppColors.warning.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                          child: const Text("Ragu-ragu", style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.warning)),
                        ),
                    ]),
                    const SizedBox(height: 10),
                    Text(currentSoal["pertanyaan"] ?? "", style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, height: 1.45, color: AppColors.ink)),
                    const SizedBox(height: 12),
                    if (currentSoal["jenisSoal"] == "PILIHAN_GANDA" && currentSoal["pilihanGanda"] is List)
                      ...((currentSoal["pilihanGanda"] as List).map((opt) {
                        final label = opt["label"] ?? "";
                        final text = opt["text"] ?? "";
                        final selected = answers[currentSoal["id"]] == label;
                        // Material (bukan Container berwarna) agar ripple ListTile tetap terlihat.
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Material(
                            color: selected ? AppColors.primarySoft : Colors.white,
                            clipBehavior: Clip.antiAlias,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                              side: BorderSide(color: selected ? AppColors.primary : AppColors.border, width: selected ? 1.5 : 1),
                            ),
                            child: RadioListTile<String>(
                              dense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                              title: Text("$label. $text", style: const TextStyle(fontSize: 13, color: AppColors.ink, height: 1.35)),
                              value: label,
                              groupValue: answers[currentSoal["id"]],
                              onChanged: (v) => setState(() => answers[currentSoal["id"]] = v!),
                            ),
                          ),
                        );
                      })),
                    if (currentSoal["jenisSoal"] == "ESSAY")
                      TextField(
                        controller: TextEditingController(text: answers[currentSoal["id"]] ?? ""),
                        onChanged: (v) => answers[currentSoal["id"]] = v,
                        maxLines: 5,
                        decoration: const InputDecoration(hintText: "Tulis jawaban…"),
                      ),
                    if (currentSoal["jenisSoal"] == "ISIAN_SINGKAT")
                      TextField(
                        controller: TextEditingController(text: answers[currentSoal["id"]] ?? ""),
                        onChanged: (v) => answers[currentSoal["id"]] = v,
                        decoration: const InputDecoration(hintText: "Jawaban singkat…"),
                      ),
                  ]),
                ),
              ),
            ),
          ),
          if (showReview)
            Container(
              color: Colors.black.withValues(alpha: 0.45),
              child: Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: AppShadows.lift,
                ),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Text("Review Jawaban", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.ink)),
                    const SizedBox(height: 8),
                    Wrap(spacing: 8, runSpacing: 8, children: soalList.map((s) {
                      final id = s["id"] as String;
                      final isAnswered = answers[id]?.trim().isNotEmpty ?? false;
                      final isRagu = raguRagu.contains(id);
                      Color c = const Color(0xFFEFF1F8);
                      Color fg = AppColors.inkMuted;
                      if (isAnswered && isRagu) {
                        c = AppColors.warning.withValues(alpha: 0.18);
                        fg = AppColors.warning;
                      } else if (isAnswered) {
                        c = AppColors.success.withValues(alpha: 0.16);
                        fg = AppColors.success;
                      }
                      final aktif = currentNomor == s["nomor"];
                      return InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () => setState(() { currentNomor = s["nomor"]; showReview = false; }),
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: c,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: aktif ? AppColors.primary : Colors.transparent, width: 2),
                          ),
                          child: Center(child: Text("${s["nomor"]}", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: fg))),
                        ),
                      );
                    }).toList()),
                    const SizedBox(height: 14),
                    Row(children: [
                      Expanded(child: OutlinedButton(onPressed: () => setState(() => showReview = false), child: const Text("Lanjut"))),
                      const SizedBox(width: 10),
                      Expanded(child: FilledButton(onPressed: isSubmitting ? null : _submit, child: isSubmitting ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text("Kumpulkan"))),
                    ]),
                  ]),
                ),
              ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.border)),
          boxShadow: [BoxShadow(color: Color(0x141E1B4B), blurRadius: 20, offset: Offset(0, -6))],
        ),
        child: Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: currentNomor > 1 ? () => setState(() => currentNomor--) : null,
              style: _tombolNavigasi,
              icon: const Icon(Icons.chevron_left, size: 16),
              label: const Text("Sebelum"),
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: () {
              final id = currentSoal["id"] as String;
              setState(() { if (raguRagu.contains(id)) raguRagu.remove(id); else raguRagu.add(id); });
            },
            style: _tombolNavigasi.copyWith(
              foregroundColor: WidgetStatePropertyAll(raguRagu.contains(currentSoal["id"]) ? AppColors.warning : AppColors.inkSoft),
            ),
            child: Text(
              raguRagu.contains(currentSoal["id"]) ? "Batal Ragu" : "Ragu",
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: FilledButton.icon(
              onPressed: currentNomor < soalList.length ? () => setState(() => currentNomor++) : () => setState(() => showReview = true),
              style: FilledButton.styleFrom(minimumSize: const Size(0, 48), padding: const EdgeInsets.symmetric(horizontal: 8), textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              icon: Icon(currentNomor < soalList.length ? Icons.chevron_right : Icons.send, size: 16),
              label: Text(currentNomor < soalList.length ? "Lanjut" : "Review", maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
          ),
        ]),
      ),
    );
  }
}
