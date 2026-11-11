import { useEffect, useState } from "react";
import { money } from "./api";
import { paymentApi } from "./lib/sprint2";
import type { PrepaidPayment } from "./lib/sprint2";

type Choice = "vnpay" | "cash";

export default function VnPayPanel({
  shipmentId,
  feePayer,
  fee,
}: {
  shipmentId: string;
  feePayer?: string;
  fee?: number;
}) {
  const [choice, setChoice] = useState<Choice>("vnpay");
  const [payment, setPayment] = useState<PrepaidPayment | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const latest = await paymentApi.byShipment(shipmentId);
      setPayment(latest);
      if (latest.method === "cash" || latest.method === "vnpay") {
        setChoice(latest.method);
      }
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : "Không lấy được trạng thái thanh toán.");
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setNotice("");
    void paymentApi.byShipment(shipmentId)
      .then((latest) => {
        if (!active) return;
        setPayment(latest);
        if (latest.method === "cash" || latest.method === "vnpay") {
          setChoice(latest.method);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error
          ? reason.message
          : "Không lấy được trạng thái thanh toán.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [shipmentId]);

  async function startPayment() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (choice === "cash") {
        const created = await paymentApi.requestCash(shipmentId);
        setPayment(created);
        setNotice(created.message ??
          "Đã đăng ký nộp tiền mặt. Vui lòng nộp tại điểm tiếp nhận và lấy biên nhận.");
      } else {
        const created = await paymentApi.create(shipmentId);
        setPayment(created);
        window.location.assign(created.paymentUrl);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tạo được yêu cầu thanh toán.");
    } finally {
      setBusy(false);
    }
  }

  if (feePayer !== "shop_prepaid") return null;

  const paid = payment?.status === "paid";
  const pending = payment?.status === "pending";
  const method = payment?.method;

  return (
    <section className="panel" aria-label="Thanh toán phí vận chuyển Shop trả trước">
      <h3>Thanh toán phí vận chuyển – Shop trả trước</h3>
      <p className="muted">
        Shop chỉ thanh toán <strong>phí vận chuyển{typeof fee === "number" ? ` ${money(fee)}` : ""}</strong>.
        Tiền hàng COD được thu riêng lúc giao hàng, không thanh toán tại đây.
      </p>

      {loading ? <p role="status">Đang kiểm tra trạng thái thanh toán…</p> : (
        <>
          {paid ? (
            <p role="status">
              <strong>Đã ghi nhận thanh toán phí ship</strong> (
              {method === "cash" ? "Tiền mặt" : "VNPay"}).
              {payment?.transactionReference ? ` Mã tham chiếu: ${payment.transactionReference}.` : ""}
              Hệ thống đã được phép thử phân công Staff tự động.
            </p>
          ) : pending ? (
            <p role="status">
              <strong>Chờ xác nhận thanh toán.</strong>{" "}
              {method === "cash"
                ? "Shop đã đăng ký trả tiền mặt. Sau khi nộp tiền và nhận biên nhận, Operations sẽ kiểm tra rồi xác nhận; Customer không thể tự xác nhận."
                : "Giao dịch VNPay đang chờ xử lý. Nếu đã rời trang VNPay, hãy kiểm tra lại trạng thái."}
            </p>
          ) : (
            <div className="form-grid">
              <label>
                Shop chọn phương thức trả trước
                <select value={choice} onChange={(event) => setChoice(event.target.value as Choice)}>
                  <option value="vnpay">VNPay (trực tuyến)</option>
                  <option value="cash">Tiền mặt tại điểm tiếp nhận (Operations xác nhận)</option>
                </select>
              </label>
              <p className="muted">
                {choice === "cash"
                  ? "Chỉ đăng ký nộp tiền mặt. Sau khi thực tế đã thu đủ phí và có mã biên nhận, Operations mới ghi nhận thanh toán."
                  : "Chuyển đến VNPay Sandbox để thanh toán đúng phí vận chuyển."}
              </p>
              <div className="actions">
                <button type="button" className="primary" disabled={busy} onClick={() => void startPayment()}>
                  {busy ? "Đang xử lý…" : choice === "cash"
                    ? "Đăng ký nộp tiền mặt"
                    : "Thanh toán phí ship qua VNPay"}
                </button>
              </div>
            </div>
          )}
          {payment?.status === "failed" && (
            <p className="muted">Giao dịch trước thất bại. Bạn có thể chọn phương thức thanh toán khác.</p>
          )}
          {notice && <p role="status">{notice}</p>}
          {error && <p role="alert">{error}</p>}
          <div className="actions">
            <button type="button" disabled={busy} onClick={() => void refresh()}>
              {busy ? "Đang kiểm tra…" : "Làm mới trạng thái thanh toán"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
