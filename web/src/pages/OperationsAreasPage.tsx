import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  createOperationsArea,
  listOperationsAreas,
  updateOperationsArea,
} from "../operationsAreasApi";
import type {
  AreaType,
  OperationsArea,
  SaveAreaInput,
} from "../operationsAreasApi";
import "./OperationsAreasPage.css";

type Notice = { kind: "success" | "error"; text: string } | null;

type AreaScope = "both" | "delivery" | "pickup";

interface AreaFormState {
  code: string;
  name: string;
  type: AreaType;
  isActive: boolean;
  scope: AreaScope;
}

const emptyForm: AreaFormState = {
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
  const [areas, setAreas] = useState<OperationsArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [notice, setNotice] = useState<Notice>(null);

  // Modal Thêm / Sửa
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<OperationsArea | null>(null);
  const [form, setForm] = useState<AreaFormState>(emptyForm);
  const [codeDuplicateError, setCodeDuplicateError] = useState("");

  const loadAreas = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await listOperationsAreas();
      setAreas(data);
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Không tải được danh sách khu vực.",
      });
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAreas(true);
  }, [loadAreas]);

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

  const openCreateModal = () => {
    setEditingArea(null);
    setForm(emptyForm);
    setCodeDuplicateError("");
    setModalOpen(true);
  };

  const openEditModal = (area: OperationsArea) => {
    setEditingArea(area);
    setForm({
      code: area.code,
      name: area.name,
      type: area.type,
      isActive: area.isActive,
      scope: "both",
    });
    setCodeDuplicateError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingArea(null);
    setForm(emptyForm);
    setCodeDuplicateError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // 1. Validation bỏ trống
    const cleanCode = form.code.trim().toUpperCase();
    const cleanName = form.name.trim();

    if (!cleanCode) {
      setNotice({ kind: "error", text: "Vui lòng nhập mã khu vực." });
      return;
    }
    if (cleanCode.length < 2 || cleanCode.length > 50) {
      setNotice({ kind: "error", text: "Mã khu vực phải từ 2 đến 50 ký tự." });
      return;
    }
    if (!cleanName) {
      setNotice({ kind: "error", text: "Vui lòng nhập tên khu vực (phường/xã/đặc khu)." });
      return;
    }
    if (cleanName.length < 2 || cleanName.length > 150) {
      setNotice({ kind: "error", text: "Tên khu vực phải từ 2 đến 150 ký tự." });
      return;
    }

    // 2. Validation trùng mã
    if (checkDuplicateCode(cleanCode)) {
      setNotice({ kind: "error", text: "Mã khu vực đã tồn tại, vui lòng chọn mã khác." });
      return;
    }

    setSaving(true);
    setNotice(null);

    const payload: SaveAreaInput = {
      code: cleanCode,
      name: cleanName,
      type: form.type,
      isActive: form.isActive,
    };

    try {
      if (editingArea) {
        // Gắn API PUT /api/v1/operations/areas/{id}
        await updateOperationsArea(editingArea.id, payload);
        setNotice({
          kind: "success",
          text: `Đã cập nhật thành công khu vực "${cleanName}" (${cleanCode}).`,
        });
      } else {
        // Gắn API POST /api/v1/operations/areas
        await createOperationsArea(payload);
        setNotice({
          kind: "success",
          text: `Đã thêm mới thành công khu vực "${cleanName}" (${cleanCode}).`,
        });
      }
      closeModal();
      await loadAreas(false);
    } catch (error) {
      // Bắt lỗi trả về từ Backend (409 Conflict, 400 Bad Request...)
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Thao tác khu vực thất bại.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (area: OperationsArea) => {
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
      await loadAreas(false);
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Cập nhật trạng thái thất bại.",
      });
    }
  };

  // Lọc danh sách
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
    const totalStaff = areas.reduce((sum, a) => sum + (a.staffCount || 0), 0);
    const totalAlerts = areas.filter((a) => a.hasCapacityAlert).length;
    return { total, active, totalStaff, totalAlerts };
  }, [areas]);

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
          <h2>Quản lý Khu vực Vận hành (Operations Areas)</h2>
          <p className="muted">
            Quản lý chuẩn hóa danh mục phường, xã, đặc khu phục vụ gom đơn lấy và tự động phân công nhân viên giao nhận.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="secondary"
            onClick={() => void loadAreas(true)}
            disabled={loading}
          >
            {loading ? "Đang tải…" : "Làm mới"}
          </button>
          <button type="button" className="primary" onClick={openCreateModal}>
            + Thêm khu vực mới
          </button>
        </div>
      </section>

      {/* Thống kê nhanh */}
      <section className="ops-areas-stats">
        <div>
          <strong>{stats.total}</strong>
          <span>Tổng số khu vực</span>
        </div>
        <div>
          <strong style={{ color: "#137333" }}>{stats.active}</strong>
          <span>Đang kích hoạt</span>
        </div>
        <div>
          <strong>{stats.totalStaff}</strong>
          <span>Nhân viên phụ trách</span>
        </div>
        <div>
          <strong style={{ color: stats.totalAlerts > 0 ? "#c5221f" : "#123f31" }}>
            {stats.totalAlerts}
          </strong>
          <span>Khu vực chờ bổ sung tải</span>
        </div>
      </section>

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
                  <th style={{ width: "130px" }}>Loại khu vực</th>
                  <th style={{ width: "160px" }}>Áp dụng</th>
                  <th style={{ width: "130px" }}>Vận hành</th>
                  <th style={{ width: "140px" }}>Trạng thái</th>
                  <th style={{ width: "150px", textAlign: "right" }}>Thao tác</th>
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
                      <span className="area-scope-pill" title="Áp dụng lấy hàng">Lấy hàng</span>
                      <span className="area-scope-pill" title="Áp dụng giao hàng">Giao hàng</span>
                    </td>
                    <td>
                      <div style={{ fontSize: "12px", color: "#24483b" }}>
                        <span>👤 {area.staffCount} NV</span>
                        {area.waitingAssignments > 0 && (
                          <span
                            style={{
                              marginLeft: "6px",
                              color: "#c5221f",
                              fontWeight: "bold",
                            }}
                            title="Số đơn đang chờ phân công"
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
                      <div className="ops-areas-actions" style={{ justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: "5px 10px", fontSize: "12px" }}
                          onClick={() => openEditModal(area)}
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
                          onClick={() => void handleToggleStatus(area)}
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

      {/* Modal Thêm & Sửa khu vực */}
      {modalOpen && (
        <div className="ops-areas-modal-backdrop" onClick={closeModal}>
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
                onClick={closeModal}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="ops-areas-form">
              {/* Mã khu vực */}
              <label>
                Mã khu vực (Code) <span style={{ color: "#d93025" }}>*</span>
                <input
                  type="text"
                  required
                  maxLength={50}
                  placeholder="VD: Q1-BN, Q3-VTS..."
                  value={form.code}
                  style={{ textTransform: "uppercase" }}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setForm((prev) => ({ ...prev, code: val }));
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
                  value={form.type}
                  onChange={(e) =>
                    setForm((prev) => ({
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
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={saving}
                />
              </label>

              {/* Xác định rõ đây là khu vực lấy hàng hay giao hàng */}
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
                      checked={form.scope === "both"}
                      onChange={() => setForm((prev) => ({ ...prev, scope: "both" }))}
                      disabled={saving}
                    />
                    <span>Cả Lấy hàng &amp; Giao hàng</span>
                  </label>
                  <label className="ops-scope-option">
                    <input
                      type="radio"
                      name="scope"
                      value="delivery"
                      checked={form.scope === "delivery"}
                      onChange={() => setForm((prev) => ({ ...prev, scope: "delivery" }))}
                      disabled={saving}
                    />
                    <span>Khu vực Giao hàng (Phân công Staff)</span>
                  </label>
                  <label className="ops-scope-option">
                    <input
                      type="radio"
                      name="scope"
                      value="pickup"
                      checked={form.scope === "pickup"}
                      onChange={() => setForm((prev) => ({ ...prev, scope: "pickup" }))}
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
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, isActive: e.target.checked }))
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
                  onClick={closeModal}
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
    </div>
  );
}
