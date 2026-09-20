import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class UjianDetail extends StatefulWidget {
  final String ujianId;
  const UjianDetail({super.key, required this.ujianId});
  @override
  State<UjianDetail> createState() => _UjianDetailState();
}

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
    // Auto-save tiap 30 detik
    Timer.periodic(const Duration(seconds: 30), (t) {
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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return Scaffold(appBar: AppBar(title: const Text("Ujian")), body: const Center(child: CircularProgressIndicator()));
    if (hasil != null) {
      final bisaRetake = ujian?["bisaRetake"] == true;
      return Scaffold(
        appBar: AppBar(title: const Text("Hasil Ujian")),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
              Text("${hasil!["nilai"]}", style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: Color(0xFF4F46E5))),
              Text("${hasil!["jumlahBenar"]}/${hasil!["jumlahSoal"]} benar • ${hasil!["perolehPoin"]}/${hasil!["totalPoin"]} poin"),
              const SizedBox(height: 12),
              LinearProgressIndicator(value: (hasil!["nilai"] as int) / 100, minHeight: 8),
            ]))),
            const SizedBox(height: 12),
            if (bisaRetake)
              SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: () => setState(() { hasil = null; hasStarted = false; showKonfirmasi = true; answers = {}; raguRagu = []; currentNomor = 1; }), icon: const Icon(Icons.refresh, size: 16), label: const Text("Kerjakan Lagi"))),
            SizedBox(width: double.infinity, child: OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text("Kembali"))),
          ]),
        ),
      );
    }
    if (showKonfirmasi && ujian != null) {
      return Scaffold(
        body: Center(
          child: Card(
            margin: const EdgeInsets.all(16),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text(ujian!["nama"] ?? "-", style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                Text("${ujian!["mapel"] ?? ""} • ${ujian!["jumlahSoal"]} soal • ${ujian!["durasi"]} menit"),
                const SizedBox(height: 12),
                const Text("Siap memulai? Timer akan langsung jalan.", style: TextStyle(fontSize: 12, color: Colors.black54)),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text("Batal"))),
                  const SizedBox(width: 8),
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
        title: Column(children: [Text(ujian!["nama"], style: const TextStyle(fontSize: 14)), Text("${ujian!["mapel"]}", style: const TextStyle(fontSize: 11, color: Colors.black54))]),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: waktuTersisa < 300 ? Colors.red : const Color(0xFF4F46E5), borderRadius: BorderRadius.circular(8)),
            child: Text(_formatTime(waktuTersisa), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
          ),
        ],
      ),
      body: Column(
        children: [
          LinearProgressIndicator(value: answeredCount / (soalList.length), minHeight: 4),
          Padding(padding: const EdgeInsets.all(12), child: Row(children: [Text("$answeredCount/${soalList.length} terjawab", style: const TextStyle(fontSize: 11, color: Colors.black54)), const Spacer(), TextButton(onPressed: () => setState(() => showReview = true), child: const Text("Review", style: TextStyle(fontSize: 12)))])),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Text("Soal ${currentSoal["nomor"]}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black54)),
                      const Spacer(),
                      if (raguRagu.contains(currentSoal["id"])) Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: Colors.amber.shade100, borderRadius: BorderRadius.circular(8)), child: const Text("Ragu-ragu", style: TextStyle(fontSize: 10, color: Colors.orange))),
                    ]),
                    const SizedBox(height: 8),
                    Text(currentSoal["pertanyaan"] ?? "", style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 12),
                    if (currentSoal["jenisSoal"] == "PILIHAN_GANDA" && currentSoal["pilihanGanda"] is List)
                      ...((currentSoal["pilihanGanda"] as List).map((opt) {
                        final label = opt["label"] ?? "";
                        final text = opt["text"] ?? "";
                        final selected = answers[currentSoal["id"]] == label;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(border: Border.all(color: selected ? const Color(0xFF4F46E5) : const Color(0xFFE2E8F0)), borderRadius: BorderRadius.circular(10), color: selected ? const Color(0xFFEEF2FF) : Colors.white),
                          child: RadioListTile<String>(
                            title: Text("$label. $text", style: const TextStyle(fontSize: 13)),
                            value: label,
                            groupValue: answers[currentSoal["id"]],
                            onChanged: (v) => setState(() => answers[currentSoal["id"]] = v!),
                          ),
                        );
                      })),
                    if (currentSoal["jenisSoal"] == "ESSAY")
                      TextField(
                        controller: TextEditingController(text: answers[currentSoal["id"]] ?? ""),
                        onChanged: (v) => answers[currentSoal["id"]] = v,
                        maxLines: 5,
                        decoration: const InputDecoration(hintText: "Tulis jawaban...", border: OutlineInputBorder()),
                      ),
                    if (currentSoal["jenisSoal"] == "ISIAN_SINGKAT")
                      TextField(
                        controller: TextEditingController(text: answers[currentSoal["id"]] ?? ""),
                        onChanged: (v) => answers[currentSoal["id"]] = v,
                        decoration: const InputDecoration(hintText: "Jawaban singkat...", border: OutlineInputBorder()),
                      ),
                  ]),
                ),
              ),
            ),
          ),
          if (showReview)
            Container(
              color: Colors.black54,
              child: Card(
                margin: const EdgeInsets.all(16),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(children: [
                    const Text("Review Jawaban", style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Wrap(spacing: 8, runSpacing: 8, children: soalList.map((s) {
                      final id = s["id"] as String;
                      final isAnswered = answers[id]?.trim().isNotEmpty ?? false;
                      final isRagu = raguRagu.contains(id);
                      Color c = Colors.grey.shade200;
                      if (isAnswered && isRagu) c = Colors.orange.shade200;
                      else if (isAnswered) c = Colors.green.shade200;
                      return InkWell(
                        onTap: () => setState(() { currentNomor = s["nomor"]; showReview = false; }),
                        child: Container(width: 40, height: 40, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(8), border: Border.all(color: currentNomor == s["nomor"] ? const Color(0xFF4F46E5) : Colors.transparent, width: 2)), child: Center(child: Text("${s["nomor"]}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)))),
                      );
                    }).toList()),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: OutlinedButton(onPressed: () => setState(() => showReview = false), child: const Text("Lanjut"))),
                      const SizedBox(width: 8),
                      Expanded(child: FilledButton(onPressed: isSubmitting ? null : _submit, child: isSubmitting ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text("Kumpulkan"))),
                    ]),
                  ]),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFE2E8F0)))),
        child: Row(children: [
          Expanded(child: OutlinedButton.icon(onPressed: currentNomor > 1 ? () => setState(() => currentNomor--) : null, icon: const Icon(Icons.chevron_left, size: 16), label: const Text("Sebelum"))),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: () {
              final id = currentSoal["id"] as String;
              setState(() { if (raguRagu.contains(id)) raguRagu.remove(id); else raguRagu.add(id); });
            },
            style: OutlinedButton.styleFrom(foregroundColor: raguRagu.contains(currentSoal["id"]) ? Colors.orange : null),
            child: Text(raguRagu.contains(currentSoal["id"]) ? "Batal Ragu" : "Ragu"),
          ),
          const SizedBox(width: 8),
          Expanded(child: FilledButton.icon(onPressed: currentNomor < soalList.length ? () => setState(() => currentNomor++) : () => setState(() => showReview = true), icon: Icon(currentNomor < soalList.length ? Icons.chevron_right : Icons.send, size: 16), label: Text(currentNomor < soalList.length ? "Lanjut" : "Review"))),
        ]),
      ),
    );
  }
}
