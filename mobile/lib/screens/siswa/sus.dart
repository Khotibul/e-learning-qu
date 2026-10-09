import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Evaluasi kelayakan sistem (SUS) — 10 pertanyaan, skor 0-100 + hasil agregat.
/// Mirror web /siswa/sus-evaluation (submitSUSSurvey/getSUSResults).
class SiswaSus extends StatefulWidget {
  const SiswaSus({super.key});
  @override
  State<SiswaSus> createState() => _SiswaSusState();
}

const _questions = [
  "Saya berpikir ingin menggunakan sistem ini secara sering",
  "Saya menemukan sistem ini tidak perlu rumit",
  "Saya berpikir sistem ini mudah digunakan",
  "Saya berpikir saya akan membutuhkan bantuan teknis untuk menggunakan sistem ini",
  "Saya menemukan berbagai fungsi dalam sistem ini terintegrasi dengan baik",
  "Saya menemukan terlalu banyak ketidaksesuaian dalam sistem ini",
  "Sebagian besar orang akan belajar menggunakan sistem ini dengan cepat",
  "Saya menemukan sistem ini sangat rumit untuk digunakan",
  "Saya merasa sangat percaya diri menggunakan sistem ini",
  "Saya harus belajar banyak hal sebelum menggunakan sistem ini",
];

const _labels = ["Sangat Tidak Setuju", "Tidak Setuju", "Netral", "Setuju", "Sangat Setuju"];

int? _calcScore(List<int> jawaban) {
  if (jawaban.any((v) => v <= 0)) return null;
  int odd = 0, even = 0;
  for (final i in [0, 2, 4, 6, 8]) {
    odd += jawaban[i] - 1;
  }
  for (final i in [1, 3, 5, 7, 9]) {
    even += 5 - jawaban[i];
  }
  return ((odd + even) * 2.5).round();
}

String _interpretation(int skor) {
  if (skor >= 80) return "Excellent";
  if (skor >= 68) return "Good";
  if (skor >= 50) return "OK";
  if (skor >= 25) return "Poor";
  return "Terrible";
}

class _SiswaSusState extends State<SiswaSus> {
  final jawaban = List<int>.filled(10, 0);
  final komentarCtrl = TextEditingController();
  bool loading = true;
  bool submitting = false;
  bool submitted = false;
  Map<String, dynamic>? hasil;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/siswa/sus", useCache: false);
      if (mounted) setState(() { hasil = v is Map ? Map<String, dynamic>.from(v) : null; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _submit() async {
    final skor = _calcScore(jawaban);
    if (skor == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Semua 10 pertanyaan wajib dijawab"), backgroundColor: Color(0xFFEF4444)));
      return;
    }
    setState(() => submitting = true);
    try {
      await ApiService.post("/api/mobile/siswa/sus", {"jawaban": jawaban, "komentar": komentarCtrl.text.trim()});
      if (!mounted) return;
      setState(() { submitted = true; jawaban.fillRange(0, 10, 0); komentarCtrl.clear(); });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Terkirim! Skor Anda: $skor (${_interpretation(skor)})")));
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Gagal: $e"), backgroundColor: const Color(0xFFEF4444)));
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  void dispose() { komentarCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final skor = _calcScore(jawaban);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text("Evaluasi SUS"),
          backgroundColor: Colors.white,
          elevation: 0,
          bottom: const TabBar(labelColor: Color(0xFF0F172A), unselectedLabelColor: Colors.black45, tabs: [Tab(text: "Isi Survei"), Tab(text: "Hasil")]),
        ),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(children: [
                _buildForm(skor),
                _buildHasil(),
              ]),
      ),
    );
  }

  Widget _buildForm(int? skor) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text("System Usability Scale", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 4),
            const Text("Jawab 10 pernyataan dengan skala 1-5. Skor SUS (0-100) dihitung otomatis.", style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            if (skor != null) ...[
              const SizedBox(height: 10),
              Row(children: [
                Text("$skor", style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                const SizedBox(width: 8),
                Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: const Color(0xFF0EA5E9).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)), child: Text(_interpretation(skor), style: const TextStyle(fontSize: 11, color: Color(0xFF0EA5E9), fontWeight: FontWeight.w700))),
              ]),
            ],
          ]),
        ),
      ),
      const SizedBox(height: 8),
      ...List.generate(10, (i) => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text("${i + 1}. ${_questions[i]}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            RadioGroup<int>(
              groupValue: jawaban[i],
              onChanged: (v) => setState(() => jawaban[i] = v ?? 0),
              child: Column(children: List.generate(5, (l) => RadioListTile<int>(
                value: l + 1,
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(_labels[l], style: const TextStyle(fontSize: 12)),
              ))),
            ),
          ]),
        ),
      )),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: TextField(
            controller: komentarCtrl,
            maxLines: 3,
            decoration: const InputDecoration(labelText: "Komentar (opsional)", border: OutlineInputBorder(), isDense: true),
          ),
        ),
      ),
      const SizedBox(height: 12),
      FilledButton.icon(
        onPressed: submitting ? null : _submit,
        icon: submitting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.send, size: 16),
        label: const Text("Kirim Survei"),
      ),
      if (submitted) ...[
        const SizedBox(height: 8),
        const Text("Terima kasih — jawaban Anda telah direkam.", style: TextStyle(fontSize: 12, color: Color(0xFF10B981))),
      ],
      const SizedBox(height: 24),
    ],
  );

  Widget _buildHasil() {
    if (hasil == null) return const Center(child: Text("Gagal memuat hasil", style: TextStyle(color: Colors.black54)));
    final total = (hasil!["total"] as num?) ?? 0;
    final average = (hasil!["average"] as num?) ?? 0;
    final dist = (hasil!["distribusi"] as Map<String, dynamic>?) ?? {};
    final entries = [
      ("Excellent", dist["excellent"] ?? 0, const Color(0xFF10B981)),
      ("Good", dist["good"] ?? 0, const Color(0xFF0EA5E9)),
      ("OK", dist["ok"] ?? 0, const Color(0xFFF59E0B)),
      ("Poor", dist["poor"] ?? 0, const Color(0xFFF97316)),
      ("Terrible", dist["terrible"] ?? 0, const Color(0xFFEF4444)),
    ];
    final maxV = entries.map((e) => (e.$2 as num).toInt()).fold<int>(1, (a, b) => b > a ? b : a);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text("Rata-rata Skor SUS", style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                Text("$average / 100", style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                if (total > 0) Text(_interpretation(average.toInt()), style: const TextStyle(fontSize: 12, color: Color(0xFF10B981), fontWeight: FontWeight.w600)),
              ])),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text("Total Respons", style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                Text("$total", style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                const Text("lintas seluruh siswa", style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              ])),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text("Distribusi Skor", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 12),
              ...entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Text(e.$1, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    const Spacer(),
                    Text("${e.$2}", style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  ]),
                  const SizedBox(height: 4),
                  ClipRRect(borderRadius: BorderRadius.circular(6), child: LinearProgressIndicator(value: total > 0 ? (e.$2 as num) / maxV : 0, minHeight: 7, backgroundColor: const Color(0xFFE2E8F0), color: e.$3)),
                ]),
              )),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        const Card(child: Padding(padding: EdgeInsets.all(14), child: Text("Skor SUS: ≥80 Excellent • 68-79 Good • 50-67 OK • 25-49 Poor • <25 Terrible. Rincian jawaban per siswa hanya untuk admin/guru (privasi).", style: TextStyle(fontSize: 11, color: Color(0xFF64748B))))),
        const SizedBox(height: 24),
      ],
    );
  }
}
