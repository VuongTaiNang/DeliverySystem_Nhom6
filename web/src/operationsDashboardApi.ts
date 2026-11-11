import { request } from "./lib/http";

export interface OperationsDashboard {
  totalOrders: number;
  unassignedOrders: number;
  inDeliveryOrders: number;
  deliveredOrders: number;
  failedOrders: number;
  returnedOrders: number;

  staff: {
    available: number;
    busy: number;
    inactive: number;
    total: number;
  };

  successRate: number;
  failureRate: number;

  ordersByStaff: {
    staffId: number;
    employeeCode: string;
    staffName: string;
    totalOrders: number;
  }[];

  ordersByArea: {
    areaId: number;
    areaCode: string;
    areaName: string;
    totalOrders: number;
  }[];

  updatedAt: string;
}

export async function getOperationsDashboard(): Promise<OperationsDashboard> {
  return request<OperationsDashboard>("/operations/dashboard");
}