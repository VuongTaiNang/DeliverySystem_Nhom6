import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'login_page.dart';

import '../operations/dashboard/operations_dashboard_screen.dart';
import '../operations/settlement/settlement_screen.dart';
import '../operations/shipment/shipment_list_screen.dart';

class OperationsHomePage extends StatefulWidget {
  final Map<String, dynamic>? user;

  const OperationsHomePage({
    super.key,
    this.user,
  });

  @override
  State<OperationsHomePage> createState() => _OperationsHomePageState();
}

class _OperationsHomePageState extends State<OperationsHomePage> {
  int _currentIndex = 0;

  final List<Widget> _pages = const [
    OperationsDashboardScreen(),
    ShipmentListScreen(),
    SettlementScreen(),
  ];

  static const Color forest = Color(0xFF123F31);
  static const Color muted = Color(0xFF668177);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Express • Operations'),
        backgroundColor: forest,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Đăng xuất',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await ApiService.logout();
              if (!context.mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginPage()),
                (_) => false,
              );
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        selectedItemColor: forest,
        unselectedItemColor: muted,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Tổng quan',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.local_shipping_outlined),
            activeIcon: Icon(Icons.local_shipping),
            label: 'Đơn hàng',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.account_balance_wallet_outlined),
            activeIcon: Icon(Icons.account_balance_wallet),
            label: 'Đối soát COD',
          ),
        ],
      ),
    );
  }
}

