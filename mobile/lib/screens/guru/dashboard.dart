import "package:flutter/material.dart";
class GuruDashboard extends StatelessWidget {
  const GuruDashboard({super.key});
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text("Dashboard Guru")), body: const Center(child: Text("Guru Dashboard — data dari /api/guru/* (1 DB)")));
}
