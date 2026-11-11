import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  assignStaffToArea,
  createOperationsArea,
  listOperationsAreas,
  updateOperationsArea,
} from "../operationsAreasApi";
import type {
  AreaType,
  OperationsArea,
  OperationsAreaStaff,
  SaveAreaInput,
} from "../operationsAreasApi";
import { listOperationsStaff } from "../operationsStaffApi";
import type { OperationsStaff } from "../operationsStaffApi";
import "./OperationsAreasPage.css";

type Notice = { kind: "success" | "error"; text: string } | null;

type AreaScope = "both" | "delivery" | "pickup";

type ViewTab = "areas" | "staff_assignments";

interface AreaFormState {
  code: string;
  name: string;
  type: AreaType;
  isActive: boolean;
  scope: AreaScope;
}

const emptyAreaForm: AreaFormState = {
  code: "",
  name: "",
  type: "ward",
  isActive: true,
  scope: "both",
};

const TYPE_LABELS: Record<AreaType, string> = {
  ward: "Phường",
  commune: "Xã",
  special_zone: "Đặc khu",
};

export default function OperationsAreasPage() {
  const [activeTab, setActiveTab] = useState<ViewTab>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "staff") return "staff_assignments";
    }
    return "areas";
  });

  const [areas, setAreas] = useState<OperationsArea[]>([]);
  const [staffList, setStaffList] = useState<OperationsStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [notice, setNotice] = useState<Notice>(null);

  // Modal Thêm / Sửa Khu vực
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<OperationsArea | null>(null);
  const [areaForm, setAreaForm] = useState<AreaFormState>(emptyAreaForm);
  const [codeDuplicateError, setCodeDuplicateError] = useState("");

  // Tab 2: Phân khu vực theo Nhân viên
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sid = params.get("staffId");
      if (sid && Number.isInteger(Number(sid))) return Number(sid);
    }
    return null;
  });

  // Modal gán khu vực mới cho Staff đang chọn
  const [addAreaToStaffModalOpen, setAddAreaToStaffModalOpen] = useState(false);
  const [selectedAreaIdToAssign, setSelectedAreaIdToAssign] = useState<number | "">("");
  const [assignMaxOrders, setAssignMaxOrders] = useState<number>(10);
  const [assignIsActive, setAssignIsActive] = useState<boolean>(true);

  // Modal quản lý Staff của một khu vực cụ thể (từ Tab 1)
  const [areaForStaffModal, setAreaForStaffModal] = useState<OperationsArea | null>(null);
  const [newStaffIdForArea, setNewStaffIdForArea] = useState<number | "">("");
  const [newStaffMaxOrders, setNewStaffMaxOrders] = useState<number>(10);
  const [newStaffIsActive, setNewStaffIsActive] = useState<boolean>(true);

  // State cục bộ lưu chỉnh sửa maxActiveOrders & isActive theo từng row
  const [rowEdits, setRowEdits] = useState<
    Record<string, { maxActiveOrders: number; isActive: boolean }>
  >({});

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [areasData, staffsData] = await Promise.all([
        listOperationsAreas(),
        listOperationsStaff().catch(() => [] as OperationsStaff[]),
      ]);
      setAreas(areasData);
      setStaffList(staffsData);

      // Nếu chưa chọn staffId, tự động chọn staff đầu tiên nếu có
      setSelectedStaffId((prev) => {
        if (prev !== null && staffsData.some((s) => s.id === prev)) return prev;
        return staffsData.length > 0 ? staffsData[0].id : null;
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Không tải được dữ liệu khu vực và nhân viên.",
      });
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(
      () => setNotice(null),
      notice.kind === "success" ? 4000 : 6000,
    );
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Kiểm tra mã khu vực trùng (Frontend validation)
  const checkDuplicateCode = (codeToTest: string) => {
    const trimmed = codeToTest.trim().toUpperCase();
    if (!trimmed) {
      setCodeDuplicateError("");
      return false;
    }
    const isDuplicate = areas.some(
      (a) => a.code.toUpperCase() === trimmed && (!editingArea || a.id !== editingArea.id),
    );
    if (isDuplicate) {
      setCodeDuplicateError("Mã khu vực này đã tồn tại trong hệ thống.");
      return true;
    }
    setCodeDuplicateError("");
    return false;
  };

  const openCreateAreaModal = () => {
    setEditingArea(null);
    setAreaForm(emptyAreaForm);
    setCodeDuplicateError("");
    setAreaModalOpen(true);
  };

  const openEditAreaModal = (area: OperationsArea) => {
    setEditingArea(area);
    setAreaForm({
      code: area.code,
      name: area.name,
      type: area.type,
      isActive: area.isActive,
      scope: "both",
    });
    setCodeDuplicateError("");
    setAreaModalOpen(true);
  };

  const closeAreaModal = () => {
    if (saving) return;
    setAreaModalOpen(false);
    setEditingArea(null);
    setAreaForm(emptyAreaForm);
    setCodeDuplicateError("");
  };

  const handleSaveArea = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanCode = areaForm.code.trim().toUpperCase();
    const cleanName = areaForm.name.trim();

    if (!cleanCode || cleanCode.length < 2 || cleanCode.length > 50) {
      setNotice({ kind: "error", text: "Mã khu vực phải từ 2 đến 50 ký tự." });
      return;
    }
    if (!cleanName || cleanName.length < 2 || cleanName.length > 150) {
      setNotice({ kind: "error", text: "Tên khu vực phải từ 2 đến 150 ký tự." });
      return;
    }
    if (checkDuplicateCode(cleanCode)) {
      setNotice({ kind: "error", text: "Mã khu vực đã tồn tại, vui lòng chọn mã khác." });
      return;
    }

    setSaving(true);
    setNotice(null);
    const payload: SaveAreaInput = {
      code: cleanCode,
      name: cleanName,
      type: areaForm.type,
      isActive: areaForm.isActive,
    };

    try {
      if (editingArea) {
        await updateOperationsArea(editingArea.id, payload);
        setNotice({
          kind: "success",
          text: `Đã cập nhật thành công khu vực "${cleanName}" (${cleanCode}).`,
        });
      } else {
        await createOperationsArea(payload);
        setNotice({
          kind: "success",
          text: `Đã thêm mới thành công khu vực "${cleanName}" (${cleanCode}).`,
        });
      }
      closeAreaModal();
      await loadData(false);
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Thao tác khu vực thất bại.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAreaStatus = async (area: OperationsArea) => {
    const newStatus = !area.isActive;
    const confirmMsg = newStatus
      ? `Bạn có chắc muốn KÍCH HOẠT lại khu vực ${area.name} (${area.code})?`
      : `Bạn có chắc muốn NGỪNG HOẠT ĐỘNG khu vực ${area.name} (${area.code})?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await updateOperationsArea(area.id, {
        code: area.code,
        name: area.name,
        type: area.type,
        isActive: newStatus,
      });
      setNotice({
        kind: "success",
        text: `Đã ${newStatus ? "kích hoạt" : "ngừng hoạt động"} khu vực ${area.name}.`,
      });
      await loadData(false);
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Cập nhật trạng thái thất bại.",
      });
    }
  };

  // ===================================================================
  // ISSUE #24: Logic Phân khu vực cho Staff (PUT /areas/{areaId}/staff/{staffId})
  // ===================================================================

  // Danh sách các khu vực mà Staff đang chọn phụ trách
  const staffAssignmentsForSelectedStaff = useMemo(() => {
    if (!selectedStaffId) return [];
    const list: { area: OperationsArea; assignment: OperationsAreaStaff }[] = [];
    for (const area of areas) {
      const match = area.staff?.find((s) => s.staffId === selectedStaffId);
      if (match) {
        list.push({ area, assignment: match });
      }
    }
    return list;
  }, [areas, selectedStaffId]);

  // Danh sách các khu vực Staff đang chọn CHƯA phụ trách
  const unassignedAreasForSelectedStaff = useMemo(() => {
    if (!selectedStaffId) return [];
    const assignedAreaIds = new Set(
      staffAssignmentsForSelectedStaff.map((item) => item.area.id),
    );
    return areas.filter((a) => !assignedAreaIds.has(a.id));
  }, [areas, selectedStaffId, staffAssignmentsForSelectedStaff]);

  // Thông tin Staff đang chọn
  const currentSelectedStaff = useMemo(() => {
    return staffList.find((s) => s.id === selectedStaffId) || null;
  }, [staffList, selectedStaffId]);

  // Cập nhật giá trị đang gõ (maxActiveOrders hoặc isActive)
  const getRowValue = (
    key: string,
    fallback: { maxActiveOrders: number; isActive: boolean },
  ) => {
    return rowEdits[key] ?? fallback;
  };

  const setRowEditValue = (
    key: string,
    val: Partial<{ maxActiveOrders: number; isActive: boolean }>,
    fallback: { maxActiveOrders: number; isActive: boolean },
  ) => {
    setRowEdits((prev) => ({
      ...prev,
      [key]: {
        ...fallback,
        ...(prev[key] || {}),
        ...val,
      },
    }));
  };

  // Thực hiện gọi API PUT /api/v1/operations/areas/{areaId}/staff/{staffId}
  const handleSaveStaffArea = async (
    areaId: number,
    staffId: number,
    maxActiveOrders: number,
    isActive: boolean,
    areaName: string,
    staffCodeOrName: string,
  ) => {
    // Validation Backend: [Range(1, 100)]
    if (!Number.isInteger(maxActiveOrders) || maxActiveOrders < 1 || maxActiveOrders > 100) {
      setNotice({
        kind: "error",
        text: "Giới hạn đơn tối đa (maxActiveOrders) phải là số nguyên từ 1 đến 100.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      await assignStaffToArea(areaId, staffId, {
        maxActiveOrders,
        isActive,
      });

      setNotice({
        kind: "success",
        text: `Đã lưu cấu hình phân khu vực ${areaName} cho nhân viên ${staffCodeOrName}.`,
      });

      // Xóa edit cache cho row này
      const key = `${areaId}-${staffId}`;
      setRowEdits((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });

      await loadData(false);
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Lưu phân khu vực thất bại.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Xác nhận thêm khu vực mới cho Staff đang chọn
  const handleAddAreaToStaffSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId || !selectedAreaIdToAssign) {
      setNotice({ kind: "error", text: "Vui lòng chọn khu vực cần phân công." });
      return;
    }
    const targetArea = areas.find((a) => a.id === selectedAreaIdToAssign);
    if (!targetArea) return;

    await handleSaveStaffArea(
      targetArea.id,
      selectedStaffId,
      assignMaxOrders,
      assignIsActive,
      targetArea.name,
      currentSelectedStaff?.employeeCode || `NV#${selectedStaffId}`,
    );

    setAddAreaToStaffModalOpen(false);
    setSelectedAreaIdToAssign("");
    setAssignMaxOrders(10);
    setAssignIsActive(true);
  };

  // Xác nhận thêm Staff mới vào khu vực đang chọn (từ Modal Tab 1)
  const handleAddStaffToAreaSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!areaForStaffModal || !newStaffIdForArea) {
      setNotice({ kind: "error", text: "Vui lòng chọn nhân viên cần phân công." });
      return;
    }
    const targetStaff = staffList.find((s) => s.id === newStaffIdForArea);

    await handleSaveStaffArea(
      areaForStaffModal.id,
      Number(newStaffIdForArea),
      newStaffMaxOrders,
      newStaffIsActive,
      areaForStaffModal.name,
      targetStaff?.employeeCode || `NV#${newStaffIdForArea}`,
    );

    setNewStaffIdForArea("");
    setNewStaffMaxOrders(10);
    setNewStaffIsActive(true);

    // Cập nhật lại dữ liệu khu vực hiện tại trong modal
    const updatedAreas = await listOperationsAreas();
    setAreas(updatedAreas);
    const refreshedArea = updatedAreas.find((a) => a.id === areaForStaffModal.id) || null;
    setAreaForStaffModal(refreshedArea);
  };

  // Lọc khu vực trong Tab 1
  const filteredAreas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return areas.filter((area) => {
      const matchSearch =
        !term ||
        area.code.toLowerCase().includes(term) ||
        area.name.toLowerCase().includes(term);

      const matchType = typeFilter === "all" || area.type === typeFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? area.isActive : !area.isActive);

      return matchSearch && matchType && matchStatus;
    });
  }, [areas, search, typeFilter, statusFilter]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = areas.length;
    const active = areas.filter((a) => a.isActive).length;
    const totalStaff = staffList.length;
    const totalAssignments = areas.reduce(
      (sum, a) => sum + (a.staff?.filter((s) => s.isActive).length || 0),
      0,
    );
    return { total, active, totalStaff, totalAssignments };
  }, [areas, staffList]);

  return (
    <div className="ops-areas-page">
      {notice && (
        <div className={`notice notice--${notice.kind}`} role="alert">
          {notice.text}
        </div>
      )}

      {/* Hero / Header */}
      <section className="ops-areas-hero">
        <div>
          <h2>Quản lý Khu vực &amp; Phân công Staff (Issue #23 &amp; #24)</h2>
          <p className="muted">
            Quản lý chuẩn hóa phường/xã và phân công nhân viên phụ trách khu vực (hỗ trợ thuật toán Auto Assignment phân bổ tự động).
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="secondary"
            onClick={() => void loadData(true)}
            disabled={loading}
          >
            {loading ? "Đang tải…" : "Làm mới"}
          </button>
          {activeTab === "areas" ? (
            <button type="button" className="primary" onClick={openCreateAreaModal}>
              + Thêm khu vực mới
            </button>
          ) : (
            <button
              type="button"
              className="primary"
              disabled={!selectedStaffId || unassignedAreasForSelectedStaff.length === 0}
              onClick={() => {
                setSelectedAreaIdToAssign(
                  unassignedAreasForSelectedStaff.length > 0
                    ? unassignedAreasForSelectedStaff[0].id
                    : "",
                );
                setAssignMaxOrders(10);
                setAssignIsActive(true);
                setAddAreaToStaffModalOpen(true);
              }}
            >
              + Phân công khu vực
            </button>
          )}
        </div>
      </section>

      {/* Thống kê nhanh (KPIs) */}
      <section className="ops-areas-stats">
        <div>
          <strong>{stats.total}</strong>
          <span>Tổng số khu vực</span>
        </div>
        <div>
          <strong style={{ color: "#137333" }}>{stats.active}</strong>
          <span>Khu vực kích hoạt</span>
        </div>
        <div>
          <strong>{stats.totalStaff}</strong>
          <span>Tổng số nhân viên</span>
        </div>
        <div>
          <strong style={{ color: "#123f31" }}>{stats.totalAssignments}</strong>
          <span>Lượt phân công phụ trách</span>
        </div>
      </section>

      {/* Sub-navigation Tabs: Chuyển đổi giữa Danh mục Khu vực & Phân khu vực cho Staff */}
      <nav className="ops-subnav-tabs" aria-label="Chế độ quản lý khu vực">
        <button
          type="button"
          className={`ops-subnav-btn ${activeTab === "areas" ? "active" : ""}`}
          onClick={() => setActiveTab("areas")}
        >
          <span>⚑</span> Danh mục Khu vực (Areas)
        </button>
        <button
          type="button"
          className={`ops-subnav-btn ${activeTab === "staff_assignments" ? "active" : ""}`}
          onClick={() => setActiveTab("staff_assignments")}
        >
          <span>👤</span> Phân khu vực cho Staff (Staff Assignments)
        </button>
      </nav>

      {/* =================================================================== */}
      {/* TAB 1: DANH MỤC KHU VỰC (AREAS) */}
      {/* =================================================================== */}
      {activeTab === "areas" && (
        <>
          {/* Thanh công cụ tìm kiếm và lọc */}
          <section className="ops-areas-toolbar">
            <input
              type="search"
              placeholder="Tìm theo mã hoặc tên khu vực…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Lọc theo loại khu vực"
            >
              <option value="all">Tất cả loại khu vực</option>
              <option value="ward">Phường</option>
              <option value="commune">Xã</option>
              <option value="special_zone">Đặc khu</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Lọc theo trạng thái"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang kích hoạt</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </section>

          {/* Bảng danh sách khu vực */}
          <section className="ops-areas-table-card">
            {loading && areas.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#668177" }}>
                Đang tải danh sách khu vực…
              </div>
            ) : filteredAreas.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#668177" }}>
                Không tìm thấy khu vực nào phù hợp với điều kiện tìm kiếm.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="ops-areas-table">
                  <thead>
                    <tr>
                      <th style={{ width: "110px" }}>Mã KV</th>
                      <th>Tên Phường / Xã / Đặc khu</th>
                      <th style={{ width: "120px" }}>Loại khu vực</th>
                      <th style={{ width: "150px" }}>Nhân viên phụ trách</th>
                      <th style={{ width: "130px" }}>Tải vận hành</th>
                      <th style={{ width: "140px" }}>Trạng thái KV</th>
                      <th style={{ width: "190px", textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAreas.map((area) => (
                      <tr key={area.id}>
                        <td>
                          <span className="area-code-badge">{area.code}</span>
                        </td>
                        <td>
                          <strong style={{ color: "#123f31", fontSize: "14px" }}>
                            {area.name}
                          </strong>
                        </td>
                        <td>
                          <span className={`area-type-tag ${area.type}`}>
                            {TYPE_LABELS[area.type] ?? area.type}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="area-staff-count-btn"
                            title="Bấm để xem và phân công Staff cho khu vực này"
                            onClick={() => setAreaForStaffModal(area)}
                          >
                            👤 {area.staffCount} Staff {area.staffCount > 0 ? "▾" : "+"}
                          </button>
                        </td>
                        <td>
                          <div style={{ fontSize: "12px", color: "#24483b" }}>
                            <span>
                              {area.activeOrders}/{area.totalCapacity} đơn
                            </span>
                            {area.waitingAssignments > 0 && (
                              <span
                                style={{
                                  marginLeft: "6px",
                                  color: "#c5221f",
                                  fontWeight: "bold",
                                }}
                                title="Đơn đang chờ phân công"
                              >
                                ({area.waitingAssignments} chờ)
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${area.isActive ? "active" : "inactive"}`}
                          >
                            <span
                              style={{
                                width: "7px",
                                height: "7px",
                                borderRadius: "50%",
                                background: area.isActive ? "#137333" : "#c5221f",
                              }}
                            />
                            {area.isActive ? "Kích hoạt" : "Ngừng hoạt động"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div
                            className="ops-areas-actions"
                            style={{ justifyContent: "flex-end" }}
                          >
                            <button
                              type="button"
                              className="secondary"
                              style={{ padding: "5px 9px", fontSize: "12px" }}
                              onClick={() => setAreaForStaffModal(area)}
                              title="Phân công nhân viên phụ trách khu vực này"
                            >
                              Phân Staff
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              style={{ padding: "5px 9px", fontSize: "12px" }}
                              onClick={() => openEditAreaModal(area)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              style={{
                                padding: "5px 9px",
                                fontSize: "12px",
                                color: area.isActive ? "#c5221f" : "#137333",
                                background: "transparent",
                                border: `1px solid ${area.isActive ? "#f8d7da" : "#c3e6cb"}`,
                              }}
                              onClick={() => void handleToggleAreaStatus(area)}
                              title={area.isActive ? "Ngừng hoạt động khu vực" : "Kích hoạt lại"}
                            >
                              {area.isActive ? "Ngừng" : "Bật"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 2: PHÂN KHU VỰC CHO STAFF (ISSUE #24 - STAFF ASSIGNMENTS) */}
      {/* =================================================================== */}
      {activeTab === "staff_assignments" && (
        <>
          {/* Card chọn Nhân viên & thông tin năng lực */}
          <section className="ops-staff-select-card">
            <div className="ops-staff-select-box">
              <label htmlFor="staff-selector">Chọn nhân viên:</label>
              <select
                id="staff-selector"
                value={selectedStaffId ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setSelectedStaffId(val);
                }}
              >
                {staffList.length === 0 ? (
                  <option value="">Chưa có dữ liệu nhân viên</option>
                ) : (
                  staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.employeeCode} - {st.fullName} ({st.phone || "Chưa có SĐT"}) [
                      {st.status === "available"
                        ? "Sẵn sàng"
                        : st.status === "busy"
                        ? "Bận"
                        : "Ngừng"}
                      ]
                    </option>
                  ))
                )}
              </select>
            </div>

            {currentSelectedStaff && (
              <div className="ops-staff-badge-group">
                <span className="ops-staff-info-tag">
                  <strong>Trạng thái:</strong>{" "}
                  <span
                    style={{
                      color:
                        currentSelectedStaff.status === "available"
                          ? "#137333"
                          : currentSelectedStaff.status === "busy"
                          ? "#f9ab00"
                          : "#c5221f",
                      fontWeight: 600,
                    }}
                  >
                    {currentSelectedStaff.status === "available"
                      ? "● Sẵn sàng"
                      : currentSelectedStaff.status === "busy"
                      ? "● Đang bận"
                      : "● Ngưng hoạt động"}
                  </span>
                </span>
                <span className="ops-staff-info-tag">
                  <strong>Khu vực phụ trách:</strong>{" "}
                  {staffAssignmentsForSelectedStaff.length} khu vực
                </span>
                <span className="ops-staff-info-tag">
                  <strong>Tổng đơn đang gánh:</strong>{" "}
                  {staffAssignmentsForSelectedStaff.reduce(
                    (sum, item) => sum + item.assignment.activeOrders,
                    0,
                  )}{" "}
                  đơn
                </span>
              </div>
            )}
          </section>

          {/* Bảng danh sách các khu vực nhân viên này đang phụ trách */}
          <section className="ops-areas-table-card">
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #e0e8e2",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#123f31" }}>
                  Khu vực phụ trách của{" "}
                  {currentSelectedStaff
                    ? `${currentSelectedStaff.fullName} (${currentSelectedStaff.employeeCode})`
                    : "nhân viên"}
                </h3>
                <span style={{ fontSize: "12px", color: "#668177" }}>
                  Một Staff có thể phụ trách nhiều khu vực; thuật toán Auto Assignment sẽ tự động điều phối đơn theo tỷ lệ sử dụng thấp nhất.
                </span>
              </div>
              <button
                type="button"
                className="primary"
                style={{ fontSize: "13px", padding: "7px 14px" }}
                disabled={!selectedStaffId || unassignedAreasForSelectedStaff.length === 0}
                onClick={() => {
                  setSelectedAreaIdToAssign(
                    unassignedAreasForSelectedStaff.length > 0
                      ? unassignedAreasForSelectedStaff[0].id
                      : "",
                  );
                  setAssignMaxOrders(10);
                  setAssignIsActive(true);
                  setAddAreaToStaffModalOpen(true);
                }}
              >
                + Gán thêm khu vực
              </button>
            </div>

            {staffAssignmentsForSelectedStaff.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#668177" }}>
                <p>Nhân viên này hiện chưa được phân công phụ trách khu vực nào.</p>
                <button
                  type="button"
                  className="primary"
                  style={{ marginTop: "8px" }}
                  onClick={() => {
                    setSelectedAreaIdToAssign(
                      unassignedAreasForSelectedStaff.length > 0
                        ? unassignedAreasForSelectedStaff[0].id
                        : "",
                    );
                    setAssignMaxOrders(10);
                    setAssignIsActive(true);
                    setAddAreaToStaffModalOpen(true);
                  }}
                  disabled={unassignedAreasForSelectedStaff.length === 0}
                >
                  + Phân công khu vực đầu tiên
                </button>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="ops-areas-table">
                  <thead>
                    <tr>
                      <th style={{ width: "110px" }}>Mã KV</th>
                      <th>Khu vực (Phường/Xã/Đặc khu)</th>
                      <th style={{ width: "110px" }}>Loại KV</th>
                      <th style={{ width: "120px" }}>Đơn đang xử lý</th>
                      <th style={{ width: "160px" }}>Giới hạn đơn tối đa</th>
                      <th style={{ width: "170px" }}>Tỷ lệ sử dụng</th>
                      <th style={{ width: "140px" }}>Trạng thái</th>
                      <th style={{ width: "120px", textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffAssignmentsForSelectedStaff.map(({ area, assignment }) => {
                      const editKey = `${area.id}-${assignment.staffId}`;
                      const currentVals = getRowValue(editKey, {
                        maxActiveOrders: assignment.maxActiveOrders,
                        isActive: assignment.isActive,
                      });

                      const isDirty =
                        currentVals.maxActiveOrders !== assignment.maxActiveOrders ||
                        currentVals.isActive !== assignment.isActive;

                      const utilizationPct = Math.round(
                        (assignment.utilization ?? 0) * 100,
                      );

                      return (
                        <tr key={area.id}>
                          <td>
                            <span className="area-code-badge">{area.code}</span>
                          </td>
                          <td>
                            <strong style={{ color: "#123f31", fontSize: "14px" }}>
                              {area.name}
                            </strong>
                          </td>
                          <td>
                            <span className={`area-type-tag ${area.type}`}>
                              {TYPE_LABELS[area.type] ?? area.type}
                            </span>
                          </td>
                          <td>
                            <strong style={{ fontSize: "14px", color: "#123f31" }}>
                              {assignment.activeOrders}
                            </strong>{" "}
                            <span style={{ fontSize: "12px", color: "#668177" }}>đơn</span>
                            {assignment.isFull && (
                              <span className="badge-full" title="Đã đạt giới hạn tối đa">
                                ĐẦY TẢI
                              </span>
                            )}
                          </td>
                          <td>
                            {/* Chỉnh sửa maxActiveOrders (1-100) */}
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <input
                                type="number"
                                className="max-orders-input"
                                min={1}
                                max={100}
                                value={currentVals.maxActiveOrders}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setRowEditValue(
                                    editKey,
                                    { maxActiveOrders: Number.isNaN(val) ? 1 : val },
                                    {
                                      maxActiveOrders: assignment.maxActiveOrders,
                                      isActive: assignment.isActive,
                                    },
                                  );
                                }}
                                disabled={saving}
                              />
                              <span style={{ fontSize: "12px", color: "#668177" }}>đơn max</span>
                            </div>
                          </td>
                          <td>
                            {/* Hiển thị Tỷ lệ sử dụng */}
                            <div className="utilization-wrapper">
                              <div className="utilization-track">
                                <div
                                  className={`utilization-fill ${
                                    utilizationPct < 70
                                      ? "low"
                                      : utilizationPct < 90
                                      ? "medium"
                                      : "high"
                                  }`}
                                  style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                                />
                              </div>
                              <div className="utilization-text">
                                <span
                                  style={{
                                    color:
                                      utilizationPct < 70
                                        ? "#137333"
                                        : utilizationPct < 90
                                        ? "#b06000"
                                        : "#c5221f",
                                  }}
                                >
                                  {utilizationPct}%
                                </span>
                                <span style={{ color: "#668177" }}>
                                  ({assignment.activeOrders}/{currentVals.maxActiveOrders})
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {/* Chỉnh sửa isActive */}
                            <button
                              type="button"
                              className={`btn-toggle-active ${
                                currentVals.isActive ? "active" : "inactive"
                              }`}
                              onClick={() => {
                                setRowEditValue(
                                  editKey,
                                  { isActive: !currentVals.isActive },
                                  {
                                    maxActiveOrders: assignment.maxActiveOrders,
                                    isActive: assignment.isActive,
                                  },
                                );
                              }}
                              disabled={saving}
                              title="Bấm để bật / tắt phân công khu vực này"
                            >
                              {currentVals.isActive ? "● Hoạt động" : "○ Tạm dừng"}
                            </button>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="primary"
                              style={{
                                padding: "5px 12px",
                                fontSize: "12px",
                                opacity: isDirty ? 1 : 0.6,
                              }}
                              disabled={saving || !isDirty}
                              onClick={() =>
                                void handleSaveStaffArea(
                                  area.id,
                                  assignment.staffId,
                                  currentVals.maxActiveOrders,
                                  currentVals.isActive,
                                  area.name,
                                  assignment.employeeCode,
                                )
                              }
                            >
                              Lưu
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: THÊM & SỬA KHU VỰC (ISSUE #23) */}
      {/* =================================================================== */}
      {areaModalOpen && (
        <div className="ops-areas-modal-backdrop" onClick={closeAreaModal}>
          <div
            className="ops-areas-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="area-modal-title"
          >
            <div className="ops-areas-modal-header">
              <h3 id="area-modal-title">
                {editingArea ? `Chỉnh sửa khu vực: ${editingArea.code}` : "Thêm mới khu vực"}
              </h3>
              <button
                type="button"
                className="secondary"
                style={{ padding: "4px 10px" }}
                onClick={closeAreaModal}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveArea} className="ops-areas-form">
              {/* Mã khu vực */}
              <label>
                Mã khu vực (Code) <span style={{ color: "#d93025" }}>*</span>
                <input
                  type="text"
                  required
                  maxLength={50}
                  placeholder="VD: Q1-BN, Q3-VTS..."
                  value={areaForm.code}
                  style={{ textTransform: "uppercase" }}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setAreaForm((prev) => ({ ...prev, code: val }));
                    checkDuplicateCode(val);
                  }}
                  disabled={saving}
                />
                {codeDuplicateError && (
                  <span className="field-error-msg">{codeDuplicateError}</span>
                )}
              </label>

              {/* Loại khu vực */}
              <label>
                Loại khu vực <span style={{ color: "#d93025" }}>*</span>
                <select
                  value={areaForm.type}
                  onChange={(e) =>
                    setAreaForm((prev) => ({
                      ...prev,
                      type: e.target.value as AreaType,
                    }))
                  }
                  disabled={saving}
                >
                  <option value="ward">Phường (Ward)</option>
                  <option value="commune">Xã (Commune)</option>
                  <option value="special_zone">Đặc khu (Special Zone)</option>
                </select>
              </label>

              {/* Tên khu vực */}
              <label className="ops-areas-form__wide">
                Tên khu vực (Phường / Xã / Đặc khu){" "}
                <span style={{ color: "#d93025" }}>*</span>
                <input
                  type="text"
                  required
                  maxLength={150}
                  placeholder="VD: Phường Bến Nghé, Xã Tân Nhựt, Đặc khu Cảng..."
                  value={areaForm.name}
                  onChange={(e) =>
                    setAreaForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={saving}
                />
              </label>

              {/* Xác định rõ phạm vi áp dụng */}
              <div className="ops-areas-form__wide ops-scope-selector">
                <span style={{ fontWeight: 600, fontSize: "13px", color: "#123f31" }}>
                  Mục đích áp dụng trong vận hành:
                </span>
                <div className="ops-scope-options">
                  <label className="ops-scope-option">
                    <input
                      type="radio"
                      name="scope"
                      value="both"
                      checked={areaForm.scope === "both"}
                      onChange={() => setAreaForm((prev) => ({ ...prev, scope: "both" }))}
                      disabled={saving}
                    />
                    <span>Cả Lấy hàng &amp; Giao hàng</span>
                  </label>
                  <label className="ops-scope-option">
                    <input
                      type="radio"
                      name="scope"
                      value="delivery"
                      checked={areaForm.scope === "delivery"}
                      onChange={() => setAreaForm((prev) => ({ ...prev, scope: "delivery" }))}
                      disabled={saving}
                    />
                    <span>Khu vực Giao hàng (Phân công Staff)</span>
                  </label>
                  <label className="ops-scope-option">
                    <input
                      type="radio"
                      name="scope"
                      value="pickup"
                      checked={areaForm.scope === "pickup"}
                      onChange={() => setAreaForm((prev) => ({ ...prev, scope: "pickup" }))}
                      disabled={saving}
                    />
                    <span>Khu vực Lấy hàng (Gom đơn lấy)</span>
                  </label>
                </div>
                <small style={{ color: "#668177", lineHeight: "1.4" }}>
                  💡 Gợi ý: Khu vực giao hàng là khóa chính để thuật toán tự động phân công Shipper; khu vực lấy hàng giúp chuẩn hóa địa chỉ và phân tuyến tài xế gom đơn.
                </small>
              </div>

              {/* Trạng thái hoạt động */}
              <div className="ops-areas-form__wide">
                <label className="ops-toggle-label">
                  <input
                    type="checkbox"
                    checked={areaForm.isActive}
                    onChange={(e) =>
                      setAreaForm((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                    disabled={saving}
                  />
                  <span>
                    <strong>Kích hoạt hoạt động</strong> (Cho phép chọn khu vực này khi tạo đơn hàng mới và phân công)
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="ops-areas-form__actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={closeAreaModal}
                  disabled={saving}
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={saving || !!codeDuplicateError}
                >
                  {saving
                    ? "Đang lưu…"
                    : editingArea
                    ? "CẬP NHẬT KHU VỰC"
                    : "THÊM KHU VỰC"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: GÁN THÊM KHU VỰC CHO STAFF ĐANG CHỌN (ISSUE #24) */}
      {/* =================================================================== */}
      {addAreaToStaffModalOpen && (
        <div
          className="ops-areas-modal-backdrop"
          onClick={() => !saving && setAddAreaToStaffModalOpen(false)}
        >
          <div
            className="ops-areas-modal"
            style={{ width: "min(560px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="ops-areas-modal-header">
              <h3>
                Phân khu vực phụ trách cho{" "}
                {currentSelectedStaff?.fullName || `Staff #${selectedStaffId}`}
              </h3>
              <button
                type="button"
                className="secondary"
                style={{ padding: "4px 10px" }}
                onClick={() => setAddAreaToStaffModalOpen(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAreaToStaffSubmit} className="ops-areas-form">
              <label className="ops-areas-form__wide">
                Chọn khu vực cần phân công: <span style={{ color: "#d93025" }}>*</span>
                <select
                  required
                  value={selectedAreaIdToAssign}
                  onChange={(e) =>
                    setSelectedAreaIdToAssign(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                  disabled={saving}
                >
                  <option value="">-- Chọn khu vực --</option>
                  {unassignedAreasForSelectedStaff.map((ar) => (
                    <option key={ar.id} value={ar.id}>
                      {ar.name} ({ar.code}) - {TYPE_LABELS[ar.type]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Giới hạn đơn tối đa (maxActiveOrders):{" "}
                <span style={{ color: "#d93025" }}>*</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={assignMaxOrders}
                  onChange={(e) => setAssignMaxOrders(parseInt(e.target.value, 10) || 1)}
                  disabled={saving}
                />
                <small style={{ color: "#668177" }}>Từ 1 đến 100 đơn (Mặc định: 10)</small>
              </label>

              <div style={{ display: "flex", alignItems: "center", marginTop: "18px" }}>
                <label className="ops-toggle-label">
                  <input
                    type="checkbox"
                    checked={assignIsActive}
                    onChange={(e) => setAssignIsActive(e.target.checked)}
                    disabled={saving}
                  />
                  <span>
                    <strong>Kích hoạt phụ trách</strong>
                  </span>
                </label>
              </div>

              <div className="ops-areas-form__actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setAddAreaToStaffModalOpen(false)}
                  disabled={saving}
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={saving || !selectedAreaIdToAssign}
                >
                  {saving ? "Đang lưu…" : "XÁC NHẬN PHÂN CÔNG"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: QUẢN LÝ STAFF CỦA MỘT KHU VỰC CỤ THỂ (TỪ TAB 1) */}
      {/* =================================================================== */}
      {areaForStaffModal && (
        <div
          className="ops-areas-modal-backdrop"
          onClick={() => !saving && setAreaForStaffModal(null)}
        >
          <div
            className="ops-areas-modal"
            style={{ width: "min(720px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="ops-areas-modal-header">
              <div>
                <h3 style={{ margin: 0 }}>
                  Nhân viên phụ trách: {areaForStaffModal.name} ({areaForStaffModal.code})
                </h3>
                <span style={{ fontSize: "12px", color: "#668177" }}>
                  Loại: {TYPE_LABELS[areaForStaffModal.type]} • Tải khu vực:{" "}
                  {areaForStaffModal.activeOrders}/{areaForStaffModal.totalCapacity} đơn
                </span>
              </div>
              <button
                type="button"
                className="secondary"
                style={{ padding: "4px 10px" }}
                onClick={() => setAreaForStaffModal(null)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            {/* Danh sách Staff hiện tại */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 10px", fontSize: "14px", color: "#123f31" }}>
                Danh sách nhân viên đang phụ trách ({areaForStaffModal.staff?.length || 0}):
              </h4>

              {(!areaForStaffModal.staff || areaForStaffModal.staff.length === 0) ? (
                <p style={{ color: "#668177", fontStyle: "italic", fontSize: "13px" }}>
                  Chưa có nhân viên nào được phân công khu vực này. Hãy phân công nhân viên bên dưới.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="ops-areas-table" style={{ fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th style={{ width: "90px" }}>Đơn xử lý</th>
                        <th style={{ width: "130px" }}>Tối đa (1-100)</th>
                        <th style={{ width: "140px" }}>Tỷ lệ sử dụng</th>
                        <th style={{ width: "110px" }}>Trạng thái</th>
                        <th style={{ width: "80px", textAlign: "right" }}>Lưu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {areaForStaffModal.staff.map((st) => {
                        const editKey = `${areaForStaffModal.id}-${st.staffId}`;
                        const currentVals = getRowValue(editKey, {
                          maxActiveOrders: st.maxActiveOrders,
                          isActive: st.isActive,
                        });
                        const isDirty =
                          currentVals.maxActiveOrders !== st.maxActiveOrders ||
                          currentVals.isActive !== st.isActive;
                        const pct = Math.round((st.utilization ?? 0) * 100);

                        return (
                          <tr key={st.staffId}>
                            <td>
                              <strong>{st.employeeCode}</strong>
                              <div style={{ color: "#668177", fontSize: "11px" }}>
                                {st.staffStatus === "available"
                                  ? "Sẵn sàng"
                                  : st.staffStatus === "busy"
                                  ? "Đang bận"
                                  : "Ngừng"}
                              </div>
                            </td>
                            <td>
                              <strong>{st.activeOrders}</strong> đơn
                              {st.isFull && <span className="badge-full">ĐẦY</span>}
                            </td>
                            <td>
                              <input
                                type="number"
                                className="max-orders-input"
                                min={1}
                                max={100}
                                style={{ width: "60px", padding: "4px" }}
                                value={currentVals.maxActiveOrders}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setRowEditValue(
                                    editKey,
                                    { maxActiveOrders: Number.isNaN(val) ? 1 : val },
                                    {
                                      maxActiveOrders: st.maxActiveOrders,
                                      isActive: st.isActive,
                                    },
                                  );
                                }}
                                disabled={saving}
                              />
                            </td>
                            <td>
                              <div className="utilization-wrapper" style={{ minWidth: "110px" }}>
                                <div className="utilization-track" style={{ height: "6px" }}>
                                  <div
                                    className={`utilization-fill ${
                                      pct < 70 ? "low" : pct < 90 ? "medium" : "high"
                                    }`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <div className="utilization-text">
                                  <span>{pct}%</span>
                                  <span>
                                    ({st.activeOrders}/{currentVals.maxActiveOrders})
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`btn-toggle-active ${
                                  currentVals.isActive ? "active" : "inactive"
                                }`}
                                style={{ padding: "2px 6px", fontSize: "11px" }}
                                onClick={() => {
                                  setRowEditValue(
                                    editKey,
                                    { isActive: !currentVals.isActive },
                                    {
                                      maxActiveOrders: st.maxActiveOrders,
                                      isActive: st.isActive,
                                    },
                                  );
                                }}
                                disabled={saving}
                              >
                                {currentVals.isActive ? "Hoạt động" : "Tạm dừng"}
                              </button>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                type="button"
                                className="primary"
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "11px",
                                  opacity: isDirty ? 1 : 0.6,
                                }}
                                disabled={saving || !isDirty}
                                onClick={() =>
                                  void handleSaveStaffArea(
                                    areaForStaffModal.id,
                                    st.staffId,
                                    currentVals.maxActiveOrders,
                                    currentVals.isActive,
                                    areaForStaffModal.name,
                                    st.employeeCode,
                                  )
                                }
                              >
                                Lưu
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Phân công nhân viên mới vào khu vực này */}
            <div
              style={{
                background: "#f7f9f7",
                border: "1px solid #e0e8e2",
                borderRadius: "10px",
                padding: "14px 16px",
              }}
            >
              <h4 style={{ margin: "0 0 10px", fontSize: "13px", color: "#123f31" }}>
                + Thêm nhân viên mới phụ trách khu vực này:
              </h4>

              <form onSubmit={handleAddStaffToAreaSubmit} className="ops-areas-form">
                <label>
                  Chọn nhân viên:
                  <select
                    required
                    value={newStaffIdForArea}
                    onChange={(e) =>
                      setNewStaffIdForArea(
                        e.target.value ? Number(e.target.value) : "",
                      )
                    }
                    disabled={saving}
                  >
                    <option value="">-- Chọn Staff --</option>
                    {staffList
                      .filter(
                        (st) =>
                          !areaForStaffModal.staff?.some(
                            (assigned) => assigned.staffId === st.id,
                          ),
                      )
                      .map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.employeeCode} - {st.fullName}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Giới hạn đơn tối đa:
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={newStaffMaxOrders}
                    onChange={(e) =>
                      setNewStaffMaxOrders(parseInt(e.target.value, 10) || 1)
                    }
                    disabled={saving}
                  />
                </label>

                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "6px",
                  }}
                >
                  <label className="ops-toggle-label">
                    <input
                      type="checkbox"
                      checked={newStaffIsActive}
                      onChange={(e) => setNewStaffIsActive(e.target.checked)}
                      disabled={saving}
                    />
                    <span>Kích hoạt phụ trách ngay</span>
                  </label>

                  <button
                    type="submit"
                    className="primary"
                    disabled={saving || !newStaffIdForArea}
                  >
                    {saving ? "Đang lưu…" : "+ Phân công Staff này"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
