import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ComplaintPage extends StatefulWidget {
  final String shipmentId;

  const ComplaintPage({
    super.key,
    required this.shipmentId,
  });

  @override
  State<ComplaintPage> createState() => _ComplaintPageState();
}

class _ComplaintPageState extends State<ComplaintPage> {
  final _contentController = TextEditingController();

  String _type = 'damaged';
  bool _loading = true;
  bool _saving = false;
  int _loadVersion = 0;
  String? _error;
  List<Map<String, dynamic>> _complaints = [];

  static const Map<String, String> _types = {
    'damaged': 'Hàng hóa hư hỏng',
    'delayed': 'Giao hàng chậm',
    'lost': 'Thất lạc hàng hóa',
    'wrong_item': 'Sai hàng',
    'other': 'Vấn đề khác',
  };

  static const Map<String, String> _statuses = {
    'pending': 'Chờ xử lý',
    'processing': 'Đang xử lý',
    'resolved': 'Đã giải quyết',
  };

  @override
  void initState() {
    super.initState();
    _loadComplaints();
  }

  @override
  void dispose() {
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _loadComplaints() async {
    final version = ++_loadVersion;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final data = await ApiService.listComplaints(widget.shipmentId);
      if (!mounted || version != _loadVersion) return;
      setState(() => _complaints = data);
    } catch (e) {
      if (!mounted || version != _loadVersion) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted && version == _loadVersion) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _submit() async {
    final content = _contentController.text.trim();

    if (content.length < 10) {
      _show('Nội dung sự cố phải có ít nhất 10 ký tự.', true);
      return;
    }

    setState(() => _saving = true);

    try {
      final complaint = await ApiService.createComplaint(
        shipmentId: widget.shipmentId,
        type: _type,
        content: content,
      );

      if (!mounted) return;

      setState(() {
        _complaints = [complaint, ..._complaints];
        _contentController.clear();
      });

      _show('Đã gửi báo cáo sự cố.', false);
    } catch (e) {
      if (!mounted) return;
      _show(e.toString().replaceFirst('Exception: ', ''), true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _show(String message, bool error) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? Colors.red.shade700 : Colors.green.shade700,
      ),
    );
  }

  String _formatDate(dynamic value) {
    if (value == null) return '';
    final date = DateTime.tryParse(value.toString())?.toLocal();
    if (date == null) return value.toString();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(date.day)}/${two(date.month)}/${date.year} '
        '${two(date.hour)}:${two(date.minute)}';
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'resolved':
        return Colors.green;
      case 'processing':
        return Colors.blue;
      default:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit =
        !_saving && _contentController.text.trim().length >= 10;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8F4),
      appBar: AppBar(
        title: const Text('Sự cố và khiếu nại'),
        backgroundColor: const Color(0xFF123F31),
        foregroundColor: Colors.white,
      ),
      body: RefreshIndicator(
        onRefresh: _loadComplaints,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Vận đơn: ${widget.shipmentId}',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: Color(0xFF173E32),
              ),
            ),
            const SizedBox(height: 18),
            DropdownButtonFormField<String>(
              initialValue: _type,
              decoration: _input('Loại sự cố'),
              items: _types.entries
                  .map(
                    (e) => DropdownMenuItem(
                      value: e.key,
                      child: Text(e.value),
                    ),
                  )
                  .toList(),
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _type = value ?? 'damaged'),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _contentController,
              minLines: 4,
              maxLines: 6,
              maxLength: 2000,
              onChanged: (_) => setState(() {}),
              decoration: _input(
                'Nội dung sự cố',
                hint: 'Mô tả vấn đề và thông tin cần hỗ trợ…',
              ),
            ),
            const Text(
              'Tối thiểu 10 ký tự',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 50,
              child: ElevatedButton.icon(
                onPressed: canSubmit ? _submit : null,
                icon: const Icon(Icons.send_outlined),
                label: Text(_saving ? 'Đang gửi…' : 'Gửi báo cáo'),
              ),
            ),
            const SizedBox(height: 28),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Lịch sử báo cáo',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF173E32),
                    ),
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: _loadComplaints,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Làm mới trạng thái'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_error != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text(
                        _error!,
                        style: const TextStyle(color: Colors.red),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: _loadComplaints,
                        child: const Text('Thử lại'),
                      ),
                    ],
                  ),
                ),
              )
            else if (_complaints.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Text('Đơn hàng này chưa có báo cáo sự cố.'),
              )
            else
              ..._complaints.map((complaint) {
                final status = complaint['status']?.toString() ?? 'pending';
                final type = complaint['type']?.toString() ?? 'other';
                final response = complaint['response']?.toString();

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                _types[type] ?? type,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                            ),
                            Chip(
                              label: Text(_statuses[status] ?? status),
                              side: BorderSide(
                                color: _statusColor(status),
                              ),
                            ),
                          ],
                        ),
                        Text(_formatDate(complaint['createdAt'])),
                        const SizedBox(height: 10),
                        Text(complaint['content']?.toString() ?? ''),
                        if (response != null && response.trim().isNotEmpty) ...[
                          const Divider(height: 28),
                          const Text(
                            'Kết quả xử lý',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 6),
                          Text(response),
                          if (complaint['resolvedAt'] != null) ...[
                            const SizedBox(height: 6),
                            Text(
                              'Giải quyết lúc: ${_formatDate(complaint['resolvedAt'])}',
                              style: const TextStyle(color: Colors.black54),
                            ),
                          ],
                        ],
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  InputDecoration _input(String label, {String? hint}) => InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      );
}
