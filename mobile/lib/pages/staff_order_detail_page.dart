import 'dart:async';

import 'package:flutter/material.dart';
import '../services/staff_api_service.dart';
import '../services/geofence_service.dart';

class StaffOrderDetailPage extends StatefulWidget {
  final Map<String, dynamic> order;
  const StaffOrderDetailPage({super.key, required this.order});
  @override
  State<StaffOrderDetailPage> createState() => _StaffOrderDetailPageState();
}

class _StaffOrderDetailPageState extends State<StaffOrderDetailPage> {
  static const _green = Color(0xFF123F31);
  bool _busy = false;
  String? _error;
  String? _geofenceStatus;
  GeofenceService? _geofenceService;
  static const _actions = <String, List<List<String>>>{
    'assigned': [['accept', 'Nhận đơn'], ['reject', 'Từ chối']],
    'accepted': [['start-pickup', 'Bắt đầu lấy hàng']],
    'pickup_failed': [['start-pickup', 'Thử lấy hàng lại']],
    'delivery_failed': [['start-delivery', 'Bắt đầu giao lại']],
    'picking_up': [['pickup-success', 'Lấy hàng thành công'], ['pickup-failed', 'Lấy hàng thất bại']],
    'picked_up': [['start-delivery', 'Bắt đầu giao hàng']],
    'delivering': [['delivery-success', 'Giao thành công'], ['delivery-failed', 'Giao thất bại']],
    'return_pending': [['start-return', 'Bắt đầu hoàn hàng']],
    'returning': [['return-complete', 'Hoàn hàng thành công']],
  };
  static const _labels = <String, String>{
    'assigned': 'Đã phân công', 'accepted': 'Đã nhận đơn',
    'pending_pickup': 'Chờ lấy hàng',
    'pickup_failed': 'Lấy hàng thất bại',
    'delivery_failed': 'Giao hàng thất bại',
    'picking_up': 'Đang lấy hàng', 'picked_up': 'Đã lấy hàng',
    'delivering': 'Đang giao hàng', 'delivered': 'Đã giao hàng',
    'return_pending': 'Chờ hoàn hàng', 'returning': 'Đang hoàn hàng',
    'returned': 'Đã hoàn hàng',
  };

  String _field(String name) => (widget.order[name] ?? '').toString();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _startGeofence());
  }

  double? _coordinate(String key) {
    final value = widget.order[key];
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '');
  }

  void _startGeofence() {
    final shipmentStatus = _field('shipmentStatus').trim().toLowerCase();
    final GeofenceStage? stage = switch (shipmentStatus) {
      'picking_up' => GeofenceStage.pickup,
      'delivering' => GeofenceStage.delivery,
      _ => null,
    };
    if (stage == null) return;

    final latitude = _coordinate(
      stage == GeofenceStage.pickup ? 'pickupLatitude' : 'deliveryLatitude',
    );
    final longitude = _coordinate(
      stage == GeofenceStage.pickup ? 'pickupLongitude' : 'deliveryLongitude',
    );
    if (latitude == null || longitude == null ||
        !latitude.isFinite || !longitude.isFinite ||
        latitude.abs() > 90 || longitude.abs() > 180 ||
        (latitude == 0 && longitude == 0)) {
      setState(() => _geofenceStatus =
          'Shipment chưa có tọa độ hợp lệ cho ${stage == GeofenceStage.pickup ? 'điểm lấy hàng' : 'điểm giao hàng'}.');
      return;
    }

    final rawId = widget.order['assignmentId'];
    final assignmentId = rawId is num ? rawId.toInt() : int.tryParse('$rawId');
    if (assignmentId == null || assignmentId <= 0) {
      setState(() => _geofenceStatus = 'Không tìm thấy mã phân công để bật Geofence.');
      return;
    }

    final service = _geofenceService ?? GeofenceService();
    _geofenceService = service;
    service.start(
      assignmentId: assignmentId,
      target: GeofenceTarget(
        stage: stage,
        latitude: latitude,
        longitude: longitude,
      ),
      onStatus: (message) {
        if (mounted) setState(() => _geofenceStatus = message);
      },
    );
  }

  @override
  void dispose() {
    unawaited(_geofenceService?.stop() ?? Future<void>.value());
    super.dispose();
  }

  Future<String?> _askReason() async {
    final controller = TextEditingController();
    try {
      return await showDialog<String>(context: context, builder: (dialogContext) =>
        StatefulBuilder(builder: (dialogContext, refresh) => AlertDialog(
          title: const Text('Nhập lý do'),
          content: TextField(
            controller: controller, maxLength: 300, maxLines: 3,
            decoration: const InputDecoration(
              hintText: 'Nhập lý do từ chối hoặc thất bại (ít nhất 3 ký tự)',
              border: OutlineInputBorder(),
            ),
            onChanged: (_) => refresh(() {}),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Hủy')),
            FilledButton(
              onPressed: controller.text.trim().length < 3
                  ? null : () => Navigator.pop(dialogContext, controller.text.trim()),
              child: const Text('Xác nhận'),
            ),
          ],
        )),
      );
    } finally {
      // Chờ hiệu ứng đóng hộp thoại hoàn tất rồi mới giải phóng bộ điều khiển.
      await Future<void>.delayed(const Duration(milliseconds: 250));
      controller.dispose();
    }
  }

  Future<void> _act(String action) async {
    if (_busy) return;
    String? reason;
    if (['reject', 'pickup-failed', 'delivery-failed'].contains(action)) {
      reason = await _askReason();
      if (reason == null) return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      final rawId = widget.order['assignmentId'];
      final id = rawId is num ? rawId.toInt() : int.tryParse('$rawId');
      if (id == null) throw Exception('Thiếu mã phân công của đơn hàng.');
      await StaffApiService.performPath(action, id, reason: reason);
      if (!mounted) return;

      if (action == 'start-pickup' || action == 'start-delivery') {
        setState(() {
          widget.order['shipmentStatus'] =
              action == 'start-pickup' ? 'picking_up' : 'delivering';
        });
        _startGeofence();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã bắt đầu công việc. Geofence đang được bật.')),
        );
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cập nhật đơn hàng thành công')),
      );
      Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final shipmentStatus = _field('shipmentStatus').trim().toLowerCase();
    final assignmentStatus = _field('assignmentStatus').trim().toLowerCase();
    // Ưu tiên dùng trạng thái Shipment để xác định thao tác; dùng trạng thái phân công dự phòng khi Shipment còn chờ lấy hàng.
    final status = shipmentStatus == 'pending_pickup' &&
        (assignmentStatus == 'assigned' || assignmentStatus == 'accepted')
          ? assignmentStatus
          : _actions.containsKey(shipmentStatus) || _labels.containsKey(shipmentStatus)
              ? shipmentStatus : assignmentStatus;
    final allActions = _actions[status] ?? const <List<String>>[];
    final available = allActions.where((button) {
      final a = StaffAssignment.fromJson(widget.order);
      return StaffApiService.availableActions(a).any((allowed) => allowed.name == {
        'start-pickup': 'startPickup', 'pickup-success': 'pickupSuccess',
        'pickup-failed': 'pickupFailed', 'start-delivery': 'startDelivery',
        'delivery-success': 'deliverySuccess', 'delivery-failed': 'deliveryFailed',
        'start-return': 'startReturn', 'return-complete': 'returnComplete',
      }[button[0]] || allowed.name == button[0]);
    }).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết đơn'),
        backgroundColor: _green, foregroundColor: Colors.white),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        SelectableText(_field('shipmentId'),
          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Chip(label: Text(_labels[status] ?? status)),
        const SizedBox(height: 12),
        Card(child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Điểm lấy', style: Theme.of(context).textTheme.titleMedium),
            Text(_field('pickupAddress')),
            Text('${_field('senderName')} • ${_field('senderPhone')}'),
            const Divider(height: 28),
            Text('Điểm giao', style: Theme.of(context).textTheme.titleMedium),
            Text(_field('deliveryAddress')),
            Text('${_field('recipientName')} • ${_field('recipientPhone')}'),
            const Divider(height: 28),
            Text('COD: ${widget.order['codAmount'] ?? 0} đ'),
            if (_field('notes').isNotEmpty) Text('Ghi chú: ${_field('notes')}'),
          ]),
        )),
        if (_geofenceStatus != null) Card(
          color: const Color(0xFFEAF3EF),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.my_location, color: _green),
              const SizedBox(width: 10),
              Expanded(child: Text(_geofenceStatus!)),
            ]),
          ),
        ),
        if (_error != null) Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Text(_error!, style: const TextStyle(color: Colors.red)),
        ),
        if (_busy) const Padding(
          padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator()),
        ),
        ...available.map((action) => Padding(
          padding: const EdgeInsets.only(top: 12),
          child: SizedBox(height: 54, child: FilledButton(
            onPressed: _busy ? null : () => _act(action[0]),
            style: FilledButton.styleFrom(
              backgroundColor: action[0].contains('failed') || action[0] == 'reject'
                  ? Colors.red.shade700 : _green,
            ),
            child: Text(action[1]),
          )),
        )),
        if (available.isEmpty) const Padding(
          padding: EdgeInsets.only(top: 14),
          child: Text('Không có thao tác dành cho trạng thái hiện tại.'),
        ),
      ]),
    );
  }
}
