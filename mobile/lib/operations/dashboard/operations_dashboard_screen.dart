import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../services/api_service.dart';

/// Operations-only overview backed by the same API as the React dashboard.
class OperationsDashboardScreen extends StatefulWidget {
  const OperationsDashboardScreen({super.key});

  @override
  State<OperationsDashboardScreen> createState() =>
      _OperationsDashboardScreenState();
}

class _OperationsDashboardScreenState
    extends State<OperationsDashboardScreen> {
  static const _forest = Color(0xFF123F31);
  Map<String, dynamic>? _dashboard;
  String? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final uri = Uri.parse(
        '${ApiService.baseUrl}/api/v1/operations/dashboard',
      );
      final response = await http
          .get(uri, headers: ApiService.authHeaders())
          .timeout(const Duration(seconds: 15));
      if (response.statusCode == 401 || response.statusCode == 403) {
        ApiService.decodeApiResponse(response);
        throw Exception('Tài khoản không có quyền xem thống kê.');
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('Không tải được Dashboard (HTTP ${response.statusCode}).');
      }
      final decoded = jsonDecode(response.body);
      if (decoded is! Map) {
        throw const FormatException('Phản hồi thống kê không hợp lệ.');
      }
      if (!mounted) return;
      setState(() {
        _dashboard = Map<String, dynamic>.from(decoded);
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _number(Object? value) => value is num
      ? value.toInt()
      : int.tryParse(value?.toString() ?? '') ?? 0;

  Widget _stat(String label, Object? count, IconData icon) {
    return SizedBox(
      width: 155,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: _forest),
              const SizedBox(height: 8),
              Text(label, style: const TextStyle(fontSize: 12)),
              const SizedBox(height: 6),
              Text(
                '${_number(count)}',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _summaryRows(
    String title,
    Object? raw,
    String Function(Map<String, dynamic>) label,
  ) {
    final rows = raw is List
        ? raw.whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList()
        : <Map<String, dynamic>>[];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            )),
            const SizedBox(height: 10),
            if (rows.isEmpty)
              const Text('Chưa có dữ liệu.'),
            for (final row in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Expanded(child: Text(label(row))),
                    Text(
                      '${_number(row['totalOrders'])}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = _dashboard;
    final staff = data?['staff'] is Map
        ? Map<String, dynamic>.from(data!['staff'] as Map)
        : <String, dynamic>{};

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(12),
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Tổng quan vận hành',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    )),
              ),
              IconButton(
                tooltip: 'Làm mới',
                onPressed: _loading ? null : _load,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          if (_loading) const LinearProgressIndicator(),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          if (data == null && !_loading)
            const Text('Chưa có dữ liệu thống kê. Kéo xuống để thử lại.'),
          if (data != null) ...[
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                _stat('Tổng đơn hàng', data['totalOrders'],
                    Icons.inventory_2_outlined),
                _stat('Chưa phân công', data['unassignedOrders'],
                    Icons.assignment_late_outlined),
                _stat('Đang giao', data['inDeliveryOrders'],
                    Icons.local_shipping_outlined),
                _stat('Giao thành công', data['deliveredOrders'],
                    Icons.check_circle_outline),
                _stat('Giao thất bại', data['failedOrders'],
                    Icons.error_outline),
                _stat('Đơn hoàn', data['returnedOrders'],
                    Icons.keyboard_return_outlined),
              ],
            ),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Tình trạng Staff',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text('Sẵn sàng: ${_number(staff['available'])}'),
                    Text('Đang bận: ${_number(staff['busy'])}'),
                    Text('Ngừng hoạt động: ${_number(staff['inactive'])}'),
                    Text('Tổng Staff: ${_number(staff['total'])}'),
                  ],
                ),
              ),
            ),
            _summaryRows(
              'Số đơn theo Staff',
              data['ordersByStaff'],
              (row) => '${row['employeeCode'] ?? ''} - ${row['staffName'] ?? ''}',
            ),
            _summaryRows(
              'Số đơn theo khu vực',
              data['ordersByArea'],
              (row) => '${row['areaName'] ?? row['areaCode'] ?? ''}',
            ),
          ],
        ],
      ),
    );
  }
}
