import 'package:flutter/material.dart';
import '../services/staff_api_service.dart';

class StaffIncidentPage extends StatefulWidget {
  final int assignmentId;
  final String shipmentId;
  const StaffIncidentPage({
    super.key,
    required this.assignmentId,
    required this.shipmentId,
  });

  @override
  State<StaffIncidentPage> createState() => _StaffIncidentPageState();
}

class _StaffIncidentPageState extends State<StaffIncidentPage> {
  final _formKey = GlobalKey<FormState>();
  final _descController = TextEditingController();
  String? _type;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _descController.dispose();
    super.dispose();
  }

  Future<bool> _confirm() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xác nhận gửi báo cáo'),
        content: Text(
          'Gửi báo cáo sự cố "${StaffApiService.incidentTypeLabels[_type]}" '
          'cho đơn ${widget.shipmentId}?',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Hủy')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Gửi')),
        ],
      ),
    );
    return ok == true;
  }

  Future<void> _submit() async {
    if (_busy) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (!await _confirm()) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await StaffApiService.reportIncident(
        widget.assignmentId,
        _type!,
        _descController.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã gửi báo cáo sự cố')),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Báo cáo sự cố')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Đơn hàng: ${widget.shipmentId}',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _type,
              decoration: const InputDecoration(
                  labelText: 'Loại sự cố', border: OutlineInputBorder()),
              items: StaffApiService.incidentTypeLabels.entries
                  .map((e) =>
                      DropdownMenuItem(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: _busy ? null : (v) => setState(() => _type = v),
              validator: (v) => v == null ? 'Vui lòng chọn loại sự cố' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _descController,
              enabled: !_busy,
              maxLines: 5,
              maxLength: 1000,
              decoration: const InputDecoration(
                  labelText: 'Mô tả sự cố', border: OutlineInputBorder()),
              validator: (v) {
                final t = (v ?? '').trim();
                if (t.length < 10) return 'Mô tả tối thiểu 10 ký tự';
                return null;
              },
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Gửi báo cáo'),
            ),
          ],
        ),
      ),
    );
  }
}