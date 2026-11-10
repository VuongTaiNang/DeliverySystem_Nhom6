import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAddress } from "../lib/geocoding";
import "./MapLocationPicker.css";

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

type Props = {
  label: string;
  address: string;
  value: MapCoordinate | null;
  onChange: (coordinate: MapCoordinate) => void;
  color?: string;
};

const DEFAULT_CENTER: L.LatLngExpression = [10.7769, 106.7009];

export default function MapLocationPicker({
  label,
  address,
  value,
  onChange,
  color = "#e65520",
}: Props) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [locationHint, setLocationHint] = useState("");
  const [tileStatus, setTileStatus] = useState("");
  const [manualCoordinates, setManualCoordinates] = useState("");
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;

    const map = L.map(elementRef.current, {
      scrollWheelZoom: false,
    }).setView(
      value
        ? [value.latitude, value.longitude]
        : DEFAULT_CENTER,
      value ? 15 : 12,
    );

    // Leaflet can render, pan and zoom even when a tile provider is offline.
    // Try the official OSM tiles first, and switch once to OSM France if
    // repeated tile errors occur. Both providers are intended for light demo
    // traffic only and have their own usage rules.
    const officialTiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    );
    const backupTiles = L.tileLayer(
      "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
      {
        subdomains: "abc",
        maxZoom: 20,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.openstreetmap.fr/">OSM France</a>',
      },
    );
    let officialErrors = 0;
    let backupErrors = 0;
    let fallbackActive = false;
    let officialTilesCompleted = false;
    let backupUnavailable = false;

    function enableFallback() {
      if (fallbackActive) return;
      fallbackActive = true;
      map.removeLayer(officialTiles);
      setTileStatus("Nguồn ảnh OpenStreetMap đang lỗi; đang chuyển sang OSM France...");
      backupTiles.addTo(map);
    }

    officialTiles.on("load", () => { officialTilesCompleted = true; });
    officialTiles.on("tileerror", () => {
      if (++officialErrors >= 3) enableFallback();
    });
    backupTiles.on("tileload", () => {
      if (!backupUnavailable) {
        setTileStatus("Đang dùng bản đồ dự phòng OSM France.");
      }
    });
    backupTiles.on("tileerror", () => {
      if (++backupErrors >= 3) {
        backupUnavailable = true;
        setTileStatus("Nguồn ảnh bản đồ dự phòng cũng bị lỗi hoặc chỉ tải một phần. Có thể đổi mạng/DNS hoặc nhập tọa độ thủ công từ Google Maps.");
      }
    });
    officialTiles.addTo(map);

    // A network may stall without emitting tileerror (e.g. unresolved DNS).
    const fallbackTimer = window.setTimeout(() => {
      if (!officialTilesCompleted) enableFallback();
    }, 7000);
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => map.invalidateSize({ pan: false }))
      : null;
    if (elementRef.current) resizeObserver?.observe(elementRef.current);

    map.on("click", (event: L.LeafletMouseEvent) => {
      setSearchError("");
      setLocationHint("Đã đánh dấu thủ công. Hãy kiểm tra điểm ghim đúng vị trí thực tế.");
      onChangeRef.current({
        latitude: Number(event.latlng.lat.toFixed(7)),
        longitude: Number(event.latlng.lng.toFixed(7)),
      });
    });

    mapRef.current = map;

    window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      window.clearTimeout(fallbackTimer);
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    if (!value) {
      if (markerRef.current) {
        markerRef.current.remove();
      }

      markerRef.current = null;
      return;
    }

    const point: L.LatLngExpression = [
      value.latitude,
      value.longitude,
    ];

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(point, {
        radius: 9,
        color,
        fillColor: color,
        fillOpacity: 0.9,
      }).addTo(map);
    } else {
      markerRef.current
        .setLatLng(point)
        .setStyle({
          color,
          fillColor: color,
        });
    }

    map.panTo(point);
  }, [value, color]);

  async function searchAddress() {
    const keyword = address.trim();

    if (!keyword) {
      setSearchError("Vui lòng nhập địa chỉ trước.");
      return;
    }

    setSearching(true);
    setSearchError("");
    setLocationHint("");

    try {
      const result = await geocodeAddress(keyword);

      const coordinate = {
        latitude: Number(result.latitude.toFixed(7)),
        longitude: Number(result.longitude.toFixed(7)),
      };

      onChangeRef.current(coordinate);
      setLocationHint(
        result.approximate
          ? "Kết quả tìm kiếm chỉ là vị trí ước tính. Hãy kiểm tra ghim trên bản đồ và nhấp lại nếu chưa đúng số nhà."
          : "Đã tìm thấy tọa độ. Hãy kiểm tra ghim trên bản đồ trước khi tính phí.",
      );

      mapRef.current?.setView(
        [coordinate.latitude, coordinate.longitude],
        16,
      );
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "Không thể tìm địa chỉ.",
      );
      setLocationHint("Bạn vẫn có thể phóng to và nhấp trực tiếp lên bản đồ để chọn tọa độ.");
    } finally {
      setSearching(false);
    }
  }

  function applyManualCoordinates() {
    const pieces = manualCoordinates.trim()
      .replace(/[()]/g, "")
      .split(/[,;\s]+/)
      .filter(Boolean);
    const latitude = Number(pieces[0]);
    const longitude = Number(pieces[1]);
    if (
      pieces.length !== 2 || !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      setManualError("Nhập theo dạng: 10.7769, 106.7009 (vĩ độ, kinh độ).");
      return;
    }
    setManualError("");
    setSearchError("");
    setLocationHint("Đã nhập tọa độ thủ công. Hãy kiểm tra chính xác địa chỉ giao/lấy hàng.");
    onChangeRef.current({
      latitude: Number(latitude.toFixed(7)),
      longitude: Number(longitude.toFixed(7)),
    });
    mapRef.current?.setView([latitude, longitude], 16);
  }

  return (
    <section className="map-picker">
      <div className="map-picker__heading">
        <strong>{label}</strong>

        <span>
          Nhập địa chỉ để tìm, hoặc phóng to và nhấp trực tiếp vào điểm giao/lấy hàng
        </span>
      </div>

      <div className="map-picker__search">
        <div className="map-picker__address-preview">
          {address.trim()
            ? address
            : "Chưa nhập địa chỉ"}
        </div>

        <button
          type="button"
          onClick={searchAddress}
          disabled={searching || !address.trim()}
        >
          {searching
            ? "Đang tìm..."
            : "Tìm trên bản đồ"}
        </button>
      </div>

      {searchError && (
        <p className="map-picker__error" role="alert">
          {searchError}
        </p>
      )}
      {locationHint && <p className="map-picker__hint" role="status">{locationHint}</p>}
      {tileStatus && <p className="map-picker__hint" role="status">{tileStatus}</p>}

      <div
        className="map-picker__map"
        ref={elementRef}
      />

      <div className="map-picker__coordinates">
        {value ? (
          <>
            Vĩ độ: <code>{value.latitude}</code>
            {" · "}
            Kinh độ: <code>{value.longitude}</code>
          </>
        ) : (
          "Chưa chọn vị trí – hãy nhấp vào bản đồ để đánh dấu điểm lấy/giao hàng."
        )}
      </div>
      <details className="map-picker__manual">
        <summary>Nếu không tải được bản đồ, nhập tọa độ từ Google Maps</summary>
        <div className="map-picker__manual-row">
          <input
            type="text"
            value={manualCoordinates}
            placeholder="Ví dụ: 10.7769, 106.7009"
            aria-label={`Tọa độ thủ công cho ${label}`}
            onChange={(event) => setManualCoordinates(event.target.value)}
          />
          <button type="button" onClick={applyManualCoordinates}>
            Dùng tọa độ này
          </button>
        </div>
        {manualError && <p className="map-picker__error" role="alert">{manualError}</p>}
      </details>
    </section>
  );
}
