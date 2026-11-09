import 'package:flutter/material.dart';

import '../services/api_service.dart';
import 'login_page.dart';
import 'staff_orders_page.dart';
import 'staff_location_page.dart';

class StaffHomePage extends StatelessWidget {
  final Map<String, dynamic> user;
  const StaffHomePage({super.key, required this.user});
  static const _green = Color(0xFF123F31);

  Future<void> _logout(BuildContext context) async {
    await ApiService.logout();
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginPage()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final name = (user['name'] ?? user['fullName'] ?? 'Nhân viên').toString();
    return Scaffold(
      appBar: AppBar(
        title: const Text('EXPRESS • Staff'),
        backgroundColor: _green,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Đăng xuất',
            icon: const Icon(Icons.logout),
            onPressed: () => _logout(context),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Xin chào, $name',
              style: Theme.of(context).textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.bold, color: _green),
            ),
            const SizedBox(height: 8),
            const Text('Quản lý công việc giao nhận của bạn.'),
            const SizedBox(height: 24),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.local_shipping_outlined,
                      size: 38,
                      color: _green,
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Đơn được phân công',
                      style: Theme.of(context).textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 7),
                    const Text(
                      'Nhận đơn, lấy hàng, giao hàng và xử lý sự cố theo đúng trạng thái.',
                    ),
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(backgroundColor: _green),
                        icon: const Icon(Icons.list_alt),
                        label: const Text('Xem đơn hàng'),
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const StaffOrdersPage(),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.my_location_outlined,
                      size: 38,
                      color: _green,
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Chia sẻ vị trí nhiệm vụ',
                      style: Theme.of(context).textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 7),
                    const Text(
                      'Chủ động gửi GPS hiện tại để Operations theo dõi và ước tính ETA.',
                    ),
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.location_searching),
                        label: const Text('Mở chia sẻ vị trí'),
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const StaffLocationPage(),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Danh sách đơn và trạng thái được lấy từ Backend Express, dùng chung với Staff Web.',
              style: TextStyle(color: Colors.black54),
            ),
          ],
        ),
      ),
    );
  }
}
