import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { money, STATUS, EVENT_STATUS, MOCK_MODE } from "./api";
import type { Shipment, Status } from "./api";
import { request } from "./lib/http";
import "./DispatchPage.css";

interface DispatchPageProps {
  shipments: Shipment[];
  loading: boolean;
  onShipmentUpdated: (shipment: Shipment) => void;
}

// ---------------------------------------------------------------------
// Data Interfaces matching Backend Controller & DTOs
// ---------------------------------------------------------------------
export interface OperationShipmentItem {
  id: string;
  customerId?: number | string | null;
  senderName: string;
  senderPhone: string;
  pickupAddress: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  goods: string;
  weightKg: number;
  codAmount: number;
  codCollected?: number;
  fee: number;
  feePayer: string;
  vehicleType?: string;
  service: string;
  status: string;
  attempts?: number;
  createdAt: string;
  activeAssignment?: {
    id: number;
    staffId: number;
    employeeCode: string;
    staffName: string;
    assignmentStatus: string;
    assignedAt: string;
  } | null;
}

export interface OperationShipmentListResponse {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  items: OperationShipmentItem[];
}

export interface OperationEvent {
  id?: number | string;
  status: string;
  at: string;
  note: string;
}

export interface OperationAssignmentHistory {
  id: number;
  staffId: number;
  employeeCode?: string;
  staffName: string;
  assignedByUserId?: number;
  assignedByName?: string;
  assignedAt: string;
  status: string;
  isActive: boolean;
  acceptedAt?: string | null;
  endedAt?: string | null;
  rejectionReason?: string | null;
}

export interface OperationShipmentDetail {
  shipment: OperationShipmentItem & {
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    declaredValue?: number;
    notes?: string;
    currentHubId?: number | null;
  };
  events: OperationEvent[];
  assignmentHistory: OperationAssignmentHistory[];
}

export interface AvailableStaff {
  id: number;
  employeeCode?: string;
  fullName: string;
  phone?: string;
  area?: string;
  status?: string;
  currentAssignments?: number;
}

// ---------------------------------------------------------------------
// Local / Mock Demo Storage Helpers for offline / mock testing
// ---------------------------------------------------------------------
const STORAGE_KEY = "express-demo-shipments-v1";
const ASSIGNMENTS_STORAGE_KEY = "express-demo-assignments-v1";

function readLocalShipments(): Shipment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Shipment[]) : [];
  } catch {
    return [];
  }
}

function saveLocalShipments(shipments: Shipment[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shipments));
  } catch {
    // Ignore storage quota
  }
}

function readLocalAssignments(): OperationAssignmentHistory[] {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OperationAssignmentHistory[]) : [];
  } catch {
    return [];
  }
}

function saveLocalAssignments(assignments: OperationAssignmentHistory[]) {
  try {
    localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
  } catch {
    // Ignore storage quota
  }
}

export default function DispatchPage({
  shipments: parentShipments,
  onShipmentUpdated,
}: DispatchPageProps) {
  // Navigation tabs: "all" (Tất cả đơn hàng) vs "new" (Đơn hàng mới chờ phân công)
  const [activeTab, setActiveTab] = useState<"all" | "new">("all");

  // Query filter states for GET /api/v1/operations/shipments
  const [statusFilter, setStatusFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [customerIdFilter, setCustomerIdFilter] = useState("");
  const [staffIdFilter, setStaffIdFilter] = useState("");
  const [sortFilter, setSortFilter] = useState("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data states
  const [allShipmentsData, setAllShipmentsData] = useState<OperationShipmentListResponse>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
    items: [],
  });
  const [newShipments, setNewShipments] = useState<OperationShipmentItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Available staff list
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Detail view state
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [shipmentDetail, setShipmentDetail] = useState<OperationShipmentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal states: Assign, Reassign, Cancel
  const [assignModalShipmentId, setAssignModalShipmentId] =
  useState<string | null>(null);

const [selectedStaffId, setSelectedStaffId] =
  useState<number | "">("");

const [assignError, setAssignError] = useState("");

const [reassignModalShipmentId, setReassignModalShipmentId] =
  useState<string | null>(null);

const [reassignStaffId, setReassignStaffId] =
  useState<number | "">("");

const [reassignReason, setReassignReason] = useState("");

const [cancelAssignmentId, setCancelAssignmentId] =
  useState<number | null>(null);

const [cancelAssignmentShipmentId, setCancelAssignmentShipmentId] =
  useState<string>("");

const [cancelReason, setCancelReason] = useState("");

  // Feedback notifications & action busy state
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // -------------------------------------------------------------------
  // API Fetch: Available Staff (GET /api/v1/operations/staff/available)
  // -------------------------------------------------------------------
  const loadAvailableStaff = useCallback(async () => {
  setLoadingStaff(true);

  try {
    if (!MOCK_MODE) {
      const staff = await request<AvailableStaff[]>(
        "/operations/staff/available"
      );

      setAvailableStaff(staff);
      return;
    }

    // Mock fallback
    setAvailableStaff([
      {
        id: 1,
        employeeCode: "NV001",
        fullName: "Nguyễn Văn Giao (Demo)",
        phone: "0901112233",
        area: "Quận 1",
        status: "available",
        currentAssignments: 1,
      },
      {
        id: 2,
        employeeCode: "NV002",
        fullName: "Trần Bình Shipper",
        phone: "0902223344",
        area: "Quận 3",
        status: "available",
        currentAssignments: 0,
      },
      {
        id: 3,
        employeeCode: "NV003",
        fullName: "Lê An Vận Chuyển",
        phone: "0903334455",
        area: "Bình Thạnh",
        status: "available",
        currentAssignments: 2,
      },
      {
        id: 4,
        employeeCode: "NV004",
        fullName: "Phạm Hải Điều Phối",
        phone: "0904445566",
        area: "Thủ Đức",
        status: "available",
        currentAssignments: 0,
      },
    ]);
  } catch (err) {
    console.error("Không tải được nhân viên:", err);
    setAvailableStaff([]);
  } finally {
    setLoadingStaff(false);
  }
}, []);

  // -------------------------------------------------------------------
  // API Fetch: All Operations Shipments (GET /api/v1/operations/shipments)
  // -------------------------------------------------------------------
  const loadOperationsShipments = useCallback(async () => {
    setLoadingList(true);
    setNotice(null);

    if (!MOCK_MODE) {
      try {
        const query = new URLSearchParams();
        if (statusFilter) query.set("status", statusFilter);
        if (searchFilter.trim()) query.set("search", searchFilter.trim());
        if (customerIdFilter.trim()) query.set("customerId", customerIdFilter.trim());
        if (staffIdFilter.trim()) query.set("staffId", staffIdFilter.trim());
        if (sortFilter) query.set("sort", sortFilter);
        query.set("page", page.toString());
        query.set("pageSize", pageSize.toString());

        const res = await request<OperationShipmentListResponse>(`/operations/shipments?${query.toString()}`);
        setAllShipmentsData(res);
        setLoadingList(false);
        return;
      } catch (err) {
        if (!MOCK_MODE) {
          setNotice({
            kind: "error",
            text: err instanceof Error ? err.message : "Không tải được danh sách đơn hàng Operations.",
          });
          setLoadingList(false);
          return;
        }
      }
    }

    // Mock Fallback
    const local = readLocalShipments();
    const sourceShipments: Shipment[] = local.length > 0 ? local : parentShipments;
    const localAssignments = readLocalAssignments();

    let filtered = sourceShipments.map((s) => {
      const activeAsg = localAssignments.find((a) => a.id && a.isActive && (a as unknown as { shipmentId: string }).shipmentId === s.id);
      return {
        id: s.id,
        customerId: 1,
        senderName: s.senderName,
        senderPhone: s.senderPhone,
        pickupAddress: s.pickupAddress,
        recipientName: s.recipientName,
        recipientPhone: s.recipientPhone,
        deliveryAddress: s.deliveryAddress,
        goods: s.goods,
        weightKg: s.weightKg,
        codAmount: s.codAmount,
        codCollected: s.codCollected,
        fee: s.fee,
        feePayer: s.feePayer,
        vehicleType: s.vehicleType,
        service: s.service,
        status: s.status,
        attempts: s.attempts,
        createdAt: s.events[0]?.at || new Date().toISOString(),
        activeAssignment: activeAsg
          ? {
              id: activeAsg.id,
              staffId: activeAsg.staffId,
              employeeCode: activeAsg.employeeCode || `NV00${activeAsg.staffId}`,
              staffName: activeAsg.staffName,
              assignmentStatus: activeAsg.status,
              assignedAt: activeAsg.assignedAt,
            }
          : s.assignedStaffId
          ? {
              id: 99,
              staffId: 1,
              employeeCode: "NV001",
              staffName: "Nguyễn Văn Giao (Demo)",
              assignmentStatus: "assigned",
              assignedAt: s.assignmentDate || new Date().toISOString(),
            }
          : null,
      } as OperationShipmentItem;
    });

    if (statusFilter) {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }
    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.senderName.toLowerCase().includes(q) ||
          s.senderPhone.includes(q) ||
          s.recipientName.toLowerCase().includes(q) ||
          s.recipientPhone.includes(q) ||
          s.pickupAddress.toLowerCase().includes(q) ||
          s.deliveryAddress.toLowerCase().includes(q)
      );
    }
    if (customerIdFilter.trim()) {
      filtered = filtered.filter((s) => String(s.customerId) === customerIdFilter.trim());
    }
    if (staffIdFilter.trim()) {
      filtered = filtered.filter(
        (s) => s.activeAssignment && String(s.activeAssignment.staffId) === staffIdFilter.trim()
      );
    }

    if (sortFilter === "oldest") {
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startIndex = (page - 1) * pageSize;
    const pagedItems = filtered.slice(startIndex, startIndex + pageSize);

    setAllShipmentsData({
      page,
      pageSize,
      totalItems,
      totalPages,
      items: pagedItems,
    });
    setLoadingList(false);
  }, [
    statusFilter,
    searchFilter,
    customerIdFilter,
    staffIdFilter,
    sortFilter,
    page,
    pageSize,
    parentShipments,
  ]);

  // -------------------------------------------------------------------
  // API Fetch: New Shipments (GET /api/v1/operations/shipments/new)
  // Logic bắt buộc: Nếu đơn thanh toán trước qua VNPay, phải check thanh toán
  // -------------------------------------------------------------------
  const loadNewShipments = useCallback(async () => {
    setLoadingList(true);
    setNotice(null);

    if (!MOCK_MODE) {
      try {
        const res = await request<OperationShipmentItem[]>("/operations/shipments/new");
        setNewShipments(res);
        setLoadingList(false);
        return;
      } catch (err) {
        if (!MOCK_MODE) {
          setNotice({
            kind: "error",
            text: err instanceof Error ? err.message : "Không tải được danh sách đơn hàng mới.",
          });
          setLoadingList(false);
          return;
        }
      }
    }

    // Mock Fallback:
    // Điều kiện: status == "pending_pickup" && chưa có active assignment
    // VÀ nếu feePayer == "shop_prepaid", phải kiểm tra thanh toán (mặc định cho đơn demo là hợp lệ)
    const local = readLocalShipments();
    const sourceShipments: Shipment[] = local.length > 0 ? local : parentShipments;
    const localAssignments = readLocalAssignments();

    const filtered = sourceShipments
      .filter((s) => {
        const hasActiveAssignment = localAssignments.some(
          (a) => (a as unknown as { shipmentId: string }).shipmentId === s.id && a.isActive
        ) || Boolean(s.assignedStaffId);

        if (s.status !== "pending_pickup" || hasActiveAssignment) {
          return false;
        }

        // Kiểm tra điều kiện VNPay: nếu shop_prepaid, phải thanh toán thành công
        if (s.feePayer === "shop_prepaid") {
          // Trong mock mode, kiểm tra flag thanh toán hoặc giả lập hợp lệ
          return true;
        }
        return true;
      })
      .map(
        (s) =>
          ({
            id: s.id,
            customerId: 1,
            senderName: s.senderName,
            senderPhone: s.senderPhone,
            pickupAddress: s.pickupAddress,
            recipientName: s.recipientName,
            recipientPhone: s.recipientPhone,
            deliveryAddress: s.deliveryAddress,
            goods: s.goods,
            weightKg: s.weightKg,
            codAmount: s.codAmount,
            codCollected: s.codCollected,
            fee: s.fee,
            feePayer: s.feePayer,
            vehicleType: s.vehicleType,
            service: s.service,
            status: s.status,
            createdAt: s.events[0]?.at || new Date().toISOString(),
          } as OperationShipmentItem)
      );

    setNewShipments(filtered);
    setLoadingList(false);
  }, [parentShipments]);

  // -------------------------------------------------------------------
  // API Fetch: Shipment Detail (GET /api/v1/operations/shipments/{shipmentId})
  // -------------------------------------------------------------------
  const loadShipmentDetail = useCallback(async (shipmentId: string) => {
    setLoadingDetail(true);
    setSelectedShipmentId(shipmentId);

    if (!MOCK_MODE) {
      try {
        const detail = await request<OperationShipmentDetail>(
          `/operations/shipments/${encodeURIComponent(shipmentId)}`
        );
        setShipmentDetail(detail);
        setLoadingDetail(false);
        return;
      } catch (err) {
        if (!MOCK_MODE) {
          setNotice({
            kind: "error",
            text: err instanceof Error ? err.message : "Không tải được chi tiết đơn hàng.",
          });
          setLoadingDetail(false);
          return;
        }
      }
    }

    // Mock Fallback
    const local = readLocalShipments();
    const sourceShipments: Shipment[] = local.length > 0 ? local : parentShipments;
    const found = sourceShipments.find((s) => s.id === shipmentId);

    if (!found) {
      setNotice({ kind: "error", text: "Không tìm thấy đơn hàng." });
      setLoadingDetail(false);
      return;
    }

    const localAssignments = readLocalAssignments().filter(
      (a) => (a as unknown as { shipmentId: string }).shipmentId === shipmentId
    );

    // If shipment has assignedStaffId but no mock assignment history yet, synthesize one
    if (found.assignedStaffId && localAssignments.length === 0) {
      localAssignments.push({
        id: 101,
        staffId: 1,
        employeeCode: "NV001",
        staffName: "Nguyễn Văn Giao (Demo)",
        assignedByUserId: 1,
        assignedByName: "Express Operations",
        assignedAt: found.assignmentDate || new Date().toISOString(),
        status: "assigned",
        isActive: true,
        acceptedAt: found.assignmentDate || new Date().toISOString(),
      });
    }

    setShipmentDetail({
      shipment: {
        id: found.id,
        customerId: 1,
        senderName: found.senderName,
        senderPhone: found.senderPhone,
        pickupAddress: found.pickupAddress,
        recipientName: found.recipientName,
        recipientPhone: found.recipientPhone,
        deliveryAddress: found.deliveryAddress,
        goods: found.goods,
        weightKg: found.weightKg,
        lengthCm: found.lengthCm,
        widthCm: found.widthCm,
        heightCm: found.heightCm,
        declaredValue: found.declaredValue,
        codAmount: found.codAmount,
        codCollected: found.codCollected,
        fee: found.fee,
        feePayer: found.feePayer,
        vehicleType: found.vehicleType,
        service: found.service,
        notes: found.notes,
        status: found.status,
        attempts: found.attempts,
        createdAt: found.events[0]?.at || new Date().toISOString(),
      },
      events: found.events.map((e, idx) => ({
        id: idx + 1,
        status: e.status,
        at: e.at,
        note: e.note,
      })),
      assignmentHistory: localAssignments,
    });
    setLoadingDetail(false);
  }, [parentShipments]);

  // Initial loads
  useEffect(() => {
    void loadAvailableStaff();
  }, [loadAvailableStaff]);

  useEffect(() => {
    if (activeTab === "all") {
      void loadOperationsShipments();
    } else {
      void loadNewShipments();
    }
  }, [activeTab, loadOperationsShipments, loadNewShipments]);

  // -------------------------------------------------------------------
  // Action: Assign Staff (POST /api/v1/operations/shipments/{shipmentId}/assign)
  // -------------------------------------------------------------------
  async function handleConfirmAssign(event: FormEvent) {
  event.preventDefault();

  if (!assignModalShipmentId || !selectedStaffId || busyAction) {
    return;
  }

  const shipmentId = assignModalShipmentId;

  setBusyAction(true);
  setNotice(null);
  setAssignError("");

  const targetStaff = availableStaff.find(
    (s) => s.id === Number(selectedStaffId)
  );

  try {
    if (!MOCK_MODE) {
      await request(
        `/operations/shipments/${encodeURIComponent(shipmentId)}/assign`,
        {
          method: "POST",
          body: JSON.stringify({
            staffId: Number(selectedStaffId),
          }),
        }
      );
    } else {
      // Mock save
      const local = readLocalShipments();
      const source = local.length > 0 ? local : parentShipments;

      const updatedList = source.map((s) => {
        if (s.id === shipmentId) {
          const updated = {
            ...s,
            assignedStaffId: String(selectedStaffId),
            assignmentDate: new Date().toISOString().slice(0, 10),
            assignmentShift: "morning" as const,
            assignmentArea: targetStaff?.area || "TP. Hồ Chí Minh",
            assignmentKind: "pickup" as const,
            events: [
              ...s.events,
              {
                status: s.status,
                at: new Date().toISOString(),
                note: `Phân công cho nhân viên ${
                  targetStaff?.fullName || selectedStaffId
                }`,
              },
            ],
          };

          onShipmentUpdated(updated);
          return updated;
        }

        return s;
      });

      saveLocalShipments(updatedList);

      const assignments = readLocalAssignments();

      assignments.unshift({
        id: Date.now(),
        staffId: Number(selectedStaffId),
        employeeCode:
          targetStaff?.employeeCode || `NV00${selectedStaffId}`,
        staffName:
          targetStaff?.fullName || `Nhân viên #${selectedStaffId}`,
        assignedByName: "Express Operations",
        assignedAt: new Date().toISOString(),
        status: "pending",
        isActive: true,
        acceptedAt: null,
        endedAt: null,
        rejectionReason: null,
        ...({ shipmentId } as object),
      });

      saveLocalAssignments(assignments);
    }

    setNotice({
      kind: "success",
      text: `Đã phân công vận đơn ${shipmentId} cho nhân viên ${
        targetStaff?.fullName || selectedStaffId
      }.`,
    });

    setAssignModalShipmentId(null);
    setSelectedStaffId("");
    setAssignError("");

    // Cập nhật số lượng công việc của Staff ngay
    await loadAvailableStaff();

    // Cập nhật danh sách đơn
    if (activeTab === "all") {
      await loadOperationsShipments();
    } else {
      await loadNewShipments();
    }

    // Nếu đang mở chi tiết đúng đơn này thì cập nhật luôn
    if (selectedShipmentId === shipmentId) {
      await loadShipmentDetail(shipmentId);
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Phân công nhân viên thất bại.";

    setAssignError(message);

    setNotice({
      kind: "error",
      text: message,
    });
  } finally {
    setBusyAction(false);
  }
}

  // -------------------------------------------------------------------
  // Action: Reassign Staff (PATCH /api/v1/operations/shipments/{shipmentId}/reassign)
  // Logic bắt buộc: Sau khi call API thành công, tự động refresh Shipment Detail và Assignment History
  // -------------------------------------------------------------------
  async function handleConfirmReassign(event: FormEvent) {
    event.preventDefault();
    if (!reassignModalShipmentId || !reassignStaffId || !reassignReason.trim() || busyAction) {
      setNotice({ kind: "error", text: "Vui lòng chọn nhân viên mới và nhập lý do đổi nhân viên." });
      return;
    }

    setBusyAction(true);
    setNotice(null);

    const targetStaff = availableStaff.find((s) => s.id === Number(reassignStaffId));

    try {
      if (!MOCK_MODE) {
        await request(
          `/operations/shipments/${encodeURIComponent(reassignModalShipmentId)}/reassign`,
          {
            method: "PATCH",
            body: JSON.stringify({
              staffId: Number(reassignStaffId),
              reason: reassignReason.trim(),
            }),
          }
        );
      } else {
        // Mock save
        const assignments = readLocalAssignments();
        assignments.forEach((a) => {
          if ((a as unknown as { shipmentId: string }).shipmentId === reassignModalShipmentId && a.isActive) {
            a.isActive = false;
            a.status = "reassigned";
            a.endedAt = new Date().toISOString();
          }
        });
        assignments.unshift({
          id: Date.now(),
          staffId: Number(reassignStaffId),
          employeeCode: targetStaff?.employeeCode || `NV00${reassignStaffId}`,
          staffName: targetStaff?.fullName || `Nhân viên #${reassignStaffId}`,
          assignedByName: "Express Operations",
          assignedAt: new Date().toISOString(),
          status: "pending",
          isActive: true,
          acceptedAt: null,
          endedAt: null,
          rejectionReason: null,
          ...({ shipmentId: reassignModalShipmentId } as object),
        });
        saveLocalAssignments(assignments);

        const local = readLocalShipments();
        const source = local.length > 0 ? local : parentShipments;
        const updatedList = source.map((s) => {
          if (s.id === reassignModalShipmentId) {
            const updated = {
              ...s,
              assignedStaffId: String(reassignStaffId),
              events: [
                ...s.events,
                {
                  status: s.status,
                  at: new Date().toISOString(),
                  note: `Chuyển phân công sang ${targetStaff?.fullName || reassignStaffId}. Lý do: ${reassignReason.trim()}`,
                },
              ],
            };
            onShipmentUpdated(updated);
            return updated;
          }
          return s;
        });
        saveLocalShipments(updatedList);
      }

      setNotice({
        kind: "success",
        text: `Đã đổi phân công vận đơn ${reassignModalShipmentId} sang nhân viên ${targetStaff?.fullName || reassignStaffId}.`,
      });

      const updatedShipmentId = reassignModalShipmentId;

        setReassignModalShipmentId(null);
        setReassignStaffId("");
        setReassignReason("");

        // Refresh danh sách nhân viên ngay
        await loadAvailableStaff();

        // Refresh chi tiết + Assignment History
        await loadShipmentDetail(updatedShipmentId);

        // Refresh danh sách đơn
        if (activeTab === "all") {
          await loadOperationsShipments();
        } else {
          await loadNewShipments();
        }
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Chuyển phân công thất bại.",
      });
    } finally {
      setBusyAction(false);
    }
  }

  // -------------------------------------------------------------------
  // Action: Cancel Assignment (PATCH /api/v1/operations/assignments/{id}/cancel)
  // Chặn hoàn toàn việc người dùng tự nhập trạng thái thủ công trên giao diện
  // -------------------------------------------------------------------
  async function handleConfirmCancel(event: FormEvent) {
    event.preventDefault();
    if (!cancelAssignmentId || !cancelReason.trim() || busyAction) {
      setNotice({ kind: "error", text: "Vui lòng nhập lý do hủy phân công." });
      return;
    }

    setBusyAction(true);
    setNotice(null);

    try {
      if (!MOCK_MODE) {
        await request(`/operations/assignments/${cancelAssignmentId}/cancel`, {
          method: "PATCH",
          body: JSON.stringify({ reason: cancelReason.trim() }),
        });
      } else {
        // Mock save
        const assignments = readLocalAssignments();
        assignments.forEach((a) => {
          if (a.id === cancelAssignmentId) {
            a.isActive = false;
            a.status = "cancelled";
            a.endedAt = new Date().toISOString();
            a.rejectionReason = cancelReason.trim();
          }
        });
        saveLocalAssignments(assignments);

        const local = readLocalShipments();
        const source = local.length > 0 ? local : parentShipments;
        const updatedList = source.map((s) => {
          if (s.id === cancelAssignmentShipmentId) {
            const updated = {
              ...s,
              assignedStaffId: undefined,
              events: [
                ...s.events,
                {
                  status: s.status,
                  at: new Date().toISOString(),
                  note: `Hủy phân công nhân viên. Lý do: ${cancelReason.trim()}`,
                },
              ],
            };
            onShipmentUpdated(updated);
            return updated;
          }
          return s;
        });
        saveLocalShipments(updatedList);
      }

      setNotice({
        kind: "success",
        text: `Đã hủy phân công #${cancelAssignmentId}.`,
      });

      const refreshedShipmentId = cancelAssignmentShipmentId;

      setCancelAssignmentId(null);
      setCancelAssignmentShipmentId("");
      setCancelReason("");

      // Refresh danh sách nhân viên
      await loadAvailableStaff();

      // Refresh Shipment Detail + Assignment History
      if (refreshedShipmentId) {
        await loadShipmentDetail(refreshedShipmentId);
      }

      // Refresh danh sách đơn
      if (activeTab === "all") {
        await loadOperationsShipments();
      } else {
        await loadNewShipments();
      }
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Hủy phân công thất bại.",
      });
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Quản lý đơn hàng & Điều phối Operations</h2>
            <p className="muted">
              Giám sát tiến độ đơn hàng, phân công nhân viên giao nhận và theo dõi lịch sử điều phối.
            </p>
          </div>
          <button
            type="button"
            disabled={loadingList}
            onClick={() => {
              if (activeTab === "all") void loadOperationsShipments();
              else void loadNewShipments();
              void loadAvailableStaff();
            }}
          >
            {loadingList ? "Đang tải…" : "Tải lại danh sách"}
          </button>
        </div>

        {notice && (
          <div className={`notice ${notice.kind}`} role="alert">
            {notice.text}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB NAVIGATION: All Shipments vs New Pending Shipments */}
        {/* ------------------------------------------------------------- */}
        <div className="ops-tabs">
          <button
            type="button"
            className={`ops-tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("all");
              setPage(1);
            }}
          >
            Tất cả đơn hàng Operations
            {allShipmentsData.totalItems > 0 && (
              <span className="ops-badge-count">{allShipmentsData.totalItems}</span>
            )}
          </button>
          <button
            type="button"
            className={`ops-tab ${activeTab === "new" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("new");
            }}
          >
            Đơn mới chờ phân công (New)
            {newShipments.length > 0 && (
              <span className="ops-badge-count">{newShipments.length}</span>
            )}
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: TẤT CẢ ĐƠN HÀNG (GET /api/v1/operations/shipments) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "all" && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                void loadOperationsShipments();
              }}
              className="ops-filters-grid"
            >
              <div className="ops-filter-item">
                <span>Tìm kiếm</span>
                <input
                  type="text"
                  placeholder="Mã đơn, người gửi, người nhận, địa chỉ..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>

              <div className="ops-filter-item">
                <span>Trạng thái</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Tất cả trạng thái</option>
                  {Object.entries(STATUS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ops-filter-item">
                <span>Khách hàng ID</span>
                <input
                  type="number"
                  placeholder="Mã KH"
                  value={customerIdFilter}
                  onChange={(e) => {
                    setCustomerIdFilter(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="ops-filter-item">
                <span>Nhân viên ID</span>
                <input
                  type="number"
                  placeholder="Mã NV"
                  value={staffIdFilter}
                  onChange={(e) => {
                    setStaffIdFilter(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="ops-filter-item">
                <span>Sắp xếp</span>
                <select
                  value={sortFilter}
                  onChange={(e) => {
                    setSortFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <button type="submit" className="primary">
                  Lọc
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("");
                    setSearchFilter("");
                    setCustomerIdFilter("");
                    setStaffIdFilter("");
                    setSortFilter("newest");
                    setPage(1);
                  }}
                >
                  Xóa lọc
                </button>
              </div>
            </form>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Shipment ID</th>
                    <th>Customer</th>
                    <th>Pickup</th>
                    <th>Delivery</th>
                    <th>Staff</th>
                    <th>COD</th>
                    <th>Fee</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: "center", padding: "28px" }}>
                        Đang tải danh sách đơn hàng…
                      </td>
                    </tr>
                  ) : allShipmentsData.items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="ops-empty-state">
                        Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    allShipmentsData.items.map((item) => (
                      <tr key={item.id}>
                        <td className="tracking-code">
                          <strong>{item.id}</strong>
                        </td>
                        <td>
                          <div>{item.senderName}</div>
                          <small className="muted">{item.senderPhone}</small>
                        </td>
                        <td title={item.pickupAddress}>
                          <div style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.pickupAddress}
                          </div>
                        </td>
                        <td title={item.deliveryAddress}>
                          <div>{item.recipientName}</div>
                          <small className="muted" style={{ maxWidth: "160px", display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.deliveryAddress}
                          </small>
                        </td>
                        <td>
                          {item.activeAssignment ? (
                            <div>
                              <strong>{item.activeAssignment.staffName}</strong>
                              <small className="muted" style={{ display: "block" }}>
                                {item.activeAssignment.employeeCode}
                              </small>
                            </div>
                          ) : (
                            <span className="muted">Chưa phân công</span>
                          )}
                        </td>
                        <td>{money(item.codAmount)}</td>
                        <td>
                          <div>{money(item.fee)}</div>
                          <small className="muted">{item.feePayer}</small>
                        </td>
                        <td>
                          <span className={`badge ${item.status}`}>
                            {STATUS[item.status as Status] || item.status}
                          </span>
                        </td>
                        <td>{new Date(item.createdAt).toLocaleDateString("vi-VN")}</td>
                        <td>
                          <button
                            type="button"
                            className="ops-btn-action"
                            onClick={() => void loadShipmentDetail(item.id)}
                          >
                            Chi tiết
                          </button>

                          {!item.activeAssignment && item.status === "pending_pickup" && (
                            <button
                              type="button"
                              className="ops-btn-action ops-btn-assign"
                              onClick={() => {
                                setAssignModalShipmentId(item.id);
                                setSelectedStaffId("");
                                setAssignError("");
                              }}
                            >
                              Phân công
                            </button>
                          )}

                          {item.activeAssignment && (item.status === "pending_pickup" || item.status === "pickup_failed") && (
                            <button
                              type="button"
                              className="ops-btn-action ops-btn-reassign"
                              onClick={() => {
                                setReassignModalShipmentId(item.id);
                                setReassignStaffId("");
                                setReassignReason("");
                              }}
                            >
                              Đổi NV
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="ops-pagination">
              <div>
                Trang {allShipmentsData.page} / {allShipmentsData.totalPages} (Tổng cộng{" "}
                <strong>{allShipmentsData.totalItems}</strong> đơn)
              </div>
              <div className="ops-pagination-controls">
                <label style={{ marginRight: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span>Số dòng:</span>
                  <select
                    value={pageSize}
                    style={{ width: "70px", padding: "4px 8px" }}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={page <= 1 || loadingList}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  &larr; Trước
                </button>
                <button
                  type="button"
                  disabled={page >= allShipmentsData.totalPages || loadingList}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau &rarr;
                </button>
              </div>
            </div>
          </>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: ĐƠN HÀNG MỚI CHỜ PHÂN CÔNG (GET /api/v1/operations/shipments/new) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "new" && (
          <>
            <p className="hint" style={{ margin: "12px 0 16px" }}>
              💡 Các đơn hàng thanh toán trước qua VNPay (loại cước <code>shop_prepaid</code>) đã được kiểm tra điều kiện thanh toán thành công trước khi hiển thị tại đây để sẵn sàng phân công.
            </p>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Shipment ID</th>
                    <th>Customer</th>
                    <th>Pickup</th>
                    <th>Delivery</th>
                    <th>Hàng hóa</th>
                    <th>COD</th>
                    <th>Fee</th>
                    <th>Created At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "28px" }}>
                        Đang tải danh sách đơn mới…
                      </td>
                    </tr>
                  ) : newShipments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="ops-empty-state">
                        Hiện không có đơn hàng mới nào chờ phân công.
                      </td>
                    </tr>
                  ) : (
                    newShipments.map((item) => (
                      <tr key={item.id}>
                        <td className="tracking-code">
                          <strong>{item.id}</strong>
                        </td>
                        <td>
                          <div>{item.senderName}</div>
                          <small className="muted">{item.senderPhone}</small>
                        </td>
                        <td>{item.pickupAddress}</td>
                        <td>
                          <div>{item.recipientName}</div>
                          <small className="muted">{item.deliveryAddress}</small>
                        </td>
                        <td>
                          {item.goods} ({item.weightKg} kg)
                        </td>
                        <td>{money(item.codAmount)}</td>
                        <td>
                          {money(item.fee)} <small className="muted">({item.feePayer})</small>
                        </td>
                        <td>{new Date(item.createdAt).toLocaleDateString("vi-VN")}</td>
                        <td>
                          <button
                            type="button"
                            className="ops-btn-action ops-btn-assign"
                            onClick={() => {
                              setAssignModalShipmentId(item.id);
                              setSelectedStaffId("");
                              setAssignError("");
                            }}
                          >
                            Phân công
                          </button>
                          <button
                            type="button"
                            className="ops-btn-action"
                            onClick={() => void loadShipmentDetail(item.id)}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* --------------------------------------------------------------- */}
      {/* 2. CHI TIẾT ĐƠN HÀNG (GET /api/v1/operations/shipments/{shipmentId}) */}
      {/* Giao diện chi tiết chia làm 3 phần rõ ràng: */}
      {/* 1. Shipment information, 2. Events, 3. Assignment History */}
      {/* --------------------------------------------------------------- */}
      {selectedShipmentId && (
        <section className="panel ops-detail-container" aria-label="Chi tiết đơn hàng">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">OPERATIONS / SHIPMENT DETAIL</p>
              <h2>Vận đơn {selectedShipmentId}</h2>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                disabled={loadingDetail}
                onClick={() => void loadShipmentDetail(selectedShipmentId)}
              >
                {loadingDetail ? "Đang tải…" : "Làm mới"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedShipmentId(null);
                  setShipmentDetail(null);
                }}
              >
                Đóng chi tiết
              </button>
            </div>
          </div>

          {loadingDetail || !shipmentDetail ? (
            <p role="status">Đang tải thông tin chi tiết đơn hàng…</p>
          ) : (
            <>
              {/* PHẦN 1: SHIPMENT INFORMATION */}
              <div className="ops-detail-part">
                <div className="ops-detail-part-header">
                  <h3>
                    <span>📦</span> 1. Shipment Information (Thông tin đơn hàng)
                  </h3>
                  <span className={`badge ${shipmentDetail.shipment.status}`}>
                    {STATUS[shipmentDetail.shipment.status as Status] || shipmentDetail.shipment.status}
                  </span>
                </div>

                <dl className="ops-info-grid">
                  <div className="ops-info-card">
                    <dt>Mã vận đơn</dt>
                    <dd className="tracking-code">{shipmentDetail.shipment.id}</dd>
                  </div>
                  <div className="ops-info-card">
                    <dt>Người gửi & Lấy hàng</dt>
                    <dd>
                      <strong>{shipmentDetail.shipment.senderName}</strong> ({shipmentDetail.shipment.senderPhone})
                      <br />
                      {shipmentDetail.shipment.pickupAddress}
                    </dd>
                  </div>
                  <div className="ops-info-card">
                    <dt>Người nhận & Giao hàng</dt>
                    <dd>
                      <strong>{shipmentDetail.shipment.recipientName}</strong> ({shipmentDetail.shipment.recipientPhone})
                      <br />
                      {shipmentDetail.shipment.deliveryAddress}
                    </dd>
                  </div>
                  <div className="ops-info-card">
                    <dt>Hàng hóa & Kích thước</dt>
                    <dd>
                      {shipmentDetail.shipment.goods} &bull; {shipmentDetail.shipment.weightKg} kg
                      {shipmentDetail.shipment.lengthCm && (
                        <span>
                          {" "}
                          ({shipmentDetail.shipment.lengthCm}x{shipmentDetail.shipment.widthCm}x{shipmentDetail.shipment.heightCm} cm)
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="ops-info-card">
                    <dt>Tiền thu hộ COD</dt>
                    <dd style={{ color: "#174c37", fontWeight: 700 }}>
                      {money(shipmentDetail.shipment.codAmount)}
                    </dd>
                  </div>
                  <div className="ops-info-card">
                    <dt>Cước phí & Người trả</dt>
                    <dd>
                      {money(shipmentDetail.shipment.fee)} &bull; {shipmentDetail.shipment.feePayer}
                    </dd>
                  </div>
                  <div className="ops-info-card">
                    <dt>Dịch vụ & Phương tiện</dt>
                    <dd>
                      {shipmentDetail.shipment.service} &bull; {shipmentDetail.shipment.vehicleType || "Xe máy"}
                    </dd>
                  </div>
                  <div className="ops-info-card">
                    <dt>Số lần giao</dt>
                    <dd>{shipmentDetail.shipment.attempts || 0} lần</dd>
                  </div>
                  {shipmentDetail.shipment.notes && (
                    <div className="ops-info-card" style={{ gridColumn: "1 / -1" }}>
                      <dt>Ghi chú</dt>
                      <dd>{shipmentDetail.shipment.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* PHẦN 2: EVENTS */}
              <div className="ops-detail-part">
                <div className="ops-detail-part-header">
                  <h3>
                    <span>⏱</span> 2. Events (Lịch sử hành trình & sự kiện)
                  </h3>
                  <span className="muted">{shipmentDetail.events.length} sự kiện</span>
                </div>

                {shipmentDetail.events.length === 0 ? (
                  <p className="ops-empty-state">Chưa có sự kiện nào được ghi nhận.</p>
                ) : (
                  <div className="ops-timeline">
                    {shipmentDetail.events.map((evt, index) => (
                      <div key={evt.id || index} className="ops-timeline-item">
                        <div className="ops-timeline-time">
                          {new Date(evt.at).toLocaleString("vi-VN")}
                        </div>
                        <div className="ops-timeline-content">
                          <span
                            className={`badge ${evt.status}`}
                            style={{ marginRight: "10px", fontSize: "10px" }}
                          >
                            {EVENT_STATUS[evt.status as keyof typeof EVENT_STATUS] || evt.status}
                          </span>
                          <span>{evt.note}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PHẦN 3: ASSIGNMENT HISTORY */}
              <div className="ops-detail-part">
                <div className="ops-detail-part-header">
                  <h3>
                    <span>👤</span> 3. Assignment History (Lịch sử phân công nhân viên)
                  </h3>
                  <div>
                    {/* Action buttons inside Assignment History section */}
                    {shipmentDetail.assignmentHistory.some((a) => a.isActive) ? (
                      <button
                        type="button"
                        className="ops-btn-action ops-btn-reassign"
                        onClick={() => {
                          setReassignModalShipmentId(shipmentDetail.shipment.id);
                          setReassignStaffId("");
                          setReassignReason("");
                        }}
                      >
                        Đổi nhân viên (Reassign)
                      </button>
                    ) : (
                      (shipmentDetail.shipment.status === "pending_pickup" ||
                        shipmentDetail.shipment.status === "pickup_failed") && (
                        <button
                          type="button"
                          className="ops-btn-action ops-btn-assign"
                          onClick={() => {
                            setAssignModalShipmentId(shipmentDetail.shipment.id);
                            setSelectedStaffId("");
                            setAssignError("");
                          }}
                        >
                          Phân công nhân viên
                        </button>
                      )
                    )}
                  </div>
                </div>

                {shipmentDetail.assignmentHistory.length === 0 ? (
                  <p className="ops-empty-state">Đơn hàng chưa từng được phân công.</p>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nhân viên</th>
                          <th>Người phân công</th>
                          <th>Thời gian phân công</th>
                          <th>Trạng thái</th>
                          <th>Hoạt động</th>
                          <th>Nhận việc</th>
                          <th>Kết thúc</th>
                          <th>Lý do hủy / từ chối</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shipmentDetail.assignmentHistory.map((item) => (
                          <tr key={item.id}>
                            <td>#{item.id}</td>
                            <td>
                              <strong>{item.staffName}</strong>
                              {item.employeeCode && (
                                <small className="muted" style={{ display: "block" }}>
                                  {item.employeeCode}
                                </small>
                              )}
                            </td>
                            <td>{item.assignedByName || "Hệ thống"}</td>
                            <td>{new Date(item.assignedAt).toLocaleString("vi-VN")}</td>
                            <td>
                              <span
                                className={`badge ${
                                  item.status === "completed"
                                    ? "delivered"
                                    : item.status === "cancelled"
                                    ? "delivery_failed"
                                    : item.status === "accepted"
                                    ? "picked_up"
                                    : "pending_pickup"
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td>
                              {item.isActive ? (
                                <strong style={{ color: "#286b3e" }}>Đang hoạt động</strong>
                              ) : (
                                <span className="muted">Hết hiệu lực</span>
                              )}
                            </td>
                            <td>{item.acceptedAt ? new Date(item.acceptedAt).toLocaleString("vi-VN") : "—"}</td>
                            <td>{item.endedAt ? new Date(item.endedAt).toLocaleString("vi-VN") : "—"}</td>
                            <td>{item.rejectionReason || "—"}</td>
                            <td>
                              {item.isActive && (
                                <>
                                  <button
                                    type="button"
                                    className="ops-btn-action ops-btn-reassign"
                                    onClick={() => {
                                      setReassignModalShipmentId(shipmentDetail.shipment.id);
                                      setReassignStaffId("");
                                      setReassignReason("");
                                    }}
                                  >
                                    Đổi NV
                                  </button>
                                  <button
                                    type="button"
                                    className="ops-btn-action ops-btn-cancel"
                                    onClick={() => {
                                      setCancelAssignmentId(item.id);
                                      setCancelAssignmentShipmentId(shipmentDetail.shipment.id);
                                      setCancelReason("");
                                    }}
                                  >
                                    Hủy
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* --------------------------------------------------------------- */}
      {/* 3. MODAL PHÂN CÔNG NHÂN VIÊN (Assign Staff) */}
      {/* Bao gồm: Shipment ID hiện tại, dropdown chọn nhân viên, nút [HỦY], [XÁC NHẬN] */}
      {/* API: POST /api/v1/operations/shipments/{shipmentId}/assign */}
      {/* --------------------------------------------------------------- */}
      {assignModalShipmentId && (
        <div
          className="ops-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!busyAction) setAssignModalShipmentId(null);
          }}
        >
          <div className="ops-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modal-header">
              <h3>Phân công nhân viên giao nhận</h3>
              <button
                type="button"
                className="ops-modal-close"
                disabled={busyAction}
                onClick={() => setAssignModalShipmentId(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmAssign}>
              <div className="ops-modal-body">
  <div>
    <span className="muted">Shipment ID:</span>

    <div
      className="tracking-code"
      style={{ fontSize: "16px", marginTop: "4px" }}
    >
      <strong>{assignModalShipmentId}</strong>
    </div>
  </div>

  {assignError && (
    <div className="notice error" role="alert">
      {assignError}
    </div>
  )}

  <label>
    <span>Chọn nhân viên thực hiện</span>

    <select
      required
      value={selectedStaffId}
      onChange={(e) =>
        setSelectedStaffId(Number(e.target.value))
      }
      disabled={busyAction || loadingStaff}
    >
      <option value="">
        -- Chọn nhân viên sẵn sàng --
      </option>

      {availableStaff.map((staff) => (
        <option key={staff.id} value={staff.id}>
          {staff.fullName} (
          {staff.employeeCode || `NV#${staff.id}`}) — KV:{" "}
          {staff.area || "Chung"} —{" "}
          {staff.currentAssignments ?? 0} việc
        </option>
      ))}
    </select>
  </label>
</div>

              <div className="ops-modal-actions">
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => setAssignModalShipmentId(null)}
                >
                  [ HỦY ]
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={busyAction || !selectedStaffId}
                >
                  {busyAction ? "Đang xử lý…" : "[ XÁC NHẬN ]"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/* 4. MODAL CHUYỂN PHÂN CÔNG (Reassign Staff) */}
      {/* API: PATCH /api/v1/operations/shipments/{shipmentId}/reassign */}
      {/* --------------------------------------------------------------- */}
      {reassignModalShipmentId && (
        <div
          className="ops-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!busyAction) setReassignModalShipmentId(null);
          }}
        >
          <div className="ops-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modal-header">
              <h3>Chuyển phân công nhân viên (Reassign)</h3>
              <button
                type="button"
                className="ops-modal-close"
                disabled={busyAction}
                onClick={() => setReassignModalShipmentId(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmReassign}>
              <div className="ops-modal-body">
                <div>
                  <span className="muted">Shipment ID:</span>
                  <div className="tracking-code" style={{ fontSize: "16px", marginTop: "4px" }}>
                    <strong>{reassignModalShipmentId}</strong>
                  </div>
                </div>

                <label>
                  <span>Chọn nhân viên mới</span>
                  <select
                    required
                    value={reassignStaffId}
                    onChange={(e) => setReassignStaffId(Number(e.target.value))}
                    disabled={busyAction || loadingStaff}
                  >
                    <option value="">-- Chọn nhân viên nhận thay --</option>
                    {availableStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.fullName} ({staff.employeeCode || `NV#${staff.id}`}) — KV:{" "}
                        {staff.area || "Chung"}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Lý do chuyển phân công</span>
                  <textarea
                    required
                    minLength={3}
                    maxLength={300}
                    rows={3}
                    placeholder="Nhập lý do đổi nhân viên (ví dụ: Shipper gặp sự cố xe, quá tải đơn hàng...)"
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    disabled={busyAction}
                  />
                </label>
              </div>

              <div className="ops-modal-actions">
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => setReassignModalShipmentId(null)}
                >
                  [ HỦY ]
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={busyAction || !reassignStaffId || !reassignReason.trim()}
                >
                  {busyAction ? "Đang xử lý…" : "[ XÁC NHẬN ]"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/* 4. MODAL HỦY PHÂN CÔNG (Cancel Assignment) */}
      {/* API: PATCH /api/v1/operations/assignments/{id}/cancel */}
      {/* CHẶN HOÀN TOÀN VIỆC NGƯỜI DÙNG TỰ NHẬP TRẠNG THÁI THỦ CÔNG */}
      {/* --------------------------------------------------------------- */}
      {cancelAssignmentId && (
        <div
          className="ops-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!busyAction) setCancelAssignmentId(null);
          }}
        >
          <div className="ops-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modal-header">
              <h3>Hủy phân công nhân viên</h3>
              <button
                type="button"
                className="ops-modal-close"
                disabled={busyAction}
                onClick={() => setCancelAssignmentId(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmCancel}>
              <div className="ops-modal-body">
                <div>
                  <span className="muted">Mã phân công cần hủy:</span>
                  <div style={{ fontSize: "16px", marginTop: "4px" }}>
                    <strong>Assignment #{cancelAssignmentId}</strong>
                  </div>
                  <small className="muted">
                    Trạng thái phân công sẽ tự động chuyển thành <code>cancelled</code> trên hệ thống.
                  </small>
                </div>

                <label>
                  <span>Lý do hủy phân công</span>
                  <textarea
                    required
                    minLength={3}
                    maxLength={300}
                    rows={3}
                    placeholder="Nhập lý do hủy phân công cho nhân viên này..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    disabled={busyAction}
                  />
                </label>
              </div>

              <div className="ops-modal-actions">
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => setCancelAssignmentId(null)}
                >
                  [ HỦY ]
                </button>
                <button
                  type="submit"
                  className="ops-btn-action ops-btn-cancel"
                  style={{ padding: "8px 18px", fontSize: "13px" }}
                  disabled={busyAction || !cancelReason.trim()}
                >
                  {busyAction ? "Đang hủy…" : "[ XÁC NHẬN HỦY ]"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
