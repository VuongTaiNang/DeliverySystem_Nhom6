import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const useMock =
      bool.fromEnvironment(
        'USE_MOCK',
        defaultValue: false,
      );
  static const String _configuredBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: '');

  static String get baseUrl {
    if (_configuredBaseUrl.isNotEmpty) return _configuredBaseUrl;
    if (kIsWeb) return 'http://localhost:5274';
    if (defaultTargetPlatform == TargetPlatform.android) {
  return 'http://10.21.239.201:5274'; // Giữ cấu hình thiết bị thật của Thuật; emulator dùng --dart-define=API_BASE_URL=http://10.0.2.2:5274
}
    return 'http://localhost:5274';
  }

  static String? currentUserId;
  static String? currentToken;
  static String? currentName;
  static String? currentRole;
  static void Function()? onSessionExpired;
  static Map<String, dynamic>? _savedUser;
  static const _sessionKey = 'express_mobile_session';

  // Preserve JWT and user details through full Flutter Web page reloads.
  static Future<Map<String, dynamic>?> restoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_sessionKey);
      if (raw == null) return null;
      final data = jsonDecode(raw);
      if (data is! Map) return null;
      final session = Map<String, dynamic>.from(data);
      final token = (session['token'] ?? '').toString();
      if (token.isEmpty) return null;
      currentToken = token;
      currentUserId = session['userId']?.toString();
      currentName = session['name']?.toString();
      currentRole = session['role']?.toString().toLowerCase();
      _savedUser = Map<String, dynamic>.from(session['user'] as Map? ?? session);
      return _savedUser;
    } catch (_) {
      return null;
    }
  }

  static Future<void> _persistSession(Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_sessionKey, jsonEncode({
      'token': currentToken,
      'userId': currentUserId,
      'name': currentName,
      'role': currentRole,
      'user': user,
    }));
  }


            static Future<void> changePassword({
        required String currentPassword,
        required String newPassword,
      }) async {
        final response = await http
            .put(
              Uri.parse(
                '$baseUrl/api/v1/account/change-password',
              ),
              headers: _headers(),
              body: jsonEncode({
                'currentPassword':
                    currentPassword,
                'newPassword':
                    newPassword,
              }),
            )
            .timeout(
              const Duration(seconds: 10),
            );

        final data = _decodeResponse(response);

        if (_ok(response)) {
          return;
        }

        throw Exception(
          data['message'] ??
              'Không đổi được mật khẩu.',
        );
      }

      static Future<Map<String, dynamic>> getAccount() async {
        final response = await http
            .get(
              Uri.parse(
                '$baseUrl/api/v1/account/me',
              ),
              headers: _headers(),
            )
            .timeout(
              const Duration(seconds: 10),
            );

        final data = _decodeResponse(response);

        if (_ok(response)) {
          return data;
        }

        throw Exception(
          data['message'] ??
              'Không tải được thông tin tài khoản.',
        );
      }

          static Future<Map<String, dynamic>> updateAccount({
          required String fullName,
          required String email,
          required String phone,
          String? shopName,
        }) async {
          final response = await http
              .put(
                Uri.parse(
                  '$baseUrl/api/v1/account/me',
                ),
                headers: _headers(),
                body: jsonEncode({
                  'fullName': fullName.trim(),
                  'email': email.trim(),
                  'phone': phone.trim(),
                  'shopName':
                      shopName?.trim(),
                }),
              )
              .timeout(
                const Duration(seconds: 10),
              );

          final data = _decodeResponse(response);

          if (_ok(response)) {
            return data;
          }

          throw Exception(
            data['message'] ??
                'Không cập nhật được tài khoản.',
          );
        }

  static Future<Map<String, dynamic>> register({
    required String fullName,
    String? shopName,
    required String phone,
    required String email,
    required String password,
  }) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/api/v1/auth/register'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'fullName': fullName.trim(),
            'shopName': shopName == null || shopName.trim().isEmpty
                ? null
                : shopName.trim(),
            'phone': phone.trim(),
            'email': email.trim(),
            'password': password,
          }),
        )
        .timeout(const Duration(seconds: 10));

    final data = _decodeResponse(response);
    if (_ok(response)) return data;
    throw Exception(data['message'] ?? 'Đăng ký không thành công.');
  }

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/api/v1/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': email.trim(), 'password': password}),
        )
        .timeout(const Duration(seconds: 10));

    final data = _decodeResponse(response);
    if (_ok(response)) {
      currentUserId = (data['id'] ?? data['userId'])?.toString();
      currentName = (data['name'] ?? data['fullName'])?.toString();
      currentRole = data['role']?.toString().toLowerCase();
      currentToken = data['token']?.toString();
      if (currentToken == null || currentToken!.isEmpty) throw Exception('Backend không trả JWT token.');
      _savedUser = data;
      await _persistSession(data);
      return data;
    }
    throw Exception(data['message'] ?? 'Đăng nhập không thành công.');
  }

  // Pickup locations shared with React Web and SQL Server.
  static Future<List<Map<String, dynamic>>> listPickupLocations() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/v1/pickup-locations'),
      headers: _headers(),
    ).timeout(const Duration(seconds: 15));
    final data = _decodeResponse(response);
    if (!_ok(response)) {
      throw Exception(data['message'] ?? 'Không tải được điểm lấy hàng.');
    }
    final raw = data['data'];
    if (raw is! List) throw Exception('Danh sách điểm lấy hàng không hợp lệ.');
    return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  static Future<Map<String, dynamic>> createPickupLocation({
    required String name,
    required String contactName,
    required String contactPhone,
    required String address,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/pickup-locations'),
      headers: _headers(),
      body: jsonEncode({
        'name': name.trim(),
        'contactName': contactName.trim(),
        'contactPhone': contactPhone.trim(),
        'address': address.trim(),
      }),
    ).timeout(const Duration(seconds: 15));
    final data = _decodeResponse(response);
    if (!_ok(response)) {
      throw Exception(data['message'] ?? 'Không lưu được điểm lấy hàng.');
    }
    return data;
  }

  static Future<void> deletePickupLocation(String id) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/api/v1/pickup-locations/${Uri.encodeComponent(id)}'),
      headers: _headers(),
    ).timeout(const Duration(seconds: 15));
    if (!_ok(response)) {
      final data = _decodeResponse(response);
      throw Exception(data['message'] ?? 'Không xóa được điểm lấy hàng.');
    }
  }

  // Sprint 3: structured ward/commune/special-zone catalog.
  static Future<List<Map<String, dynamic>>> listAreas() async {
    try {
      final opsResponse = await http.get(
        Uri.parse('$baseUrl/api/v1/operations/areas'),
        headers: _headers(),
      ).timeout(const Duration(seconds: 10));

      if (_ok(opsResponse)) {
        final decoded = jsonDecode(opsResponse.body);
        if (decoded is List) {
          return decoded.map((item) =>
            Map<String, dynamic>.from(item as Map)
          ).toList();
        }
      }
    } catch (_) {
      // Fallback to /api/v1/areas if not authorized as operations
    }

    final response = await http.get(
      Uri.parse('$baseUrl/api/v1/areas'),
      headers: _headers(),
    ).timeout(const Duration(seconds: 10));

    if (!_ok(response)) {
      final data = _decodeResponse(response);
      throw Exception(data['message'] ?? 'Không tải được danh mục phường/xã.');
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! List) {
      throw Exception('Danh mục khu vực trả về không hợp lệ.');
    }
    return decoded.map((item) =>
      Map<String, dynamic>.from(item as Map)
    ).toList();
  }

  static Future<Map<String, dynamic>> createQuote({
    required Map<String, dynamic> order,
  }) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/api/v1/shipping-quotes'),
          headers: _headers(),
          body: jsonEncode(order),
        )
        .timeout(const Duration(seconds: 10));

    final data = _decodeResponse(response);
    if (_ok(response)) return data;
    throw Exception(data['message'] ?? 'Không tính được phí vận chuyển.');
  }

  static Future<Map<String, dynamic>> createOrder({
    required Map<String, dynamic> order,
    required String quoteId,
  }) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/api/v1/shipments'),
          headers: _headers(),
          body: jsonEncode({...order, 'quoteId': quoteId}),
        )
        .timeout(const Duration(seconds: 10));

    final data = _decodeResponse(response);
    if (_ok(response)) return data;
    throw Exception(data['message'] ?? 'Không tạo được đơn hàng.');
  }

  static Future<List<Map<String, dynamic>>> listOrders() async {
    final response = await http
        .get(Uri.parse('$baseUrl/api/v1/shipments'), headers: _headers())
        .timeout(const Duration(seconds: 10));

    final data = _decodeResponse(response);
    if (_ok(response)) {
      final list = data['data'];
      if (list is List) {
        return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    }
    throw Exception(data['message'] ?? 'Không tải được đơn hàng.');
  }

  static Future<Map<String, dynamic>> getOrder(String shipmentId) async {
    final response = await http
        .get(
          Uri.parse(
            '$baseUrl/api/v1/shipments/${Uri.encodeComponent(shipmentId)}',
          ),
          headers: _headers(),
        )
        .timeout(const Duration(seconds: 10));

    final data = _decodeResponse(response);
    if (_ok(response)) return data;
    throw Exception(data['message'] ?? 'Không tải được chi tiết đơn hàng.');
  }

  // Đồng bộ với GET /api/v1/shipments/{shipmentId}/complaints
  static Future<List<Map<String, dynamic>>> listComplaints(
    String shipmentId,
  ) async {
    final response = await http
        .get(
          Uri.parse(
            '$baseUrl/api/v1/shipments/${Uri.encodeComponent(shipmentId)}/complaints',
          ),
          headers: _headers(),
        )
        .timeout(const Duration(seconds: 10));

    final data = _decodeResponse(response);
    if (_ok(response)) {
      final list = data['data'];
      if (list is List) {
        return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    }
    throw Exception(data['message'] ?? 'Không tải được báo cáo sự cố.');
  }

  // Đồng bộ với POST /api/v1/shipments/{shipmentId}/complaints
  static Future<Map<String, dynamic>> createComplaint({
    required String shipmentId,
    required String type,
    required String content,
  }) async {
    final response = await http
        .post(
          Uri.parse(
            '$baseUrl/api/v1/shipments/${Uri.encodeComponent(shipmentId)}/complaints',
          ),
          headers: _headers(),
          body: jsonEncode({'type': type, 'content': content.trim()}),
        )
        .timeout(const Duration(seconds: 10));

    final data = _decodeResponse(response);
    if (_ok(response)) return data;
    throw Exception(data['message'] ?? 'Không gửi được báo cáo sự cố.');
  }

  // Lấy đánh giá hiện tại của đơn hàng
  static Future<Map<String, dynamic>?> getRating(
    String shipmentId,
  ) async {
    final response = await http
        .get(
          Uri.parse(
            '$baseUrl/api/v1/customer/shipments/${Uri.encodeComponent(shipmentId)}/rating',
          ),
          headers: _headers(),
        )
        .timeout(const Duration(seconds: 10));

    final data = _decodeResponse(response);

    if (_ok(response)) {
      // API có thể trả dữ liệu trong trường data hoặc trực tiếp.
      final rating = data['data'] ?? data;

      if (rating is Map<String, dynamic> && rating.isNotEmpty) {
        return rating;
      }

      return null;
    }

    // Chỉ xem 404 là chưa có đánh giá nếu Backend quy định như vậy.
    if (response.statusCode == 404) {
      return null;
    }

    throw Exception(
      data['message'] ?? 'Không tải được đánh giá dịch vụ.',
    );
  }

  // Tạo đánh giá mới
  static Future<Map<String, dynamic>> createRating({
    required String shipmentId,
    required int rating,
    required String comment,
  }) async {
    final response = await http
        .post(
          Uri.parse(
            '$baseUrl/api/v1/customer/shipments/${Uri.encodeComponent(shipmentId)}/rating',
          ),
          headers: _headers(),
          body: jsonEncode({
  'score': rating,
  'comment': comment.trim(),
})
        )
        .timeout(const Duration(seconds: 10));

    final data = _decodeResponse(response);

    if (_ok(response)) return data;

    throw Exception(data['message'] ?? 'Không gửi được đánh giá.');
  }

  // Cập nhật đánh giá đã tồn tại
  static Future<Map<String, dynamic>> updateRating({
    required String shipmentId,
    required int rating,
    required String comment,
  }) async {
    final response = await http
        .put(
          Uri.parse(
            '$baseUrl/api/v1/customer/shipments/${Uri.encodeComponent(shipmentId)}/rating',
          ),
          headers: _headers(),
          body: jsonEncode({
  'score': rating,
  'comment': comment.trim(),
}),
        )
        .timeout(const Duration(seconds: 10));

    final data = _decodeResponse(response);

    if (_ok(response)) return data;

    throw Exception(data['message'] ?? 'Không cập nhật được đánh giá.');
  }



  // Các module Operations/Customer/Staff cùng dùng một phiên JWT.
  static Map<String, String> authHeaders() => _headers();
  static Map<String, dynamic> decodeApiResponse(http.Response response) =>
      _decodeResponse(response);

  static Map<String, String> _headers() {
  final headers = <String, String>{
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (currentToken != null) {
    headers['Authorization'] = 'Bearer $currentToken';
  }
  return headers;
}

  static bool _ok(http.Response response) =>
      response.statusCode >= 200 && response.statusCode < 300;

  static Map<String, dynamic> _decodeResponse(http.Response response) {
    if (response.statusCode == 401) {
      final hadSession = currentToken != null;
      // First clear the in-memory token, then persistent storage, before
      // navigating back to Login on an expired session.
      logout().then((_) {
        if (hadSession) onSessionExpired?.call();
      }).catchError((Object _) {
        if (hadSession) onSessionExpired?.call();
      });
      throw Exception('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
    if (response.statusCode == 403) {
      throw Exception('Bạn không có quyền truy cập chức năng này.');
    }
    if (response.body.isEmpty) return {};
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) return decoded;
      return {'data': decoded};
    } catch (_) {
      return {'message': response.body};
    }
  }

  static Future<List<Map<String, dynamic>>> getStaffAssignments() async {
    final response = await http.get(Uri.parse('$baseUrl/api/v1/staff/shipments'), headers: _headers()).timeout(const Duration(seconds: 15));
    if (response.statusCode == 401) { _decodeResponse(response); }
    if (response.statusCode == 403) _decodeResponse(response);
    if (!_ok(response)) throw Exception(_decodeResponse(response)['message'] ?? 'Không tải được công việc.');
    final decoded = jsonDecode(response.body);
    return (decoded as List).map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  static Future<void> staffAction(int assignmentId, String action, {String? reason}) async {
    final response = await http.patch(Uri.parse('$baseUrl/api/v1/staff/assignments/$assignmentId/$action'),
      headers: _headers(), body: reason == null ? null : jsonEncode({'reason': reason})).timeout(const Duration(seconds: 15));
    if (response.statusCode == 401) { _decodeResponse(response); }
    if (response.statusCode == 403) _decodeResponse(response);
    if (!_ok(response)) throw Exception(_decodeResponse(response)['message'] ?? 'Không cập nhật được trạng thái.');
  }

  static Future<Map<String, dynamic>> createVnPayPayment(String shipmentId) async {
    final response = await http.post(Uri.parse('$baseUrl/api/v1/payments/vnpay'), headers: _headers(),
      body: jsonEncode({'shipmentId': shipmentId})).timeout(const Duration(seconds: 15));
    final data = _decodeResponse(response);
    if (!_ok(response)) throw Exception(data['message'] ?? 'Không tạo được thanh toán VNPay.');
    return data;
  }

  static Future<Map<String, dynamic>> getPaymentStatus(String paymentId) async {
    final response = await http.get(Uri.parse('$baseUrl/api/v1/payments/${Uri.encodeComponent(paymentId)}'), headers: _headers()).timeout(const Duration(seconds: 15));
    final data = _decodeResponse(response);
    if (!_ok(response)) throw Exception(data['message'] ?? 'Không kiểm tra được thanh toán.');
    return data;
  }

  // GET /api/v1/payments/statuses - shared with the React Web client.
  // A successful payment takes priority over earlier failed attempts.
  static Future<Map<String, String>> getShipmentPaymentStatuses() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/v1/payments/statuses'),
      headers: _headers(),
    ).timeout(const Duration(seconds: 15));
    final data = _decodeResponse(response);
    if (!_ok(response)) {
      throw Exception(data['message'] ?? 'Không tải được trạng thái thanh toán.');
    }
    final raw = data['data'];
    if (raw is! List) {
      throw Exception('Phản hồi danh sách trạng thái thanh toán không hợp lệ.');
    }
    final result = <String, String>{};
    for (final item in raw) {
      if (item is! Map) continue;
      final id = (item['shipmentId'] ?? '').toString().trim();
      final status = (item['status'] ?? '').toString().toLowerCase();
      if (id.isNotEmpty) result[id] = status;
    }
    return result;
  }

  static Future<void> logout() async {
    // Clear RAM immediately and wait for persisted session to be removed.
    // Callers should await this before navigating or allowing page reload.
    _savedUser = null;
    currentUserId = null;
    currentToken = null;
    currentName = null;
    currentRole = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionKey);
  }
}
