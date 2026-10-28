import { request } from "./lib/http";

export type StaffStatus = "available" | "busy" | "inactive";

export interface OperationsStaff {
  id: number;
  employeeCode: string;
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  area: string;
  status: StaffStatus;
  isAvailable: boolean;
  role: string;
  createdAt: string;
}

export interface CreateOperationsStaffInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  area: string;
}

export interface UpdateOperationsStaffInput {
  fullName: string;
  phone: string;
  email: string;
  area: string;
}

export async function listOperationsStaff(): Promise<OperationsStaff[]> {
  return request<OperationsStaff[]>("/operations/staff");
}

export async function createOperationsStaff(input: CreateOperationsStaffInput): Promise<OperationsStaff> {
  const result = await request<{ message: string; staff: OperationsStaff }>("/operations/staff", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.staff;
}

export async function updateOperationsStaff(id: number, input: UpdateOperationsStaffInput): Promise<OperationsStaff> {
  const result = await request<{ message: string; staff: OperationsStaff }>(`/operations/staff/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return result.staff;
}

export async function updateOperationsStaffStatus(id: number, status: StaffStatus): Promise<Pick<OperationsStaff, "id" | "employeeCode" | "status" | "isAvailable">> {
  const result = await request<{
    message: string;
    staff: Pick<OperationsStaff, "id" | "employeeCode" | "status" | "isAvailable">;
  }>(`/operations/staff/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return result.staff;
}
