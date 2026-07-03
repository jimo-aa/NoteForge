import 'package:flutter/material.dart';
import '../core/theme.dart';

enum ToastType { success, error, info }

final GlobalKey<ToastManagerState> toastKey = GlobalKey<ToastManagerState>();

class ToastManager extends StatefulWidget {
  final Widget child;
  const ToastManager({super.key, required this.child});
  @override
  State<ToastManager> createState() => ToastManagerState();
}

class ToastManagerState extends State<ToastManager> {
  final List<_Toast> _list = [];

  void show(ToastType type, String msg) {
    setState(() => _list.add(_Toast(type, msg)));
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _list.removeAt(0));
    });
  }

  @override
  Widget build(BuildContext context) => Stack(children: [
    widget.child,
    if (_list.isNotEmpty) Positioned(top: 12, left: 16, right: 16, child: Column(
      children: _list.map((t) => Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: t.type == ToastType.success ? AppTheme.success : t.type == ToastType.error ? AppTheme.danger : context.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          boxShadow: const [BoxShadow(color: Color(0x1A000000), blurRadius: 8, offset: Offset(0, 4))],
        ),
        child: Text(t.msg, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: t.type == ToastType.info ? context.textPrimary : Colors.white)),
      )).toList(),
    )),
  ]);
}

class _Toast { final ToastType type; final String msg; _Toast(this.type, this.msg); }
