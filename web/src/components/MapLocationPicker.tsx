import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { request } from "../lib/http";
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

type GeocodingResult = {
  latitude: number;
  longitude: number;
  displayName?: string;
  source?: "nominatim" | "photon";
  approximate?: boolean;
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

    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    ).addTo(map);

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
      const result = await request<GeocodingResult>(
        `/geocoding/search?q=${encodeURIComponent(keyword)}`,
      );

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
    </section>
  );
}
