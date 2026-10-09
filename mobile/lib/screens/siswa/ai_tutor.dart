import "package:flutter/material.dart";
import "../../services/api_service.dart";

/// AI Tutor chat — mirror web /siswa/ai (bagian tutor): sesi percakapan,
/// riwayat tersimpan, bubble chat, dan sumber RAG.
class SiswaAiTutor extends StatefulWidget {
  const SiswaAiTutor({super.key});
  @override
  State<SiswaAiTutor> createState() => _SiswaAiTutorState();
}

class _ChatMsg {
  final String role; // "siswa" | "assistant"
  final String konten;
  final List<dynamic> sumber;
  _ChatMsg(this.role, this.konten, [this.sumber = const []]);
}

class _SiswaAiTutorState extends State<SiswaAiTutor> {
  final _ctrl = TextEditingController();
  final _scroll = ScrollController();
  final List<_ChatMsg> _messages = [];
  String? _sessionId;
  bool _loading = false;

  @override
  void dispose() {
    _ctrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _snack(String msg, {Color color = const Color(0xFFEF4444)}) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  void _scrollDown() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
    });
  }

  Future<void> _ask() async {
    final pesan = _ctrl.text.trim();
    if (pesan.isEmpty || _loading) return;
    _ctrl.clear();
    setState(() { _messages.add(_ChatMsg("siswa", pesan)); _loading = true; });
    _scrollDown();
    try {
      final res = await ApiService.askAiTutor(pesan, sessionId: _sessionId);
      if (!mounted) return;
      setState(() {
        _sessionId = res["sessionId"] as String? ?? _sessionId;
        _messages.add(_ChatMsg("assistant", "${res["jawaban"] ?? "-"}", (res["sumber"] as List?) ?? []));
        _loading = false;
      });
      _scrollDown();
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; });
      _snack("Gagal: $e");
    }
  }

  Future<void> _openSessions() async {
    List<dynamic> sessions = [];
    try {
      sessions = await ApiService.getAiTutorSessions();
    } catch (e) {
      _snack("Gagal memuat sesi: $e");
      return;
    }
    if (!mounted) return;
    final picked = await showModalBottomSheet<Map>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: SizedBox(
          height: 420,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                const Expanded(child: Text("Riwayat Percakapan", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14))),
                TextButton(onPressed: () => Navigator.pop(ctx, {"new": true}), child: const Text("Chat Baru")),
              ]),
            ),
            Expanded(
              child: sessions.isEmpty
                  ? const Center(child: Text("Belum ada riwayat", style: TextStyle(color: Colors.black54)))
                  : ListView.builder(
                      itemCount: sessions.length,
                      itemBuilder: (_, i) {
                        final s = sessions[i] as Map;
                        final aktif = s["id"] == _sessionId;
                        return ListTile(
                          dense: true,
                          leading: Icon(aktif ? Icons.chat_bubble : Icons.chat_bubble_outline, size: 18, color: aktif ? const Color(0xFF0EA5E9) : Colors.black45),
                          title: Text(s["judul"]?.toString() ?? "Percakapan", maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                          subtitle: Text("${s["_count"]?["messages"] ?? 0} pesan • ${"${s["updatedAt"] ?? ""}".split("T").first}", style: const TextStyle(fontSize: 10)),
                          onTap: () => Navigator.pop(ctx, {"id": s["id"] as String}),
                        );
                      },
                    ),
            ),
          ]),
        ),
      ),
    );
    if (picked == null || !mounted) return;
    if (picked["new"] == true) {
      setState(() { _messages.clear(); _sessionId = null; });
      return;
    }
    final sid = picked["id"] as String?;
    if (sid == null) return;
    try {
      final msgs = await ApiService.getAiTutorMessages(sid);
      if (!mounted) return;
      setState(() {
        _sessionId = sid;
        _messages
          ..clear()
          ..addAll(msgs.map((m) { final mm = m as Map; return _ChatMsg(mm["role"] == "siswa" ? "siswa" : "assistant", "${mm["konten"] ?? ""}", (mm["sumber"] as List?) ?? []); }));
      });
      _scrollDown();
    } catch (e) {
      _snack("Gagal memuat pesan: $e");
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF8FAFC),
    appBar: AppBar(
      title: const Text("AI Tutor"),
      backgroundColor: Colors.white,
      elevation: 0,
      actions: [
        IconButton(icon: const Icon(Icons.history, size: 22), tooltip: "Riwayat", onPressed: _openSessions),
        IconButton(icon: const Icon(Icons.add_comment_outlined, size: 22), tooltip: "Chat baru", onPressed: () => setState(() { _messages.clear(); _sessionId = null; })),
        const SizedBox(width: 4),
      ],
    ),
    body: Column(children: [
      Expanded(
        child: _messages.isEmpty && !_loading
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: const [
                    Icon(Icons.smart_toy_outlined, size: 48, color: Color(0xFF94A3B8)),
                    SizedBox(height: 12),
                    Text("Tanya materi pelajaran kepada AI Tutor.\nPercakapan akan tersimpan di riwayat.", textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                  ]),
                ),
              )
            : ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.all(16),
                itemCount: _messages.length + (_loading ? 1 : 0),
                itemBuilder: (_, i) {
                  if (i == _messages.length) return const _TypingBubble();
                  final m = _messages[i];
                  return _Bubble(msg: m);
                },
              ),
      ),
      SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFE2E8F0)))),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _ctrl,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _ask(),
                decoration: const InputDecoration(hintText: "Tanya materi...", border: OutlineInputBorder(), isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: _loading ? null : _ask,
              icon: _loading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.send, size: 18),
              style: IconButton.styleFrom(backgroundColor: const Color(0xFF4F46E5)),
            ),
          ]),
        ),
      ),
    ]),
  );
}

class _Bubble extends StatelessWidget {
  final _ChatMsg msg;
  const _Bubble({required this.msg});

  @override
  Widget build(BuildContext context) {
    final user = msg.role == "siswa";
    final sumber = msg.sumber.whereType<Map>().toList();
    return Align(
      alignment: user ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.82),
        decoration: BoxDecoration(
          color: user ? const Color(0xFF4F46E5) : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(14),
            topRight: const Radius.circular(14),
            bottomLeft: Radius.circular(user ? 14 : 4),
            bottomRight: Radius.circular(user ? 4 : 14),
          ),
          border: user ? null : Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(msg.konten, style: TextStyle(fontSize: 13, height: 1.4, color: user ? Colors.white : const Color(0xFF1E293B))),
          if (!user && sumber.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(spacing: 4, runSpacing: 4, children: sumber.take(3).map((m) {
              final judul = "${m["judul"] ?? m["materi"] ?? m["judulMateri"] ?? "Sumber"}";
              return Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: const Color(0xFF4F46E5).withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)), child: Text(judul, style: const TextStyle(fontSize: 10, color: Color(0xFF4F46E5))));
            }).toList()),
          ],
        ]),
      ),
    );
  }
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: const SizedBox(width: 36, height: 14, child: LinearProgressIndicator(backgroundColor: Color(0xFFE2E8F0), color: Color(0xFF4F46E5), minHeight: 6)),
    ),
  );
}
