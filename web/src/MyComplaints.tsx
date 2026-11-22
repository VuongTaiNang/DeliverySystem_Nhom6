import { useEffect, useState } from "react";
import { api, INCIDENT_STATUSES, typeLabel } from "./api";
import type { Incident } from "./api";
import ComplaintTimeline from "./ComplaintTimeline";
import { formatVietnamDateTime } from "./lib/dateTime";
import "./MyComplaints.css";

export default function MyComplaints() {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listMyComplaints()
      .then((data) => { if (active) setItems(data); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Không tải được danh sách khiếu nại.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <p role="status">Đang tải khiếu nại…</p>;
  if (error) return <p role="alert" className="error">{error}</p>;

  return (
    <section className="my-complaints">
      <div className="my-complaints__heading">
        <h2>Khiếu nại của tôi</h2>
        <span className="muted">{items.length} khiếu nại</span>
      </div>
      {items.length === 0 ? (
        <p className="my-complaints__empty">Bạn chưa có khiếu nại nào.</p>
      ) : (
        <div className="my-complaints__list">
          {items.map((complaint) => (
            <article key={complaint.id} className="complaint-card">
              <header className="complaint-card__header">
                <div>
                  <h3>Khiếu nại #{complaint.id}</h3>
                  <p className="complaint-card__order">Mã vận đơn: {complaint.shipmentId}</p>
                </div>
                <span className={"complaint-status complaint-status--" + complaint.status}>
                  {INCIDENT_STATUSES[complaint.status] ?? "Chưa xác định"}
                </span>
              </header>
              <dl className="complaint-card__details">
                <div><dt>Loại khiếu nại</dt><dd>{typeLabel(complaint.type)}</dd></div>
                <div><dt>Ngày gửi</dt><dd>{formatVietnamDateTime(complaint.createdAt)}</dd></div>
                <div className="complaint-card__full"><dt>Mô tả</dt><dd>{complaint.content}</dd></div>
                {complaint.response && (
                  <div className="complaint-card__resolution complaint-card__full">
                    <dt>Kết quả xử lý</dt><dd>{complaint.response}</dd>
                  </div>
                )}
              </dl>
              <div className="complaint-card__footer">
                <button
                  type="button"
                  className="complaint-card__history-button"
                  aria-expanded={openId === complaint.id}
                  onClick={() => setOpenId(openId === complaint.id ? null : complaint.id)}
                >
                  {openId === complaint.id ? "Ẩn lịch sử xử lý" : "Xem lịch sử xử lý"}
                </button>
              </div>
              {openId === complaint.id && (
                <div className="complaint-card__timeline">
                  <ComplaintTimeline complaintId={complaint.id} />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
