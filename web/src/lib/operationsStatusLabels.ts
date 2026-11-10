/**
 * Vietnamese-only labels for Operations screens. API/database status values
 * remain unchanged for filters, actions, events and integration contracts.
 */
import { EVENT_STATUS, STATUS } from "../api";

const eventLabels: Record<string, string> = {
  ...EVENT_STATUS,
  assigned_staff: "Đã phân công nhân viên",
  assignment_accepted: "Nhân viên đã nhận đơn",
  assignment_rejected: "Nhân viên từ chối đơn",
  assignment_cancelled: "Đã hủy phân công",
  staff_reassigned: "Đã đổi nhân viên phụ trách",
  waiting_assignment: "Đang chờ phân công",
  waiting_payment: "Đang chờ thanh toán",
  assignment_started: "Đã bắt đầu nhiệm vụ",
  pickup_success: "Lấy hàng thành công",
  pickup_failed: "Lấy hàng thất bại",
  delivery_success: "Giao hàng thành công",
  delivery_failed: "Giao hàng thất bại",
  return_complete: "Đã hoàn tất hoàn hàng",
  order_created: "Đã tạo vận đơn",
  shipment_created: "Đã tạo vận đơn",
  pending_pickup: "Chờ lấy hàng",
  picking_up: "Đang lấy hàng",
  picked_up: "Đã lấy hàng",
  in_transit: "Đang vận chuyển",
  at_hub: "Đã đến kho",
  out_for_delivery: "Đang giao hàng",
  delivering: "Đang giao hàng",
  delivered: "Đã giao thành công",
  return_pending: "Chờ hoàn hàng",
  returning: "Đang hoàn hàng",
  returned: "Đã hoàn hàng",
  return_confirmed: "Đã xác nhận nhận hàng hoàn",
};

const assignmentLabels: Record<string, string> = {
  pending: "Đang chờ",
  assigned: "Chờ nhân viên xác nhận",
  accepted: "Đã nhận đơn",
  in_progress: "Đang thực hiện",
  rejected: "Đã từ chối",
  reassigned: "Đã chuyển phân công",
  cancelled: "Đã hủy phân công",
  completed: "Đã hoàn thành",
};

const feePayerLabels: Record<string, string> = {
  shop_prepaid: "Người gửi trả trước",
  recipient: "Người nhận trả",
  deduct_cod: "Trừ vào tiền thu hộ (COD)",
};

const serviceLabels: Record<string, string> = {
  standard: "Tiêu chuẩn",
  fast: "Giao nhanh",
  express: "Hỏa tốc",
};

const vehicleLabels: Record<string, string> = {
  motorbike: "Xe máy",
  car: "Ô tô",
};

export function eventStatusLabel(status: string): string {
  return eventLabels[status] ?? STATUS[status as keyof typeof STATUS] ?? "Sự kiện khác";
}

export function assignmentStatusLabel(status: string): string {
  return assignmentLabels[status] ?? "Trạng thái khác";
}

export function feePayerLabel(value: string): string {
  return feePayerLabels[value] ?? "Chưa xác định";
}

export function serviceLabel(value: string): string {
  return serviceLabels[value] ?? "Dịch vụ khác";
}

export function vehicleLabel(value?: string): string {
  if (!value) return "Chưa xác định";
  return vehicleLabels[value] ?? "Phương tiện khác";
}

export function assignerLabel(name?: string | null): string {
  if (!name) return "Hệ thống (tự động)";
  if (/^(?:hệ thống|he thong)\s*\(auto\)$/i.test(name.trim())) {
    return "Hệ thống (tự động)";
  }
  return name;
}
