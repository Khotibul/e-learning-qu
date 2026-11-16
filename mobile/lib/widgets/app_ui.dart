import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

/// Latar halaman dengan gradien lembut — dipakai semua layar utama.
class AppBackdrop extends StatelessWidget {
  final Widget child;
  const AppBackdrop({super.key, required this.child});

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: const BoxDecoration(gradient: AppGradients.backdrop),
        child: child,
      );
}

/// Header utama dashboard: sapaan, identitas, dan aksi (mis. notifikasi).
class DashboardHeader extends StatelessWidget {
  final String greeting;
  final String name;
  final String subtitle;
  final String? badge;
  final String? avatarUrl;
  final Widget? actions;
  final IconData subtitleIcon;

  const DashboardHeader({
    super.key,
    required this.greeting,
    required this.name,
    required this.subtitle,
    this.badge,
    this.avatarUrl,
    this.actions,
    this.subtitleIcon = Icons.auto_awesome_outlined,
  });

  String get _initial {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return "?";
    return trimmed.substring(0, 1).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: AppGradients.brand,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
        boxShadow: AppShadows.brand,
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
        child: Stack(
          children: [
            // Aksen dekoratif — memberi kesan berdimensi tanpa mengganggu teks.
            Positioned(
              top: -46,
              right: -28,
              child: _Orb(size: 148, opacity: 0.10),
            ),
            Positioned(
              bottom: -58,
              left: -30,
              child: _Orb(size: 132, opacity: 0.07),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 12, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(2.5),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
                        ),
                        child: CircleAvatar(
                          radius: 22,
                          backgroundColor: Colors.white.withValues(alpha: 0.18),
                          backgroundImage: (avatarUrl != null && avatarUrl!.isNotEmpty) ? NetworkImage(avatarUrl!) : null,
                          child: (avatarUrl == null || avatarUrl!.isEmpty)
                              ? Text(_initial, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17))
                              : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              greeting,
                              style: TextStyle(color: Colors.white.withValues(alpha: 0.72), fontSize: 11.5, letterSpacing: 0.3),
                            ),
                            const SizedBox(height: 1),
                            // Dua baris agar nama panjang tidak langsung terpotong di layar sempit.
                            Text(
                              name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: Colors.white, fontSize: 18.5, fontWeight: FontWeight.w800, letterSpacing: -0.3, height: 1.15),
                            ),
                            // Badge di baris sendiri supaya tidak berebut lebar dengan nama.
                            if (badge != null && badge!.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 5),
                                child: Align(alignment: Alignment.centerLeft, child: _HeaderBadge(text: badge!)),
                              ),
                          ],
                        ),
                      ),
                      if (actions != null) IconTheme.merge(data: const IconThemeData(color: Colors.white), child: actions!),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(subtitleIcon, size: 13, color: Colors.white.withValues(alpha: 0.72)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.82), fontSize: 11.5, height: 1.35),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  final double size;
  final double opacity;
  const _Orb({required this.size, required this.opacity});

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: opacity)),
      );
}

class _HeaderBadge extends StatelessWidget {
  final String text;
  const _HeaderBadge({required this.text});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
        ),
        child: Text(
          text,
          style: const TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w700, letterSpacing: 0.4),
        ),
      );
}

/// Tombol ikon di dalam header gradien (mis. lonceng notifikasi).
class HeaderIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;
  final String tooltip;
  final int? badgeCount;

  const HeaderIconButton({super.key, required this.icon, required this.onPressed, required this.tooltip, this.badgeCount});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 2),
      child: Material(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () {
            HapticFeedback.selectionClick();
            onPressed();
          },
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Badge(
              isLabelVisible: (badgeCount ?? 0) > 0,
              backgroundColor: AppColors.gold,
              label: Text((badgeCount ?? 0) > 99 ? "99+" : "$badgeCount", style: const TextStyle(fontSize: 9)),
              child: Icon(icon, size: 20, color: Colors.white),
            ),
          ),
        ),
      ),
    );
  }
}

/// Menu tambahan di header (mis. keluar).
class HeaderMenu extends StatelessWidget {
  final List<HeaderMenuItem> items;
  const HeaderMenu({super.key, required this.items});

  @override
  Widget build(BuildContext context) => PopupMenuButton<String>(
        tooltip: "Menu",
        icon: const Icon(Icons.more_vert, color: Colors.white, size: 20),
        onSelected: (value) => items.firstWhere((e) => e.value == value).onSelected(),
        itemBuilder: (_) => items
            .map((e) => PopupMenuItem<String>(
                  value: e.value,
                  child: Row(
                    children: [
                      Icon(e.icon, size: 18, color: e.danger ? AppColors.danger : AppColors.inkSoft),
                      const SizedBox(width: 10),
                      Text(e.label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: e.danger ? AppColors.danger : AppColors.ink)),
                    ],
                  ),
                ))
            .toList(),
      );
}

class HeaderMenuItem {
  final String value;
  final String label;
  final IconData icon;
  final VoidCallback onSelected;
  final bool danger;
  const HeaderMenuItem({required this.value, required this.label, required this.icon, required this.onSelected, this.danger = false});
}

/// Tile fitur: ikon bergradien, animasi mengecil saat ditekan, dan getaran halus.
/// Ini yang membuat menu terasa "hidup" tanpa menambah dependensi animasi.
class FeatureTile extends StatefulWidget {
  final IconData icon;
  final String label;
  final LinearGradient gradient;
  final VoidCallback onTap;
  final bool locked;

  const FeatureTile({
    super.key,
    required this.icon,
    required this.label,
    required this.gradient,
    required this.onTap,
    this.locked = false,
  });

  @override
  State<FeatureTile> createState() => _FeatureTileState();
}

class _FeatureTileState extends State<FeatureTile> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed != value) setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.gradient.colors.first;
    return Semantics(
      button: true,
      label: widget.locked ? "${widget.label} (terkunci)" : widget.label,
      child: GestureDetector(
        onTapDown: (_) => _setPressed(true),
        onTapCancel: () => _setPressed(false),
        onTapUp: (_) => _setPressed(false),
        onTap: () {
          HapticFeedback.selectionClick();
          widget.onTap();
        },
        child: AnimatedScale(
          scale: _pressed ? 0.94 : 1,
          duration: const Duration(milliseconds: 110),
          curve: Curves.easeOut,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: _pressed ? accent.withValues(alpha: 0.35) : AppColors.border),
              boxShadow: _pressed ? AppShadows.lift : AppShadows.soft,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        gradient: widget.locked ? AppGradients.slate : widget.gradient,
                        borderRadius: BorderRadius.circular(13),
                        boxShadow: [
                          BoxShadow(
                            color: accent.withValues(alpha: widget.locked ? 0.12 : 0.30),
                            blurRadius: 12,
                            offset: const Offset(0, 5),
                          ),
                        ],
                      ),
                      child: Icon(widget.icon, color: Colors.white, size: 21),
                    ),
                    if (widget.locked)
                      Positioned(
                        right: -5,
                        top: -5,
                        child: Container(
                          padding: const EdgeInsets.all(2.5),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.border),
                          ),
                          child: const Icon(Icons.lock_outline, size: 10, color: AppColors.inkMuted),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  widget.label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    height: 1.2,
                    fontWeight: FontWeight.w600,
                    color: widget.locked ? AppColors.inkMuted : AppColors.ink,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Kartu statistik ringkas: ikon berwarna lembut + angka besar.
class StatTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const StatTile({super.key, required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.soft,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(11)),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, color: AppColors.inkMuted, fontWeight: FontWeight.w500)),
                const SizedBox(height: 1),
                Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color, letterSpacing: -0.3)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Persentase dalam bentuk cincin — lebih cepat dibaca daripada bar tipis.
class PercentTile extends StatelessWidget {
  final String label;
  final int value;
  final String detail;
  final IconData icon;
  final Color color;

  const PercentTile({super.key, required this.label, required this.value, required this.detail, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    final clamped = value.clamp(0, 100);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.soft,
      ),
      // Label di atas, cincin di bawah: pada layar 320dp lebar untuk label tetap
      // utuh (sebelumnya "Absensi"/"AI Tutor" terpotong jadi "Abse…").
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: color),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.ink),
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          Row(
            children: [
              SizedBox(
                width: 40,
                height: 40,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox.expand(
                      child: TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: clamped / 100),
                        duration: const Duration(milliseconds: 700),
                        curve: Curves.easeOutCubic,
                        builder: (_, v, _) => CircularProgressIndicator(
                          value: v,
                          strokeWidth: 5,
                          strokeCap: StrokeCap.round,
                          backgroundColor: const Color(0xFFEFF1F8),
                          color: color,
                        ),
                      ),
                    ),
                    Text("$clamped%", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: color)),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  detail,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 10, height: 1.3, color: AppColors.inkMuted),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Judul bagian dengan garis aksen kecil di kiri.
class SectionHeader extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onAction;
  const SectionHeader({super.key, required this.title, this.action, this.onAction});

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 3,
            height: 15,
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(gradient: AppGradients.brand, borderRadius: BorderRadius.circular(3)),
          ),
          Expanded(
            child: Text(title, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: AppColors.ink, letterSpacing: -0.2)),
          ),
          if (action != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: const Size(0, 28), tapTargetSize: MaterialTapTargetSize.shrinkWrap),
              child: Text(action!, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
            ),
        ],
      );
}

/// Kotak informasi lembut (insight AI, pemberitahuan jabatan, dsb.).
class InfoBanner extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color color;
  final bool italic;

  const InfoBanner({super.key, required this.icon, required this.text, this.color = AppColors.primary, this.italic = false});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: color.withValues(alpha: 0.16)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  fontSize: 11.5,
                  height: 1.45,
                  color: AppColors.inkSoft,
                  fontStyle: italic ? FontStyle.italic : FontStyle.normal,
                ),
              ),
            ),
          ],
        ),
      );
}
