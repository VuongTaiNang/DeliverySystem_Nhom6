import { useEffect, useState } from "react";
import { ApiError, request } from "./lib/http";
import "./CustomerRating.css";

type DeliveryRating = {
  score: number;
  comment: string | null;
};

// Chỉ mount thành phần này cho đơn đã giao thành công của Customer.
export default function CustomerRating({ shipmentId }: { shipmentId: string }) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [hasRating, setHasRating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const endpoint = "/customer/shipments/" + encodeURIComponent(shipmentId) + "/rating";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    setError("");
    setMessage("");
    setHasRating(false);
    setScore(5);
    setComment("");

    request<DeliveryRating>(endpoint)
      .then((rating) => {
        if (!active) return;
        setHasRating(true);
        setScore(Math.min(5, Math.max(1, rating.score)));
        setComment(rating.comment ?? "");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 404) {
          // Đơn hợp lệ chưa có đánh giá: khách hàng có thể gửi đánh giá mới.
          return;
        }
        setLoadFailed(true);
        setError(reason instanceof Error ? reason.message : "Không tải được đánh giá.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [endpoint, refreshKey]);

  async function submit() {
    if (saving || loading || loadFailed) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await request<unknown>(endpoint, {
        method: hasRating ? "PUT" : "POST",
        body: JSON.stringify({ score, comment: comment.trim() }),
      });
      setHasRating(true);
      setMessage(hasRating ? "Đã cập nhật đánh giá thành công." : "Đã gửi đánh giá thành công.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được đánh giá. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="customer-rating" aria-label="Đánh giá dịch vụ giao hàng">
      <div className="customer-rating__heading">
        <div>
          <h3>Đánh giá dịch vụ giao hàng</h3>
          <p className="muted">
            {hasRating ? "Bạn có thể cập nhật đánh giá của đơn hàng này." : "Bạn hài lòng với dịch vụ giao hàng chứ?"}
          </p>
        </div>
        {hasRating && <span className="customer-rating__saved">Đã đánh giá</span>}
      </div>

      {loading ? (
        <p role="status">Đang tải đánh giá…</p>
      ) : loadFailed ? (
        <div>
          <p role="alert" className="customer-rating__error">{error}</p>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Thử tải lại</button>
        </div>
      ) : (
        <>
          <div className="customer-rating__stars" role="group" aria-label="Chọn số sao đánh giá">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={value <= score ? "customer-rating__star is-active" : "customer-rating__star"}
                aria-label={value + " sao"}
                aria-pressed={score === value}
                disabled={saving}
                onClick={() => setScore(value)}
              >
                {value <= score ? "★" : "☆"}
              </button>
            ))}
            <span className="customer-rating__score">{score}/5 sao</span>
          </div>
          <label className="customer-rating__label" htmlFor="customer-rating-comment">
            Nhận xét (không bắt buộc)
          </label>
          <textarea
            id="customer-rating-comment"
            rows={3}
            maxLength={1000}
            value={comment}
            disabled={saving}
            placeholder="Chia sẻ trải nghiệm của bạn…"
            onChange={(event) => setComment(event.target.value)}
          />
          {error && <p role="alert" className="customer-rating__error">{error}</p>}
          {message && <p role="status" className="customer-rating__success">{message}</p>}
          <button type="button" className="primary customer-rating__submit" disabled={saving} onClick={() => void submit()}>
            {saving ? "Đang lưu đánh giá…" : hasRating ? "Cập nhật đánh giá" : "Gửi đánh giá"}
          </button>
        </>
      )}
    </section>
  );
}
