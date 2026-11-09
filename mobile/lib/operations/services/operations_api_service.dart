import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../services/api_service.dart';
import '../models/operations_models.dart';

class OperationsApiService {
  static Map<String, String> _headers() => ApiService.authHeaders();

  static bool _ok(http.Response response) =>
      response.statusCode >= 200 && response.statusCode < 300;

  // Cùng xử lý 401/403 với toàn bộ ứng dụng, không tạo session riêng.
  static Map<String, dynamic> _decode(http.Response response) =>
      ApiService.decodeApiResponse(response);

  // ===================================================================
  // 1. GET /api/v1/operations/shipments
  // Params: status, search, customerId, staffId, sort, page, pageSize
  // ===================================================================
  static Future<Map<String, dynamic>> getShipments({
    String? status,
    String? search,
    int? customerId,
    int? staffId,
    String sort = 'newest',
    int page = 1,
    int pageSize = 20,
  }) async {
    final queryParams = <String, String>{
      'sort': sort,
      'page': page.toString(),
      'pageSize': pageSize.toString(),
    };

    if (status != null && status.isNotEmpty) queryParams['status'] = status;
    if (search != null && search.trim().isNotEmpty) queryParams['search'] = search.trim();
    if (customerId != null) queryParams['customerId'] = customerId.toString();
    if (staffId != null) queryParams['staffId'] = staffId.toString();

    final uri = Uri.parse('${ApiService.baseUrl}/api/v1/operations/shipments')
        .replace(queryParameters: queryParams);

    final response = await http
        .get(uri, headers: _headers())
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      final rawItems = data['items'];
      final List<OperationShipment> shipments = [];
      if (rawItems is List) {
        for (final item in rawItems) {
          if (item is Map) {
            shipments.add(OperationShipment.fromJson(Map<String, dynamic>.from(item)));
          }
        }
      }

      return {
        'page': data['page'] ?? page,
        'pageSize': data['pageSize'] ?? pageSize,
        'totalItems': data['totalItems'] ?? shipments.length,
        'totalPages': data['totalPages'] ?? 1,
        'items': shipments,
      };
    }

    throw Exception(data['message'] ?? 'Không tải được danh sách đơn hàng Operations.');
  }

  // ===================================================================
  // 1b. GET /api/v1/operations/shipments/new
  // Luồng lấy đơn hàng mới chờ phân công
  // Logic bắt buộc: Lọc bỏ các đơn VNPay có paymentStatus khác 'PAID'
  // ===================================================================
  static Future<List<OperationShipment>> getNewShipments() async {
    final response = await http
        .get(
          Uri.parse('${ApiService.baseUrl}/api/v1/operations/shipments/new'),
          headers: _headers(),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      final rawList = data['data'] ?? (data is List ? data : data['items']);
      final List<OperationShipment> allNew = [];

      final listToIterate = rawList is List ? rawList : (data['data'] is List ? data['data'] as List : []);
      for (final e in listToIterate) {
        if (e is Map) {
          allNew.add(OperationShipment.fromJson(Map<String, dynamic>.from(e)));
        }
      }

      // Logic bắt buộc ở Frontend:
      // Lọc bỏ các đơn thanh toán VNPay có paymentStatus khác 'PAID',
      // chỉ hiển thị các đơn VNPay đã thanh toán hoặc các đơn không dùng VNPay.
      final filtered = allNew.where((shipment) {
        final isVnPay = (shipment.paymentMethod?.toLowerCase() == 'vnpay') ||
            (shipment.feePayer == 'shop_prepaid');

        if (isVnPay) {
          final pStatus = shipment.paymentStatus?.toUpperCase() ?? '';
          return pStatus == 'PAID';
        }

        // Các đơn không thanh toán trước bằng VNPay thì hiển thị bình thường
        return true;
      }).toList();

      return filtered;
    }

    throw Exception(data['message'] ?? 'Không tải được danh sách đơn mới chờ phân công.');
  }

  // ===================================================================
  // 2. GET /api/v1/operations/shipments/{shipmentId}
  // Chi tiết đơn hàng
  // ===================================================================
  static Future<OperationShipmentDetail> getShipmentDetail(String shipmentId) async {
    final response = await http
        .get(
          Uri.parse('${ApiService.baseUrl}/api/v1/operations/shipments/${Uri.encodeComponent(shipmentId)}'),
          headers: _headers(),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      return OperationShipmentDetail.fromJson(data);
    }

    throw Exception(data['message'] ?? 'Không tải được chi tiết đơn hàng.');
  }

  // ===================================================================
  // 3. GET /api/v1/operations/staff/available
  // Lấy danh sách nhân viên khả dụng cho Dropdown phân công
  // ===================================================================
  static Future<List<OperationStaff>> getAvailableStaff() async {
    final response = await http
        .get(
          Uri.parse('${ApiService.baseUrl}/api/v1/operations/staff/available'),
          headers: _headers(),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      final raw = data['data'] ?? (data is List ? data : []);
      final list = raw is List ? raw : [];
      return list
          .whereType<Map>()
          .map((e) => OperationStaff.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }

    throw Exception(data['message'] ?? 'Không tải được danh sách nhân viên khả dụng.');
  }

  // ===================================================================
  // 3b. POST /api/v1/operations/shipments/{shipmentId}/assign
  // Phân công nhân viên
  // ===================================================================
  static Future<Map<String, dynamic>> assignShipment({
    required String shipmentId,
    required int staffId,
  }) async {
    final response = await http
        .post(
          Uri.parse('${ApiService.baseUrl}/api/v1/operations/shipments/${Uri.encodeComponent(shipmentId)}/assign'),
          headers: _headers(),
          body: jsonEncode({'staffId': staffId}),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      return data;
    }

    throw Exception(data['message'] ?? 'Phân công nhân viên thất bại.');
  }

  // ===================================================================
  // 4a. PATCH /api/v1/operations/shipments/{shipmentId}/reassign
  // Chuyển phân công nhân viên
  // ===================================================================
  static Future<Map<String, dynamic>> reassignShipment({
    required String shipmentId,
    required int staffId,
    required String reason,
  }) async {
    final response = await http
        .patch(
          Uri.parse('${ApiService.baseUrl}/api/v1/operations/shipments/${Uri.encodeComponent(shipmentId)}/reassign'),
          headers: _headers(),
          body: jsonEncode({
            'staffId': staffId,
            'reason': reason.trim(),
          }),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      return data;
    }

    throw Exception(data['message'] ?? 'Chuyển phân công nhân viên thất bại.');
  }

  // ===================================================================
  // 4b. PATCH /api/v1/operations/assignments/{id}/cancel
  // Hủy phân công nhân viên (Chặn nhập tay trạng thái, chỉ nhận reason)
  // ===================================================================
  static Future<Map<String, dynamic>> cancelAssignment({
    required int assignmentId,
    required String reason,
  }) async {
    final response = await http
        .patch(
          Uri.parse('${ApiService.baseUrl}/api/v1/operations/assignments/$assignmentId/cancel'),
          headers: _headers(),
          body: jsonEncode({
            'reason': reason.trim(),
          }),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      return data;
    }

    throw Exception(data['message'] ?? 'Hủy phân công thất bại.');
  }

  // ===================================================================
  // 5a. GET /api/v1/settlements
  // Lấy dữ liệu đối soát: eligibleShipments & settlements
  // ===================================================================
  static Future<Map<String, dynamic>> getSettlements() async {
    final response = await http
        .get(
          Uri.parse('${ApiService.baseUrl}/api/v1/settlements'),
          headers: _headers(),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      final rawEligible = data['eligibleShipments'];
      final rawSettlements = data['settlements'];

      final List<OperationShipment> eligibleList = [];
      if (rawEligible is List) {
        for (final item in rawEligible) {
          if (item is Map) {
            eligibleList.add(OperationShipment.fromJson(Map<String, dynamic>.from(item)));
          }
        }
      }

      final List<SettlementItem> settlementsList = [];
      if (rawSettlements is List) {
        for (final item in rawSettlements) {
          if (item is Map) {
            settlementsList.add(SettlementItem.fromJson(Map<String, dynamic>.from(item)));
          }
        }
      }

      return {
        'eligibleShipments': eligibleList,
        'settlements': settlementsList,
      };
    }

    throw Exception(data['message'] ?? 'Không tải được dữ liệu đối soát.');
  }

  // ===================================================================
  // 5b. POST /api/v1/settlements
  // Tạo kỳ đối soát mới
  // ===================================================================
  static Future<Map<String, dynamic>> createSettlement({
    required List<String> shipmentIds,
    num adjustment = 0,
    String adjustmentReason = '',
  }) async {
    final response = await http
        .post(
          Uri.parse('${ApiService.baseUrl}/api/v1/settlements'),
          headers: _headers(),
          body: jsonEncode({
            'shipmentIds': shipmentIds,
            'adjustment': adjustment,
            'adjustmentReason': adjustmentReason.trim(),
          }),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      return data;
    }

    throw Exception(data['message'] ?? 'Lập kỳ đối soát không thành công.');
  }

  // ===================================================================
  // 5c. POST /api/v1/settlements/{id}/complete
  // Hoàn tất kỳ đối soát (Operations xác nhận chuyển tiền)
  // ===================================================================
  static Future<Map<String, dynamic>> completeSettlement({
    required String settlementId,
    required String paymentReference,
  }) async {
    final response = await http
        .post(
          Uri.parse('${ApiService.baseUrl}/api/v1/settlements/${Uri.encodeComponent(settlementId)}/complete'),
          headers: _headers(),
          body: jsonEncode({
            'paymentReference': paymentReference.trim(),
          }),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      return data;
    }

    throw Exception(data['message'] ?? 'Không hoàn tất được kỳ đối soát.');
  }

  // ===================================================================
  // 6a. GET /api/v1/operations/areas
  // Lấy danh sách khu vực vận hành
  // ===================================================================
  static Future<List<OperationArea>> getAreas() async {
    final response = await http
        .get(
          Uri.parse('${ApiService.baseUrl}/api/v1/operations/areas'),
          headers: _headers(),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      final raw = data['data'] ?? (data is List ? data : []);
      final list = raw is List ? raw : [];
      return list
          .whereType<Map>()
          .map((e) => OperationArea.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }

    throw Exception(data['message'] ?? 'Không tải được danh sách khu vực Operations.');
  }

  // ===================================================================
  // 6b. POST /api/v1/operations/areas
  // Thêm mới khu vực vận hành
  // ===================================================================
  static Future<OperationArea> createArea({
    required String code,
    required String name,
    required String type,
    bool isActive = true,
  }) async {
    final response = await http
        .post(
          Uri.parse('${ApiService.baseUrl}/api/v1/operations/areas'),
          headers: _headers(),
          body: jsonEncode({
            'code': code.trim().toUpperCase(),
            'name': name.trim(),
            'type': type,
            'isActive': isActive,
          }),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      return OperationArea.fromJson(data);
    }

    throw Exception(data['message'] ?? 'Thêm mới khu vực thất bại.');
  }

  // ===================================================================
  // 6c. PUT /api/v1/operations/areas/{id}
  // Cập nhật khu vực vận hành
  // ===================================================================
  static Future<OperationArea> updateArea({
    required int id,
    required String code,
    required String name,
    required String type,
    required bool isActive,
  }) async {
    final response = await http
        .put(
          Uri.parse('${ApiService.baseUrl}/api/v1/operations/areas/$id'),
          headers: _headers(),
          body: jsonEncode({
            'code': code.trim().toUpperCase(),
            'name': name.trim(),
            'type': type,
            'isActive': isActive,
          }),
        )
        .timeout(const Duration(seconds: 15));

    final data = _decode(response);
    if (_ok(response)) {
      return OperationArea.fromJson(data);
    }

    throw Exception(data['message'] ?? 'Cập nhật khu vực thất bại.');
  }
}

