import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_service.dart';

// STAFF API SERVICE (mobile) - Ân phụ trách
// Quy tắc: mọi thao tác Staff dùng assignmentId, KHÔNG dùng shipmentId.
// Lỗi được ném ra dạng Exception(message tiếng Việt).

/// Một dòng trong GET /api/v1/staff/shipments
class StaffAssignment {
  final int assignmentId; // dùng cho MỌI action
  final String assignmentStatus;
  final String shipmentId; // chỉ để hiển thị
  final String shipmentStatus;
  final String senderName;
  final String senderPhone;
  final String pickupAddress;
  final double? pickupLatitude;
  final double? pickupLongitude;
  final String recipientName;
  final String recipientPhone;
  final String deliveryAddress;
  final double? deliveryLatitude;
  final double? deliveryLongitude;
  final String goods;
  final num weightKg;
  final num codAmount;
  final String service;
  final String notes;

  const StaffAssignment({
    required this.assignmentId,
    required this.assignmentStatus,
    required this.shipmentId,
    required this.shipmentStatus,
    required this.senderName,
    required this.senderPhone,
    required this.pickupAddress,
    required this.pickupLatitude,
    required this.pickupLongitude,
    required this.recipientName,
    required this.recipientPhone,
    required this.deliveryAddress,
    required this.deliveryLatitude,
    required this.deliveryLongitude,
    required this.goods,
    required this.weightKg,
    required this.codAmount,
    required this.service,
    required this.notes,
  });

  Map<String, dynamic> toJson() => {
    'assignmentId': assignmentId,
    'assignmentStatus': assignmentStatus,
    'shipmentId': shipmentId,
    'shipmentStatus': shipmentStatus,
    'senderName': senderName,
    'senderPhone': senderPhone,
    'pickupAddress': pickupAddress,
    'pickupLatitude': pickupLatitude,
    'pickupLongitude': pickupLongitude,
    'recipientName': recipientName,
    'recipientPhone': recipientPhone,
    'deliveryAddress': deliveryAddress,
    'deliveryLatitude': deliveryLatitude,
    'deliveryLongitude': deliveryLongitude,
    'goods': goods,
    'weightKg': weightKg,
    'codAmount': codAmount,
    'service': service,
    'notes': notes,
  };

  factory StaffAssignment.fromJson(Map<String, dynamic> j) {
    String s(String key) => j[key]?.toString() ?? '';
    num n(String key) => j[key] is num ? j[key] as num : 0;
    double? coordinate(String key) {
      final value = j[key];
      return value is num ? value.toDouble() : double.tryParse('$value');
    }

    return StaffAssignment(
      assignmentId: (j['assignmentId'] as num).toInt(),
      assignmentStatus: s('assignmentStatus'),
      shipmentId: s('shipmentId'),
      shipmentStatus: s('shipmentStatus'),
      senderName: s('senderName'),
      senderPhone: s('senderPhone'),
      pickupAddress: s('pickupAddress'),
      pickupLatitude: coordinate('pickupLatitude'),
      pickupLongitude: coordinate('pickupLongitude'),
      recipientName: s('recipientName'),
      recipientPhone: s('recipientPhone'),
      deliveryAddress: s('deliveryAddress'),
      deliveryLatitude: coordinate('deliveryLatitude'),
      deliveryLongitude: coordinate('deliveryLongitude'),
      goods: s('goods'),
      weightKg: n('weightKg'),
      codAmount: n('codAmount'),
      service: s('service'),
      notes: s('notes'),
    );
  }
}

/// Các thao tác Staff.
enum StaffAction {
  accept,
  reject,
  startPickup,
  pickupSuccess,
  pickupFailed,
  startDelivery,
  deliverySuccess,
  deliveryFailed,
  startReturn,
  returnComplete,
}

extension StaffActionInfo on StaffAction {
  String get label => switch (this) {
    StaffAction.accept => 'Nhận đơn',
    StaffAction.reject => 'Từ chối',
    StaffAction.startPickup => 'Bắt đầu lấy hàng',
    StaffAction.pickupSuccess => 'Lấy hàng thành công',
    StaffAction.pickupFailed => 'Lấy hàng thất bại',
    StaffAction.startDelivery => 'Bắt đầu giao',
    StaffAction.deliverySuccess => 'Giao thành công',
    StaffAction.deliveryFailed => 'Giao thất bại',
    StaffAction.startReturn => 'Bắt đầu hoàn hàng',
    StaffAction.returnComplete => 'Hoàn hàng xong',
  };

  /// Các action cần hộp thoại nhập lý do.
  bool get needsReason =>
      this == StaffAction.reject ||
      this == StaffAction.pickupFailed ||
      this == StaffAction.deliveryFailed;
}

const assignmentStatusLabel = <String, String>{
  'assigned': 'Chờ nhận đơn',
  'accepted': 'Đã nhận đơn',
  'in_progress': 'Đang thực hiện',
  'completed': 'Hoàn tất',
  'rejected': 'Đã từ chối',
  'cancelled': 'Đã huỷ',
};

const shipmentStatusLabel = <String, String>{
  'pending_pickup': 'Chờ lấy hàng',
  'picking_up': 'Đang đi lấy hàng',
  'picked_up': 'Đã lấy hàng',
  'pickup_failed': 'Lấy hàng thất bại',
  'delivering': 'Đang giao hàng',
  'delivery_failed': 'Giao hàng thất bại',
  'delivered': 'Giao thành công',
  'return_pending': 'Chờ hoàn hàng',
  'returning': 'Đang hoàn hàng',
  'returned': 'Đã hoàn hàng',
};

class StaffApiService {
  static const int _minReason = 3; // khớp DTO backend
  static const int _maxReason = 300;

  // ---- 8.3 - 11 hàm ----
  static Future<List<StaffAssignment>> getStaffAssignments() async {
    final response = await _send(
      () => http.get(
        Uri.parse('${ApiService.baseUrl}/api/v1/staff/shipments'),
        headers: _headers(),
      ),
    );
    final data = _decode(response);
    if (_ok(response)) {
      if (data is List) {
        return data
            .map(
              (e) =>
                  StaffAssignment.fromJson(Map<String, dynamic>.from(e as Map)),
            )
            .toList();
      }
      return [];
    }
    throw Exception(_message(response, data, 'Không tải được danh sách đơn.'));
  }

  static Future<Map<String, dynamic>> acceptAssignment(int id) =>
      _patch(id, 'accept');

  static Future<Map<String, dynamic>> rejectAssignment(int id, String reason) =>
      _patch(id, 'reject', reason: _cleanReason(reason, 'từ chối'));

  static Future<Map<String, dynamic>> startPickup(int id) =>
      _patch(id, 'start-pickup');

  static Future<Map<String, dynamic>> pickupSuccess(int id) =>
      _patch(id, 'pickup-success');

  static Future<Map<String, dynamic>> pickupFailed(int id, String reason) =>
      _patch(
        id,
        'pickup-failed',
        reason: _cleanReason(reason, 'lấy hàng thất bại'),
      );

  static Future<Map<String, dynamic>> startDelivery(int id) =>
      _patch(id, 'start-delivery');

  static Future<Map<String, dynamic>> deliverySuccess(int id) =>
      _patch(id, 'delivery-success');

  static Future<Map<String, dynamic>> deliveryFailed(int id, String reason) =>
      _patch(
        id,
        'delivery-failed',
        reason: _cleanReason(reason, 'giao thất bại'),
      );

  static Future<Map<String, dynamic>> startReturn(int id) =>
      _patch(id, 'start-return');

  static Future<Map<String, dynamic>> returnComplete(int id) =>
      _patch(id, 'return-complete');

  /// Vị trí chỉ được gửi khi Staff tự bật chia sẻ cho một assignment đã nhận.
  static Future<Map<String, dynamic>> updateLocation({
    required int assignmentId,
    required double latitude,
    required double longitude,
    double? accuracyMeters,
  }) async {
    final response = await _send(
      () => http.post(
        Uri.parse('${ApiService.baseUrl}/api/v1/staff/location'),
        headers: _headers(),
        body: jsonEncode({
          'assignmentId': assignmentId,
          'latitude': latitude,
          'longitude': longitude,
          if (accuracyMeters != null) 'accuracyMeters': accuracyMeters,
        }),
      ),
    );
    final data = _decode(response);
    if (_ok(response))
      return data is Map<String, dynamic> ? data : <String, dynamic>{};
    throw Exception(_message(response, data, 'Không cập nhật được vị trí.'));
  }

  /// Gọi đúng hàm theo [action] (tiện cho giao diện).
  static Future<Map<String, dynamic>> perform(
    StaffAction action,
    int id, {
    String reason = '',
  }) {
    switch (action) {
      case StaffAction.accept:
        return acceptAssignment(id);
      case StaffAction.reject:
        return rejectAssignment(id, reason);
      case StaffAction.startPickup:
        return startPickup(id);
      case StaffAction.pickupSuccess:
        return pickupSuccess(id);
      case StaffAction.pickupFailed:
        return pickupFailed(id, reason);
      case StaffAction.startDelivery:
        return startDelivery(id);
      case StaffAction.deliverySuccess:
        return deliverySuccess(id);
      case StaffAction.deliveryFailed:
        return deliveryFailed(id, reason);
      case StaffAction.startReturn:
        return startReturn(id);
      case StaffAction.returnComplete:
        return returnComplete(id);
    }
  }

  /// Assignment này đang được phép làm gì (khớp điều kiện backend).
  static List<StaffAction> availableActions(StaffAssignment a) {
    final shipment = a.shipmentStatus.trim().toLowerCase();
    final assignment = a.assignmentStatus.trim().toLowerCase();
    // Shipment là trạng thái xử lý thực tế; assignment chỉ dùng lúc nhận đơn
    // và thử lấy lại (Backend bắt buộc assignment = accepted).
    if (shipment == 'pending_pickup') {
      if (assignment == 'assigned') {
        return [StaffAction.accept, StaffAction.reject];
      }
      if (assignment == 'accepted') return [StaffAction.startPickup];
      return [];
    }
    if (shipment == 'pickup_failed') {
      return assignment == 'accepted' ? [StaffAction.startPickup] : [];
    }
    switch (shipment) {
      case 'picking_up':
        return [StaffAction.pickupSuccess, StaffAction.pickupFailed];
      case 'picked_up':
      case 'delivery_failed':
        return [StaffAction.startDelivery];
      case 'delivering':
        return [StaffAction.deliverySuccess, StaffAction.deliveryFailed];
      case 'return_pending':
        return [StaffAction.startReturn];
      case 'returning':
        return [StaffAction.returnComplete];
      default:
        return [];
    }
  }

  /// Adapter dùng bởi giao diện Staff của Thuật; nghiệp vụ nằm tại service của Ân.
  static Future<Map<String, dynamic>> performPath(
    String path,
    int assignmentId, {
    String? reason,
  }) {
    switch (path) {
      case 'accept':
        return acceptAssignment(assignmentId);
      case 'reject':
        return rejectAssignment(assignmentId, reason ?? '');
      case 'start-pickup':
        return startPickup(assignmentId);
      case 'pickup-success':
        return pickupSuccess(assignmentId);
      case 'pickup-failed':
        return pickupFailed(assignmentId, reason ?? '');
      case 'start-delivery':
        return startDelivery(assignmentId);
      case 'delivery-success':
        return deliverySuccess(assignmentId);
      case 'delivery-failed':
        return deliveryFailed(assignmentId, reason ?? '');
      case 'start-return':
        return startReturn(assignmentId);
      case 'return-complete':
        return returnComplete(assignmentId);
      default:
        throw Exception('Thao tác Staff không hợp lệ: $path');
    }
  }

  // ---- Nội bộ ----
  static Future<Map<String, dynamic>> _patch(
    int id,
    String action, {
    String? reason,
  }) async {
    if (id <= 0) throw Exception('assignmentId không hợp lệ.');

    final response = await _send(
      () => http.patch(
        Uri.parse('${ApiService.baseUrl}/api/v1/staff/assignments/$id/$action'),
        headers: _headers(),
        body: reason == null ? null : jsonEncode({'reason': reason}),
      ),
    );

    final data = _decode(response);
    if (_ok(response)) {
      return data is Map<String, dynamic> ? data : <String, dynamic>{};
    }
    throw Exception(_message(response, data, 'Thao tác không thành công.'));
  }

  static String _cleanReason(String reason, String what) {
    final value = reason.trim();
    if (value.length < _minReason || value.length > _maxReason) {
      throw Exception('Lý do $what phải từ $_minReason đến $_maxReason ký tự.');
    }
    return value;
  }

  static Map<String, String> _headers() {
    return ApiService.authHeaders();
  }

  static Future<http.Response> _send(
    Future<http.Response> Function() request,
  ) async {
    try {
      return await request().timeout(const Duration(seconds: 10));
    } catch (_) {
      throw Exception('Không kết nối được máy chủ. Vui lòng thử lại sau.');
    }
  }

  static bool _ok(http.Response r) => r.statusCode >= 200 && r.statusCode < 300;

  static dynamic _decode(http.Response r) {
    if (r.statusCode == 401 || r.statusCode == 403) {
      // JWT/session lifecycle always belongs to the common ApiService.
      ApiService.decodeApiResponse(r);
    }
    if (r.body.isEmpty) return null;
    try {
      return jsonDecode(r.body);
    } catch (_) {
      return {'message': r.body};
    }
  }

  static String _message(http.Response r, dynamic data, String fallback) {
    if (r.statusCode == 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    if (r.statusCode == 403) {
      return 'Tài khoản không có quyền thực hiện thao tác này.';
    }
    if (data is Map) {
      final message = data['message'];
      if (message is String && message.isNotEmpty) return message;

      final errors = data['errors'];
      if (errors is Map) {
        final texts = errors.values
            .expand((v) => v is List ? v : [v])
            .whereType<String>()
            .toList();
        if (texts.isNotEmpty) return texts.join(' ');
      }

      final title = data['title'];
      if (title is String && title.isNotEmpty) return title;
    }
    return fallback;
  }
  
    static const incidentTypeLabels = <String, String>{
    'customer_unreachable': 'Không liên lạc được người nhận',
    'wrong_address': 'Sai / thiếu địa chỉ',
    'customer_refused': 'Người nhận từ chối nhận hàng',
    'goods_damaged': 'Hàng bị hư hỏng',
    'vehicle_issue': 'Sự cố phương tiện',
    'accident': 'Tai nạn giao thông',
    'other': 'Sự cố khác',
  };

  static Future<Map<String, dynamic>> reportIncident(
    int assignmentId,
    String type,
    String description,
  ) async {
    final desc = description.trim();
    if (!incidentTypeLabels.containsKey(type)) {
      throw Exception('Loại sự cố không hợp lệ.');
    }
    if (desc.length < 10 || desc.length > 1000) {
      throw Exception('Mô tả sự cố phải từ 10 đến 1000 ký tự.');
    }
    final response = await _send(
      () => http.post(
        Uri.parse(
            '${ApiService.baseUrl}/api/v1/staff/assignments/$assignmentId/incidents'),
        headers: _headers(),
        body: jsonEncode({'type': type, 'description': desc}),
      ),
    );
    final data = _decode(response);
    if (_ok(response)) return Map<String, dynamic>.from(data as Map);
    throw Exception(_message(response, data, 'Không gửi được báo cáo sự cố.'));
  }

  static Future<List<Map<String, dynamic>>> getMyIncidents() async {
    final response = await _send(
      () => http.get(
        Uri.parse('${ApiService.baseUrl}/api/v1/staff/incidents'),
        headers: _headers(),
      ),
    );
    final data = _decode(response);
    if (_ok(response)) {
      return data is List
          ? data.map((e) => Map<String, dynamic>.from(e as Map)).toList()
          : [];
    }
    throw Exception(_message(response, data, 'Không tải được danh sách sự cố.'));
  }
}
