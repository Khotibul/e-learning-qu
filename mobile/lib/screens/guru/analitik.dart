import "package:flutter/material.dart";
class GuruAnalitik extends StatelessWidget { const GuruAnalitik({super.key}); @override Widget build(BuildContext context) => Scaffold(backgroundColor: const Color(0xFFF8FAFC), appBar: AppBar(title: const Text("Analitik"), backgroundColor: Colors.white, elevation:0), body: const Center(child: Text("Analitik Guru — data dari /api/mobile/guru/dashboard (1 DB)")));
}
