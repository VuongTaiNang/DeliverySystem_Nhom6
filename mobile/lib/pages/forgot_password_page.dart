import 'package:flutter/material.dart';

import '../services/password_reset_service.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  static const forest = Color(0xFF123F31);
  static const muted = Color(0xFF668177);
  static const background = Color(0xFFF7F8F4);

  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _requesting = false;
  bool _resetting = false;
  bool _otpRequested = false;
  bool _hidePassword = true;
  bool _hideConfirm = true;
  String? _demoOtp;

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  bool _validPhone(String phone) => RegExp(r'^0[0-9]{9}$').hasMatch(phone);

  Future<void> _requestOtp() async {
    final phone = _phoneController.text.trim();
    if (!_validPhone(phone)) {
      _message('Số điện thoại phải gồm 10 số và bắt đầu bằng 0.', error: true);
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _requesting = true);

    try {
      final result = await PasswordResetService.requestOtp(phone);
      if (!mounted) return;

      setState(() {
        _otpRequested = true;
        _demoOtp = result['demoOtp']?.toString();
      });

      _message('Đã tạo mã OTP. Mã có hiệu lực trong 5 phút.');
    } catch (error) {
      if (!mounted) return;
      _message(_cleanError(error), error: true);
    } finally {
      if (mounted) setState(() => _requesting = false);
    }
  }

  Future<void> _resetPassword() async {
    final phone = _phoneController.text.trim();
    final otp = _otpController.text.trim();
    final password = _passwordController.text;
    final confirm = _confirmController.text;

    if (!_validPhone(phone)) {
      _message('Số điện thoại không hợp lệ.', error: true);
      return;
    }
    if (!RegExp(r'^[0-9]{6}$').hasMatch(otp)) {
      _message('OTP phải gồm đúng 6 số.', error: true);
      return;
    }
    if (password.length < 8) {
      _message('Mật khẩu mới phải có ít nhất 8 ký tự.', error: true);
      return;
    }
    if (password != confirm) {
      _message('Mật khẩu nhập lại chưa khớp.', error: true);
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _resetting = true);

    try {
      final message = await PasswordResetService.resetPassword(
        phone: phone,
        otp: otp,
        newPassword: password,
      );
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: forest),
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      _message(_cleanError(error), error: true);
    } finally {
      if (mounted) setState(() => _resetting = false);
    }
  }

  String _cleanError(Object error) =>
      error.toString().replaceFirst('Exception: ', '');

  void _message(String text, {bool error = false}) {
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

  @override
  Widget build(BuildContext context) {
    final busy = _requesting || _resetting;

    return Scaffold(
      backgroundColor: background,
      appBar: AppBar(
        title: const Text('Quên mật khẩu'),
        backgroundColor: forest,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(
                  'Đặt lại mật khẩu',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: forest,
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Nhập số điện thoại đã đăng ký để nhận mã OTP.',
                  style: TextStyle(color: muted, height: 1.4),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _phoneController,
                  enabled: !busy,
                  keyboardType: TextInputType.phone,
                  maxLength: 10,
                  decoration: _decoration('Số điện thoại', Icons.phone_outlined),
                ),
                const SizedBox(height: 4),
                SizedBox(
                  height: 50,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: forest,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: busy ? null : _requestOtp,
                    icon: _requesting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.sms_outlined),
                    label: Text(
                      _otpRequested ? 'Gửi lại OTP' : 'Lấy mã OTP',
                    ),
                  ),
                ),
                if (_otpRequested) ...[
                  const SizedBox(height: 18),
                  if (_demoOtp != null)
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF3CD),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFFE69C)),
                      ),
                      child: Text(
                        'OTP demo: $_demoOtp\n'
                        'Project chưa tích hợp SMS thật nên mã được hiển thị trực tiếp.',
                        style: const TextStyle(height: 1.4),
                      ),
                    ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: _otpController,
                    enabled: !busy,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: _decoration('Mã OTP 6 số', Icons.pin_outlined),
                  ),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _passwordController,
                    enabled: !busy,
                    obscureText: _hidePassword,
                    decoration: _decoration('Mật khẩu mới', Icons.lock_outline).copyWith(
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => _hidePassword = !_hidePassword),
                        icon: Icon(
                          _hidePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _confirmController,
                    enabled: !busy,
                    obscureText: _hideConfirm,
                    decoration: _decoration(
                      'Nhập lại mật khẩu mới',
                      Icons.lock_outline,
                    ).copyWith(
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => _hideConfirm = !_hideConfirm),
                        icon: Icon(
                          _hideConfirm
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    height: 50,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: forest,
                        foregroundColor: Colors.white,
                      ),
                      onPressed: busy ? null : _resetPassword,
                      child: _resetting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Đặt lại mật khẩu'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
