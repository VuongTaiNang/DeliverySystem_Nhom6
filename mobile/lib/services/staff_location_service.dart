import 'dart:async';

import 'package:geolocator/geolocator.dart';

import 'staff_api_service.dart';

/// Dùng chung cho Issue #21 và #26. Không theo dõi nền; stream chỉ hoạt động
/// khi Staff chủ động bật trên màn hình và có nhiệm vụ đã nhận.
class StaffLocationService {
  StreamSubscription<Position>? _subscription;
  Position? lastPosition;

  bool get isSharing => _subscription != null;

  /// Cả Tracking (#21) và Geofence (#26) dùng chung kiểm tra quyền GPS foreground.
  static Future<void> ensureForegroundLocationPermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw Exception('GPS đang tắt. Vui lòng bật Dịch vụ vị trí rồi thử lại.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw Exception('Bạn chưa cấp quyền truy cập vị trí.');
    }
    if (permission == LocationPermission.deniedForever) {
      throw Exception('Quyền vị trí đã bị từ chối vĩnh viễn. Hãy bật lại trong Cài đặt ứng dụng.');
    }
  }

  Future<void> start({
    required int assignmentId,
    required void Function(Position position) onPosition,
    required void Function(Object error) onError,
  }) async {
    await stop();
    await ensureForegroundLocationPermission();

    const settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 50,
    );
    final first = await Geolocator.getCurrentPosition(
      locationSettings: settings,
      timeLimit: const Duration(seconds: 20),
    );
    await _send(assignmentId, first);
    lastPosition = first;
    onPosition(first);
    _subscription = Geolocator.getPositionStream(locationSettings: settings)
        .listen((position) async {
          try {
            await _send(assignmentId, position);
            lastPosition = position;
            onPosition(position);
          } catch (error) {
            onError(error);
          }
        }, onError: onError);
  }

  Future<void> _send(int assignmentId, Position position) =>
      StaffApiService.updateLocation(
        assignmentId: assignmentId,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: position.accuracy,
      );

  Future<void> stop() async {
    await _subscription?.cancel();
    _subscription = null;
  }
}
