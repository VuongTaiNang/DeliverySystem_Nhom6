import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/services/geofence_service.dart';

void main() {
  group('GeofenceService distance calculation', () {
    test('returns zero for the same coordinate', () {
      expect(
        GeofenceService.distanceBetweenMeters(
          fromLatitude: 10.762622,
          fromLongitude: 106.660172,
          toLatitude: 10.762622,
          toLongitude: 106.660172,
        ),
        closeTo(0, 0.01),
      );
    });

    test('calculates a short distance between nearby coordinates', () {
      final distance = GeofenceService.distanceBetweenMeters(
        fromLatitude: 10.762622,
        fromLongitude: 106.660172,
        toLatitude: 10.763522,
        toLongitude: 106.660172,
      );
      expect(distance, greaterThan(95));
      expect(distance, lessThan(105));
    });
  });
}
