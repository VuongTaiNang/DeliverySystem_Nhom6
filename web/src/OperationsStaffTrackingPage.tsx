import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { listStaffTracking } from "./operationsStaffTrackingApi";
import type { StaffTrackingItem } from "./operationsStaffTrackingApi";
import { formatVietnamDateTime } from "./lib/dateTime";
import "./OperationsStaffTrackingPage.css";

const center: L.LatLngExpression = [10.7769, 106.7009];
const text = (item: StaffTrackingItem) => `${item.employeeCode} · ${item.staffName}`;

function TrackingMap({ items, selectedId }: { items: StaffTrackingItem[]; selectedId: number | null }) {
  const element = useRef<HTMLDivElement | null>(null); const map = useRef<L.Map | null>(null); const layer = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (!element.current || map.current) return;
    map.current = L.map(element.current).setView(center, 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const current = map.current; if (!current) return;
    layer.current?.remove(); const next = L.layerGroup();
    const points: L.LatLngExpression[] = [];
    for (const item of items) {
      const staffPoint: L.LatLngExpression = [item.latitude, item.longitude]; points.push(staffPoint);
      L.circleMarker(staffPoint, { radius: item.staffId === selectedId ? 11 : 8, color: item.isStale || !item.isAssignmentActive ? "#8b5e34" : "#113e30", fillColor: item.isStale || !item.isAssignmentActive ? "#f4c07a" : "#d95625", fillOpacity: 1, weight: 3 }).bindPopup(`<strong>${text(item)}</strong><br>${item.shipmentId}<br>${item.distanceKm == null ? "Chưa có tọa độ điểm đến" : `${item.distanceKm} km · ETA ${item.etaMinutes} phút`}`).addTo(next);
      if (item.targetLatitude != null && item.targetLongitude != null) {
        const target: L.LatLngExpression = [item.targetLatitude, item.targetLongitude]; points.push(target);
        L.circleMarker(target, { radius: 7, color: "#2e6c55", fillColor: "#eafa9a", fillOpacity: 1, weight: 2 }).bindPopup(`<strong>${item.targetType === "pickup" ? "Điểm lấy hàng" : "Điểm giao hàng"}</strong><br>${item.targetAddress}`).addTo(next);
        L.polyline([staffPoint, target], { color: "#d95625", weight: 2, dashArray: "5 7" }).addTo(next);
      }
    }
    next.addTo(current); layer.current = next;
    if (points.length === 1) current.setView(points[0], 15); else if (points.length > 1) current.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 14 });
  }, [items, selectedId]);
  return <div className="staff-tracking-map" ref={element} aria-label="Bản đồ vị trí Staff" />;
}

export default function OperationsStaffTrackingPage() {
  const [items, setItems] = useState<StaffTrackingItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selectedId, setSelectedId] = useState<number | null>(null);
  async function load() { setLoading(true); setError(""); try { const data = await listStaffTracking(); setItems(data); setSelectedId(current => current && data.some(x => x.staffId === current) ? current : data[0]?.staffId ?? null); } catch (e) { setError(e instanceof Error ? e.message : "Không tải được vị trí Staff."); } finally { setLoading(false); } }
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30000); return () => window.clearInterval(timer); }, []);
  return <div className="staff-tracking-page">
    <section className="panel staff-tracking-hero"><div><p className="eyebrow">OPERATIONS · THEO DÕI GPS</p><h2>Vị trí Staff và ETA</h2><p className="muted">Dữ liệu chỉ xuất hiện khi Staff chủ động chia sẻ vị trí cho nhiệm vụ đã nhận. Tự làm mới mỗi 30 giây.</p></div><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Đang tải…" : "Làm mới"}</button></section>
    {error && <div className="notice error" role="alert">{error}</div>}
    {loading && !items.length ? <p role="status">Đang tải vị trí Staff…</p> : items.length === 0 ? <section className="panel empty"><h3>Chưa có vị trí được chia sẻ</h3><p>Staff cần nhận nhiệm vụ và chủ động bật chia sẻ vị trí trên Mobile.</p></section> : <div className="staff-tracking-grid">
      <section className="panel"><TrackingMap items={items} selectedId={selectedId} /><p className="staff-tracking-legend"><span>●</span> Staff · <i>●</i> Điểm lấy/giao · đường nét đứt là khoảng cách đường chim bay</p></section>
      <section className="staff-tracking-list" aria-label="Danh sách Staff đang theo dõi">{items.map(item => <button type="button" className={`staff-tracking-card ${selectedId === item.staffId ? "selected" : ""}`} key={item.staffId} onClick={() => setSelectedId(item.staffId)}><div><strong>{text(item)}</strong><span>{item.shipmentId} · {item.targetType === "pickup" ? "Đang đến điểm lấy" : "Đang đến điểm giao"}</span></div><dl><div><dt>Khoảng cách</dt><dd>{item.distanceKm == null ? "Chưa có tọa độ" : `${item.distanceKm} km`}</dd></div><div><dt>ETA</dt><dd>{item.etaMinutes == null ? "—" : `${item.etaMinutes} phút`}</dd></div></dl><p>{item.targetAddress}</p><small className={item.isStale ? "stale" : ""}>{item.isStale ? "Vị trí cũ" : "Cập nhật"}: {formatVietnamDateTime(item.updatedAt)}{item.accuracyMeters != null ? ` · ±${Math.round(item.accuracyMeters)} m` : ""}</small>{item.etaAssumption && <small>{item.etaAssumption}</small>}</button>)}</section>
    </div>}
  </div>;
}
