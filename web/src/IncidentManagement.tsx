import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  api,
  INCIDENT_STATUSES,
  COMPLAINT_CATEGORIES,
  STAFF_INCIDENT_CATEGORIES,
  typeLabel,
} from "./api";
import type {
  Incident,
  IncidentStatus,
  ComplaintCategory,
} from "./api";
import ComplaintTimeline from "./ComplaintTimeline";
import { formatVietnamDateTime } from "./lib/dateTime";

type IncidentSource = "" | "customer" | "staff";

async function withRequestTimeout<T>(request: Promise<T>, milliseconds = 12000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Tải danh sách quá thời gian cho phép. Hãy kiểm tra Backend rồi thử lại.")),
      milliseconds,
    );
  });
  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export default function IncidentManagement() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<IncidentStatus | "">("");
  const [source, setSource] = useState<IncidentSource>("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);
  const selectedIdRef = useRef<number | null>(null);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    let active = true;

    async function load(showLoading = false) {
      if (showLoading) setLoading(true);
      setLoadError("");

      try {
        const data = await withRequestTimeout(api.listAllIncidents(source || undefined));
        if (active) setIncidents(data);
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Không tải được danh sách sự cố."
          );
        }
      } finally {
        if (active && showLoading) setLoading(false);
      }
    }

    void load(true);

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden" && selectedIdRef.current === null) {
        void load(false);
      }
    }, 12000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [reload, source]);

  const term = search.trim().toLocaleLowerCase("vi");

  const visible = incidents.filter((incident) => {
    const matchesStatus = !filter || incident.status === filter;
    const values = [
      incident.shipmentId,
      incident.content,
      typeLabel(incident.type),
    ];
    const matchesSearch =
      !term ||
      values.some((value) =>
        value.toLocaleLowerCase("vi").includes(term)
      );

    return matchesStatus && matchesSearch;
  });

  const selected = incidents.find((item) => item.id === selectedId);

  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Tiếp nhận và xử lý sự cố</h2>
            <p className="muted">
              Theo dõi báo cáo, cập nhật trạng thái và phản hồi cho khách hàng.
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => setReload((current) => current + 1)}
          >
            {loading ? "Đang tải…" : "Tải lại"}
          </button>
        </div>

        {success && (
          <div className="notice success" role="status">
            {success}
          </div>
        )}

        {loadError && (
          <div className="notice error" role="alert">
            {loadError}
          </div>
        )}

        <div className="tabs">
          {(
            [
              ["", "Tất cả"],
              ["customer", "Khiếu nại khách hàng"],
              ["staff", "Sự cố nhân viên"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={source === value ? "active" : ""}
              onClick={() => setSource(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="filters">
          <input
            aria-label="Tìm báo cáo sự cố"
            placeholder="Mã vận đơn, nội dung hoặc loại sự cố…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            aria-label="Lọc trạng thái xử lý"
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as IncidentStatus | "")
            }
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(INCIDENT_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {loading && incidents.length === 0 ? (
          <p role="status">Đang tải báo cáo…</p>
        ) : visible.length === 0 ? (
          <div className="empty">
            <h3>Không có báo cáo phù hợp</h3>
            <p>
              Báo cáo được tạo từ phần Sự cố và khiếu nại trong chi tiết vận đơn.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Vận đơn</th>
                  <th>Loại sự cố</th>
                  <th>Ngày báo cáo</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {visible.map((incident) => (
                  <tr key={incident.id}>
                    <td>
                      <strong className="tracking-code">
                        {incident.shipmentId}
                      </strong>
                    </td>
                    <td>{typeLabel(incident.type)}</td>
                    <td>{formatVietnamDateTime(incident.createdAt)}</td>
                    <td>
                      <span className={`badge incident-${incident.status}`}>
                        {INCIDENT_STATUSES[incident.status]}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={Boolean(selected)}
                        onClick={() => setSelectedId(incident.id)}
                      >
                        Xem báo cáo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <IncidentEditor
          key={`${selected.id}-${selected.status}`}
          incident={selected}
          onClose={() => setSelectedId(null)}
          onSaved={(updated) => {
            setIncidents((current) =>
              current.map((item) =>
                item.id === updated.id ? updated : item
              )
            );
            setSelectedId(null);
            setSuccess(
              `Đã cập nhật báo cáo: ${INCIDENT_STATUSES[updated.status]}.`
            );
          }}
          onClassified={() => {
            setSuccess("Đã cập nhật phân loại.");
            setReload((current) => current + 1);
          }}
          onClassifyError={(message) => setLoadError(message)}
        />
      )}
    </>
  );
}

interface IncidentEditorProps {
  incident: Incident;
  onClose: () => void;
  onSaved: (incident: Incident) => void;
  onClassified: () => void;
  onClassifyError: (message: string) => void;
}

function IncidentEditor({
  incident,
  onClose,
  onSaved,
  onClassified,
  onClassifyError,
}: IncidentEditorProps) {
  const isStaffIncident = incident.source === "staff";
  const categories = isStaffIncident ? STAFF_INCIDENT_CATEGORIES : COMPLAINT_CATEGORIES;
  const categoryName = incident.category == null ? "" :
    (categories as Record<string, string>)[incident.category] ??
    (COMPLAINT_CATEGORIES as Record<string, string>)[incident.category] ??
    incident.category;
  const [response, setResponse] = useState(incident.response ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || incident.status === "resolved") return;

    const nextStatus: "processing" | "resolved" =
      incident.status === "pending" ? "processing" : "resolved";
    const cleanResponse = response.trim();

    if (nextStatus === "resolved" && !cleanResponse) {
      setError("Vui lòng nhập kết quả giải quyết trước khi hoàn tất.");
      return;
    }

    if (cleanResponse.length > 1000) {
      setError("Kết quả giải quyết không được vượt quá 1.000 ký tự.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const updated = await api.updateIncident(incident.id, {
        status: nextStatus,
        response: nextStatus === "resolved" ? cleanResponse : "",
      });
      onSaved(updated);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không cập nhật được báo cáo."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleClassify(value: string) {
    try {
      await api.classifyComplaint(
        incident.id,
        value as ComplaintCategory
      );
      onClassified();
    } catch (err) {
      onClassifyError(
        err instanceof Error
          ? err.message
          : "Không cập nhật được phân loại."
      );
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{isStaffIncident ? "Sự cố nhân viên" : "Khiếu nại khách hàng"}: {typeLabel(incident.type)}</h2>
          <p className="muted tracking-code">
            Vận đơn: {incident.shipmentId}
          </p>
        </div>

        <button type="button" disabled={busy} onClick={onClose}>
          Đóng
        </button>
      </div>

      <div className="incident-card">
        <span className={`badge incident-${incident.status}`}>
          {INCIDENT_STATUSES[incident.status]}
        </span>

        <p className="incident-description">{incident.content}</p>

        <time className="muted" dateTime={incident.createdAt}>
          Gửi lúc: {formatVietnamDateTime(incident.createdAt)}
        </time>
      </div>

      <div className="incident-editor-space">
        <label>
          {isStaffIncident ? "Nhóm nguyên nhân sự cố" : "Phân loại khiếu nại"}
          <select
            value={incident.category ?? ""}
            disabled={incident.status === "resolved"}
            onChange={(event) => void handleClassify(event.target.value)}
          >
            <option value="" disabled>
              -- Chọn phân loại --
            </option>
            {incident.category && !(incident.category in categories) && (
              <option value={incident.category}>
                {categoryName} (phân loại trước đây)
              </option>
            )}
            {Object.entries(categories).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="incident-editor-space">
        <h4>Lịch sử xử lý</h4>
        <ComplaintTimeline
          key={`${incident.id}-${incident.status}-${incident.category}`}
          complaintId={incident.id}
        />
      </div>

      {incident.status === "resolved" ? (
        <div className="incident-resolution incident-editor-space">
          <strong>Kết quả giải quyết</strong>
          <p>{incident.response || "Không có nội dung phản hồi."}</p>

          {incident.resolvedAt && (
            <time className="muted" dateTime={incident.resolvedAt}>
              Giải quyết lúc: {formatVietnamDateTime(incident.resolvedAt)}
            </time>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="incident-editor-space">
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}

          <fieldset disabled={busy}>
            {incident.status === "pending" ? (
              <p className="muted">
                {isStaffIncident
                  ? "Tiếp nhận báo cáo của Staff để kiểm tra nguyên nhân, hỗ trợ giao nhận và chuyển sang trạng thái"
                  : "Bắt đầu xử lý để chuyển khiếu nại sang trạng thái"}{" "}
                <strong>Đang xử lý</strong>.
              </p>
            ) : (
              <label>
                Kết quả giải quyết
                <textarea
                  rows={4}
                  value={response}
                  maxLength={1000}
                  required
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder={isStaffIncident
                    ? "Hướng xử lý sự cố, hỗ trợ Staff và kết quả thực hiện…"
                    : "Mô tả nguyên nhân, biện pháp và kết quả xử lý…"}
                />
                <span className="muted">
                  {response.length}/1.000 ký tự
                </span>
              </label>
            )}

            <div className="actions incident-submit">
              <button
                type="submit"
                className="primary"
                disabled={
                  incident.status === "processing" && !response.trim()
                }
              >
                {busy
                  ? "Đang lưu…"
                  : incident.status === "pending"
                    ? "Bắt đầu xử lý"
                    : "Hoàn tất giải quyết"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
