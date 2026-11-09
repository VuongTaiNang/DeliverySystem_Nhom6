import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../services/staff_api_service.dart';
import '../services/staff_location_service.dart';

class StaffLocationPage extends StatefulWidget {
  const StaffLocationPage({super.key});
  @override
  State<StaffLocationPage> createState() => _StaffLocationPageState();
}

class _StaffLocationPageState extends State<StaffLocationPage> {
  static const _green = Color(0xFF123F31);
  final _location = StaffLocationService();
  List<StaffAssignment> _assignments = [];
  int? _selectedAssignmentId;
  bool _loading = true;
  bool _starting = false;
  String? _error;
  Position? _position;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    unawaited(_location.stop());
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final assignments = await StaffApiService.getStaffAssignments();
      final active = assignments
          .where((item) => item.assignmentStatus == 'accepted')
          .toList();
      if (!mounted) return;
      setState(() {
        _assignments = active;
        _selectedAssignmentId =
            active.any((x) => x.assignmentId == _selectedAssignmentId)
            ? _selectedAssignmentId
            : (active.isEmpty ? null : active.first.assignmentId);
      });
    } catch (error) {
      if (mounted)
        setState(
          () => _error = error.toString().replaceFirst('Exception: ', ''),
        );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _start() async {
    final assignmentId = _selectedAssignmentId;
    if (assignmentId == null) return;
    setState(() {
      _starting = true;
      _error = null;
    });
    try {
      await _location.start(
        assignmentId: assignmentId,
        onPosition: (position) {
          if (mounted) setState(() => _position = position);
        },
        onError: (error) {
          if (mounted)
            setState(
              () => _error = error.toString().replaceFirst('Exception: ', ''),
            );
        },
      );
    } catch (error) {
      if (mounted)
        setState(
          () => _error = error.toString().replaceFirst('Exception: ', ''),
        );
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  Future<void> _stop() async {
    await _location.stop();
    if (mounted) setState(() {});
  }

  String _coordinate(double? value) =>
      value == null ? '—' : value.toStringAsFixed(6);

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Chia sẻ vị trí'),
      backgroundColor: _green,
      foregroundColor: Colors.white,
    ),
    body: RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Vị trí chỉ được gửi khi bạn chủ động bật chia sẻ cho nhiệm vụ đã nhận. Ứng dụng không theo dõi vị trí khi ở nền hoặc khi bạn tắt chia sẻ.',
          ),
          const SizedBox(height: 18),
          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(30),
                child: CircularProgressIndicator(),
              ),
            )
          else if (_assignments.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Text(
                  'Bạn chưa có nhiệm vụ đã nhận. Hãy nhận đơn trước khi chia sẻ vị trí.',
                ),
              ),
            )
          else ...[
            DropdownButtonFormField<int>(
              value: _selectedAssignmentId,
              decoration: const InputDecoration(
                labelText: 'Nhiệm vụ đang thực hiện',
                border: OutlineInputBorder(),
              ),
              items: _assignments
                  .map(
                    (a) => DropdownMenuItem(
                      value: a.assignmentId,
                      child: Text('${a.shipmentId} · ${a.shipmentStatus}'),
                    ),
                  )
                  .toList(),
              onChanged: _location.isSharing
                  ? null
                  : (value) => setState(() => _selectedAssignmentId = value),
            ),
            const SizedBox(height: 18),
            if (_location.isSharing)
              Card(
                color: const Color(0xFFE8F5EE),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.location_on, color: _green),
                          SizedBox(width: 8),
                          Text(
                            'Đang chia sẻ vị trí',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text('Vĩ độ: ${_coordinate(_position?.latitude)}'),
                      Text('Kinh độ: ${_coordinate(_position?.longitude)}'),
                      Text(
                        'Độ chính xác: ${_position == null ? '—' : '${_position!.accuracy.round()} m'}',
                      ),
                    ],
                  ),
                ),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: _location.isSharing
                      ? Colors.red.shade700
                      : _green,
                ),
                onPressed: _starting
                    ? null
                    : (_location.isSharing ? _stop : _start),
                icon: Icon(
                  _location.isSharing ? Icons.location_off : Icons.my_location,
                ),
                label: Text(
                  _starting
                      ? 'Đang xin vị trí…'
                      : (_location.isSharing
                            ? 'Dừng chia sẻ vị trí'
                            : 'Bắt đầu chia sẻ vị trí'),
                ),
              ),
            ),
          ],
          const SizedBox(height: 22),
          const Text(
            'Vị trí được gửi khi bắt đầu và khi di chuyển tối thiểu 50 m. Nếu GPS hoặc mạng lỗi, ứng dụng sẽ hiển thị lỗi; bạn có thể thử lại khi kết nối ổn định.',
            style: TextStyle(color: Colors.black54),
          ),
        ],
      ),
    ),
  );
}
