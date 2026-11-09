import { useEffect, useState } from "react";
import { api } from "./api";
import type { ComplaintHistoryItem } from "./api";
import { formatVietnamDateTime } from "./lib/dateTime";

const ACTION_LABEL: Record<string, string> = {
  created: "Đã tiếp nhận",
  classified: "Đã phân loại",
  processing: "Bắt đầu xử lý",
  resolved: "Đã giải quyết",
};
const ROLE_LABEL: Record<string, string> = {
  customer: "Khách hàng",
  staff: "Nhân viên giao hàng",
  operations: "Bộ phận vận hành",
};

export default function ComplaintTimeline({ complaintId }: { complaintId: number }) {
  const [items, setItems] = useState<ComplaintHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .getComplaintHistory(complaintId)
      .then((data) => active && setItems(data))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Không tải được lịch sử."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [complaintId]);

  if (loading) return <p>Đang tải lịch sử xử lý...</p>;
  if (error) return <p role="alert" className="error">{error}</p>;
  if (items.length === 0) return <p>Chưa có lịch sử xử lý.</p>;

  return (
    <ol className="complaint-timeline">
      {items.map((h) => (
        <li key={h.id}>
          <strong>{ACTION_LABEL[h.action] ?? h.action}</strong>
          <span> · {ROLE_LABEL[h.actorRole] ?? h.actorRole} · {formatVietnamDateTime(h.createdAt)}</span>
          {h.note && <p>{h.note}</p>}
        </li>
      ))}
    </ol>
  );
}