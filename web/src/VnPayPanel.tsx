import { useEffect, useState } from "react";
import { paymentApi } from "./lib/sprint2";

type PaymentStatus = "" | "pending" | "paid" | "failed" | string;

export default function VnPayPanel({
  shipmentId,
  feePayer,
}: {
  shipmentId: string;
  feePayer?: string;
}) {
  const storageKey = `express-vnpay-payment:${shipmentId}`;
  const [paymentId, setPaymentId] = useState<string | null>(() =>
    sessionStorage.getItem(storageKey)
  );
  const [paymentUrl, setPaymentUrl] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!paymentId) return;
    let active = true;
    paymentApi.get(paymentId)
      .then((payment) => { if (active) setStatus(payment.status); })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Không tải được trạng thái thanh toán.");
      });
    return () => { active = false; };
  }, [paymentId]);

  async function create() {
  setBusy(true);
  setError("");

  try {
    const payment = await paymentApi.create(shipmentId);

    setPaymentId(payment.paymentId);
    setStatus(payment.status);

    // Chuyển đến VNPay trên tab hiện tại
    window.location.assign(payment.paymentUrl);
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Không tạo được thanh toán VNPay."
    );
    setBusy(false);
  }

}

  async function refresh() {
    if (!paymentId) return;
    setBusy(true);
    setError("");
    try {
      const payment = await paymentApi.get(paymentId);
      setStatus(payment.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không kiểm tra được thanh toán.");
    } finally {
      setBusy(false);
    }
  }

  if (feePayer !== "shop_prepaid") return null;

  return (
    <section className="panel" aria-label="Thanh toán VNPay">
      <h3>Thanh toán phí vận chuyển bằng VNPay</h3>
      
      {status && (
        <p role="status">
          Trạng thái: {status === "paid" ? "Đã thanh toán" : status === "pending" ? "Đang chờ thanh toán" : status === "failed" ? "Thanh toán thất bại" : status}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {!paymentId && (
        <button type="button" disabled={busy} onClick={() => void create()}>
          {busy ? "Đang tạo giao dịch..." : "Tạo liên kết thanh toán VNPay"}
        </button>
      )}
      {paymentUrl && status !== "paid" && (
        <p>
          <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
            Mở trang thanh toán VNPay
          </a>
        </p>
      )}
      {paymentId && (
        <button type="button" disabled={busy} onClick={() => void refresh()}>
          {busy ? "Đang kiểm tra..." : "Kiểm tra trạng thái thanh toán"}
        </button>
      )}
      {status === "failed" && (
        <button type="button" disabled={busy} onClick={() => {
          sessionStorage.removeItem(storageKey);
          setPaymentId(null);
          setPaymentUrl("");
          setStatus("");
          setError("");
        }}>
          Tạo giao dịch khác
        </button>
      )}
      {status === "pending" && !paymentUrl && (
        <p className="muted">Giao dịch đang chờ. Nếu bạn đã đóng trang VNPay, hãy chọn “Kiểm tra trạng thái thanh toán” để cập nhật kết quả.</p>
      )}
    </section>
  );
}
