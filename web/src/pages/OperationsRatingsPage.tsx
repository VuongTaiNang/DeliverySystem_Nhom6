import { useEffect, useMemo, useState } from "react";
import { request } from "../lib/http";
import { formatVietnamDateTime } from "../lib/dateTime";
import "./OperationsRatingsPage.css";

type DeliveryRating = {
  id: number;
  shipmentId: string;
  customerId: number;
  score: number;
  comment: string;
  createdAt: string;
  updatedAt: string | null;
  service: string;
};

export default function OperationsRatingsPage() {
  const [ratings, setRatings] = useState<DeliveryRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    request<DeliveryRating[]>("/operations/ratings")
      .then((rows) => { if (active) setRatings(rows); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Không tải được đánh giá.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const average = ratings.length === 0
    ? "—"
    : (ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length).toFixed(1);
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("vi");
    return ratings.filter((rating) => !term ||
      [rating.shipmentId, rating.comment, rating.service, String(rating.customerId)]
        .some((value) => value.toLocaleLowerCase("vi").includes(term)));
  }, [ratings, search]);

  return (
    <div className="operations-ratings">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Đánh giá dịch vụ</h2>
            <p className="muted">Phản hồi khách hàng sau khi giao hàng thành công. Hiển thị tối đa 200 đánh giá gần nhất.</p>
          </div>
          <button type="button" disabled={loading} onClick={() => setReload((n) => n + 1)}>
            {loading ? "Đang tải…" : "Tải lại"}
          </button>
        </div>
        {error && <p role="alert" className="muted">Không thể tải dữ liệu: {error}</p>}
        <div className="ratings-summary">
          <div><span>Số đánh giá hiển thị</span><strong>{ratings.length}</strong></div>
          <div><span>Điểm trung bình</span><strong>{average} / 5 ★</strong></div>
        </div>
        <label className="ratings-search">
          Tìm đánh giá
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo mã vận đơn, nội dung hoặc dịch vụ…"
          />
        </label>
        {loading && ratings.length === 0 ? <p>Đang tải đánh giá…</p> :
         visible.length === 0 ? <p className="muted">Chưa có đánh giá phù hợp.</p> :
        <div className="ratings-table-wrapper">
          <table className="ratings-table">
            <thead><tr>
              <th>Vận đơn</th><th>Điểm</th><th>Nhận xét</th><th>Dịch vụ</th><th>Ngày gửi / cập nhật</th>
            </tr></thead>
            <tbody>
              {visible.map((rating) => <tr key={rating.id}>
                <td><strong>{rating.shipmentId}</strong></td>
                <td>
                  <span className="ratings-stars" aria-label={String(rating.score) + " trên 5 sao"}>
                    {Array.from({ length: 5 }, (_, i) => i < rating.score ? "★" : "☆").join("")}
                  </span>
                </td>
                <td>{rating.comment || "Không có nhận xét"}</td>
                <td>{rating.service}</td>
                <td>{formatVietnamDateTime(rating.updatedAt ?? rating.createdAt)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </section>
    </div>
  );
}
