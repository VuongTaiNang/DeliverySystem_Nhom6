import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:latlong2/latlong.dart';
import '../widgets/map_location_picker.dart';

import '../services/api_service.dart';

class CreateOrderPage extends StatefulWidget {
  const CreateOrderPage({super.key});

  @override
  State<CreateOrderPage> createState() =>
      _CreateOrderPageState();
}

class _CreateOrderPageState
    extends State<CreateOrderPage> {
  // =========================================================
  // FORM / CONTROLLERS
  // =========================================================

  final _formKey = GlobalKey<FormState>();

  final _senderName = TextEditingController();
  final _senderPhone = TextEditingController();
  final _pickup = TextEditingController();

  final _recipientName = TextEditingController();
  final _recipientPhone = TextEditingController();
  final _delivery = TextEditingController();

  final _goods = TextEditingController();
  final _weight = TextEditingController(text: '1');

  final _length = TextEditingController(text: '20');
  final _width = TextEditingController(text: '15');
  final _height = TextEditingController(text: '10');

  final _declared = TextEditingController(text: '0');
  final _cod = TextEditingController(text: '0');

  final _notes = TextEditingController();

  String _vehicleType = 'motorbike';
  String _service = 'standard';

  String _feePayer = 'shop_prepaid';

  // Sprint 3: khu vực theo AreaId, độc lập với tọa độ bản đồ.
  List<Map<String, dynamic>> _areas = [];
  bool _areasLoading = true;
  int? _pickupAreaId;
  int? _deliveryAreaId;

  bool _loading = false;

  Map<String, dynamic>? _quote;
  LatLng? _pickupLocation;
  LatLng? _deliveryLocation;

  // =========================================================
  // COLORS
  // =========================================================

  static const Color forest = Color(0xFF123F31);
  static const Color orange = Color(0xFFE65520);
  static const Color background = Color(0xFFF7F8F4);
  static const Color muted = Color(0xFF668177);
  static const Color lime = Color(0xFFEAF6A6);

  // =========================================================
  // VALIDATION
  // =========================================================

  static final RegExp _phoneRegex =
      RegExp(r'^\+?[0-9 ()-]{8,20}$');

  String? _required(
    String? value,
    String label, {
    int max = 300,
  }) {
    final v = value?.trim() ?? '';

    if (v.isEmpty) {
      return 'Vui lòng nhập $label.';
    }

    if (v.length > max) {
      return '$label không được vượt quá $max ký tự.';
    }

    return null;
  }

  String? _phone(
    String? value,
    String label,
  ) {
    final required = _required(
      value,
      label,
      max: 20,
    );

    if (required != null) {
      return required;
    }

    if (!_phoneRegex.hasMatch(
      value!.trim(),
    )) {
      return '$label không hợp lệ.';
    }

    return null;
  }

  String? _positiveDecimal(
    String? value,
    String label,
  ) {
    final raw = value?.trim() ?? '';

    if (raw.isEmpty) {
      return 'Vui lòng nhập $label.';
    }

    final n = double.tryParse(raw);

    if (n == null) {
      return '$label phải là số.';
    }

    if (!n.isFinite || n <= 0) {
      return '$label phải lớn hơn 0.';
    }

    return null;
  }

  String? _nonNegativeInt(
    String? value,
    String label,
  ) {
    final raw = value?.trim() ?? '';

    if (raw.isEmpty) {
      return 'Vui lòng nhập $label.';
    }

    final n = int.tryParse(raw);

    if (n == null) {
      return '$label phải là số nguyên.';
    }

    if (n < 0) {
      return '$label không được âm.';
    }

    return null;
  }

  // =========================================================
  // LIFE CYCLE
  // =========================================================

  @override
  void initState() {
    super.initState();
    _loadAreas();
  }

  Future<void> _loadAreas() async {
    try {
      final areas = await ApiService.listAreas();
      if (!mounted) return;
      setState(() {
        _areas = areas;
        _areasLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _areasLoading = false);
      _show(
        error.toString().replaceFirst('Exception: ', ''),
        true,
      );
    }
  }

  @override
  void dispose() {
    final controllers = [
      _senderName,
      _senderPhone,
      _pickup,
      _recipientName,
      _recipientPhone,
      _delivery,
      _goods,
      _weight,
      _length,
      _width,
      _height,
      _declared,
      _cod,
      _notes,
    ];

    for (final controller in controllers) {
      controller.dispose();
    }

    super.dispose();
  }

  // =========================================================
  // QUOTE
  // =========================================================

  void _invalidateQuote() {
    if (_quote != null) {
      setState(() {
        _quote = null;
      });
    }
  }

  Map<String, dynamic> _order() {
    return {
      'senderName': _senderName.text.trim(),
      'senderPhone': _senderPhone.text.trim(),

      'pickupAddress': _pickup.text.trim(),
      'pickupAreaId': _pickupAreaId,
      'pickupLatitude': _pickupLocation?.latitude,
      'pickupLongitude': _pickupLocation?.longitude,

      'recipientName':
          _recipientName.text.trim(),
      'recipientPhone':
          _recipientPhone.text.trim(),

      'deliveryAddress':
          _delivery.text.trim(),
      'deliveryAreaId': _deliveryAreaId,
      'deliveryLatitude': _deliveryLocation?.latitude,
      'deliveryLongitude': _deliveryLocation?.longitude,

      'goods': _goods.text.trim(),

      'weightKg':
          double.parse(_weight.text.trim()),

      'lengthCm':
          double.parse(_length.text.trim()),

      'widthCm':
          double.parse(_width.text.trim()),

      'heightCm':
          double.parse(_height.text.trim()),

      'declaredValue':
          int.parse(_declared.text.trim()),

      'codAmount':
          int.parse(_cod.text.trim()),

      'vehicleType': _vehicleType,

      'service': _service,

      'feePayer': _feePayer,

      'notes': _notes.text.trim(),
    };
  }

  Future<void> _quoteOrder() async {
    FocusScope.of(context).unfocus();
    if (_deliveryAreaId == null) {
      _show('Vui lòng chọn phường/xã giao hàng.', true);
      return;
    }
    if (_pickupLocation == null || _deliveryLocation == null) {
      _show('Vui lòng chọn cả hai vị trí trên bản đồ trước khi báo giá.', true);
      return;
    }

    if (!_formKey.currentState!.validate()) {
      _show(
        'Vui lòng kiểm tra các trường đang báo lỗi.',
        true,
      );
      return;
    }

    if (_notes.text.trim().length > 1000) {
      _show(
        'Ghi chú không được vượt quá 1.000 ký tự.',
        true,
      );
      return;
    }

    setState(() {
      _loading = true;
    });

    try {
      final quote =
          await ApiService.createQuote(
        order: _order(),
      );

      if (!mounted) return;

      setState(() {
        _quote = quote;
      });

      _show(
        'Đã tính phí vận chuyển.',
        false,
      );
    } catch (e) {
      if (!mounted) return;

      _show(
        e.toString().replaceFirst(
          'Exception: ',
          '',
        ),
        true,
      );
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _create() async {
    if (_quote == null || _loading) {
      return;
    }
    if (_deliveryAreaId == null) {
      _show('Vui lòng chọn phường/xã giao hàng trước khi tạo đơn.', true);
      return;
    }

    if (!_formKey.currentState!.validate()) {
      _show(
        'Thông tin đã thay đổi. '
        'Vui lòng kiểm tra và tính phí lại.',
        true,
      );
      return;
    }

    setState(() {
      _loading = true;
    });

    try {
      final order =
          await ApiService.createOrder(
        order: _order(),
        quoteId: _quote!['id'].toString(),
      );

      if (!mounted) return;

      _show(
        'Đã tạo đơn ${order['id']}.',
        false,
      );

      Navigator.pop(
        context,
        order,
      );
    } catch (e) {
      if (!mounted) return;

      _show(
        e.toString().replaceFirst(
          'Exception: ',
          '',
        ),
        true,
      );
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  void _show(
    String text,
    bool error,
  ) {
    ScaffoldMessenger.of(context)
        .showSnackBar(
      SnackBar(
        content: Text(text),
        backgroundColor: error
            ? Colors.red.shade700
            : Colors.green.shade700,
      ),
    );
  }

  // =========================================================
  // FIELD
  // =========================================================

  Widget _field(
    String label,
    TextEditingController controller, {
    TextInputType? keyboardType,
    List<TextInputFormatter>? formatters,
    String? Function(String?)? validator,
    int maxLength = 300,
    int maxLines = 1,
    String? hint,
    IconData? icon,
  }) {
    return Padding(
      padding:
          const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        inputFormatters: formatters,
        maxLength: maxLength,
        maxLines: maxLines,

        validator: validator ??
            (value) => _required(
                  value,
                  label,
                  max: maxLength,
                ),

        onChanged: (_) {
          // Đổi địa chỉ phải chọn lại điểm trên bản đồ, và báo giá cũ hết hiệu lực.
          if (identical(controller, _pickup)) {
            setState(() => _pickupLocation = null);
          } else if (identical(controller, _delivery)) {
            setState(() => _deliveryLocation = null);
          }
          _invalidateQuote();
        },

        decoration: _input(
          label,
          hint: hint,
          icon: icon,
        ).copyWith(
          counterText:
              maxLength <= 30 ? '' : null,
        ),
      ),
    );
  }

  // =========================================================
  // BUILD
  // =========================================================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: background,

      appBar: AppBar(
        title:
            const Text('Tạo đơn giao hàng'),
        backgroundColor: forest,
        foregroundColor: Colors.white,
      ),

      body: Form(
        key: _formKey,

        child: ListView(
          padding:
              const EdgeInsets.all(20),

          children: [
            // ===============================================
            // INTRO
            // ===============================================

            _introCard(),

            const SizedBox(height: 22),

            // ===============================================
            // NGƯỜI GỬI
            // ===============================================

            _SectionTitle(
              icon:
                  Icons.person_outline,
              title: 'Người gửi',
            ),

            const SizedBox(height: 12),

            _sectionCard(
              children: [
                _field(
                  'Tên người gửi',
                  _senderName,
                  icon:
                      Icons.person_outline,
                ),

                _field(
                  'Điện thoại người gửi',
                  _senderPhone,
                  keyboardType:
                      TextInputType.phone,
                  maxLength: 20,
                  icon:
                      Icons.phone_outlined,
                  validator: (value) =>
                      _phone(
                    value,
                    'Số điện thoại người gửi',
                  ),
                ),

                _field(
                  'Địa chỉ lấy hàng',
                  _pickup,
                  icon:
                      Icons.location_on_outlined,
                  hint:
                      'Nhập địa chỉ lấy hàng',
                ),
                 const SizedBox(height: 12),
                 DropdownButtonFormField<int>(
                   key: ValueKey('pickup-area-$_pickupAreaId'),
                   initialValue: _pickupAreaId,
                   decoration: _input(
                     'Phường/xã lấy hàng (không bắt buộc)',
                     icon: Icons.location_city_outlined,
                   ),
                   hint: Text(_areasLoading ? 'Đang tải khu vực…' : 'Chọn khu vực lấy hàng'),
                   isExpanded: true,
                   items: _areas
                       .where((area) => (area['isActive'] != false && area['isActive']?.toString() != 'false') || (area['id'] as num).toInt() == _pickupAreaId)
                       .map((area) {
                         final code = area['code'] != null ? ' (${area['code']})' : '';
                         return DropdownMenuItem<int>(
                           value: (area['id'] as num).toInt(),
                           child: Text('${area['name']}$code', overflow: TextOverflow.ellipsis),
                         );
                       }).toList(),
                   onChanged: (_loading || _areasLoading) ? null : (value) {
                     setState(() {
                       _pickupAreaId = value;
                       _quote = null;
                     });
                   },
                 ),
                 if (_pickupAreaId != null)
                   Align(
                     alignment: Alignment.centerRight,
                     child: TextButton(
                       onPressed: _loading ? null : () => setState(() {
                         _pickupAreaId = null;
                         _quote = null;
                       }),
                       child: const Text('Bỏ chọn khu vực lấy hàng'),
                     ),
                   ),

              ],
            ),

            const SizedBox(height: 20),

            MapLocationPicker(
              title: 'Chọn vị trí lấy hàng',
              value: _pickupLocation,
              onChanged: (location) {
                _invalidateQuote();
                setState(() => _pickupLocation = location);
              },
            ),
            const SizedBox(height: 20),

            // ===============================================
            // NGƯỜI NHẬN
            // ===============================================

            _SectionTitle(
              icon:
                  Icons.person_pin_outlined,
              title: 'Người nhận',
            ),

            const SizedBox(height: 12),

            _sectionCard(
              children: [
                _field(
                  'Tên người nhận',
                  _recipientName,
                  icon:
                      Icons.person_outline,
                ),

                _field(
                  'Điện thoại người nhận',
                  _recipientPhone,
                  keyboardType:
                      TextInputType.phone,
                  maxLength: 20,
                  icon:
                      Icons.phone_outlined,
                  validator: (value) =>
                      _phone(
                    value,
                    'Số điện thoại người nhận',
                  ),
                ),

                _field(
                  'Địa chỉ giao hàng',
                  _delivery,
                  icon:
                      Icons.flag_outlined,
                  hint:
                      'Nhập địa chỉ giao hàng',
                ),
                 const SizedBox(height: 12),
                 DropdownButtonFormField<int>(
                   key: ValueKey('delivery-area-$_deliveryAreaId'),
                   initialValue: _deliveryAreaId,
                   decoration: _input(
                     'Phường/xã giao hàng *',
                     icon: Icons.location_city_outlined,
                   ),
                   hint: Text(_areasLoading ? 'Đang tải khu vực…' : 'Chọn khu vực giao hàng'),
                   isExpanded: true,
                   items: _areas
                       .where((area) => (area['isActive'] != false && area['isActive']?.toString() != 'false') || (area['id'] as num).toInt() == _deliveryAreaId)
                       .map((area) {
                         final code = area['code'] != null ? ' (${area['code']})' : '';
                         return DropdownMenuItem<int>(
                           value: (area['id'] as num).toInt(),
                           child: Text('${area['name']}$code', overflow: TextOverflow.ellipsis),
                         );
                       }).toList(),
                   validator: (value) => value == null ? 'Vui lòng chọn phường/xã giao hàng.' : null,
                   onChanged: (_loading || _areasLoading) ? null : (value) {
                     setState(() {
                       _deliveryAreaId = value;
                       _quote = null;
                     });
                   },
                 ),
                 const Padding(
                   padding: EdgeInsets.only(top: 8),
                   child: Text(
                     'Khu vực giao hàng dùng để tự động phân công Staff; vị trí bản đồ dùng để xác định địa điểm.',
                     style: TextStyle(color: muted, fontSize: 12),
                   ),
                 ),

              ],
            ),

            const SizedBox(height: 20),

            MapLocationPicker(
              title: 'Chọn vị trí giao hàng',
              value: _deliveryLocation,
              markerColor: Colors.green,
              onChanged: (location) {
                _invalidateQuote();
                setState(() => _deliveryLocation = location);
              },
            ),
            const SizedBox(height: 20),

            // ===============================================
            // KIỆN HÀNG
            // ===============================================

            _SectionTitle(
              icon:
                  Icons.inventory_2_outlined,
              title:
                  'Thông tin kiện hàng',
            ),

            const SizedBox(height: 12),

            _sectionCard(
              children: [
                _field(
                  'Nội dung hàng hóa',
                  _goods,
                  icon:
                      Icons.category_outlined,
                  hint:
                      'Ví dụ: Quần áo, tài liệu...',
                ),

                _field(
                  'Khối lượng (kg)',
                  _weight,
                  keyboardType:
                      const TextInputType
                          .numberWithOptions(
                    decimal: true,
                  ),
                  maxLength: 10,
                  icon:
                      Icons.scale_outlined,
                  validator: (value) =>
                      _positiveDecimal(
                    value,
                    'Khối lượng',
                  ),
                ),

                const Text(
                  'Kích thước kiện hàng (cm)',
                  style: TextStyle(
                    color: forest,
                    fontWeight:
                        FontWeight.w600,
                  ),
                ),

                const SizedBox(height: 10),

                Row(
                  crossAxisAlignment:
                      CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _field(
                        'Dài',
                        _length,
                        keyboardType:
                            const TextInputType
                                .numberWithOptions(
                          decimal: true,
                        ),
                        maxLength: 10,
                        validator: (value) =>
                            _positiveDecimal(
                          value,
                          'Chiều dài',
                        ),
                      ),
                    ),

                    const SizedBox(width: 8),

                    Expanded(
                      child: _field(
                        'Rộng',
                        _width,
                        keyboardType:
                            const TextInputType
                                .numberWithOptions(
                          decimal: true,
                        ),
                        maxLength: 10,
                        validator: (value) =>
                            _positiveDecimal(
                          value,
                          'Chiều rộng',
                        ),
                      ),
                    ),

                    const SizedBox(width: 8),

                    Expanded(
                      child: _field(
                        'Cao',
                        _height,
                        keyboardType:
                            const TextInputType
                                .numberWithOptions(
                          decimal: true,
                        ),
                        maxLength: 10,
                        validator: (value) =>
                            _positiveDecimal(
                          value,
                          'Chiều cao',
                        ),
                      ),
                    ),
                  ],
                ),

                _field(
                  'Giá trị hàng (đ)',
                  _declared,
                  keyboardType:
                      TextInputType.number,
                  formatters: [
                    FilteringTextInputFormatter
                        .digitsOnly,
                  ],
                  maxLength: 12,
                  icon:
                      Icons.sell_outlined,
                  validator: (value) =>
                      _nonNegativeInt(
                    value,
                    'Giá trị hàng',
                  ),
                ),

                _field(
                  'Tiền thu hộ COD (đ)',
                  _cod,
                  keyboardType:
                      TextInputType.number,
                  formatters: [
                    FilteringTextInputFormatter
                        .digitsOnly,
                  ],
                  maxLength: 12,
                  icon:
                      Icons.payments_outlined,
                  validator: (value) =>
                      _nonNegativeInt(
                    value,
                    'Tiền COD',
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // ===============================================
            // DỊCH VỤ
            // ===============================================

            _SectionTitle(
              icon:
                  Icons.local_shipping_outlined,
              title:
                  'Dịch vụ vận chuyển',
            ),

            const SizedBox(height: 12),

            _sectionCard(
              children: [
                DropdownButtonFormField<String>(
                  initialValue: _vehicleType,
                  decoration: _input(
                    'Phương tiện',
                    icon: Icons.directions_bike_outlined,
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'motorbike',
                      child: Text('Xe máy'),
                    ),
                    DropdownMenuItem(
                      value: 'car',
                      child: Text('Ô tô'),
                    ),
                  ],
                  onChanged: _loading
                      ? null
                      : (value) {
                          if (value == null) return;
                          setState(() {
                            _vehicleType = value;
                            if (_vehicleType == 'car' &&
                                _service == 'express') {
                              _service = 'fast';
                            }
                            _quote = null;
                          });
                        },
                ),

                const SizedBox(height: 18),

                const Text(
                  'Chọn dịch vụ',
                  style: TextStyle(
                    color: forest,
                    fontWeight: FontWeight.w600,
                  ),
                ),

                const SizedBox(height: 10),

                _serviceSelector(),

                const SizedBox(height: 18),

                DropdownButtonFormField<String>(
                  initialValue:
                      _feePayer,

                  decoration: _input(
                    'Thanh toán phí vận chuyển',
                    icon:
                        Icons.wallet_outlined,
                  ),

                  items: const [
                    DropdownMenuItem(
                      value:
                          'shop_prepaid',
                      child:
                          Text(
                        'Shop trả trước',
                      ),
                    ),
                    DropdownMenuItem(
                      value:
                          'recipient',
                      child:
                          Text(
                        'Người nhận trả',
                      ),
                    ),
                    DropdownMenuItem(
                      value:
                          'deduct_cod',
                      child:
                          Text(
                        'Khấu trừ COD',
                      ),
                    ),
                  ],

                  onChanged: _loading
                      ? null
                      : (value) {
                          if (value ==
                              null) {
                            return;
                          }

                          setState(() {
                            _feePayer =
                                value;
                          });

                          _invalidateQuote();
                        },
                ),

                const SizedBox(height: 16),

                TextFormField(
                  controller: _notes,
                  maxLines: 3,
                  maxLength: 1000,

                  onChanged: (_) {
                    _invalidateQuote();
                  },

                  decoration: _input(
                    'Ghi chú giao hàng (không bắt buộc)',
                    icon:
                        Icons.notes_outlined,
                  ),
                ),
              ],
            ),

            // ===============================================
            // QUOTE
            // ===============================================

            if (_quote != null) ...[
              const SizedBox(height: 20),

              _quoteCard(),
            ],

            const SizedBox(height: 20),

            // ===============================================
            // CALCULATE
            // ===============================================

            SizedBox(
              height: 54,

              child: FilledButton.icon(
                style:
                    FilledButton.styleFrom(
                  backgroundColor: forest,
                  foregroundColor:
                      Colors.white,
                ),

                onPressed:
                    _loading
                        ? null
                        : _quoteOrder,

                icon: _loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child:
                            CircularProgressIndicator(
                          strokeWidth: 2,
                          color:
                              Colors.white,
                        ),
                      )
                    : const Icon(
                        Icons
                            .calculate_outlined,
                      ),

                label: Text(
                  _loading
                      ? 'Đang xử lý...'
                      : 'Tính phí vận chuyển',
                  style:
                      const TextStyle(
                    fontWeight:
                        FontWeight.bold,
                  ),
                ),
              ),
            ),

            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  // =========================================================
  // INTRO
  // =========================================================

  Widget _introCard() {
    return Container(
      padding:
          const EdgeInsets.all(18),

      decoration: BoxDecoration(
        color: forest,
        borderRadius:
            BorderRadius.circular(18),
      ),

      child: const Row(
        crossAxisAlignment:
            CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            backgroundColor: lime,
            foregroundColor: forest,
            child: Icon(
              Icons.local_shipping_outlined,
            ),
          ),

          SizedBox(width: 14),

          Expanded(
            child: Column(
              crossAxisAlignment:
                  CrossAxisAlignment.start,
              children: [
                Text(
                  'Tạo đơn mới',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight:
                        FontWeight.bold,
                  ),
                ),

                SizedBox(height: 6),

                Text(
                  'Nhập thông tin giao hàng, '
                  'tính phí và xác nhận tạo đơn.',
                  style: TextStyle(
                    color: Colors.white70,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================
  // SERVICE
  // =========================================================

  Widget _serviceSelector() {
    final services = <Widget>[
      Expanded(
        child: _serviceCard(
          value: 'standard',
          title: 'Tiêu chuẩn',
          subtitle: 'Tiết kiệm',
          icon: Icons.inventory_2_outlined,
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _serviceCard(
          value: 'fast',
          title: 'Nhanh',
          subtitle: 'Trong ngày',
          icon: Icons.speed_outlined,
        ),
      ),
    ];

    if (_vehicleType == 'motorbike') {
      services.addAll([
        const SizedBox(width: 8),
        Expanded(
          child: _serviceCard(
            value: 'express',
            title: 'Hỏa tốc',
            subtitle: 'Nhanh nhất',
            icon: Icons.bolt_outlined,
          ),
        ),
      ]);
    }

    return Row(children: services);
  }

  Widget _serviceCard({
    required String value,
    required String title,
    required String subtitle,
    required IconData icon,
  }) {
    final selected =
        _service == value;

    return InkWell(
      borderRadius:
          BorderRadius.circular(14),

      onTap: _loading
          ? null
          : () {
              setState(() {
                _service = value;
              });

              _invalidateQuote();
            },

      child: AnimatedContainer(
        duration:
            const Duration(
          milliseconds: 160,
        ),

        padding:
            const EdgeInsets.all(14),

        decoration: BoxDecoration(
          color: selected
              ? lime
              : const Color(
                  0xFFF7F8F4,
                ),

          borderRadius:
              BorderRadius.circular(
            14,
          ),

          border: Border.all(
            color: selected
                ? forest
                : const Color(
                    0xFFE2E8E4,
                  ),
            width:
                selected ? 1.5 : 1,
          ),
        ),

        child: Column(
          crossAxisAlignment:
              CrossAxisAlignment.start,
          children: [
            Icon(
              icon,
              color: forest,
            ),

            const SizedBox(height: 10),

            Text(
              title,
              style: const TextStyle(
                color: forest,
                fontWeight:
                    FontWeight.bold,
              ),
            ),

            const SizedBox(height: 2),

            Text(
              subtitle,
              style: const TextStyle(
                color: muted,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // =========================================================
  // QUOTE CARD
  // =========================================================

  Widget _quoteCard() {
    return Container(
      width: double.infinity,

      padding:
          const EdgeInsets.all(18),

      decoration: BoxDecoration(
        color: Colors.white,

        borderRadius:
            BorderRadius.circular(18),

        border: Border.all(
          color: forest,
        ),
      ),

      child: Column(
        crossAxisAlignment:
            CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons
                    .request_quote_outlined,
                color: forest,
              ),

              SizedBox(width: 8),

              Text(
                'Báo giá vận chuyển',
                style: TextStyle(
                  color: forest,
                  fontSize: 18,
                  fontWeight:
                      FontWeight.bold,
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          const Text(
            'Phí dự kiến',
            style: TextStyle(
              color: muted,
            ),
          ),

          const SizedBox(height: 4),

          Text(
            '${_quote!['fee']} đ',
            style: const TextStyle(
              color: orange,
              fontSize: 28,
              fontWeight:
                  FontWeight.w800,
            ),
          ),

          if (_quote!['expiresAt'] !=
              null) ...[
            const SizedBox(height: 6),

            Text(
              'Hết hạn: ${_formatDate(_quote!['expiresAt'])}',
              style: const TextStyle(
                color: muted,
                fontSize: 12,
              ),
            ),
          ],

          const SizedBox(height: 16),

          SizedBox(
            width: double.infinity,

            child: FilledButton.icon(
              style:
                  FilledButton.styleFrom(
                backgroundColor: orange,
                foregroundColor:
                    Colors.white,
                padding:
                    const EdgeInsets
                        .symmetric(
                  vertical: 13,
                ),
              ),

              onPressed:
                  _loading
                      ? null
                      : _create,

              icon: const Icon(
                Icons
                    .check_circle_outline,
              ),

              label: const Text(
                'Xác nhận tạo đơn',
                style: TextStyle(
                  fontWeight:
                      FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================
  // COMMON
  // =========================================================

  Widget _sectionCard({
    required List<Widget> children,
  }) {
    return Container(
      width: double.infinity,

      padding:
          const EdgeInsets.all(16),

      decoration: BoxDecoration(
        color: Colors.white,

        borderRadius:
            BorderRadius.circular(18),

        border: Border.all(
          color:
              const Color(
            0xFFE2E8E4,
          ),
        ),
      ),

      child: Column(
        children: children,
      ),
    );
  }

  InputDecoration _input(
    String label, {
    String? hint,
    IconData? icon,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,

      prefixIcon:
          icon == null
              ? null
              : Icon(icon),

      filled: true,
      fillColor:
          const Color(0xFFFBFCFA),

      border: OutlineInputBorder(
        borderRadius:
            BorderRadius.circular(12),
      ),

      enabledBorder:
          OutlineInputBorder(
        borderRadius:
            BorderRadius.circular(12),
        borderSide:
            const BorderSide(
          color:
              Color(
            0xFFE2E8E4,
          ),
        ),
      ),

      focusedBorder:
          OutlineInputBorder(
        borderRadius:
            BorderRadius.circular(12),
        borderSide:
            const BorderSide(
          color: forest,
          width: 1.5,
        ),
      ),
    );
  }

  String _formatDate(
    dynamic value,
  ) {
    final date =
        DateTime.tryParse(
          value.toString(),
        )?.toLocal();

    if (date == null) {
      return value.toString();
    }

    String two(int n) =>
        n.toString().padLeft(2, '0');

    return '${two(date.day)}/${two(date.month)}/${date.year} '
        '${two(date.hour)}:${two(date.minute)}';
  }
}

// =========================================================
// SECTION TITLE
// =========================================================

class _SectionTitle
    extends StatelessWidget {
  final IconData icon;
  final String title;

  const _SectionTitle({
    required this.icon,
    required this.title,
  });

  @override
  Widget build(
    BuildContext context,
  ) {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,

          decoration: BoxDecoration(
            color:
                const Color(
              0xFFEAF6A6,
            ),
            borderRadius:
                BorderRadius.circular(
              10,
            ),
          ),

          child: Icon(
            icon,
            size: 20,
            color:
                const Color(
              0xFF123F31,
            ),
          ),
        ),

        const SizedBox(width: 10),

        Expanded(
          child: Text(
            title.toUpperCase(),
            style:
                const TextStyle(
              fontWeight:
                  FontWeight.bold,
              letterSpacing: 1.1,
              color:
                  Color(
                0xFF123F31,
              ),
            ),
          ),
        ),
      ],
    );
  }
}