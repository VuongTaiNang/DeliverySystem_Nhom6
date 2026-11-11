import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// Bản đồ chọn tọa độ dùng OpenStreetMap. Trả về LatLng qua onChanged.
class MapLocationPicker extends StatefulWidget {
  const MapLocationPicker({
    super.key,
    required this.title,
    required this.value,
    required this.onChanged,
    this.markerColor = const Color(0xFFE65520),
    this.height = 260,
  });

  final String title;
  final LatLng? value;
  final ValueChanged<LatLng> onChanged;
  final Color markerColor;
  final double height;

  @override
  State<MapLocationPicker> createState() => _MapLocationPickerState();
}

class _MapLocationPickerState extends State<MapLocationPicker> {
  static const LatLng _defaultCenter = LatLng(10.7769, 106.7009);
  final MapController _mapController = MapController();

  @override
  void didUpdateWidget(covariant MapLocationPicker oldWidget) {
    super.didUpdateWidget(oldWidget);
    final selected = widget.value;
    if (selected == null || selected == oldWidget.value) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // FlutterMap may not be attached yet on the very first frame.
      try {
        _mapController.move(selected, 16);
      } catch (_) {
        // Keep manual map selection available even if repositioning fails.
      }
    });
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final selected = widget.value;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Expanded(child: Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w700))),
          const Text('Chạm bản đồ để chọn', style: TextStyle(fontSize: 11, color: Color(0xFF668177))),
        ]),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            height: widget.height,
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: selected ?? _defaultCenter,
                initialZoom: selected == null ? 12 : 15,
                onTap: (tapPosition, point) => widget.onChanged(point),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.example.mobile',
                ),
                if (selected != null)
                  MarkerLayer(markers: [
                    Marker(
                      point: selected,
                      width: 42,
                      height: 42,
                      child: Icon(Icons.location_pin, size: 42, color: widget.markerColor),
                    ),
                  ]),
                RichAttributionWidget(
                  attributions: [TextSourceAttribution('© OpenStreetMap contributors')],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          selected == null
              ? 'Chưa chọn vị trí'
              : 'Vĩ độ: ${selected.latitude.toStringAsFixed(7)} · Kinh độ: ${selected.longitude.toStringAsFixed(7)}',
          style: const TextStyle(fontSize: 12, color: Color(0xFF668177)),
        ),
      ],
    );
  }
}
