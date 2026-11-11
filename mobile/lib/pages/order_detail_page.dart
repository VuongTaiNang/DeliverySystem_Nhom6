import 'package:flutter/material.dart';

import '../services/api_service.dart';
import 'complaint_page.dart';
import 'vnpay_page.dart';

class OrderDetailPage extends StatefulWidget {
  final String shipmentId;

  const OrderDetailPage({super.key, required this.shipmentId});

  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _order;
  String? _paymentStatus;
  // Trạng thái đánh giá
bool _ratingLoading = false;
bool _ratingSaving = false;
bool _ratingExists = false;
bool _ratingEditing = false;
Map<String, dynamic>? _ratingData;

int _selectedScore = 5;
Future<void> _loadRating() async {
  if (_order?['status'] != 'delivered') return;

  setState(() {
    _ratingLoading = true;
  });

  try {
    final result = await ApiService.getRating(widget.shipmentId);

    if (!mounted) return;

    setState(() {
      _ratingExists = result != null;
      _ratingData = result;
      _ratingEditing = false;

      if (result != null) {
        _selectedScore =
            int.tryParse(result['score']?.toString() ?? '') ?? 5;
        _commentController.text =
            result['comment']?.toString() ?? '';
      } else {
        _selectedScore = 5;
        _commentController.clear();
      }
    });
  } catch (e) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Không tải được đánh giá: $e'),
      ),
    );
  } finally {
    if (mounted) {
      setState(() {
        _ratingLoading = false;
      });
    }
  }
}

final TextEditingController _commentController =
    TextEditingController();

  static const Map<String, String> statuses = {
  'created': 'Đã tạo đơn',
  'pending': 'Chờ xử lý',
  'pending_pickup': 'Chờ lấy hàng',
  'picking_up': 'Đang lấy hàng',
  'pickup_failed': 'Lấy hàng thất bại',
  'picked_up': 'Đã lấy hàng',
  'in_transit': 'Đang vận chuyển',
  'at_hub': 'Đã đến kho',
  'out_for_delivery': 'Đang giao hàng',
  'delivering': 'Đang giao hàng',
  'delivery_failed': 'Giao hàng thất bại',
  'delivered': 'Giao thành công',
  'return_pending': 'Chờ hoàn hàng',
  'returning': 'Đang hoàn hàng',
  'returned': 'Đã giao hoàn',
  'return_confirmed': 'Shop đã nhận hàng hoàn',
  'cancelled': 'Đã hủy đơn',
  'canceled': 'Đã hủy đơn',
};

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  // =========================================================
  // LOAD CHI TIẾT ĐƠN HÀNG
  // =========================================================

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final order = await ApiService.getOrder(widget.shipmentId);
      String? paymentStatus;
      if (order['feePayer']?.toString().trim().toLowerCase() == 'shop_prepaid' &&
          ApiService.currentToken != null &&
          (ApiService.currentRole ?? '').toLowerCase() == 'customer') {
        try {
          final statuses = await ApiService.getShipmentPaymentStatuses();
          paymentStatus = statuses[widget.shipmentId] ?? 'unpaid';
        } catch (_) {
          paymentStatus = null; // Không đoán trạng thái khi API không phản hồi.
        }
      }


      if (!mounted) return;

      setState(() {
  _order = order;
  _paymentStatus = paymentStatus;
});

if (order['status'] == 'delivered') {
  await _loadRating();
}
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  // =========================================================
  // FORMAT NGÀY
  // =========================================================

  String _date(dynamic value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();

    if (date == null) {
      return '';
    }

    String two(int number) {
      return number.toString().padLeft(2, '0');
    }

    return '${two(date.day)}/${two(date.month)}/${date.year} '
        '${two(date.hour)}:${two(date.minute)}';
  }

  // =========================================================
  // FORMAT TIỀN
  // =========================================================

  String _money(dynamic value) {
    final number = num.tryParse(value?.toString() ?? '0') ?? 0;

    final text = number.round().toString();
    final buffer = StringBuffer();

    for (int i = 0; i < text.length; i++) {
      if (i > 0 && (text.length - i) % 3 == 0) {
        buffer.write('.');
      }

      buffer.write(text[i]);
    }

    return '${buffer.toString()} đ';
  }
  
Widget _ratingSection() {
  if (_order?['status'] != 'delivered') {
    return const SizedBox.shrink();
  }

  if (_ratingLoading) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      ),
    );
  }

  if (_ratingExists && !_ratingEditing) {
    final score = int.tryParse(_ratingData?['score']?.toString() ?? '') ??
        _selectedScore;
    final comment = _ratingData?['comment']?.toString().trim() ??
        _commentController.text.trim();
    return _card('ĐÁNH GIÁ DỊCH VỤ', [
      const Text('Đã gửi đánh giá của bạn',
          style: TextStyle(fontWeight: FontWeight.bold)),
      const SizedBox(height: 10),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(
          5,
          (index) => Icon(
            index < score ? Icons.star : Icons.star_border,
            color: Colors.amber.shade700,
            size: 32,
          ),
        ),
      ),
      const SizedBox(height: 10),
      Text(comment.isEmpty ? 'Không có nhận xét.' : comment),
      const SizedBox(height: 12),
      OutlinedButton.icon(
        onPressed: () => setState(() => _ratingEditing = true),
        icon: const Icon(Icons.edit_outlined),
        label: const Text('Chỉnh sửa đánh giá'),
      ),
    ]);
  }

  return _card('ĐÁNH GIÁ DỊCH VỤ', [
    Text(_ratingExists
        ? 'Chỉnh sửa đánh giá của bạn'
        : 'Bạn hài lòng với dịch vụ chứ?'),
    const SizedBox(height: 8),
    Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(5, (index) {
        final score = index + 1;
        return IconButton(
          onPressed: _ratingSaving
              ? null
              : () => setState(() => _selectedScore = score),
          icon: Icon(
            score <= _selectedScore ? Icons.star : Icons.star_border,
            color: Colors.amber.shade700,
            size: 34,
          ),
        );
      }),
    ),
    TextField(
      controller: _commentController,
      enabled: !_ratingSaving,
      maxLines: 3,
      maxLength: 500,
      decoration: const InputDecoration(
        labelText: 'Nhận xét',
        hintText: 'Chia sẻ trải nghiệm của bạn...',
        border: OutlineInputBorder(),
        alignLabelWithHint: true,
      ),
    ),
    const SizedBox(height: 12),
    SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _ratingSaving ? null : _submitRating,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF123F31),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        child: _ratingSaving
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : Text(_ratingExists ? 'LƯU ĐÁNH GIÁ' : 'GỬI ĐÁNH GIÁ'),
      ),
    ),
    if (_ratingExists)
      TextButton(
        onPressed: _ratingSaving
            ? null
            : () {
                setState(() {
                  _ratingEditing = false;
                  _selectedScore =
                      int.tryParse(_ratingData?['score']?.toString() ?? '') ?? 5;
                  _commentController.text =
                      _ratingData?['comment']?.toString() ?? '';
                });
              },
        child: const Text('Hủy chỉnh sửa'),
      ),
  ]);
}

Future<void> _submitRating() async {
  if (_order?['status'] != 'delivered') {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Chỉ đánh giá khi đơn đã giao thành công.'),
      ),
    );
    return;
  }

  setState(() {
    _ratingSaving = true;
  });

  try {
    final wasUpdating = _ratingExists;
    final result = wasUpdating
        ? await ApiService.updateRating(
            shipmentId: widget.shipmentId,
            rating: _selectedScore,
            comment: _commentController.text,
          )
        : await ApiService.createRating(
            shipmentId: widget.shipmentId,
            rating: _selectedScore,
            comment: _commentController.text,
          );
    if (!mounted) return;

    final received = result['rating'];
    setState(() {
      _ratingExists = true;
      _ratingEditing = false;
      _ratingData = received is Map
          ? Map<String, dynamic>.from(received)
          : {
              'score': _selectedScore,
              'comment': _commentController.text.trim(),
            };
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(wasUpdating
            ? 'Cập nhật đánh giá thành công!'
            : 'Gửi đánh giá thành công!'),
      ),
    );
    // Đồng bộ bản ghi vừa lưu, tránh hiển thị lại form sau khi gửi.
    await _loadRating();
  } catch (e) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Lỗi đánh giá: ${e.toString().replaceFirst('Exception: ', '')}',
        ),
      ),
    );
  } finally {
    if (mounted) {
      setState(() {
        _ratingSaving = false;
      });
    }
  }
}



  // =========================================================
  // BUILD
  // =========================================================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8F4),

      appBar: AppBar(
        title: const Text('Theo dõi đơn hàng'),
        backgroundColor: const Color(0xFF123F31),
        foregroundColor: Colors.white,

        actions: [
          IconButton(
            tooltip: 'Làm mới',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),

      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),

          child: Column(
            mainAxisSize: MainAxisSize.min,

            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),

              const SizedBox(height: 12),

              Text(_error!, textAlign: TextAlign.center),

              const SizedBox(height: 16),

              ElevatedButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      );
    }

    if (_order == null) {
      return const Center(child: Text('Không tìm thấy đơn hàng.'));
    }

    return _content();
  }

  // =========================================================
  // NỘI DUNG CHI TIẾT
  // =========================================================

  Widget _content() {
    final order = _order!;

    final List<Map<String, dynamic>> events = [];

    final rawEvents = order['events'];

    if (rawEvents is List) {
      for (final event in rawEvents) {
        if (event is Map) {
          events.add(Map<String, dynamic>.from(event));
        }
      }
    }

    return RefreshIndicator(
      onRefresh: _load,

      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),

        padding: const EdgeInsets.all(16),

        children: [
          // =============================================
          // MÃ VẬN ĐƠN
          // =============================================
          Text(
            order['id']?.toString() ?? '',
            style: const TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.bold,
              color: Color(0xFF123F31),
            ),
          ),

          const SizedBox(height: 6),

          // =============================================
          // TRẠNG THÁI + DỊCH VỤ
          // =============================================
          Wrap(
            spacing: 8,
            runSpacing: 8,

            children: [
              Chip(
                avatar: const Icon(Icons.local_shipping_outlined, size: 18),
                label: Text(
                  statuses[order['status']] ??
                      order['status']?.toString() ??
                      '',
                ),
              ),

              Chip(
                avatar: const Icon(Icons.bolt, size: 18),
                label: Text(
                  order['service'] == 'express' ? 'Hỏa tốc' : 'Tiêu chuẩn',
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // =============================================
          // HÀNH TRÌNH
          // =============================================
          _card('HÀNH TRÌNH', [
            _info('Lấy hàng', order['pickupAddress']),

            const Padding(
              padding: EdgeInsets.symmetric(vertical: 2),
              child: Icon(Icons.arrow_downward, color: Colors.black38),
            ),

            _info('Giao hàng', order['deliveryAddress']),
          ]),

          // =============================================
          // THÔNG TIN ĐƠN
          // =============================================
          _card('THÔNG TIN ĐƠN', [
            _row('Người gửi', order['senderName']?.toString() ?? ''),

            _row('SĐT gửi', order['senderPhone']?.toString() ?? ''),

            _row('Người nhận', order['recipientName']?.toString() ?? ''),

            _row('SĐT nhận', order['recipientPhone']?.toString() ?? ''),

            _row('Hàng hóa', order['goods']?.toString() ?? ''),

            _row('Khối lượng', '${order['weightKg'] ?? 0} kg'),

            _row(
              'Kích thước',
              '${order['lengthCm'] ?? 0}'
                  ' × '
                  '${order['widthCm'] ?? 0}'
                  ' × '
                  '${order['heightCm'] ?? 0} cm',
            ),

            _row('Giá trị hàng', _money(order['declaredValue'])),

            _row('COD', _money(order['codAmount'])),

            _row('COD đã thu', _money(order['codCollected'])),

            _row('Phí giao', _money(order['fee'])),

            _row('Người trả phí', _feePayerName(order['feePayer'])),

            if (order['feePayer'] == 'shop_prepaid')
              _row('Thanh toán VNPay', _paymentStatus == 'paid'
                  ? 'Đã thanh toán'
                  : _paymentStatus == 'pending' ? 'Đang chờ xác nhận'
                  : _paymentStatus == 'failed' ? 'Thanh toán thất bại'
                  : _paymentStatus == null ? 'Chưa xác minh được' : 'Chưa thanh toán'),

            _row('Số lần giao', order['attempts']?.toString() ?? '0'),

            if ((order['notes']?.toString() ?? '').trim().isNotEmpty)
              _row('Ghi chú', order['notes'].toString()),
          ]),

          const SizedBox(height: 8),

          // Payment is a customer action for prepaid shipments only.
          // Keep the status sourced from the shared Backend, never guess paid.
          if (order['feePayer']?.toString().trim().toLowerCase() == 'shop_prepaid' &&
              ApiService.currentToken != null &&
              (ApiService.currentRole ?? '').toLowerCase() == 'customer')
            Card(
              margin: const EdgeInsets.only(bottom: 16),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'THANH TOÁN VNPAY',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.1,
                        color: Color(0xFF123F31),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _paymentStatus == 'paid'
                          ? 'Đã thanh toán'
                          : _paymentStatus == 'pending'
                              ? 'Đang chờ xác nhận thanh toán'
                              : _paymentStatus == 'failed'
                                  ? 'Thanh toán thất bại – có thể thử lại'
                                  : _paymentStatus == null
                                      ? 'Chưa xác minh được trạng thái thanh toán'
                                      : 'Chưa thanh toán',
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: FilledButton.icon(
                        onPressed: _paymentStatus == 'paid'
                            ? null
                            : () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => VnPayPage(
                                      shipmentId: widget.shipmentId,
                                    ),
                                  ),
                                );
                                if (mounted) await _load();
                              },
                        icon: Icon(
                          _paymentStatus == 'paid'
                              ? Icons.check_circle
                              : Icons.payment,
                        ),
                        label: Text(
                          _paymentStatus == 'paid'
                              ? 'Đã thanh toán VNPay'
                              : _paymentStatus == 'pending'
                                  ? 'Kiểm tra giao dịch VNPay'
                                  : 'Thanh toán VNPay',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          const SizedBox(height: 8),


          // =============================================
          // LỊCH SỬ VẬN CHUYỂN
          // =============================================
          const Text(
            'LỊCH SỬ VẬN CHUYỂN',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              letterSpacing: 1.1,
              color: Color(0xFF123F31),
            ),
          ),

          const SizedBox(height: 12),

          if (events.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('Chưa có cập nhật hành trình.'),
              ),
            )
          else
            ...events.asMap().entries.map((entry) {
              final event = entry.value;

              final bool isLast = entry.key == events.length - 1;

              return _timelineItem(event, isLast);
            }),

          const SizedBox(height: 8),
          _ratingSection(),

const SizedBox(height: 8),

          // =============================================
          // SỰ CỐ VÀ KHIẾU NẠI
          // =============================================
          if (ApiService.currentUserId != null)
            SizedBox(
              height: 52,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.report_problem_outlined),
                label: const Text('Sự cố và khiếu nại'),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ComplaintPage(
                        shipmentId: widget.shipmentId,
                      ),
                    ),
                  );
                },
              ),
            ),

          const SizedBox(height: 30),
        ],
      ),
    );
  }

  // =========================================================
  // TIMELINE
  // =========================================================

  Widget _timelineItem(Map<String, dynamic> event, bool isLast) {
    final status = event['status']?.toString() ?? '';

    final note = event['note']?.toString() ?? '';

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,

        children: [
          SizedBox(
            width: 28,

            child: Column(
              children: [
                Container(
                  width: 14,
                  height: 14,

                  decoration: BoxDecoration(
                    shape: BoxShape.circle,

                    color: isLast
                        ? const Color(0xFF123F31)
                        : Colors.grey.shade400,
                  ),
                ),

                if (!isLast)
                  Expanded(
                    child: Container(width: 2, color: Colors.grey.shade300),
                  ),
              ],
            ),
          ),

          const SizedBox(width: 8),

          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 18),

              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,

                children: [
                  Text(
                    statuses[status] ?? status,

                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),

                  const SizedBox(height: 3),

                  Text(
                    _date(event['at']),
                    style: const TextStyle(color: Colors.black54),
                  ),

                  if (note.trim().isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 5),
                      child: Text(note),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================
  // CARD
  // =========================================================

  Widget _card(String title, List<Widget> children) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),

      child: Padding(
        padding: const EdgeInsets.all(16),

        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,

          children: [
            Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: Color(0xFF123F31),
              ),
            ),

            const SizedBox(height: 12),

            ...children,
          ],
        ),
      ),
    );
  }

  // =========================================================
  // THÔNG TIN HÀNH TRÌNH
  // =========================================================

  Widget _info(String label, dynamic value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,

      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(fontSize: 11, color: Colors.black54),
        ),

        const SizedBox(height: 3),

        Text(
          value?.toString() ?? '',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),

        const SizedBox(height: 10),
      ],
    );
  }

  // =========================================================
  // DÒNG THÔNG TIN
  // =========================================================

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),

      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,

        children: [
          SizedBox(
            width: 115,

            child: Text(label, style: const TextStyle(color: Colors.black54)),
          ),

          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================
  // NGƯỜI TRẢ PHÍ
  // =========================================================

  String _feePayerName(dynamic value) {
    switch (value?.toString()) {
      case 'shop_prepaid':
        return 'Shop trả phí';

      case 'recipient':
        return 'Người nhận trả phí';

      default:
        return value?.toString() ?? '';
    }
  }
}
