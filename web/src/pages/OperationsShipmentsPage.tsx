import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { money, STATUS } from "../api";
import { request } from "../lib/http";
import {
  eventStatusLabel,
  feePayerLabel,
  serviceLabel,
  assignmentStatusLabel,
} from "../lib/operationsStatusLabels";
import "./OperationsShipmentsPage.css";

type ShipmentStatus = keyof typeof STATUS;

interface ShipmentItem {
  id: string;
  customerId: number | null;
  senderName: string;
  senderPhone: string;
  pickupAddress: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  goods: string;
  codAmount: number;
  fee: number;
  feePayer: string;
  service: string;
  status: string;
  createdAt: string;
  activeAssignment?: {
    staffId: number;
    employeeCode: string;
    staffName: string;
    assignmentStatus: string;
  } | null;
}

interface ShipmentListResponse {
  items: ShipmentItem[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ShipmentDetail {
  shipment: ShipmentItem;
  events: { id: number; status: string; note: string; at: string }[];
}

const emptyList: ShipmentListResponse = {
  items: [], totalItems: 0, page: 1, pageSize: 20, totalPages: 0,
};

export default function OperationsShipmentsPage() {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<ShipmentListResponse>(emptyList);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [detailError, setDetailError] = useState("");

  // Operations uses its own role-protected endpoint. Customer's own-order
  // list intentionally remains a separate API and is unchanged.
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sort: "newest",
    });
    if (query) params.set("search", query);
    if (status) params.set("status", status);
    setLoading(true);
    setError("");
    void request<ShipmentListResponse>(
      `/operations/shipments?${params.toString()}`,
      { signal: controller.signal },
    ).then((result) => {
      if (!controller.signal.aborted) setData(result);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : "Không tải được danh sách đơn.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [page, query, status, refreshKey]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetail(null);
    setDetailError("");
    void request<ShipmentDetail>(
      `/operations/shipments/${encodeURIComponent(selectedId)}`,
      { signal: controller.signal },
    ).then((result) => {
      if (!controller.signal.aborted) setDetail(result);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted)
        setDetailError(reason instanceof Error ? reason.message : "Không tải được chi tiết đơn.");
    });
    return () => controller.abort();
  }, [selectedId, refreshKey]);

  function search(event: FormEvent) {
    event.preventDefault();
    setSelectedId(null);
    setPage(1);
    setQuery(queryInput.trim());
    // Repeat a search even when the keyword hasn't changed.
    setRefreshKey((value) => value + 1);
  }

  function reset() {
    setQueryInput("");
    setQuery("");
    setStatus("");
    setPage(1);
    setSelectedId(null);
    setRefreshKey((value) => value + 1);
  }

  return (
    <div className="ops-shipments-page">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">VẬN HÀNH / TẤT CẢ VẬN ĐƠN</p>
            <h2>Danh sách đơn hàng</h2>
            <p className="muted">
              Hiển thị đơn của tất cả khách hàng. Chỉ khi tìm kiếm hoặc chọn trạng thái,
              danh sách mới được lọc.
            </p>
          </div>
          <button type="button" disabled={loading} onClick={() => setRefreshKey((v) => v + 1)}>
            Làm mới
          </button>
        </div>

        <form className="ops-shipment-filters" onSubmit={search}>
          <label>
            Tìm đơn hàng
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Mã vận đơn, người gửi/nhận, số điện thoại, địa chỉ..."
            />
          </label>
          <label>
            Trạng thái
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS).map(([value, name]) => (
                <option key={value} value={value}>{name}</option>
              ))}
            </select>
          </label>
          <button className="primary" type="submit" disabled={loading}>Tìm kiếm</button>
          <button type="button" onClick={reset}>Xóa lọc</button>
        </form>

        {error && <p className="ops-shipments-error" role="alert">{error}</p>}
        <div className="ops-shipments-count">
          <strong>{loading ? "Đang tải..." : `${data.totalItems} đơn hàng`}</strong>
          <span>Trang {data.page}/{Math.max(1, data.totalPages)}</span>
        </div>

        {loading ? <p role="status">Đang tải danh sách vận đơn…</p> :
         error ? null :
         data.items.length === 0 ? (
          <p className="ops-shipments-empty">
            {query || status ? "Không tìm thấy đơn hàng phù hợp bộ lọc." : "Hệ thống chưa có vận đơn."}
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mã vận đơn</th>
                  <th>Người gửi</th>
                  <th>Người nhận</th>
                  <th>Dịch vụ</th>
                  <th>Nhân viên</th>
                  <th>Trạng thái</th>
                  <th>Phí</th>
                  <th>Ngày tạo</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td><strong className="tracking-code">{item.id}</strong></td>
                    <td>{item.senderName}<small>{item.senderPhone}</small></td>
                    <td>{item.recipientName}<small>{item.recipientPhone}</small></td>
                    <td>{serviceLabel(item.service)}</td>
                    <td>{item.activeAssignment
                      ? <>{item.activeAssignment.staffName}<small>{item.activeAssignment.employeeCode} · {assignmentStatusLabel(item.activeAssignment.assignmentStatus)}</small></>
                      : "Chưa phân công"}</td>
                    <td><span className={`badge ${item.status}`}>{STATUS[item.status as ShipmentStatus] ?? "Trạng thái khác"}</span></td>
                    <td>{money(item.fee)}</td>
                    <td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
                    <td>
                      <button type="button" onClick={() => setSelectedId(item.id)}>Xem</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="ops-shipment-pages">
          <button type="button" disabled={loading || page <= 1}
            onClick={() => { setPage((x) => x - 1); setSelectedId(null); }}>← Trước</button>
          <span>Trang {data.page} / {Math.max(1, data.totalPages)}</span>
          <button type="button" disabled={loading || page >= data.totalPages}
            onClick={() => { setPage((x) => x + 1); setSelectedId(null); }}>Sau →</button>
        </div>
      </section>

      {selectedId && (
        <section className="panel ops-shipment-detail" aria-label="Chi tiết vận đơn">
          <div className="panel-heading">
            <h3>Vận đơn {selectedId}</h3>
            <button type="button" onClick={() => setSelectedId(null)}>Đóng</button>
          </div>
          {detailError && <p role="alert">{detailError}</p>}
          {!detail && !detailError ? <p>Đang tải chi tiết…</p> : detail && (
            <>
              <div className="ops-shipment-addresses">
                <div><strong>Điểm lấy hàng</strong><p>{detail.shipment.pickupAddress}</p></div>
                <div><strong>Điểm giao hàng</strong><p>{detail.shipment.deliveryAddress}</p></div>
              </div>
              <p>
                <strong>Hình thức trả phí:</strong> {feePayerLabel(detail.shipment.feePayer)} ·
                <strong> COD:</strong> {money(detail.shipment.codAmount)}
              </p>
              <h4>Lịch sử hành trình</h4>
              <ol className="ops-shipment-events">
                {detail.events.map((event) => (
                  <li key={event.id}>
                    <strong>{eventStatusLabel(event.status)}</strong> ·
                    <time> {new Date(event.at).toLocaleString("vi-VN")}</time>
                    {event.note && <p>{event.note}</p>}
                  </li>
                ))}
              </ol>
              <p className="muted">Để phân công lại hoặc xử lý ngoại lệ, chuyển sang tab Phân công / Điều phối.</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
