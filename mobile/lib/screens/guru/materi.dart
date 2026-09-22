import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/api_config.dart';
import '../../services/api_service.dart';

class GuruMateri extends StatefulWidget {
  const GuruMateri({super.key});
  @override
  State<GuruMateri> createState() => _GuruMateriState();
}

class _GuruMateriState extends State<GuruMateri> {
  List<dynamic> data = [];
  List<dynamic> filtered = [];
  bool loading = true;
  bool uploading = false;
  final searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    searchCtrl.addListener(_filter);
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final v = await ApiService.get("/api/mobile/guru/materi");
      if (mounted) setState(() { data = v is List ? v : []; filtered = v is List ? v : []; loading = false; });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  void _filter() {
    final q = searchCtrl.text.toLowerCase();
    setState(() { filtered = q.isEmpty ? data : data.where((m) => (m["judul"] ?? "").toLowerCase().contains(q) || (m["mataPelajaran"]?["nama"] ?? "").toLowerCase().contains(q)).toList(); });
  }

  @override
  void dispose() { searchCtrl.dispose(); super.dispose(); }

  Future<void> _pickAndUpload() async {
    final result = await FilePicker.platform.pickFiles();
    if (result == null) return;
    final file = result.files.first;
    final titleCtrl = TextEditingController(text: file.name.split(".").first);
    final descCtrl = TextEditingController();
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Upload Materi"),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: "Judul", border: OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: descCtrl, decoration: const InputDecoration(labelText: "Deskripsi (opsional)", border: OutlineInputBorder()), maxLines: 2),
          const SizedBox(height: 8),
          Text("${file.name} (${(file.size / 1024).toStringAsFixed(1)} KB)", style: const TextStyle(fontSize: 12, color: Colors.black54)),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Batal")),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Upload")),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => uploading = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString("auth_token");
      final dio = Dio();
      final formData = FormData.fromMap({
        "judul": titleCtrl.text,
        "deskripsi": descCtrl.text,
        "mataPelajaranId": "", // akan diisi via dialog mapel jika ada
        "file": await MultipartFile.fromFile(file.path!, filename: file.name),
      });
      final res = await dio.post(
        "${ApiConfig.baseUrl}/api/mobile/guru/materi",
        data: formData,
        options: Options(headers: {"Authorization": "Bearer $token"}),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Materi berhasil diupload — 1 DB")) );
        _load();
      } else {
        throw Exception(res.data);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Gagal upload: $e")));
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(title: const Text("Materi (Guru)"), backgroundColor: Colors.white, elevation: 0),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: uploading ? null : _pickAndUpload,
      icon: uploading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.upload_outlined, size: 18),
      label: Text(uploading ? "Mengupload..." : "Upload Materi"),
      backgroundColor: const Color(0xFF4F46E5),
      foregroundColor: Colors.white,
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : Column(children: [
            Padding(padding: const EdgeInsets.all(12), child: TextField(controller: searchCtrl, decoration: InputDecoration(hintText: "Cari materi atau mapel...", prefixIcon: const Icon(Icons.search, size: 18), filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))), contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10)))),
            Expanded(child: filtered.isEmpty ? const Center(child: Text("Tidak ada materi", style: TextStyle(color: Colors.black54))) : RefreshIndicator(onRefresh: _load, child: ListView.builder(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), itemCount: filtered.length, itemBuilder: (_, i) { final m = filtered[i] as Map; return Container(margin: const EdgeInsets.only(bottom: 12), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))), child: ListTile(contentPadding: const EdgeInsets.all(16), leading: Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFF4F46E5).withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.description_outlined, color: Color(0xFF4F46E5), size: 20)), title: Text(m["judul"] ?? "-", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)), subtitle: Text("${m["mataPelajaran"]?["nama"] ?? ""} • ${m["fileType"] ?? ""}", style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))), trailing: IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () {}))); }))),
          ]),
  );
}
