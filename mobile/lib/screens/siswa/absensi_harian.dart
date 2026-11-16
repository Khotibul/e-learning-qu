import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/absensi_wajah_card.dart';
import '../../widgets/app_ui.dart';

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

  void _snack(String msg, {Color color = AppColors.success}) {
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
            const Icon(Icons.fingerprint, color: AppColors.primary, size: 18),
            const SizedBox(width: 8),
            const Expanded(
              child: Text("Kehadiran Hari Ini", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            ),
          ]),
          if (pol != null) ...[
            const SizedBox(height: 2),
            Text(
              "Jam masuk ${pol["jamMasuk"]} • pulang ${pol["jamPulang"]}",
              style: const TextStyle(fontSize: 10.5, color: AppColors.inkMuted),
            ),
          ],
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
    final Color c = st == "HADIR" || st == "NORMAL" ? AppColors.success : st == "TERLAMBAT" || st == "AWAL" ? AppColors.warning : AppColors.inkMuted;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12), border: Border.all(color: c.withValues(alpha: 0.3))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.inkMuted)),
        const SizedBox(height: 2),
        Text(jam, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: c)),
        Text(st.isEmpty ? "BELUM" : st, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: c)),
      ]),
    );
  }

  Widget _mini(String label, String value) => Expanded(
        child: Column(children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.primary)),
          Text(label, style: const TextStyle(fontSize: 9, color: AppColors.inkMuted), textAlign: TextAlign.center),
        ]),
      );

  Widget _permintaanSection() {
    final list = (_kehadiran["permintaan"] as List?) ?? [];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.how_to_reg_outlined, size: 16, color: AppColors.accent),
            const SizedBox(width: 6),
            const Expanded(
              child: Text("Pengajuan Manual", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            ),
            FilledButton.tonal(
              onPressed: _ajukanManual,
              style: FilledButton.styleFrom(
                minimumSize: const Size(0, 34),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                visualDensity: VisualDensity.compact,
              ),
              child: const Text("+ Ajukan", style: TextStyle(fontSize: 12)),
            ),
          ]),
          const SizedBox(height: 6),
          if (list.isEmpty) const Text("Belum ada pengajuan", style: TextStyle(fontSize: 12, color: AppColors.inkMuted)),
          ...list.map((raw) {
            final p = raw as Map;
            final st = (p["status"] ?? "").toString();
            final Color c = st == "DISETUJUI" ? AppColors.success : st == "DITOLAK" ? AppColors.danger : AppColors.warning;
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
        appBar: AppBar(title: const Text("Absensi Harian")),
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
      appBar: AppBar(title: const Text("Absensi Harian")),
      body: AppBackdrop(
        child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            if (_kehadiran.isNotEmpty) ...[
              _todayCard(),
              const SizedBox(height: 12),
              _permintaanSection(),
              const SizedBox(height: 16),
            ],
            const AbsensiWajahCard(
              keterangan: "Absen masuk/pulang dengan verifikasi wajah lewat kamera depan perangkat.",
            ),
            const SizedBox(height: 20),
            const SectionHeader(title: "Rekap Per Mapel"),
            const SizedBox(height: 10),
            Row(children: [
              _StatCard(label: "Total Hari", value: "$totalHari", sub: "hari berjadwal", color: AppColors.primary),
              const SizedBox(width: 8),
              _StatCard(label: "Hadir Penuh", value: "$hadirPenuh", sub: "dari $totalHari", color: AppColors.success),
              const SizedBox(width: 8),
              _StatCard(label: "Persentase", value: totalHari>0 ? "${((hadirPenuh/totalHari)*100).round()}%" : "0%", sub: "rata harian", color: AppColors.accent),
            ]),
            const SizedBox(height: 12),
            const Text("Persentase = HADIR ÷ total pelajaran hari itu × 100%", style: TextStyle(fontSize: 11, color: AppColors.inkMuted)),
            const SizedBox(height: 12),
            ...entries.map((e) {
              final total = e.value.length;
              final hadir = e.value.where((x) => x["status"] == "HADIR").length;
              final pct = total>0 ? ((hadir/total)*100).round() : 0;
              return Card(
                child: ExpansionTile(
                  title: Text(e.key, style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text("$hadir/$total hadir — $pct%"),
                  trailing: Badge(label: Text(pct==100 ? "Hadir Penuh" : pct==0 ? "Tidak Hadir" : "Sebagian"), backgroundColor: pct==100 ? AppColors.success : pct>=75 ? AppColors.warning : AppColors.danger),
                  children: e.value.map<Widget>((x) => ListTile(
                    dense: true,
                    leading: Icon(x["status"]=="HADIR" ? Icons.check_circle : Icons.cancel, color: x["status"]=="HADIR" ? AppColors.success : AppColors.danger, size: 18),
                    title: Text(x["mataPelajaran"] ?? "-", style: const TextStyle(fontSize: 13)),
                    trailing: Chip(label: Text(x["status"], style: const TextStyle(fontSize: 11))),
                  )).toList(),
                ),
              );
            }),
          ],
        ),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label; final String value; final String sub; final Color? color;
  const _StatCard({required this.label, required this.value, required this.sub, this.color});
  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.border),
            boxShadow: AppShadows.soft,
          ),
          child: Column(
            children: [
              Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color ?? AppColors.primary, letterSpacing: -0.4)),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: AppColors.ink), textAlign: TextAlign.center),
              Text(sub, style: const TextStyle(fontSize: 9, color: AppColors.inkMuted), textAlign: TextAlign.center),
            ],
          ),
        ),
      );
}
