import { request } from "./lib/http";

export type StaffTrackingItem = {
  staffId: number; employeeCode: string; staffName: string; status: string;
  assignmentId: number; shipmentId: string; latitude: number; longitude: number;
  accuracyMeters: number | null; updatedAt: string; isStale: boolean; isAssignmentActive: boolean;
  shipmentStatus: string; targetType: "pickup" | "delivery"; targetAddress: string;
  targetLatitude: number | null; targetLongitude: number | null;
  distanceKm: number | null; etaMinutes: number | null; etaAssumption: string | null;
};

export const listStaffTracking = () => request<StaffTrackingItem[]>("/operations/staff-tracking");
