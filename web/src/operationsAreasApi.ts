import { request } from "./lib/http";

export type AreaType = "ward" | "commune" | "special_zone";

export interface OperationsAreaStaff {
  staffAreaId: number;
  staffId: number;
  employeeCode: string;
  staffStatus: string;
  staffAvailable: boolean;
  maxActiveOrders: number;
  activeOrders: number;
  utilization: number;
  isFull: boolean;
  isActive: boolean;
}

export interface OperationsArea {
  id: number;
  code: string;
  name: string;
  type: AreaType;
  isActive: boolean;
  staffCount: number;
  totalCapacity: number;
  activeOrders: number;
  availableCapacity: number;
  waitingAssignments: number;
  waitingPayments: number;
  hasCapacityAlert: boolean;
  staff?: OperationsAreaStaff[];
}

export interface SaveAreaInput {
  code: string;
  name: string;
  type: AreaType;
  isActive: boolean;
}

export async function listOperationsAreas(): Promise<OperationsArea[]> {
  return request<OperationsArea[]>("/operations/areas");
}

export async function createOperationsArea(input: SaveAreaInput): Promise<OperationsArea> {
  return request<OperationsArea>("/operations/areas", {
    method: "POST",
    body: JSON.stringify({
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      type: input.type,
      isActive: input.isActive,
    }),
  });
}

export async function updateOperationsArea(id: number, input: SaveAreaInput): Promise<OperationsArea> {
  return request<OperationsArea>(`/operations/areas/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      type: input.type,
      isActive: input.isActive,
    }),
  });
}
