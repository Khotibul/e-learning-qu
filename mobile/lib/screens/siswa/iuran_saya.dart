import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// Daftar iuran kelas + ajukan pembayaran (status MENUNGGU → dikonfirmasi bendahara).
/// Mirror web siswa bayarIuran() via POST /api/mobile/siswa/iuran.
class SiswaIuranSaya extends StatefulWidget {
  const SiswaIuranSaya({super.key});
  @override
  State<SiswaIuranSaya> createState() => _SiswaIuranSayaState();
}

class _SiswaIuranSayaState extends State<SiswaIuranSaya> {
  List<dynamic> data = [];
  bool loading = true;

  String _rp(dynamic n) {
    final v = ((n as num?) ?? 0).round().toString();
    final b = StringBuffer();
    for (int i = 0; i < v.length; i++) {
      if (i > 0 && (v.length - i) % 3 == 0) b.write(".");
      b.write(v[i]);
    }
    return "Rp $b";
  }

  void _snack(String msg, {Color color = const Color(0xFF10B981)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final v = await ApiService.getIuran();
      if (mounted) setState(() { data = v; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Map? _myPay(Map it) {
    final pays = (it["pembayaran"] as List?) ?? [];
    if (pays.isEmpty) return null;
    return pays.first as Map;
  }

  Future<void> _bayar(Map it) async {
    final nominal = TextEditingController(text: "${it["nominal"] ?? 0}");
    final ket = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("Bayar: ${it["nama"] ?? "Iuran"}"),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: nominal, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Nominal (Rp)", border: OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: ket, decoration: const InputDecoration(labelText: "Keterangan (opsional)", border: OutlineInputBorder())),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Kirim Pengajuan")),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiService.post("/api/mobile/siswa/iuran", {
        "iuranId": it["id"],
        "nominal": int.tryParse(nominal.text.replaceAll(".", "")) ?? 0,
        "keterangan": ket.text,
      });
      _snack("Pengajuan pembayaran terkirim — menunggu konfirmasi bendahara");
      _load();
    } catch (e) {
      _snack("Gagal: $e", color: const Color(0xFFEF4444));
    }
  }

  Widget _chip(String label, Color c) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
        child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: c)),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(title: const Text("Iuran Saya"), backgroundColor: Colors.white, elevation: 0),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: data.length,
                  itemBuilder: (_, i) {
                    final it = data[i] as Map;
                    final my = _myPay(it);
                    final st = (my?["status"] ?? "").toString();
                    final tenggat = it["tenggat"]?.toString().substring(0, 10) ?? "-";
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: const Color(0xFFF97316).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                          child: const Icon(Icons.payments_outlined, size: 18, color: Color(0xFFF97316)),
                        ),
                        title: Text(it["nama"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text("${_rp(it["nominal"])} • tenggat $tenggat"),
                        trailing: st.isEmpty
                            ? FilledButton.tonal(onPressed: () => _bayar(it), child: const Text("Bayar"))
                            : st == "LUNAS"
                                ? _chip("LUNAS", const Color(0xFF10B981))
                                : _chip("MENUNGGU", const Color(0xFFF59E0B)),
                        onTap: st.isEmpty || st == "DITOLAK" ? () => _bayar(it) : null,
                      ),
                    );
                  },
                ),
              ),
      );
}
