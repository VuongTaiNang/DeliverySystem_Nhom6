import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_service.dart';

class PasswordResetService {
  static const _timeout = Duration(seconds: 10);

  static Future<Map<String, dynamic>> requestOtp(String phone) async {
    final response = await http
        .post(
          Uri.parse('${ApiService.baseUrl}/api/v1/auth/forgot-password/request'),
          headers: const {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: jsonEncode({'phone': phone.trim()}),
        )
        .timeout(_timeout);

    final data = _decode(response);
    if (_ok(response)) return data;

    throw Exception(data['message'] ?? 'Không thể gửi mã OTP.');
  }

  static Future<String> resetPassword({
    required String phone,
    required String otp,
    required String newPassword,
  }) async {
    final response = await http
        .post(
          Uri.parse('${ApiService.baseUrl}/api/v1/auth/forgot-password/reset'),
          headers: const {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: jsonEncode({
            'phone': phone.trim(),
            'otp': otp.trim(),
            'newPassword': newPassword,
          }),
        )
        .timeout(_timeout);

    final data = _decode(response);
    if (_ok(response)) {
      return data['message']?.toString() ?? 'Đặt lại mật khẩu thành công.';
    }

    throw Exception(data['message'] ?? 'Không thể đặt lại mật khẩu.');
  }

  static bool _ok(http.Response response) =>
      response.statusCode >= 200 && response.statusCode < 300;

  static Map<String, dynamic> _decode(http.Response response) {
    if (response.body.isEmpty) return <String, dynamic>{};

    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) return decoded;
      return <String, dynamic>{'data': decoded};
    } catch (_) {
      return <String, dynamic>{'message': response.body};
    }
  }
}
