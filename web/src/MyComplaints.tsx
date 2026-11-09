import { useEffect, useState } from "react";
import { api, INCIDENT_STATUSES, typeLabel } from "./api";
import type { Incident } from "./api";
import ComplaintTimeline from "./ComplaintTimeline";
import { formatVietnamDateTime } from "./lib/dateTime";

export default function MyComplaints() {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listMyComplaints()
      .then((d) => active && setItems(d))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Không tải được danh sách khiếu nại."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <p>Đang tải...</p>;
  if (error) return <p role="alert" className="error">{error}</p>;
  if (items.length === 0) return <p>Bạn chưa có khiếu nại nào.</p>;

  return (
    <section>
      <h2>Khiếu nại của tôi</h2>
      {items.map((c) => (
        <article key={c.id} className="card">
          <header>
            <strong>#{c.id} · Đơn {c.shipmentId}</strong>
            <span className={`badge badge-${c.status}`}>{INCIDENT_STATUSES[c.status]}</span>
          </header>
          <p>{typeLabel(c.type)} · {formatVietnamDateTime(c.createdAt)}</p>
          <p>{c.content}</p>
          {c.response && <p><b>Kết quả xử lý:</b> {c.response}</p>}
          <button type="button" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
            {openId === c.id ? "Ẩn lịch sử" : "Xem lịch sử xử lý"}
          </button>
          {openId === c.id && <ComplaintTimeline complaintId={c.id} />}
        </article>
      ))}
    </section>
  );
}