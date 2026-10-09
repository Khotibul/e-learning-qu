import 'package:flutter/material.dart';
import '../../services/api_service.dart';

/// Absensi siswa: kehadiran hari ini (fingerprint), rekap bulanan,
/// riwayat per mapel, dan pengajuan verifikasi manual (POST /api/mobile/siswa/kehadiran).
class SiswaAbsensiHarian extends StatefulWidget {
  const SiswaAbsensiHarian({super.key});
  @override
  State<SiswaAbsensiHarian> createState() => _SiswaAbsensiHarianState();
}

class _SiswaAbsensiHarianState extends State<SiswaAbsensiHarian> {
  List<dynamic> _raw = [];
  Map<String, dynamic> _kehadiran = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final end = DateTime.now().toIso8601String().split("T")[0];
    final start = DateTime.now().subtract(const Duration(days: 30)).toIso8601String().split("T")[0];
    try {
      final r = await Future.wait([
        ApiService.getAbsensi(start: start, end: end),
        ApiService.get("/api/mobile/siswa/kehadiran", useCache: false),
      ]);
      setState(() {
        _raw = r[0];
        if (r[1] is Map) _kehadiran = Map<String, dynamic>.from(r[1] as Map);
        _loading = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }

  String _ymd(DateTime d) => d.toIso8601String().split("T")[0];

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  Future<void> _ajukanManual() async {
    DateTime tgl = DateTime.now();
    String tipe = "MASUK";
    final alasan = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
        title: const Text("Ajukan Absensi Manual"),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Expanded(child: Text("Tanggal: ${_ymd(tgl)}")),
            TextButton(onPressed: () async {
              final d = await showDatePicker(context: ctx, initialDate: tgl, firstDate: DateTime.now().subtract(const Duration(days: 60)), lastDate: DateTime.now());
              if (d != null) setDlg(() => tgl = d);
            }, child: const Text("Ubah")),
          ]),
          const SizedBox(height: 4),
          SegmentedButton<String>(
            segments: const [ButtonSegment(value: "MASUK", label: Text("Masuk")), ButtonSegment(value: "PULANG", label: Text("Pulang"))],
            selected: {tipe},
            onSelectionChanged: (v) => setDlg(() => tipe = v.first),
          ),
          const SizedBox(height: 12),
          TextField(controller: alasan, maxLines: 3, decoration: const InputDecoration(labelText: "Alasan (wajib)", border: OutlineInputBorder())),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Kirim")),
        ],
      )),
    );
    if (ok != true) return;
    if (alasan.text.trim().isEmpty) { _snack("Alasan wajib diisi", color: const Color(0xFFEF4444)); return; }
    try {
      await ApiService.post("/api/mobile/siswa/kehadiran", {"tanggal": _ymd(tgl), "tipe": tipe, "alasan": alasan.text.trim()});
      _snack("Pengajuan terkirim — menunggu verifikasi admin");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Widget _todayCard() {
    final pol = _kehadiran["kebijakan"] as Map?;
    final today = _kehadiran["hariIni"] as Map?;
    final rekap = _kehadiran["rekap"] as Map?;
    final masuk = today?["statusMasuk"]?.toString();
    final pulang = today?["statusPulang"]?.toString();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.fingerprint, color: Color(0xFF4F46E5), size: 18),
            const SizedBox(width: 8),
            const Text("Kehadiran Hari Ini", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            const Spacer(),
            if (pol != null) Text("Masuk ${pol["jamMasuk"]} • Pulang ${pol["jamPulang"]}", style: const TextStyle(fontSize: 10, color: Colors.black54)),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _pill("Masuk", today?["jamMasuk"]?.toString() ?? "-", masuk)),
            const SizedBox(width: 8),
            Expanded(child: _pill("Pulang", today?["jamPulang"]?.toString() ?? "-", pulang)),
          ]),
          if (rekap != null) ...[
            const SizedBox(height: 10),
            Row(children: [
              _mini("Hadir", "${rekap["hadir"] ?? 0}"),
              _mini("Terlambat", "${rekap["terlambat"] ?? 0}"),
              _mini("Pulang Awal", "${rekap["pulangAwal"] ?? 0}"),
              _mini("Bulan Ini", "${rekap["persenKehadiran"] ?? 0}%"),
            ]),
          ],
        ]),
      ),
    );
  }

  Widget _pill(String label, String jam, String? status) {
    final st = (status ?? "").toUpperCase();
    final Color c = st == "HADIR" || st == "NORMAL" ? const Color(0xFF10B981) : st == "TERLAMBAT" || st == "AWAL" ? const Color(0xFFF59E0B) : Colors.black38;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12), border: Border.all(color: c.withValues(alpha: 0.3))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.black54)),
        const SizedBox(height: 2),
        Text(jam, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: c)),
        Text(st.isEmpty ? "BELUM" : st, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: c)),
      ]),
    );
  }

  Widget _mini(String label, String value) => Expanded(
        child: Column(children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF4F46E5))),
          Text(label, style: const TextStyle(fontSize: 9, color: Colors.black54), textAlign: TextAlign.center),
        ]),
      );

  Widget _permintaanSection() {
    final list = (_kehadiran["permintaan"] as List?) ?? [];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.how_to_reg_outlined, size: 16, color: Color(0xFF0EA5E9)),
            const SizedBox(width: 6),
            const Text("Pengajuan Manual", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            const Spacer(),
            FilledButton.tonal(onPressed: _ajukanManual, child: const Text("+ Ajukan")),
          ]),
          const SizedBox(height: 6),
          if (list.isEmpty) const Text("Belum ada pengajuan", style: TextStyle(fontSize: 12, color: Colors.black45)),
          ...list.map((raw) {
            final p = raw as Map;
            final st = (p["status"] ?? "").toString();
            final Color c = st == "DISETUJUI" ? const Color(0xFF10B981) : st == "DITOLAK" ? const Color(0xFFEF4444) : const Color(0xFFF59E0B);
            return ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: Icon(p["tipe"] == "MASUK" ? Icons.login : Icons.logout, size: 18, color: c),
              title: Text("${p["tanggal"]} • ${p["tipe"]}", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              subtitle: Text("${p["alasan"] ?? "-"}${p["catatanAdmin"] != null && p["catatanAdmin"].toString().isNotEmpty ? " • ${p["catatanAdmin"]}" : ""}", style: const TextStyle(fontSize: 11)),
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                child: Text(st, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: c)),
              ),
            );
          }),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text("Absensi Harian"), backgroundColor: Colors.white, elevation: 0),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    // Group by tanggal (riwayat per mapel)
    final map = <String, List<dynamic>>{};
    for (final r in _raw) {
      final key = DateTime.parse(r["tanggal"]).toIso8601String().split("T")[0];
      map.putIfAbsent(key, () => []).add(r);
    }
    final entries = map.entries.toList()..sort((a,b) => b.key.compareTo(a.key));
    final totalHari = entries.length;
    final hadirPenuh = entries.where((e) => e.value.every((x) => x["status"] == "HADIR")).length;

    return Scaffold(
      appBar: AppBar(title: const Text("Absensi Harian"), backgroundColor: Colors.white, elevation: 0),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_kehadiran.isNotEmpty) ...[
              _todayCard(),
              const SizedBox(height: 12),
              _permintaanSection(),
              const SizedBox(height: 16),
            ],
            const Text("Rekap Per Mapel", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            const SizedBox(height: 8),
            Row(children: [
              _StatCard(label: "Total Hari", value: "$totalHari", sub: "hari berjadwal"),
              const SizedBox(width: 8),
              _StatCard(label: "Hadir Penuh", value: "$hadirPenuh", sub: "dari $totalHari", color: Colors.green),
              const SizedBox(width: 8),
              _StatCard(label: "Persentase", value: totalHari>0 ? "${((hadirPenuh/totalHari)*100).round()}%" : "0%", sub: "rata harian"),
            ]),
            const SizedBox(height: 12),
            const Text("Persentase = HADIR ÷ total pelajaran hari itu × 100%", style: TextStyle(fontSize: 11, color: Colors.black54)),
            const SizedBox(height: 12),
            ...entries.map((e) {
              final total = e.value.length;
              final hadir = e.value.where((x) => x["status"] == "HADIR").length;
              final pct = total>0 ? ((hadir/total)*100).round() : 0;
              return Card(
                child: ExpansionTile(
                  title: Text(e.key, style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text("$hadir/$total hadir — $pct%"),
                  trailing: Badge(label: Text(pct==100 ? "Hadir Penuh" : pct==0 ? "Tidak Hadir" : "Sebagian"), backgroundColor: pct==100?Colors.green: pct>=75?Colors.orange:Colors.red),
                  children: e.value.map<Widget>((x) => ListTile(
                    dense: true,
                    leading: Icon(x["status"]=="HADIR" ? Icons.check_circle : Icons.cancel, color: x["status"]=="HADIR"?Colors.green:Colors.red, size: 18),
                    title: Text(x["mataPelajaran"] ?? "-", style: const TextStyle(fontSize: 13)),
                    trailing: Chip(label: Text(x["status"], style: const TextStyle(fontSize: 11))),
                  )).toList(),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label; final String value; final String sub; final Color? color;
  const _StatCard({required this.label, required this.value, required this.sub, this.color});
  @override
  Widget build(BuildContext context) => Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [Text(label, style: const TextStyle(fontSize: 11, color: Colors.black54)), Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)), Text(sub, style: const TextStyle(fontSize: 10, color: Colors.black45))]))));
}
