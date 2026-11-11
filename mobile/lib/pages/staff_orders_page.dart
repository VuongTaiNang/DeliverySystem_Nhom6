import 'package:flutter/material.dart';
import '../services/staff_api_service.dart';
import 'staff_order_detail_page.dart';

class StaffOrdersPage extends StatefulWidget {
  const StaffOrdersPage({super.key});
  @override
  State<StaffOrdersPage> createState() => _StaffOrdersPageState();
}

class _StaffOrdersPageState extends State<StaffOrdersPage> {
  late Future<List<Map<String, dynamic>>> _future;
  String _query = '';
  static const _green = Color(0xFF123F31);
  static const _labels = <String, String>{
    'assigned': 'Đã phân công', 'accepted': 'Đã nhận đơn',
    'picking_up': 'Đang lấy hàng', 'picked_up': 'Đã lấy hàng',
    'delivering': 'Đang giao hàng', 'delivered': 'Đã giao hàng',
    'rejected': 'Đã từ chối', 'return_pending': 'Chờ hoàn hàng',
    'returning': 'Đang hoàn hàng', 'returned': 'Đã hoàn hàng',
    'completed': 'Hoàn thành',
    'pending_pickup': 'Chờ lấy hàng',
    'pickup_failed': 'Lấy hàng thất bại',
    'delivery_failed': 'Giao hàng thất bại',
  };

  @override
  void initState() { super.initState(); _reload(); }
  void _reload() {
    final next = StaffApiService.getStaffAssignments()
        .then((rows) => rows.map((a) => a.toJson()).toList());
    setState(() {
      _future = next;
    });
  }
  Future<void> _refresh() async {
    _reload();
    try { await _future; } catch (_) { /* FutureBuilder displays the error. */ }
  }
  String _value(Map<String, dynamic> item, String key) =>
      (item[key] ?? '').toString();

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Đơn được phân công'),
      backgroundColor: _green, foregroundColor: Colors.white,
      actions: [IconButton(tooltip: 'Làm mới', onPressed: _reload, icon: const Icon(Icons.refresh))],
    ),
    body: Column(children: [
      Padding(
        padding: const EdgeInsets.all(16),
        child: TextField(
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search), border: OutlineInputBorder(),
            hintText: 'Tìm mã đơn, địa chỉ hoặc người nhận',
          ),
          onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
        ),
      ),
      Expanded(child: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 12),
                Text('${snapshot.error}', textAlign: TextAlign.center),
                const SizedBox(height: 12),
                OutlinedButton(onPressed: _reload, child: const Text('Thử lại')),
              ]),
            ));
          }
          final orders = (snapshot.data ?? []).where((o) {
            final haystack = [
              _value(o, 'shipmentId'), _value(o, 'pickupAddress'),
              _value(o, 'deliveryAddress'), _value(o, 'recipientName'),
              _value(o, 'recipientPhone'),
            ].join(' ').toLowerCase();
            return haystack.contains(_query);
          }).toList();
          if (orders.isEmpty) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.inbox_outlined, color: Colors.grey, size: 52),
              const SizedBox(height: 10),
              Text(_query.isEmpty ? 'Chưa có đơn được phân công' : 'Không tìm thấy đơn phù hợp'),
              const SizedBox(height: 12),
              TextButton(onPressed: _reload, child: const Text('Làm mới')),
            ]));
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
              itemCount: orders.length,
              itemBuilder: (context, index) {
                final order = orders[index];
                final shipmentStatus = _value(order, 'shipmentStatus').trim().toLowerCase();
                final assignmentStatus = _value(order, 'assignmentStatus').trim().toLowerCase();
                final status = shipmentStatus == 'pending_pickup' &&
                        (assignmentStatus == 'assigned' || assignmentStatus == 'accepted')
                    ? assignmentStatus
                    : _labels.containsKey(shipmentStatus)
                        ? shipmentStatus : assignmentStatus;
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () async {
                      await Navigator.push(context, MaterialPageRoute(
                        builder: (_) => StaffOrderDetailPage(order: order),
                      ));
                      if (mounted) _reload();
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(_value(order, 'shipmentId'),
                          style: const TextStyle(fontWeight: FontWeight.bold, color: _green)),
                        const SizedBox(height: 7),
                        Chip(label: Text(_labels[status] ?? status)),
                        const SizedBox(height: 7),
                        Text('Điểm lấy: ${_value(order, 'pickupAddress')}'),
                        Text('Điểm giao: ${_value(order, 'deliveryAddress')}'),
                        const SizedBox(height: 8),
                        Row(children: [
                          const Icon(Icons.payments_outlined, size: 18),
                          const SizedBox(width: 6),
                          Text('COD: ${order['codAmount'] ?? 0} đ'),
                          const Spacer(),
                          const Text('Chi tiết', style: TextStyle(color: _green)),
                          const Icon(Icons.chevron_right, color: _green),
                        ]),
                      ]),
                    ),
                  ),
                );
              },
            ),
          );
        },
      )),
    ]),
  );
}
