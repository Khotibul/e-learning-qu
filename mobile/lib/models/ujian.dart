class Ujian {
  final String id;
  final String nama;
  final String mapel;
  final String kelas;
  final String tanggal;
  final int durasi;
  final String status;
  final bool sudahDikerjakan;
  final int jumlahSoal;
  final int nilaiMinimum;

  Ujian({
    required this.id,
    required this.nama,
    required this.mapel,
    required this.kelas,
    required this.tanggal,
    required this.durasi,
    required this.status,
    required this.sudahDikerjakan,
    required this.jumlahSoal,
    required this.nilaiMinimum,
  });

  factory Ujian.fromJson(Map<String, dynamic> j) => Ujian(
    id: j["id"], nama: j["nama"], mapel: j["mapel"] ?? j["mataPelajaran"]?["nama"] ?? "-",
    kelas: j["kelas"] ?? "-", tanggal: j["tanggal"], durasi: j["durasi"] ?? 60,
    status: j["status"] ?? "DRAFT", sudahDikerjakan: j["sudahDikerjakan"] ?? false,
    jumlahSoal: j["jumlahSoal"] ?? 0, nilaiMinimum: j["nilaiMinimum"] ?? 0,
  );
}

class AbsensiHarian {
  final String dateKey;
  final int total;
  final int hadir;
  final int persentase;
  AbsensiHarian({required this.dateKey, required this.total, required this.hadir, required this.persentase});
  factory AbsensiHarian.fromGroup(String key, List<dynamic> items) {
    final hadir = items.where((e) => e["status"] == "HADIR").length;
    final total = items.length;
    return AbsensiHarian(dateKey: key, total: total, hadir: hadir, persentase: total > 0 ? ((hadir / total) * 100).round() : 0);
  }
}
