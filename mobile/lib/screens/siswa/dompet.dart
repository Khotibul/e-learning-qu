import "package:flutter/material.dart";
import "package:intl/intl.dart";
import "../../services/api_service.dart";

/// Dompet uang saku — mirror web /siswa/dompet.
/// Saldo, limit harian, konsistensi, riwayat ledger, pembelian kantin, tagihan.
class SiswaDompet extends StatefulWidget {
  const SiswaDompet({super.key});
  @override
  State<SiswaDompet> createState() => _SiswaDompetState();
}

class _SiswaDompetState extends State<SiswaDompet> {
  bool loading = true;
  String? error;
  Map<String, dynamic> dompet = {};
  Map<String, dynamic> limitHarian = {};
  bool konsisten = true;
  List<dynamic> riwayat = [];
  List<dynamic> transaksi = [];
  List<dynamic> tagihan = [];

  static final _rupiah = NumberFormat.currency(locale: "id_ID", symbol: "Rp", decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final hasil = await Future.wait([
        ApiService.get("/api/mobile/siswa/dompet", useCache: false),
        ApiService.get("/api/mobile/siswa/dompet?view=riwayat", useCache: false),
        ApiService.get("/api/mobile/siswa/dompet?view=tagihan", useCache: false),
      ]);
      if (!mounted) return;
      final utama = hasil[0] is Map ? Map<String, dynamic>.from(hasil[0] as Map) : {};
      setState(() {
        dompet = (utama["dompet"] as Map?)?.cast<String, dynamic>() ?? {};
        limitHarian = (utama["limitHarian"] as Map?)?.cast<String, dynamic>() ?? {};
        konsisten = utama["konsistensiSaldo"] != false;
        riwayat = (utama["riwayat"] as List?) ?? [];
        transaksi = ((hasil[1] as Map?)?["rows"] as List?) ?? [];
        tagihan = ((hasil[2] as Map?)?["rows"] as List?) ?? [];
        loading = false;
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() { error = e.toString(); loading = false; });
    }
  }

  static const _tipeLabel = {
    "TOPUP": "Top-up", "PEMBAYARAN_KANTIN": "Beli Kantin", "REFUND_KANTIN": "Refund",
    "KOREKSI": "Koreksi", "BAYAR_TAGIHAN": "Bayar Tagihan", "PENARIKAN": "Penarikan",
  };

  static String _titik(dynamic v) {
    final d = DateTime.tryParse("$v");
    return d == null ? "-" : DateFormat("dd MMM yyyy HH:mm", "id_ID").format(d.toLocal());
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 3,
    child: Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text("Dompet Uang Saku"),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [IconButton(onPressed: loading ? null : () { setState(() => loading = true); _load(); }, icon: const Icon(Icons.refresh, size: 20))],
        bottom: const TabBar(
          labelColor: Color(0xFF4F46E5),
          unselectedLabelColor: Color(0xFF64748B),
          tabs: [Tab(text: "Riwayat Saldo"), Tab(text: "Pembelian Kantin"), Tab(text: "Tagihan")],
        ),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.account_balance_wallet_outlined, size: 40, color: Color(0xFF94A3B8)),
                  const SizedBox(height: 8),
                  Text("Gagal memuat dompet: $error", textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF64748B))),
                ])))
              : TabBarView(children: [_tabSaldo(), _tabKantin(), _tabTagihan()]),
    ),
  );

  Widget _tabSaldo() {
    final saldo = (dompet["saldo"] as num?)?.toDouble() ?? 0;
    final sisa = limitHarian["sisa"];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(children: [
            const Expanded(child: Text("Saldo Uang Saku", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
            _badge("${dompet["status"] ?? "-"}", dompet["status"] == "AKTIF" ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
          ]),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text("Saldo Tersedia", style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                const SizedBox(height: 4),
                Text(_rupiah.format(saldo), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF4F46E5))),
                Text("No. ${dompet["nomor"] ?? "-"} • ${dompet["nama"] ?? "-"}", style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              ]),
            ),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _info("Sisa Limit Harian", sisa == null ? "∞" : _rupiah.format((sisa as num).toDouble()), limitHarian["ok"] == false ? const Color(0xFFEF4444) : const Color(0xFF0EA5E9))),
            const SizedBox(width: 8),
            Expanded(child: _info("Konsistensi Saldo", konsisten ? "Konsisten" : "Tidak konsisten", konsisten ? const Color(0xFF10B981) : const Color(0xFFEF4444))),
          ]),
          const SizedBox(height: 14),
          const Text("Riwayat Saldo", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 6),
          if (riwayat.isEmpty)
            const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada transaksi", style: TextStyle(color: Colors.black54)))))
          else
            ...riwayat.cast<Map>().map((l) {
              final jumlah = (l["jumlah"] as num?)?.toDouble() ?? 0;
              return Card(
                child: ListTile(
                  dense: true,
                  leading: CircleAvatar(
                    radius: 15,
                    backgroundColor: (jumlah >= 0 ? const Color(0xFF10B981) : const Color(0xFFEF4444)).withValues(alpha: 0.12),
                    child: Icon(jumlah >= 0 ? Icons.south_west : Icons.north_east, size: 14, color: jumlah >= 0 ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
                  ),
                  title: Text(_tipeLabel["${l["tipe"]}"] ?? "${l["tipe"]}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  subtitle: Text("${l["deskripsi"] ?? "-"}\n${_titik(l["createdAt"])} • saldo ${_rupiah.format(((l["saldoSesudah"] as num?) ?? 0).toDouble())}", style: const TextStyle(fontSize: 10)),
                  isThreeLine: true,
                  trailing: Text("${jumlah >= 0 ? "+" : ""}${_rupiah.format(jumlah)}", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: jumlah >= 0 ? const Color(0xFF10B981) : const Color(0xFFEF4444))),
                ),
              );
            }),
          const SizedBox(height: 8),
          const Text("Saldo hanya dapat ditambah melalui top-up yang diverifikasi pengurus. Siswa tidak dapat menambah saldo sendiri.", style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
        ],
      ),
    );
  }

  Widget _tabKantin() {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (transaksi.isEmpty)
            const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Belum ada pembelian", style: TextStyle(color: Colors.black54)))))
          else
            ...transaksi.cast<Map>().map((t) {
              final items = (t["item"] as List?) ?? [];
              final total = (t["total"] as num?)?.toDouble() ?? 0;
              return Card(
                child: ListTile(
                  dense: true,
                  leading: const Icon(Icons.shopping_bag_outlined, size: 18, color: Color(0xFFF97316)),
                  title: Text("${t["nomorStruk"] ?? "-"} • ${t["outlet"]?["nama"] ?? "-"}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  subtitle: Text("${items.map((i) => "${(i as Map)["namaSnapshot"]}×${i["qty"]}").join(", ")}\n${_titik(t["createdAt"])} • ${t["metode"] ?? "-"}", style: const TextStyle(fontSize: 10)),
                  isThreeLine: true,
                  trailing: Text(_rupiah.format(total), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _tabTagihan() {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (tagihan.isEmpty)
            const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text("Tidak ada tagihan", style: TextStyle(color: Colors.black54)))))
          else
            ...tagihan.cast<Map>().map((t) {
              final status = "${t["status"]}";
              final color = status == "LUNAS" ? const Color(0xFF10B981) : status == "JATUH_TEMPO" ? const Color(0xFFEF4444) : const Color(0xFFF59E0B);
              return Card(
                child: ListTile(
                  dense: true,
                  title: Text("${t["kode"] ?? "-"} • ${t["jenis"]?["nama"] ?? "-"}", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  subtitle: Text("Periode ${t["periode"] ?? "-"}\nTotal ${_rupiah.format(((t["total"] as num?) ?? 0).toDouble())} • Sisa ${_rupiah.format(((t["sisa"] as num?) ?? 0).toDouble())}", style: const TextStyle(fontSize: 10)),
                  isThreeLine: true,
                  trailing: _badge(status, color),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _info(String label, String value, Color color) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
      const SizedBox(height: 2),
      FittedBox(child: Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color))),
    ]),
  );

  Widget _badge(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
    child: Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
  );
}
