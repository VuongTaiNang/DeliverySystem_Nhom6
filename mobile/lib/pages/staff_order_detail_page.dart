import 'dart:async';

import 'package:flutter/material.dart';
import '../services/staff_api_service.dart';
import '../services/geofence_service.dart';
import 'staff_incident_page.dart';
import 'staff_location_page.dart';

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
    'returned': 'Đã hoàn hàng', 'rejected': 'Đã từ chối',
  };

  String _field(String name) => (widget.order[name] ?? '').toString();
  static const int _highValueThreshold = 5000000;

  num get _declaredValue {
    final value = widget.order['declaredValue'];
    return value is num ? value : num.tryParse('$value') ?? 0;
  }

  bool get _isHighValue => _declaredValue >= _highValueThreshold;

  int? get _assignmentId {
    final value = widget.order['assignmentId'];
    return value is num ? value.toInt() : int.tryParse('$value');
  }

  Future<void> _openLocationSharing() async {
    final id = _assignmentId;
    if (id == null || id <= 0) return;
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => StaffLocationPage(initialAssignmentId: id),
    ));
  }

  Future<void> _showHighValueAlert() async {
    if (!mounted) return;
    final enable = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Đơn hàng giá trị cao'),
        content: Text(
          'Giá trị khai báo: ${_declaredValue.toStringAsFixed(0)} đ. '
          'Bạn nên bật chia sẻ GPS để Operations theo dõi đơn hàng. '
          'Vị trí chỉ được gửi trong lúc bạn chủ động chia sẻ.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Để sau')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Đến màn hình bật GPS')),
        ],
      ),
    );
    if (!mounted) return;
    if (enable == true) await _openLocationSharing();
  }

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

  /// Cập nhật UI từ kết quả API, không tự đóng màn hình khi đổi trạng thái.
  /// Một số endpoint chỉ trả shipment hoặc assignment nên cần trạng thái
  /// dự phòng tương ứng với action đã được backend chấp nhận.
  void _applyTransition(String action, Map<String, dynamic> result) {
    const shipmentByAction = <String, String>{
      'start-pickup': 'picking_up',
      'pickup-success': 'picked_up',
      'pickup-failed': 'pickup_failed',
      'start-delivery': 'delivering',
      'delivery-success': 'delivered',
      'delivery-failed': 'delivery_failed',
      'start-return': 'returning',
      'return-complete': 'returned',
    };
    const assignmentByAction = <String, String>{
      'accept': 'accepted',
      'reject': 'rejected',
      'start-pickup': 'in_progress',
      'pickup-success': 'in_progress',
      'pickup-failed': 'accepted',
      'start-delivery': 'in_progress',
      'delivery-success': 'completed',
      'delivery-failed': 'in_progress',
      'start-return': 'in_progress',
      'return-complete': 'completed',
    };
    final shipment = result['shipment'];
    final assignment = result['assignment'];
    final backendShipmentStatus =
        shipment is Map ? shipment['status']?.toString() : null;
    final backendAssignmentStatus =
        assignment is Map ? assignment['status']?.toString() : null;
    final embeddedAssignmentStatus =
        shipment is Map ? shipment['assignmentStatus']?.toString() : null;

    setState(() {
      final shipmentStatus = backendShipmentStatus ?? shipmentByAction[action];
      final assignmentStatus = backendAssignmentStatus ??
          embeddedAssignmentStatus ?? assignmentByAction[action];
      if (shipmentStatus != null) {
        widget.order['shipmentStatus'] = shipmentStatus;
      }
      if (assignmentStatus != null) {
        widget.order['assignmentStatus'] = assignmentStatus;
      }
      _geofenceStatus = null;
    });
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
      final result = await StaffApiService.performPath(action, id, reason: reason);
      if (!mounted) return;

      _applyTransition(action, result);
      // Không để Geofence của giai đoạn trước tiếp tục chạy sau khi
      // shipment đã chuyển sang giai đoạn tiếp theo.
      await _geofenceService?.stop();
      if (!mounted) return;
      if (action == 'start-pickup' || action == 'start-delivery') {
        _startGeofence();
      }

      if (action == 'accept' && _isHighValue) {
        await _showHighValueAlert();
        if (!mounted) return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message']?.toString() ??
            'Cập nhật đơn hàng thành công')),
      );
      // Giữ màn hình chi tiết để Staff theo dõi trạng thái kế tiếp.
      // Chỉ quay lại danh sách khi người dùng chủ động nhấn Back.
    } catch (error) {
      if (mounted) setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openIncidentPage() async {
    final rawId = widget.order['assignmentId'];
    final id = rawId is num ? rawId.toInt() : int.tryParse('$rawId');

    if (id == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không tìm thấy mã phân công đơn hàng.'),
        ),
      );
      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => StaffIncidentPage(
          assignmentId: id,
          shipmentId: _field('shipmentId'),
        ),
      ),
    );
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
            Text('Giá trị khai báo: ${_declaredValue.toStringAsFixed(0)} đ'),
            if (_field('notes').isNotEmpty) Text('Ghi chú: ${_field('notes')}'),
          ]),
        )),
        if (_isHighValue &&
            !['assigned', 'rejected', 'completed', 'cancelled'].contains(assignmentStatus) &&
            !['delivered', 'returned'].contains(shipmentStatus)) Card(
          color: const Color(0xFFFFF3DF),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Row(children: [
                Icon(Icons.shield_outlined, color: Color(0xFF9B5900)),
                SizedBox(width: 8),
                Expanded(child: Text('Đơn hàng giá trị cao – đề nghị bật GPS',
                  style: TextStyle(fontWeight: FontWeight.bold))),
              ]),
              const SizedBox(height: 8),
              const Text('Bật chia sẻ vị trí khi thực hiện nhiệm vụ để Operations hỗ trợ giám sát. Bạn có thể tự dừng chia sẻ.'),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _busy ? null : _openLocationSharing,
                icon: const Icon(Icons.my_location),
                label: const Text('Đến màn hình bật GPS'),
              ),
            ]),
          ),
        ),
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
        if (available.isEmpty) Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Text(
            ['delivered', 'returned', 'rejected'].contains(status)
                ? 'Nhiệm vụ đã kết thúc. Nhấn Back để quay lại danh sách.'
                : 'Không có thao tác dành cho trạng thái hiện tại.',
          ),
        ),
        if (!['delivered', 'returned', 'rejected'].contains(status)) ...[
          const SizedBox(height: 12),
          OutlinedButton.icon(
            icon: const Icon(Icons.report_problem_outlined),
            label: const Text('Báo cáo sự cố'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.red.shade700,
              minimumSize: const Size(double.infinity, 54),
              side: BorderSide(color: Colors.red.shade700),
            ),
            onPressed: _busy ? null : _openIncidentPage,
          ),
        ],
      ]),
    );
  }
}
