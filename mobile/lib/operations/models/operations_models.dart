/// Models for Operations Module
/// (Shipment, Assignment, Staff, Settlement)

class OperationStaff {
  final int id;
  final String employeeCode;
  final String fullName;
  final String phone;
  final String area;
  final String status;
  final int currentAssignments;

  OperationStaff({
    required this.id,
    required this.employeeCode,
    required this.fullName,
    required this.phone,
    required this.area,
    required this.status,
    required this.currentAssignments,
  });

  factory OperationStaff.fromJson(Map<String, dynamic> json) {
    return OperationStaff(
      id: json['id'] is int ? json['id'] as int : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      employeeCode: json['employeeCode']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? json['name']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      area: json['area']?.toString() ?? '',
      status: json['status']?.toString() ?? 'available',
      currentAssignments: json['currentAssignments'] is int
          ? json['currentAssignments'] as int
          : int.tryParse(json['currentAssignments']?.toString() ?? '0') ?? 0,
    );
  }
}

class OperationActiveAssignment {
  final int id;
  final int staffId;
  final String employeeCode;
  final String staffName;
  final String assignmentStatus;
  final String assignedAt;

  OperationActiveAssignment({
    required this.id,
    required this.staffId,
    required this.employeeCode,
    required this.staffName,
    required this.assignmentStatus,
    required this.assignedAt,
  });

  factory OperationActiveAssignment.fromJson(Map<String, dynamic> json) {
    return OperationActiveAssignment(
      id: json['id'] is int ? json['id'] as int : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      staffId: json['staffId'] is int
          ? json['staffId'] as int
          : int.tryParse(json['staffId']?.toString() ?? '0') ?? 0,
      employeeCode: json['employeeCode']?.toString() ?? '',
      staffName: json['staffName']?.toString() ?? '',
      assignmentStatus: json['assignmentStatus']?.toString() ?? '',
      assignedAt: json['assignedAt']?.toString() ?? '',
    );
  }
}

class OperationShipment {
  final String id;
  final dynamic customerId;
  final String senderName;
  final String senderPhone;
  final String pickupAddress;
  final String recipientName;
  final String recipientPhone;
  final String deliveryAddress;
  final String goods;
  final num weightKg;
  final num? lengthCm;
  final num? widthCm;
  final num? heightCm;
  final num? declaredValue;
  final num codAmount;
  final num codCollected;
  final num fee;
  final String feePayer;
  final String? vehicleType;
  final String? service;
  final String status;
  final int attempts;
  final String createdAt;
  final String? notes;
  final String? paymentMethod;
  final String? paymentStatus;
  final OperationActiveAssignment? activeAssignment;

  OperationShipment({
    required this.id,
    this.customerId,
    required this.senderName,
    required this.senderPhone,
    required this.pickupAddress,
    required this.recipientName,
    required this.recipientPhone,
    required this.deliveryAddress,
    required this.goods,
    required this.weightKg,
    this.lengthCm,
    this.widthCm,
    this.heightCm,
    this.declaredValue,
    required this.codAmount,
    required this.codCollected,
    required this.fee,
    required this.feePayer,
    this.vehicleType,
    this.service,
    required this.status,
    required this.attempts,
    required this.createdAt,
    this.notes,
    this.paymentMethod,
    this.paymentStatus,
    this.activeAssignment,
  });

  factory OperationShipment.fromJson(Map<String, dynamic> json) {
    return OperationShipment(
      id: json['id']?.toString() ?? '',
      customerId: json['customerId'],
      senderName: json['senderName']?.toString() ?? '',
      senderPhone: json['senderPhone']?.toString() ?? '',
      pickupAddress: json['pickupAddress']?.toString() ?? '',
      recipientName: json['recipientName']?.toString() ?? '',
      recipientPhone: json['recipientPhone']?.toString() ?? '',
      deliveryAddress: json['deliveryAddress']?.toString() ?? '',
      goods: json['goods']?.toString() ?? '',
      weightKg: num.tryParse(json['weightKg']?.toString() ?? '0') ?? 0,
      lengthCm: num.tryParse(json['lengthCm']?.toString() ?? ''),
      widthCm: num.tryParse(json['widthCm']?.toString() ?? ''),
      heightCm: num.tryParse(json['heightCm']?.toString() ?? ''),
      declaredValue: num.tryParse(json['declaredValue']?.toString() ?? ''),
      codAmount: num.tryParse(json['codAmount']?.toString() ?? '0') ?? 0,
      codCollected: num.tryParse(json['codCollected']?.toString() ?? '0') ?? 0,
      fee: num.tryParse(json['fee']?.toString() ?? '0') ?? 0,
      feePayer: json['feePayer']?.toString() ?? 'deduct_cod',
      vehicleType: json['vehicleType']?.toString(),
      service: json['service']?.toString(),
      status: json['status']?.toString() ?? 'pending_pickup',
      attempts: int.tryParse(json['attempts']?.toString() ?? '0') ?? 0,
      createdAt: json['createdAt']?.toString() ?? '',
      notes: json['notes']?.toString(),
      paymentMethod: json['paymentMethod']?.toString(),
      paymentStatus: json['paymentStatus']?.toString(),
      activeAssignment: json['activeAssignment'] != null && json['activeAssignment'] is Map
          ? OperationActiveAssignment.fromJson(Map<String, dynamic>.from(json['activeAssignment'] as Map))
          : null,
    );
  }
}

class OperationEvent {
  final dynamic id;
  final String status;
  final String at;
  final String note;

  OperationEvent({
    this.id,
    required this.status,
    required this.at,
    required this.note,
  });

  factory OperationEvent.fromJson(Map<String, dynamic> json) {
    return OperationEvent(
      id: json['id'],
      status: json['status']?.toString() ?? '',
      at: json['at']?.toString() ?? '',
      note: json['note']?.toString() ?? '',
    );
  }
}

class OperationAssignment {
  final int id;
  final int staffId;
  final String employeeCode;
  final String staffName;
  final dynamic assignedByUserId;
  final String assignedByName;
  final String assignedAt;
  final String status;
  final bool isActive;
  final String? acceptedAt;
  final String? endedAt;
  final String? rejectionReason;

  OperationAssignment({
    required this.id,
    required this.staffId,
    required this.employeeCode,
    required this.staffName,
    this.assignedByUserId,
    required this.assignedByName,
    required this.assignedAt,
    required this.status,
    required this.isActive,
    this.acceptedAt,
    this.endedAt,
    this.rejectionReason,
  });

  factory OperationAssignment.fromJson(Map<String, dynamic> json) {
    return OperationAssignment(
      id: json['id'] is int ? json['id'] as int : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      staffId: json['staffId'] is int
          ? json['staffId'] as int
          : int.tryParse(json['staffId']?.toString() ?? '0') ?? 0,
      employeeCode: json['employeeCode']?.toString() ?? '',
      staffName: json['staffName']?.toString() ?? '',
      assignedByUserId: json['assignedByUserId'],
      assignedByName: json['assignedByName']?.toString() ?? 'Hệ thống',
      assignedAt: json['assignedAt']?.toString() ?? '',
      status: json['status']?.toString() ?? 'pending',
      isActive: json['isActive'] == true,
      acceptedAt: json['acceptedAt']?.toString(),
      endedAt: json['endedAt']?.toString(),
      rejectionReason: json['rejectionReason']?.toString(),
    );
  }
}

class OperationShipmentDetail {
  final OperationShipment shipment;
  final List<OperationEvent> events;
  final List<OperationAssignment> assignmentHistory;

  OperationShipmentDetail({
    required this.shipment,
    required this.events,
    required this.assignmentHistory,
  });

  factory OperationShipmentDetail.fromJson(Map<String, dynamic> json) {
    final shipmentMap = json['shipment'] is Map ? Map<String, dynamic>.from(json['shipment'] as Map) : json;
    final eventsRaw = json['events'];
    final assignmentsRaw = json['assignmentHistory'];

    return OperationShipmentDetail(
      shipment: OperationShipment.fromJson(shipmentMap),
      events: eventsRaw is List
          ? eventsRaw.map((e) => OperationEvent.fromJson(Map<String, dynamic>.from(e as Map))).toList()
          : [],
      assignmentHistory: assignmentsRaw is List
          ? assignmentsRaw.map((e) => OperationAssignment.fromJson(Map<String, dynamic>.from(e as Map))).toList()
          : [],
    );
  }
}

class SettlementLineItem {
  final dynamic id;
  final String shipmentId;
  final num codCollected;
  final num shippingDeduction;

  SettlementLineItem({
    this.id,
    required this.shipmentId,
    required this.codCollected,
    required this.shippingDeduction,
  });

  factory SettlementLineItem.fromJson(Map<String, dynamic> json) {
    return SettlementLineItem(
      id: json['id'],
      shipmentId: json['shipmentId']?.toString() ?? '',
      codCollected: num.tryParse(json['codCollected']?.toString() ?? '0') ?? 0,
      shippingDeduction: num.tryParse(json['shippingDeduction']?.toString() ?? '0') ?? 0,
    );
  }
}

class SettlementItem {
  final String id;
  final String createdAt;
  final num totalCod;
  final num shippingDeduction;
  final num adjustment;
  final String? adjustmentReason;
  final num netAmount;
  final String status;
  final String? completedAt;
  final String? paymentReference;
  final List<SettlementLineItem> lines;

  SettlementItem({
    required this.id,
    required this.createdAt,
    required this.totalCod,
    required this.shippingDeduction,
    required this.adjustment,
    this.adjustmentReason,
    required this.netAmount,
    required this.status,
    this.completedAt,
    this.paymentReference,
    required this.lines,
  });

  factory SettlementItem.fromJson(Map<String, dynamic> json) {
    final rawLines = json['lines'];
    return SettlementItem(
      id: json['id']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      totalCod: num.tryParse(json['totalCod']?.toString() ?? '0') ?? 0,
      shippingDeduction: num.tryParse(json['shippingDeduction']?.toString() ?? '0') ?? 0,
      adjustment: num.tryParse(json['adjustment']?.toString() ?? '0') ?? 0,
      adjustmentReason: json['adjustmentReason']?.toString(),
      netAmount: num.tryParse(json['netAmount']?.toString() ?? '0') ?? 0,
      status: json['status']?.toString() ?? 'pending',
      completedAt: json['completedAt']?.toString(),
      paymentReference: json['paymentReference']?.toString(),
      lines: rawLines is List
          ? rawLines.map((e) => SettlementLineItem.fromJson(Map<String, dynamic>.from(e as Map))).toList()
          : [],
    );
  }
}

class OperationArea {
  final int id;
  final String code;
  final String name;
  final String type; // ward, commune, special_zone
  final bool isActive;
  final int staffCount;
  final int totalCapacity;
  final int activeOrders;
  final int availableCapacity;
  final int waitingAssignments;
  final bool hasCapacityAlert;
  final List<OperationAreaStaff> staff;

  OperationArea({
    required this.id,
    required this.code,
    required this.name,
    required this.type,
    required this.isActive,
    this.staffCount = 0,
    this.totalCapacity = 0,
    this.activeOrders = 0,
    this.availableCapacity = 0,
    this.waitingAssignments = 0,
    this.hasCapacityAlert = false,
    this.staff = const [],
  });

  factory OperationArea.fromJson(Map<String, dynamic> json) {
    final rawStaff = json['staff'];
    return OperationArea(
      id: json['id'] is int
          ? json['id'] as int
          : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      code: json['code']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      type: json['type']?.toString() ?? 'ward',
      isActive: json['isActive'] == true || json['isActive']?.toString() == 'true',
      staffCount: json['staffCount'] is int
          ? json['staffCount'] as int
          : int.tryParse(json['staffCount']?.toString() ?? '0') ?? 0,
      totalCapacity: json['totalCapacity'] is int
          ? json['totalCapacity'] as int
          : int.tryParse(json['totalCapacity']?.toString() ?? '0') ?? 0,
      activeOrders: json['activeOrders'] is int
          ? json['activeOrders'] as int
          : int.tryParse(json['activeOrders']?.toString() ?? '0') ?? 0,
      availableCapacity: json['availableCapacity'] is int
          ? json['availableCapacity'] as int
          : int.tryParse(json['availableCapacity']?.toString() ?? '0') ?? 0,
      waitingAssignments: json['waitingAssignments'] is int
          ? json['waitingAssignments'] as int
          : int.tryParse(json['waitingAssignments']?.toString() ?? '0') ?? 0,
      hasCapacityAlert: json['hasCapacityAlert'] == true,
      staff: rawStaff is List
          ? rawStaff
              .whereType<Map>()
              .map((e) => OperationAreaStaff.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }
}

class OperationAreaStaff {
  final int staffAreaId;
  final int staffId;
  final String employeeCode;
  final String staffStatus;
  final bool staffAvailable;
  final int maxActiveOrders;
  final int activeOrders;
  final double utilization;
  final bool isFull;
  final bool isActive;

  OperationAreaStaff({
    required this.staffAreaId,
    required this.staffId,
    required this.employeeCode,
    required this.staffStatus,
    required this.staffAvailable,
    required this.maxActiveOrders,
    required this.activeOrders,
    required this.utilization,
    required this.isFull,
    required this.isActive,
  });

  factory OperationAreaStaff.fromJson(Map<String, dynamic> json) {
    return OperationAreaStaff(
      staffAreaId: json['staffAreaId'] is int
          ? json['staffAreaId'] as int
          : int.tryParse(json['staffAreaId']?.toString() ?? '0') ?? 0,
      staffId: json['staffId'] is int
          ? json['staffId'] as int
          : int.tryParse(json['staffId']?.toString() ?? '0') ?? 0,
      employeeCode: json['employeeCode']?.toString() ?? '',
      staffStatus: json['staffStatus']?.toString() ?? '',
      staffAvailable: json['staffAvailable'] == true || json['staffAvailable']?.toString() == 'true',
      maxActiveOrders: json['maxActiveOrders'] is int
          ? json['maxActiveOrders'] as int
          : int.tryParse(json['maxActiveOrders']?.toString() ?? '10') ?? 10,
      activeOrders: json['activeOrders'] is int
          ? json['activeOrders'] as int
          : int.tryParse(json['activeOrders']?.toString() ?? '0') ?? 0,
      utilization: json['utilization'] is num
          ? (json['utilization'] as num).toDouble()
          : double.tryParse(json['utilization']?.toString() ?? '0') ?? 0.0,
      isFull: json['isFull'] == true,
      isActive: json['isActive'] == true || json['isActive']?.toString() == 'true',
    );
  }
}

