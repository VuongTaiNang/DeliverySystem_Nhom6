import { useCallback, useEffect, useState } from "react";
import { money } from "../api";
import { request } from "../lib/http";

interface CashRequest {
  paymentId: string;
  shipmentId: string;
  amount: number;
  status: "pending";
  customerId: number;
  senderName: string;
  pickupAddress: string;
  createdAt: string;
}
interface ConfirmResult {
  message: string;
  shipmentId: string;
  amount: number;
  receiptReference: string;
  autoAssigned: boolean;
  autoAssignmentMessage: string;
}

export default function OperationsCashPaymentsPage() {
  const [rows, setRows] = useState<CashRequest[]>([]);
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await request<CashRequest[]>("/payments/cash/pending"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được danh sách nộp tiền mặt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function confirm(row: CashRequest) {
    if (busyId) return;
    const receipt = (receipts[row.paymentId] ?? "").trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9/_-]{5,69}$/.test(receipt)) {
      setError("Vui lòng nhập mã biên nhận đã kiểm tra, dài 6–70 ký tự (chữ, số, -, _ hoặc /).");
      return;
    }
    if (!window.confirm(
      `Xác nhận Operations đã thực sự nhận đủ ${money(row.amount)} bằng TIỀN MẶT cho vận đơn ${row.shipmentId}, biên nhận ${receipt}?\nKhông bấm Xác nhận nếu chưa có tiền/biên nhận thực tế.`
    )) return;
    setBusyId(row.paymentId);
    setError("");
    setMessage("");
    try {
      const result = await request<ConfirmResult>(
        `/payments/cash/${encodeURIComponent(row.paymentId)}/confirm`, {
          method: "POST",
          body: JSON.stringify({ receiptReference: receipt }),
        },
      );
      setMessage(`${result.message} Vận đơn ${result.shipmentId}: ${result.autoAssigned
        ? "đã tự phân công."
        : "chưa thể tự phân công."} ${result.autoAssignmentMessage}`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xác nhận đã nhận tiền mặt.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="panel" aria-label="Xác nhận thu tiền mặt phí vận chuyển">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">VẬN HÀNH / THANH TOÁN TRẢ TRƯỚC</p>
          <h2>Thu phí vận chuyển bằng tiền mặt</h2>
          <p className="muted">
            Chỉ xác nhận sau khi Shop đã nộp đủ tiền và có mã biên nhận thực tế.
            VNPay được xác thực bằng cổng thanh toán, không thao tác tại đây.
          </p>
        </div>
        <button type="button" disabled={loading || !!busyId} onClick={() => void load()}>
          Tải lại
        </button>
      </div>

      <p className="muted">
        Mỗi khoản tiền mặt đang chờ là một yêu cầu của Customer, không phải chứng từ đã trả tiền.
        Xác nhận thành công sẽ ghi lịch sử giao dịch và thử tự động phân Staff.
        <strong> Demo không thực hiện chuyển tiền thật.</strong>
      </p>
      {error && <p role="alert" style={{ color: "#ae3423" }}>{error}</p>}
      {message && <p role="status" style={{ color: "#13633f" }}>{message}</p>}
      {loading ? <p role="status">Đang tải các yêu cầu chưa xác nhận…</p>
        : rows.length === 0 ? (
          <p>Không có yêu cầu nộp phí tiền mặt đang chờ xác nhận.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Vận đơn</th>
                  <th>Shop / Điểm lấy</th>
                  <th>Phí cần thu</th>
                  <th>Ngày yêu cầu</th>
                  <th>Mã biên nhận đã kiểm tra</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.paymentId}>
                    <td><strong className="tracking-code">{row.shipmentId}</strong></td>
                    <td>{row.senderName}<small style={{display:"block"}}>{row.pickupAddress}</small></td>
                    <td><strong>{money(row.amount)}</strong></td>
                    <td>{new Date(row.createdAt).toLocaleString("vi-VN")}</td>
                    <td>
                      <input
                        type="text"
                        aria-label={`Mã biên nhận tiền mặt cho ${row.shipmentId}`}
                        placeholder="TM-2026-001"
                        value={receipts[row.paymentId] ?? ""}
                        onChange={(event) => setReceipts((prev) => ({
                          ...prev, [row.paymentId]: event.target.value
                        }))}
                      />
                    </td>
                    <td>
                      <button type="button" className="primary"
                        disabled={!!busyId}
                        onClick={() => void confirm(row)}>
                        {busyId === row.paymentId ? "Đang xác nhận…" : "Xác nhận đã thu"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}
