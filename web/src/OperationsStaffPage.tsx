import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  createOperationsStaff,
  listOperationsStaff,
  updateOperationsStaff,
  updateOperationsStaffStatus,
} from "./operationsStaffApi";
import type { OperationsStaff, StaffStatus } from "./operationsStaffApi";
import { formatVietnamDateTime } from "./lib/dateTime";
import "./OperationsStaffPage.css";

type Notice = { kind: "success" | "error"; text: string } | null;

type StaffForm = {
  fullName: string;
  email: string;
  phone: string;
  area: string;
  password: string;
};

const emptyForm: StaffForm = {
  fullName: "",
  email: "",
  phone: "",
  area: "",
  password: "",
};

const STATUS_LABEL: Record<StaffStatus, string> = {
  available: "Sẵn sàng",
  busy: "Đang bận",
  inactive: "Ngưng hoạt động",
};

export default function OperationsStaffPage() {
  const [staffs, setStaffs] = useState<OperationsStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<OperationsStaff | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);

  useEffect(() => {
    void loadStaffs(true);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.kind === "success" ? 4000 : 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function loadStaffs(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const data = await listOperationsStaff();
      setStaffs(data);
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Không tải được danh sách nhân viên.",
      });
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("vi");
    if (!term) return staffs;
    return staffs.filter((staff) =>
      [staff.employeeCode, staff.fullName, staff.email, staff.phone, staff.area]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(term),
    );
  }, [search, staffs]);

  function openCreate() {
    setEditStaff(null);
    setForm(emptyForm);
    setCreateOpen(true);
  }

  function openEdit(staff: OperationsStaff) {
    setEditStaff(staff);
    setForm({
      fullName: staff.fullName,
      email: staff.email,
      phone: staff.phone,
      area: staff.area === "Chưa phân công" ? "" : staff.area,
      password: "",
    });
    setCreateOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setCreateOpen(false);
    setEditStaff(null);
    setForm(emptyForm);
  }

  async function submitStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const area = form.area.trim();

    if (!fullName || !email || !phone) {
      setNotice({ kind: "error", text: "Vui lòng nhập đầy đủ họ tên, email và số điện thoại." });
      return;
    }
    if (!/^0[0-9]{9}$/.test(phone)) {
      setNotice({ kind: "error", text: "Số điện thoại phải gồm 10 số và bắt đầu bằng 0." });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setNotice({ kind: "error", text: "Email không hợp lệ." });
      return;
    }
    if (!editStaff && form.password.length < 8) {
      setNotice({ kind: "error", text: "Mật khẩu nhân viên phải có ít nhất 8 ký tự." });
      return;
    }

    setSaving(true);
    try {
      if (editStaff) {
        const updated = await updateOperationsStaff(editStaff.id, { fullName, email, phone, area });
        setStaffs((current) => current.map((item) => item.id === editStaff.id ? { ...item, ...updated } : item));
        setNotice({ kind: "success", text: `Đã cập nhật ${editStaff.employeeCode}.` });
      } else {
        const created = await createOperationsStaff({
          fullName,
          email,
          phone,
          area,
          password: form.password,
        });
        setStaffs((current) => [created, ...current]);
        setNotice({ kind: "success", text: `Đã thêm nhân viên ${created.employeeCode}.` });
      }
      closeForm();
      await loadStaffs(false);
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Không lưu được thông tin nhân viên.",
      });
    } finally {
      setSaving(false);
      setCreateOpen(false);
      setEditStaff(null);
    }
  }

  async function changeStatus(staff: OperationsStaff, status: StaffStatus) {
    if (busyId) return;
    setBusyId(staff.id);
    try {
      const updated = await updateOperationsStaffStatus(staff.id, status);
      setStaffs((current) =>
        current.map((item) => item.id === staff.id ? { ...item, status: updated.status, isAvailable: updated.isAvailable } : item),
      );
      setNotice({ kind: "success", text: `Đã cập nhật trạng thái ${staff.employeeCode}.` });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Không cập nhật được trạng thái nhân viên.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const available = staffs.filter((item) => item.status === "available").length;
  const busy = staffs.filter((item) => item.status === "busy").length;
  const inactive = staffs.filter((item) => item.status === "inactive").length;

  return (
    <div className="ops-staff-page">
      <section className="panel ops-staff-hero">
        <div>
          <p className="eyebrow">OPERATIONS · STAFF</p>
          <h2>Quản lý nhân viên giao nhận</h2>
          <p className="muted">Tạo tài khoản Staff, cập nhật khu vực và quản lý trạng thái làm việc.</p>
        </div>
        <button type="button" className="primary" onClick={openCreate}>+ Thêm nhân viên</button>
      </section>

      {notice && <div className={`notice ${notice.kind}`} role="status">{notice.text}</div>}

      <section className="ops-staff-stats" aria-label="Thống kê nhân viên">
        <div><strong>{staffs.length}</strong><span>Tổng nhân viên</span></div>
        <div><strong>{available}</strong><span>Sẵn sàng</span></div>
        <div><strong>{busy}</strong><span>Đang bận</span></div>
        <div><strong>{inactive}</strong><span>Ngưng hoạt động</span></div>
      </section>

      <section className="panel">
        <div className="panel-heading ops-staff-toolbar">
          <input
            aria-label="Tìm nhân viên"
            placeholder="Tìm mã NV, họ tên, email, SĐT hoặc khu vực…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" disabled={loading} onClick={() => void loadStaffs(true)}>
            {loading ? "Đang tải…" : "Làm mới"}
          </button>
        </div>

        {loading && staffs.length === 0 ? (
          <p role="status">Đang tải danh sách nhân viên…</p>
        ) : visible.length === 0 ? (
          <div className="empty"><h3>Chưa có nhân viên phù hợp</h3></div>
        ) : (
          <div className="table-scroll">
            <table className="ops-staff-table">
              <thead>
                <tr>
                  <th>Mã NV</th>
                  <th>Nhân viên</th>
                  <th>Liên hệ</th>
                  <th>Khu vực</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((staff) => (
                  <tr key={staff.id}>
                    <td><strong>{staff.employeeCode}</strong></td>
                    <td>{staff.fullName}</td>
                    <td><span>{staff.phone}</span><small>{staff.email}</small></td>
                    <td>{staff.area || "Chưa phân công"}</td>
                    <td>
                      <select
                        aria-label={`Trạng thái ${staff.fullName}`}
                        value={staff.status}
                        disabled={busyId === staff.id}
                        onChange={(event) => void changeStatus(staff, event.target.value as StaffStatus)}
                      >
                        {(Object.keys(STATUS_LABEL) as StaffStatus[]).map((status) => (
                          <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                        ))}
                      </select>
                    </td>
                    <td>{formatVietnamDateTime(staff.createdAt)}</td>
                    <td><button type="button" onClick={() => openEdit(staff)}>Sửa</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createOpen && (
        <div className="ops-staff-modal-backdrop" role="presentation" onMouseDown={closeForm}>
          <section className="ops-staff-modal panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{editStaff ? editStaff.employeeCode : "NHÂN VIÊN MỚI"}</p>
                <h2>{editStaff ? "Cập nhật nhân viên" : "Thêm nhân viên giao nhận"}</h2>
              </div>
              <button type="button" onClick={closeForm} disabled={saving}>Đóng</button>
            </div>

            <form onSubmit={submitStaff} className="ops-staff-form">
              <label>Họ và tên
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} maxLength={150} required />
              </label>
              <label>Email
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={200} required />
              </label>
              <label>Số điện thoại
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" maxLength={10} required />
              </label>
              <label>Khu vực
                <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} maxLength={150} placeholder="Ví dụ: Quận 7" />
              </label>
              {!editStaff && (
                <label className="ops-staff-form__wide">Mật khẩu ban đầu
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required autoComplete="new-password" />
                  <small className="muted">Tối thiểu 8 ký tự. Operations không thể xem lại mật khẩu sau khi tạo.</small>
                </label>
              )}
              <div className="ops-staff-form__actions">
                <button type="button" onClick={closeForm} disabled={saving}>Hủy</button>
                <button type="submit" className="primary" disabled={saving}>
                  {saving ? "Đang lưu…" : editStaff ? "Lưu thay đổi" : "Tạo nhân viên"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
