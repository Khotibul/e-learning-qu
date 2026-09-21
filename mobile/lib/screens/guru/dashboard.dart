import 'package:flutter/material.dart';
import '../siswa/ujian.dart';
import '../siswa/absensi_harian.dart';
import 'murid_detail.dart';
import 'bank_soal.dart';
import 'materi.dart';
import 'nilai.dart';
import 'intervensi.dart';
import 'anti_cheat.dart';
import 'ai_knowledge.dart';
import 'analitik.dart';
import 'wali_kelas.dart';
import 'pelanggaran.dart';
import 'pengaturan.dart';

class GuruDashboard extends StatelessWidget {
  const GuruDashboard({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text("Beranda Guru"), backgroundColor: Colors.white),
    body: Container(
      decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFEEF2FF), Color(0xFFF8FAFC)])),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF4F46E5), Color(0xFF06B6D4)]), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.school_outlined, color: Colors.white, size: 20)),
                const SizedBox(width: 10),
                const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text("Halo, Guru", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)), Text("Kelola kelas & siswa", style: TextStyle(color: Colors.black54, fontSize: 11))])),
              ]),
            ),
          ),
          const SizedBox(height: 12),
          const Text("Menu Guru", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 8),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 3,
            childAspectRatio: 0.95,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            children: [
              _GuruCard(icon: Icons.people_outline, label: "Murid", color: const Color(0xFF4F46E5), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruMurid()))),
              _GuruCard(icon: Icons.inventory_2_outlined, label: "Bank Soal", color: const Color(0xFF0EA5E9), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruBankSoal()))),
              _GuruCard(icon: Icons.quiz_outlined, label: "Soal", color: const Color(0xFF8B5CF6), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruBankSoal()))),
              _GuruCard(icon: Icons.assignment_outlined, label: "Ujian", color: const Color(0xFF06B6D4), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SiswaUjian()))),
              _GuruCard(icon: Icons.fact_check_outlined, label: "Absensi", color: const Color(0xFF10B981), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SiswaAbsensiHarian()))),
              _GuruCard(icon: Icons.shield_outlined, label: "Wali Kelas", color: const Color(0xFF0EA5E9), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruWaliKelas()))),
              _GuruCard(icon: Icons.gavel_outlined, label: "Pelanggaran", color: const Color(0xFFEF4444), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruPelanggaran()))),
              _GuruCard(icon: Icons.menu_book_outlined, label: "Materi", color: const Color(0xFFF59E0B), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruMateri()))),
              _GuruCard(icon: Icons.analytics_outlined, label: "Analitik", color: const Color(0xFF8B5CF6), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruAnalitik()))),
              _GuruCard(icon: Icons.shield_outlined, label: "Nilai", color: const Color(0xFFEF4444), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruNilai()))),
              _GuruCard(icon: Icons.support_agent_outlined, label: "Intervensi", color: const Color(0xFFF97316), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruIntervensi()))),
              _GuruCard(icon: Icons.security_outlined, label: "Anti-Cheat", color: const Color(0xFFEF4444), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruAntiCheat()))),
              _GuruCard(icon: Icons.memory_outlined, label: "AI Know", color: const Color(0xFF14B8A6), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruAiKnowledge()))),
              _GuruCard(icon: Icons.settings_outlined, label: "Pengaturan", color: const Color(0xFF64748B), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const GuruPengaturan()))),
            ],
          ),
        ],
      ),
    ),
  );
}

class _GuruCard extends StatelessWidget {
  final IconData icon; final String label; final Color color; final VoidCallback onTap;
  const _GuruCard({required this.icon, required this.label, required this.color, required this.onTap});
  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFF1F5F9))),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: color.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: color, size: 18)),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11), textAlign: TextAlign.center),
        ]),
      ),
    ),
  );
}
