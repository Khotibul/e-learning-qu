import "package:flutter/material.dart";
import "../../services/api_service.dart";

class SiswaProfilBelajar extends StatefulWidget {
  const SiswaProfilBelajar({super.key});
  @override
  State<SiswaProfilBelajar> createState() => _SiswaProfilBelajarState();
}

class _SiswaProfilBelajarState extends State<SiswaProfilBelajar> {
  Map<String, dynamic>? model;
  Map<String, dynamic>? penguasaan;
  Map<String, dynamic>? jalur;
  Map<String, dynamic>? warnings;
  bool loading = true;
  bool runningWarning = false;
  String? explanation;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.get("/api/mobile/siswa/profil-belajar");
      if (mounted) {
        setState(() {
          model = v is Map ? v["model"] as Map<String, dynamic>? : null;
          penguasaan = v is Map ? v["penguasaan"] as Map<String, dynamic>? : null;
          jalur = v is Map ? v["jalur"] as Map<String, dynamic>? : null;
          warnings = v is Map ? v["warnings"] as Map<String, dynamic>? : null;
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _runWarning() async {
    setState(() => runningWarning = true);
    try {
      final v = await ApiService.post("/api/mobile/siswa/profil-belajar", {});
      if (mounted && v is Map) setState(() => warnings = v["warnings"] as Map<String, dynamic>?);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Early warning selesai dijalankan")));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Gagal menjalankan early warning")));
    } finally {
      if (mounted) setState(() => runningWarning = false);
    }
  }

  Color _kategoriColor(String kat) => switch (kat) {
        "ADVANCED" => const Color(0xFF10B981),
        "PROFICIENT" => const Color(0xFF3B82F6),
        "DEVELOPING" => const Color(0xFFF59E0B),
        "BASIC" => const Color(0xFFF97316),
        "BEGINNER" => const Color(0xFFF87171),
        _ => Colors.grey,
      };

  Color _severityColor(String s) => switch (s) {
        "CRITICAL" => Colors.red,
        "HIGH" => Colors.orange,
        "MEDIUM" => Colors.amber,
        _ => Colors.blueGrey,
      };

  Widget _metricBar(String label, double value) {
    final pct = (value * 100).round();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: const TextStyle(fontSize: 13, color: Colors.black54)),
        Text("$pct%", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
      ]),
      const SizedBox(height: 4),
      ClipRRect(borderRadius: BorderRadius.circular(8), child: LinearProgressIndicator(value: value.clamp(0, 1), minHeight: 8, backgroundColor: const Color(0xFFE2E8F0))),
    ]);
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: 4,
        child: Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          appBar: AppBar(
            title: const Text("Profil Belajar"),
            backgroundColor: Colors.white,
            elevation: 0,
            bottom: const TabBar(
              isScrollable: true,
              labelColor: Color(0xFF2563EB),
              unselectedLabelColor: Colors.black54,
              tabs: [
                Tab(text: "Profil"),
                Tab(text: "Penguasaan"),
                Tab(text: "Jalur"),
                Tab(text: "Peringatan"),
              ],
            ),
          ),
          body: loading
              ? const Center(child: CircularProgressIndicator())
              : TabBarView(
                  children: [
                    _tabProfil(),
                    _tabPenguasaan(),
                    _tabJalur(),
                    _tabPeringatan(),
                  ],
                ),
        ),
      );

  Widget _tabProfil() {
    final p = model?["profile"] as Map<String, dynamic>? ?? {};
    final gaya = (p["gayaBelajar"] ?? "CAMPURAN") as String;
    final rataNilai = p["rataNilai"] ?? 0;
    final streak = p["streak"] ?? 0;
    final trend = (p["trendNilai"] ?? "stabil") as String;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text("Gaya Belajar & Konsistensi", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text("Gaya Belajar", style: TextStyle(fontSize: 12, color: Colors.black54)),
              const SizedBox(height: 4),
              Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: const Color(0xFFDBEAFE), borderRadius: BorderRadius.circular(999)), child: Text(gaya, style: const TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600, fontSize: 12))),
            ])),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text("Rata-rata Nilai", style: TextStyle(fontSize: 12, color: Colors.black54)),
              Text("$rataNilai/100", style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
            ])),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text("Streak Belajar", style: TextStyle(fontSize: 12, color: Colors.black54)),
              Row(children: [
                const Icon(Icons.local_fire_department, color: Colors.orange, size: 20),
                const SizedBox(width: 4),
                Text("$streak hari", style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ]),
            ])),
          ]),
          const SizedBox(height: 8),
          Text("Tren nilai: $trend", style: const TextStyle(fontSize: 12, color: Colors.black54)),
        ]))),
        const SizedBox(height: 12),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text("Metrik Aktivitas", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 12),
          _metricBar("Motivasi", ((p["motivasi"] ?? 0) as num).toDouble()),
          const SizedBox(height: 10),
          _metricBar("Engagement", ((p["engagementScore"] ?? 0) as num).toDouble()),
          const SizedBox(height: 10),
          _metricBar("Konsistensi", ((p["konsistensi"] ?? 0) as num).toDouble()),
        ]))),
      ]),
    );
  }

  Widget _tabPenguasaan() {
    if (penguasaan == null || (penguasaan!["total"] ?? 0) == 0) {
      return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text("Belum ada data penguasaan kompetensi. Kerjakan ujian atau latihan terlebih dahulu.", textAlign: TextAlign.center, style: TextStyle(color: Colors.black54))));
    }
    final distribusi = (penguasaan!["distribusi"] as Map<String, dynamic>? ?? {});
    final list = (penguasaan!["penguasaan"] as List? ?? []);
    final total = (penguasaan!["total"] as num?) ?? 0;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text("Distribusi Penguasaan — rata-rata ${penguasaan!["rataSkor"] ?? 0}% • $total kompetensi", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 12),
          for (final kat in ["ADVANCED", "PROFICIENT", "DEVELOPING", "BASIC", "BEGINNER"]) ...[
            Row(children: [
              SizedBox(width: 92, child: Text(kat, style: const TextStyle(fontSize: 11, color: Colors.black54))),
              Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(8), child: LinearProgressIndicator(value: total > 0 ? ((distribusi[kat] ?? 0) as num) / total : 0, minHeight: 8, backgroundColor: const Color(0xFFE2E8F0), color: _kategoriColor(kat)))),
              SizedBox(width: 56, child: Text("${distribusi[kat] ?? 0}", textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
            ]),
            const SizedBox(height: 8),
          ],
        ]))),
        const SizedBox(height: 12),
        for (final item in list)
          Card(child: ListTile(
            dense: true,
            title: Text("${(item as Map)["kode"] ?? ""} — ${item["kompetensi"] ?? "-"}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            subtitle: Text(item["mapel"] ?? "", style: const TextStyle(fontSize: 11)),
            trailing: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: _kategoriColor("${item["kategori"]}").withValues(alpha: .15), borderRadius: BorderRadius.circular(999)), child: Text("${item["skor"]}%", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _kategoriColor("${item["kategori"]}")))),
          )),
      ]),
    );
  }

  Widget _tabJalur() {
    if (jalur == null) return const Center(child: CircularProgressIndicator());
    final items = (jalur!["items"] as List? ?? []);
    if (items.isEmpty) {
      return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text("Belum ada jalur belajar. Kerjakan beberapa ujian atau latihan terlebih dahulu.", textAlign: TextAlign.center, style: TextStyle(color: Colors.black54))));
    }
    final progres = ((jalur!["progres"] ?? 0) as num).toDouble();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text("Jalur Belajar Adaptif — progres ${progres.round()}%", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 10),
          ClipRRect(borderRadius: BorderRadius.circular(8), child: LinearProgressIndicator(value: (progres / 100).clamp(0, 1), minHeight: 10, backgroundColor: const Color(0xFFE2E8F0))),
        ]))),
        const SizedBox(height: 12),
        for (var i = 0; i < items.length; i++)
          Card(child: ListTile(
            dense: true,
            leading: CircleAvatar(radius: 12, backgroundColor: const Color(0xFFEFF6FF), child: Text("${i + 1}", style: const TextStyle(fontSize: 11, color: Color(0xFF2563EB)))),
            title: Text("${(items[i] as Map)["materi"] is Map ? (items[i]["materi"]["judul"] ?? items[i]["jenis"]) : items[i]["kompetensi"] is Map ? items[i]["kompetensi"]["nama"] : items[i]["jenis"]}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            trailing: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: items[i]["status"] == "SELESAI" ? const Color(0xFFD1FAE5) : items[i]["status"] == "SEDANG" ? const Color(0xFFDBEAFE) : const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(999)), child: Text("${items[i]["status"] ?? "PENDING"}", style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: items[i]["status"] == "SELESAI" ? const Color(0xFF047857) : items[i]["status"] == "SEDANG" ? const Color(0xFF1D4ED8) : Colors.black54))),
          )),
      ]),
    );
  }

  Widget _tabPeringatan() {
    final w = warnings;
    final list = (w?["warnings"] as List? ?? []);
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text("Early Warning System", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          OutlinedButton.icon(
            onPressed: runningWarning ? null : _runWarning,
            icon: runningWarning ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.shield_outlined, size: 16),
            label: Text(runningWarning ? "Menjalankan..." : "Jalankan Ulang", style: const TextStyle(fontSize: 12)),
          ),
        ]),
        const SizedBox(height: 12),
        if (w != null && (w["total"] ?? 0) > 0)
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text("${w["total"]} peringatan aktif", style: const TextStyle(fontWeight: FontWeight.w700)),
            if ((w["critical"] ?? 0) > 0) Text("${w["critical"]} kritis", style: const TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.w600)),
            if ((w["high"] ?? 0) > 0) Text("${w["high"]} tinggi", style: TextStyle(color: Colors.orange.shade700, fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            for (final item in list)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(border: Border.all(color: const Color(0xFFE2E8F0)), borderRadius: BorderRadius.circular(10)),
                child: Row(children: [
                  Icon(Icons.warning_amber_rounded, size: 18, color: _severityColor("${(item as Map)["severity"]}")),
                  const SizedBox(width: 8),
                  Expanded(child: Text("${item["message"]}", style: const TextStyle(fontSize: 12))),
                  Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: _severityColor("${item["severity"]}").withValues(alpha: .12), borderRadius: BorderRadius.circular(999)), child: Text("${item["severity"]}", style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _severityColor("${item["severity"]}")))),
                ]),
              ),
          ]))),
        if (w != null && (w["total"] ?? 0) == 0)
          const Card(child: Padding(padding: EdgeInsets.all(24), child: Column(children: [
            Icon(Icons.shield, color: Colors.green, size: 32),
            SizedBox(height: 8),
            Text("Tidak ada peringatan aktif", textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w600)),
            Text("Status belajar kamu aman", textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.black54)),
          ]))),
        if (w == null) const Center(child: Padding(padding: EdgeInsets.all(24), child: Text("Gagal memuat peringatan", style: TextStyle(color: Colors.black54)))),
      ]),
    );
  }
}
