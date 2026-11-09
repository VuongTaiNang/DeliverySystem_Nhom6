import 'dart:async';
import 'dart:convert';

import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

import 'api_service.dart';

enum GeofenceStage { pickup, delivery }

class GeofenceTarget {
  final GeofenceStage stage;
  final double latitude;
  final double longitude;

  const GeofenceTarget({
    required this.stage,
    required this.latitude,
    required this.longitude,
  });

  String get apiStage => stage == GeofenceStage.pickup ? 'pickup' : 'delivery';
  String get label => stage == GeofenceStage.pickup ? 'điểm lấy hàng' : 'điểm giao hàng';
}

/// Theo dõi GPS khi Staff đang ở đúng giai đoạn công việc.
/// Chỉ phát sinh arrival event; không thực hiện pickup-success/delivery-success.
class GeofenceService {
  GeofenceService({
    this.radiusMeters = 150,
    this.maxAccuracyMeters = 100,
  });

  final double radiusMeters;
  final double maxAccuracyMeters;

  StreamSubscription<Position>? _subscription;
  bool _requestInFlight = false;
  bool _arrivalRecorded = false;
  DateTime? _lastAttemptAt;

  bool get isMonitoring => _subscription != null;

  Future<void> start({
    required int assignmentId,
    required GeofenceTarget target,
    required void Function(String message) onStatus,
  }) async {
    await stop();
    _arrivalRecorded = false;
    _lastAttemptAt = null;

    if (assignmentId <= 0) {
      onStatus('Không xác định được phân công; Geofence chưa được bật.');
      return;
    }

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        onStatus('GPS đang tắt. Hãy bật dịch vụ vị trí để phát hiện đến nơi.');
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        onStatus(permission == LocationPermission.deniedForever
            ? 'Quyền GPS đã bị từ chối vĩnh viễn. Hãy cấp quyền trong Cài đặt.'
            : 'Chưa được cấp quyền GPS. Geofence đang tạm dừng.');
        return;
      }

      onStatus('Đang theo dõi vị trí để phát hiện khi vào ${target.label} '
          '(bán kính ${radiusMeters.round()} m).');

      _subscription = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 15,
        ),
      ).listen(
        (position) => _handlePosition(
          assignmentId: assignmentId,
          target: target,
          position: position,
          onStatus: onStatus,
        ),
        onError: (Object error) {
          onStatus('Không nhận được vị trí GPS: $error');
        },
      );
    } catch (error) {
      onStatus('Không thể khởi động Geofence: $error');
    }
  }

  Future<void> _handlePosition({
    required int assignmentId,
    required GeofenceTarget target,
    required Position position,
    required void Function(String message) onStatus,
  }) async {
    if (_arrivalRecorded || _requestInFlight) return;
    if (!position.latitude.isFinite || !position.longitude.isFinite ||
        position.accuracy <= 0 || position.accuracy > maxAccuracyMeters) {
      onStatus('Tín hiệu GPS chưa đủ chính xác; đang chờ vị trí tốt hơn.');
      return;
    }

    final distance = Geolocator.distanceBetween(
      position.latitude,
      position.longitude,
      target.latitude,
      target.longitude,
    );
    if (distance > radiusMeters) {
      onStatus('Còn cách ${target.label} khoảng ${distance.round()} m.');
      return;
    }

    final now = DateTime.now();
    if (_lastAttemptAt != null &&
        now.difference(_lastAttemptAt!) < const Duration(seconds: 20)) {
      return;
    }

    _requestInFlight = true;
    _lastAttemptAt = now;
    try {
      final response = await http.post(
        Uri.parse('${ApiService.baseUrl}/api/v1/staff/assignments/$assignmentId/geofence-arrivals'),
        headers: ApiService.authHeaders(),
        body: jsonEncode({
          'stage': target.apiStage,
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
        }),
      ).timeout(const Duration(seconds: 10));
      dynamic decoded;
      try {
        decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
      } catch (_) {
        decoded = <String, dynamic>{'message': response.body};
      }
      if (response.statusCode == 401 || response.statusCode == 403) {
        ApiService.decodeApiResponse(response);
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final message = decoded is Map ? decoded['message'] : null;
        throw Exception(message ?? 'HTTP ${response.statusCode}');
      }
      final result = decoded is Map<String, dynamic>
          ? decoded
          : <String, dynamic>{};
      _arrivalRecorded = true;
      final alreadyRecorded = result['alreadyRecorded'] == true;
      onStatus(alreadyRecorded
          ? 'Sự kiện Staff đến ${target.label} đã được ghi nhận trước đó.'
          : 'Đã ghi nhận Staff đến ${target.label}. Chưa xác nhận lấy/giao thành công.');
      await stop();
    } catch (error) {
      onStatus('Đã vào vùng Geofence nhưng chưa lưu được sự kiện: $error');
    } finally {
      _requestInFlight = false;
    }
  }

  Future<void> stop() async {
    final subscription = _subscription;
    _subscription = null;
    await subscription?.cancel();
  }

  static double distanceBetweenMeters({
    required double fromLatitude,
    required double fromLongitude,
    required double toLatitude,
    required double toLongitude,
  }) =>
      Geolocator.distanceBetween(
        fromLatitude,
        fromLongitude,
        toLatitude,
        toLongitude,
      );
}
