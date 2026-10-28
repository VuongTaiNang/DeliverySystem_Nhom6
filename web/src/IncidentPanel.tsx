import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, INCIDENT_STATUSES, INCIDENT_TYPES } from "./api";
import type { Incident, IncidentType } from "./api";
import { formatVietnamDateTime } from "./lib/dateTime";

interface IncidentPanelProps {
  shipmentId: string;
}

export default function IncidentPanel({ shipmentId }: IncidentPanelProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [type, setType] = useState<IncidentType>("damaged");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);
  const submitting = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!submitError) return;
    const timer = window.setTimeout(() => setSubmitError(""), 4500);
    return () => window.clearTimeout(timer);
  }, [submitError]);

  useEffect(() => {
    let active = true;

    const load = async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      setLoadError("");

      try {
        const data = await api.listIncidents(shipmentId);
        if (active) setIncidents(data);
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Không tải được danh sách sự cố.",
          );
        }
      } finally {
        if (active && showLoading) setLoading(false);
      }
    };

    void load(true);

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden" && !submitting.current) {
        void load(false);
      }
    }, 10000);

    const onFocus = () => void load(false);
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [shipmentId, reload]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const cleanContent = content.trim();
    if (cleanContent.length < 10) {
      setSubmitError("Nội dung sự cố phải có ít nhất 10 ký tự.");
      return;
    }
    if (cleanContent.length > 1000) {
      setSubmitError("Nội dung sự cố không được vượt quá 1.000 ký tự.");
      return;
    }

    submitting.current = true;
    setSaving(true);
    setSubmitError("");
    setSuccess("");

    try {
      const incident = await api.createIncident(shipmentId, {
        type,
        content: cleanContent,
      });

      if (!mounted.current) return;
      setIncidents((current) => [incident, ...current]);
      setContent("");
      setSuccess("Đã gửi báo cáo sự cố. Bạn có thể theo dõi trạng thái bên dưới.");
    } catch (error) {
      if (!mounted.current) return;
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Không gửi được báo cáo sự cố.",
      );
    } finally {
      submitting.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <section className="incident-section">
      <div className="panel-heading">
        <div>
          <h2>Sự cố và khiếu nại</h2>
          <p className="muted">
            Báo cáo vấn đề liên quan đến vận đơn đang xem.
          </p>
        </div>
      </div>

      {submitError && (
        <div className="notice error" role="alert">
          {submitError}
        </div>
      )}

      {success && (
        <div className="notice success" role="status">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset disabled={saving}>
          <div className="form-grid">
            <label>
              Loại sự cố
              <select
                value={type}
                onChange={(event) =>
                  setType(event.target.value as IncidentType)
                }
              >
                {Object.entries(INCIDENT_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="full">
              Nội dung sự cố
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Mô tả vấn đề và thông tin cần hỗ trợ…"
                rows={4}
                minLength={10}
                maxLength={1000}
                required
              />
              <span className="muted">
                {content.length}/1.000 ký tự · Tối thiểu 10 ký tự
              </span>
            </label>
          </div>

          <div className="actions incident-submit">
            <button
              type="submit"
              className="primary"
              disabled={saving || content.trim().length < 10}
            >
              {saving ? "Đang gửi…" : "Gửi báo cáo"}
            </button>
          </div>
        </fieldset>
      </form>

      <div className="incident-history">
        <div className="panel-heading">
          <h3>Lịch sử báo cáo</h3>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => setReload((current) => current + 1)}
          >
            {loading ? "Đang tải…" : "Làm mới trạng thái"}
          </button>
        </div>

        {loadError && (
          <div className="notice error" role="alert">
            {loadError}
          </div>
        )}

        {loading && incidents.length === 0 ? (
          <p className="muted" role="status">
            Đang tải báo cáo…
          </p>
        ) : incidents.length === 0 ? (
          <p className="muted">Đơn hàng này chưa có báo cáo sự cố.</p>
        ) : (
          <ul className="incident-list">
            {incidents.map((incident) => (
              <li key={incident.id} className="incident-card">
                <div className="incident-card-heading">
                  <strong>{INCIDENT_TYPES[incident.type]}</strong>
                  <span className={`badge incident-${incident.status}`}>
                    {INCIDENT_STATUSES[incident.status]}
                  </span>
                </div>

                <time className="muted" dateTime={incident.createdAt}>
                  {formatVietnamDateTime(incident.createdAt)}
                </time>

                <p className="incident-description">{incident.content}</p>

                {incident.response && (
                  <div className="incident-resolution">
                    <strong>Phản hồi từ Operations</strong>
                    <p>{incident.response}</p>
                    {incident.resolvedAt && (
                      <small className="muted">
                        Đã giải quyết: {formatVietnamDateTime(incident.resolvedAt)}
                      </small>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
