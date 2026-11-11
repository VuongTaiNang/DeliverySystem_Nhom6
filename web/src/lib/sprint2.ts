import { request } from "./http";
import {
  getStaffAssignments, acceptAssignment, rejectAssignment, startPickup,
  pickupSuccess, pickupFailed, startDelivery, deliverySuccess, deliveryFailed,
  startReturn, returnComplete, getAvailableActions
} from "../staffApi";
import type { StaffAssignment as AssignmentModel, StaffActionName } from "../staffApi";

// API and action rules are owned by Ân. This adapter preserves Thuật's UI contracts.
export type StaffAssignment = AssignmentModel;
export type StaffAction = "accept" | "reject" | "start-pickup" | "pickup-success" | "pickup-failed" |
  "start-delivery" | "delivery-success" | "delivery-failed" | "start-return" | "return-complete";
const toAction: Record<StaffActionName, StaffAction> = {
  accept: "accept", reject: "reject", startPickup: "start-pickup",
  pickupSuccess: "pickup-success", pickupFailed: "pickup-failed",
  startDelivery: "start-delivery", deliverySuccess: "delivery-success",
  deliveryFailed: "delivery-failed", startReturn: "start-return", returnComplete: "return-complete"
};
export const staffApi = {
  list: getStaffAssignments,
  available: (a: AssignmentModel): StaffAction[] => getAvailableActions(a).map(key => toAction[key]),
  action: (id: number, action: StaffAction, reason?: string) => {
    switch (action) {
      case "accept": return acceptAssignment(id);
      case "reject": return rejectAssignment(id, reason ?? "");
      case "start-pickup": return startPickup(id);
      case "pickup-success": return pickupSuccess(id);
      case "pickup-failed": return pickupFailed(id, reason ?? "");
      case "start-delivery": return startDelivery(id);
      case "delivery-success": return deliverySuccess(id);
      case "delivery-failed": return deliveryFailed(id, reason ?? "");
      case "start-return": return startReturn(id);
      case "return-complete": return returnComplete(id);
    }
  },
};
export interface PrepaidPayment {
  paymentId: string | null;
  shipmentId: string;
  amount: number;
  status: string;
  method?: "cash" | "vnpay" | null;
  transactionReference?: string | null;
  paidAt?: string | null;
  message?: string;
}
export interface VnPayPayment extends PrepaidPayment {
  paymentId: string;
  paymentUrl: string;
  transactionReference: string;
}
export const paymentApi = {
  create: (shipmentId: string) => request<VnPayPayment>("/payments/vnpay", { method: "POST", body: JSON.stringify({ shipmentId }) }),
  requestCash: (shipmentId: string) => request<PrepaidPayment>("/payments/cash/request", { method: "POST", body: JSON.stringify({ shipmentId }) }),
  byShipment: (shipmentId: string) => request<PrepaidPayment>(`/payments/shipment/${encodeURIComponent(shipmentId)}`),
  get: (paymentId: string) => request<PrepaidPayment & { paymentId: string }>(`/payments/${encodeURIComponent(paymentId)}`),
};
export interface ShipmentPaymentStatus {
  shipmentId: string;
  status: string;
}

export const paymentStatusApi = {
  list: () =>
    request<ShipmentPaymentStatus[]>("/payments/statuses"),
};