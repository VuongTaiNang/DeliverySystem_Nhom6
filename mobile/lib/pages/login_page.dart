import 'package:flutter/material.dart';

import '../services/api_service.dart';
import 'forgot_password_page.dart';
import 'home_page.dart';
import 'operations_home_page.dart';
import 'staff_home_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  static const forest = Color(0xFF123F31);
  static const muted = Color(0xFF668177);
  static const lime = Color(0xFFEAF6A6);
  static const background = Color(0xFFF7F8F4);

  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _shopNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isRegister = false;
  bool _busy = false;
  bool _hidePassword = true;
  bool _hideConfirmPassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _fullNameController.dispose();
    _shopNameController.dispose();
    _phoneController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return 'Vui lòng nhập email.';
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return 'Email không hợp lệ.';
    }
    return null;
  }

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (password.isEmpty) return 'Vui lòng nhập mật khẩu.';
    if (_isRegister && password.length < 8) {
      return 'Mật khẩu cần ít nhất 8 ký tự.';
    }
    return null;
  }

  String? _validateFullName(String? value) {
    if (!_isRegister) return null;
    if ((value?.trim() ?? '').isEmpty) return 'Vui lòng nhập họ và tên.';
    return null;
  }

  String? _validatePhone(String? value) {
    if (!_isRegister) return null;
    final phone = value?.trim() ?? '';
    if (phone.isEmpty) return 'Vui lòng nhập số điện thoại.';
    if (!RegExp(r'^0[0-9]{9}$').hasMatch(phone)) {
      return 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0.';
    }
    return null;
  }

  String? _validateConfirmPassword(String? value) {
    if (!_isRegister) return null;
    if ((value ?? '').isEmpty) return 'Vui lòng nhập lại mật khẩu.';
    if (value != _passwordController.text) return 'Mật khẩu chưa khớp.';
    return null;
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    setState(() => _busy = true);

    try {
      if (_isRegister) {
        await ApiService.register(
          fullName: _fullNameController.text.trim(),
          shopName: _shopNameController.text.trim(),
          phone: _phoneController.text.trim(),
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );

        if (!mounted) return;
        setState(() {
          _isRegister = false;
          _passwordController.clear();
          _confirmPasswordController.clear();
        });
        _showMessage('Đăng ký thành công. Vui lòng đăng nhập.');
        return;
      }

      final user = await ApiService.login(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      if (!mounted) return;
      final role = ApiService.currentRole?.toLowerCase() ?? 'customer';
      final Widget destination = role == 'staff'
          ? StaffHomePage(user: user)
          : (role == 'operations' || role == 'admin')
              ? OperationsHomePage(user: user)
              : HomePage(user: user);

      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => destination),
        (_) => false,
      );
    } catch (error) {
      if (!mounted) return;
      _showMessage(_cleanError(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _cleanError(Object error) =>
      error.toString().replaceFirst('Exception: ', '');

  void _toggleMode() {
    _formKey.currentState?.reset();
    setState(() {
      _isRegister = !_isRegister;
      _hidePassword = true;
      _hideConfirmPassword = true;
      _passwordController.clear();
      _confirmPasswordController.clear();
    });
  }

  void _continueAsGuest() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const HomePage()),
      (_) => false,
    );
  }

  Future<void> _openForgotPassword() async {
    FocusScope.of(context).unfocus();
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const ForgotPasswordPage()),
    );

    if (!mounted || changed != true) return;
    _passwordController.clear();
    _showMessage('Mật khẩu đã được đặt lại. Hãy đăng nhập bằng mật khẩu mới.');
  }

  void _showMessage(String text, {bool error = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(text),
          backgroundColor: error ? Colors.red.shade700 : forest,
        ),
      );
  }

  InputDecoration _decoration(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon),
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE2E8E4)),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    String? Function(String?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        validator: validator,
        autocorrect: false,
        enabled: !_busy,
        decoration: _decoration(label, icon),
      ),
    );
  }

  Widget _passwordField({
    required TextEditingController controller,
    required String label,
    required bool hidden,
    required VoidCallback onToggle,
    required String? Function(String?) validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        controller: controller,
        obscureText: hidden,
        autocorrect: false,
        enableSuggestions: false,
        enabled: !_busy,
        validator: validator,
        decoration: _decoration(label, Icons.lock_outline).copyWith(
          suffixIcon: IconButton(
            tooltip: hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
            onPressed: onToggle,
            icon: Icon(
              hidden
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined,
            ),
          ),
        ),
      ),
    );
  }

  Widget _brand() {
    return const Row(
      children: [
        CircleAvatar(
          radius: 24,
          backgroundColor: lime,
          foregroundColor: forest,
          child: Text(
            'E',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
        ),
        SizedBox(width: 12),
        Text(
          'express.',
          style: TextStyle(
            color: forest,
            fontSize: 26,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: forest,
        elevation: 0,
        title: const Text('Express'),
        actions: [
          TextButton(
            onPressed: _busy ? null : _continueAsGuest,
            child: const Text('Khách'),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 30),
              children: [
                _brand(),
                const SizedBox(height: 30),
                Text(
                  _isRegister ? 'Bắt đầu cùng Express' : 'Chào mừng trở lại',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: forest,
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  _isRegister
                      ? 'Tạo tài khoản để quản lý đơn hàng, theo dõi hành trình và sử dụng đầy đủ tính năng.'
                      : 'Đăng nhập để quản lý đơn hàng, COD và thông tin tài khoản của bạn.',
                  style: const TextStyle(color: muted, height: 1.45),
                ),
                const SizedBox(height: 24),
                Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      if (_isRegister) ...[
                        _field(
                          controller: _fullNameController,
                          label: 'Họ và tên',
                          icon: Icons.person_outline,
                          validator: _validateFullName,
                        ),
                        _field(
                          controller: _shopNameController,
                          label: 'Tên cửa hàng (không bắt buộc)',
                          icon: Icons.storefront_outlined,
                        ),
                        _field(
                          controller: _phoneController,
                          label: 'Số điện thoại',
                          icon: Icons.phone_outlined,
                          keyboardType: TextInputType.phone,
                          validator: _validatePhone,
                        ),
                      ],
                      _field(
                        controller: _emailController,
                        label: 'Email',
                        icon: Icons.email_outlined,
                        keyboardType: TextInputType.emailAddress,
                        validator: _validateEmail,
                      ),
                      _passwordField(
                        controller: _passwordController,
                        label: 'Mật khẩu',
                        hidden: _hidePassword,
                        onToggle: () => setState(
                          () => _hidePassword = !_hidePassword,
                        ),
                        validator: _validatePassword,
                      ),
                      if (_isRegister)
                        _passwordField(
                          controller: _confirmPasswordController,
                          label: 'Nhập lại mật khẩu',
                          hidden: _hideConfirmPassword,
                          onToggle: () => setState(
                            () => _hideConfirmPassword = !_hideConfirmPassword,
                          ),
                          validator: _validateConfirmPassword,
                        ),
                      if (!_isRegister)
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: _busy ? null : _openForgotPassword,
                            child: const Text('Quên mật khẩu?'),
                          ),
                        ),
                      const SizedBox(height: 6),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: forest,
                            foregroundColor: Colors.white,
                          ),
                          onPressed: _busy ? null : _submit,
                          child: _busy
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Text(
                                  _isRegister ? 'Tạo tài khoản' : 'Đăng nhập',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: _busy ? null : _toggleMode,
                  child: Text(
                    _isRegister
                        ? 'Đã có tài khoản? Đăng nhập'
                        : 'Chưa có tài khoản? Đăng ký',
                  ),
                ),
                if (!_isRegister) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Expanded(child: Divider()),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          'hoặc',
                          style: TextStyle(color: Colors.grey.shade600),
                        ),
                      ),
                      const Expanded(child: Divider()),
                    ],
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: forest,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                      ),
                      onPressed: _busy ? null : _continueAsGuest,
                      icon: const Icon(Icons.person_outline),
                      label: const Text('Tiếp tục với tư cách khách'),
                    ),
                  ),
                ],
                const SizedBox(height: 30),
                const Text(
                  'EXPRESS / GIAO HÀNG KẾT NỐI',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    letterSpacing: 2,
                    color: muted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
