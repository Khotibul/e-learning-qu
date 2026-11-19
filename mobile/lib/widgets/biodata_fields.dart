import "package:flutter/material.dart";

/// Controller + nilai biodata (jenis kelamin s.d. no. telepon wali).
/// Dipakai bersama oleh layar edit murid dan santri di aplikasi admin.
class BiodataControllers {
  final tempatLahir = TextEditingController();
  final tanggalLahir = TextEditingController();
  final anakKe = TextEditingController();
  final statusKeluarga = TextEditingController();
  final namaAyah = TextEditingController();
  final namaIbu = TextEditingController();
  final pekerjaanAyah = TextEditingController();
  final pekerjaanIbu = TextEditingController();
  final asalSekolah = TextEditingController();
  final noTelpWali = TextEditingController();
  final alamat = TextEditingController();

  String jenisKelamin = "";
  String agama = "";

  static const daftarAgama = [
    "Islam",
    "Kristen",
    "Katolik",
    "Hindu",
    "Buddha",
    "Konghucu",
  ];
  static const labelJenisKelamin = {
    "LAKI_LAKI": "Laki-laki",
    "PEREMPUAN": "Perempuan",
  };

  void isiDari(Map? bio) {
    if (bio is! Map) return;
    jenisKelamin = "${bio["jenisKelamin"] ?? ""}";
    agama = "${bio["agama"] ?? ""}";
    tempatLahir.text = "${bio["tempatLahir"] ?? ""}";
    final tgl = bio["tanggalLahir"];
    tanggalLahir.text = tgl == null
        ? ""
        : ("$tgl".length >= 10 ? "$tgl".substring(0, 10) : "$tgl");
    anakKe.text = bio["anakKe"] == null ? "" : "${bio["anakKe"]}";
    statusKeluarga.text = "${bio["statusKeluarga"] ?? ""}";
    namaAyah.text = "${bio["namaAyah"] ?? ""}";
    namaIbu.text = "${bio["namaIbu"] ?? ""}";
    pekerjaanAyah.text = "${bio["pekerjaanAyah"] ?? ""}";
    pekerjaanIbu.text = "${bio["pekerjaanIbu"] ?? ""}";
    asalSekolah.text = "${bio["asalSekolah"] ?? ""}";
    noTelpWali.text = "${bio["noTelpWali"] ?? ""}";
    alamat.text = "${bio["alamat"] ?? ""}";
  }

  Map<String, dynamic> toJson({bool sertakanAlamat = false}) => {
    "jenisKelamin": jenisKelamin,
    "agama": agama,
    "tempatLahir": tempatLahir.text.trim(),
    "tanggalLahir": tanggalLahir.text.trim(),
    "anakKe": anakKe.text.trim(),
    "statusKeluarga": statusKeluarga.text.trim(),
    "namaAyah": namaAyah.text.trim(),
    "namaIbu": namaIbu.text.trim(),
    "pekerjaanAyah": pekerjaanAyah.text.trim(),
    "pekerjaanIbu": pekerjaanIbu.text.trim(),
    "asalSekolah": asalSekolah.text.trim(),
    "noTelpWali": noTelpWali.text.trim(),
    if (sertakanAlamat) "alamat": alamat.text.trim(),
  };

  void dispose() {
    tempatLahir.dispose();
    tanggalLahir.dispose();
    anakKe.dispose();
    statusKeluarga.dispose();
    namaAyah.dispose();
    namaIbu.dispose();
    pekerjaanAyah.dispose();
    pekerjaanIbu.dispose();
    asalSekolah.dispose();
    noTelpWali.dispose();
    alamat.dispose();
  }
}

class BiodataFields extends StatefulWidget {
  final BiodataControllers data;
  final bool tampilkanAlamat;
  const BiodataFields({
    super.key,
    required this.data,
    this.tampilkanAlamat = false,
  });

  @override
  State<BiodataFields> createState() => _BiodataFieldsState();
}

class _BiodataFieldsState extends State<BiodataFields> {
  Future<void> _pilihTanggal() async {
    final awal =
        DateTime.tryParse(widget.data.tanggalLahir.text) ?? DateTime(1990);
    final hasil = await showDatePicker(
      context: context,
      initialDate: awal,
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
      helpText: "Tanggal lahir",
    );
    if (hasil != null) {
      setState(
        () => widget.data.tanggalLahir.text = hasil.toIso8601String().substring(
          0,
          10,
        ),
      );
    }
  }

  InputDecoration _dec(String label) => InputDecoration(
    labelText: label,
    border: const OutlineInputBorder(),
    isDense: true,
  );

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: data.jenisKelamin.isEmpty
                    ? null
                    : data.jenisKelamin,
                isExpanded: true,
                isDense: true,
                decoration: _dec("Jenis Kelamin"),
                items: BiodataControllers.labelJenisKelamin.entries
                    .map(
                      (e) => DropdownMenuItem(
                        value: e.key,
                        child: Text(
                          e.value,
                          style: const TextStyle(fontSize: 13),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => data.jenisKelamin = v ?? ""),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: data.agama.isEmpty ? null : data.agama,
                isExpanded: true,
                isDense: true,
                decoration: _dec("Agama"),
                items: BiodataControllers.daftarAgama
                    .map(
                      (a) => DropdownMenuItem(
                        value: a,
                        child: Text(a, style: const TextStyle(fontSize: 13)),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => data.agama = v ?? ""),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: data.tempatLahir,
                decoration: _dec("Tempat Lahir"),
                textCapitalization: TextCapitalization.words,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: data.tanggalLahir,
                readOnly: true,
                onTap: _pilihTanggal,
                decoration: _dec("Tanggal Lahir").copyWith(
                  hintText: "YYYY-MM-DD",
                  suffixIcon: const Icon(
                    Icons.calendar_today_outlined,
                    size: 16,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: data.anakKe,
                decoration: _dec("Anak Ke"),
                keyboardType: TextInputType.number,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: data.statusKeluarga,
                decoration: _dec("Status dalam Keluarga"),
                textCapitalization: TextCapitalization.words,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: data.namaAyah,
                decoration: _dec("Nama Ayah"),
                textCapitalization: TextCapitalization.words,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: data.namaIbu,
                decoration: _dec("Nama Ibu"),
                textCapitalization: TextCapitalization.words,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: data.pekerjaanAyah,
                decoration: _dec("Pekerjaan Ayah"),
                textCapitalization: TextCapitalization.words,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: data.pekerjaanIbu,
                decoration: _dec("Pekerjaan Ibu"),
                textCapitalization: TextCapitalization.words,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        TextField(
          controller: data.asalSekolah,
          decoration: _dec("Asal Sekolah"),
          textCapitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 10),
        TextField(
          controller: data.noTelpWali,
          decoration: _dec("No. Telepon Wali"),
          keyboardType: TextInputType.phone,
        ),
        if (widget.tampilkanAlamat) ...[
          const SizedBox(height: 10),
          TextField(
            controller: data.alamat,
            decoration: _dec("Alamat"),
            maxLines: 2,
          ),
        ],
      ],
    );
  }
}
