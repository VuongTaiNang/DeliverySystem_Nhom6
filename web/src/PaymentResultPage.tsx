import { useEffect, useState } from "react";
import { money } from "./api";
import { paymentApi } from "./lib/sprint2";
import { useAuth } from "./auth/context";

type PaymentDetails = {
  paymentId: string;
  shipmentId: string;
  amount: number;
  status: string;
  method?: string | null;
  transactionReference?: string | null;
  paidAt?: string | null;
};

export default function PaymentResultPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user } = useAuth();
  const paymentId = new URLSearchParams(window.location.search).get("paymentId");
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!paymentId || !user || user.role !== "customer") return;
    let mounted = true;
    setLoading(true);
    setError("");
    paymentApi.get(paymentId)
      .then((result) => {
        if (mounted) setPayment(result);
      })
      .catch((reason: unknown) => {
        if (mounted) setError(reason instanceof Error ? reason.message : "Không kiểm tra được giao dịch.");
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [paymentId, user, attempt]);

  const isPaid = payment?.status === "paid";
  const isFailed = payment?.status === "failed";
  const title = isPaid ? "Thanh toán thành công!" : isFailed ? "Thanh toán không thành công" : "Đang xác nhận thanh toán";

  return (
    <section className="panel" aria-label="Kết quả thanh toán VNPay">
      <div className="panel-heading"><h2>Kết quả thanh toán VNPay</h2></div>
      {!paymentId ? (
        <p role="alert">Thiếu mã giao dịch. Vui lòng mở lại kết quả từ VNPay.</p>
      ) : !user ? (
        <p>Vui lòng đăng nhập đúng tài khoản Customer đã thanh toán để xem trạng thái giao dịch.</p>
      ) : user.role !== "customer" ? (
        <p role="alert">Chỉ tài khoản Customer sở hữu giao dịch mới có thể xem kết quả.</p>
      ) : (
        <>
          <h3 role="status">{loading ? "Đang kiểm tra với hệ thống..." : error ? "Chưa kiểm tra được giao dịch" : title}</h3>
          <p className="muted">Kết quả hiển thị được lấy từ Backend, không dựa vào tham số URL của trình duyệt.</p>
          {error && <p role="alert">{error}</p>}
          {payment && (
            <div className="form-grid">
              <p><strong>Mã vận đơn:</strong> {payment.shipmentId}</p>
              <p><strong>Số tiền:</strong> {money(payment.amount)}</p>
              <p><strong>Phương thức:</strong> VNPay</p>
              <p><strong>Trạng thái:</strong> {isPaid ? "Đã thanh toán" : isFailed ? "Thất bại" : "Đang chờ xác nhận"}</p>
              <p><strong>Mã giao dịch:</strong> {paymentId}</p>
              {payment.paidAt && <p><strong>Thời điểm:</strong> {new Date(payment.paidAt).toLocaleString("vi-VN")}</p>}
            </div>
          )}
          <div className="actions">
            <button type="button" disabled={loading} onClick={() => setAttempt((n) => n + 1)}>Kiểm tra lại trạng thái</button>
            <button type="button" className="primary" onClick={() => onNavigate("shipments")}>Quay về đơn hàng</button>
          </div>
        </>
      )}
    </section>
  );
}
