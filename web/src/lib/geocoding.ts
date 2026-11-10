import { request } from "./http";

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName?: string;
  source?: "nominatim" | "photon";
  approximate?: boolean;
}

/**
 * One user-initiated geocoding request per completed address. No live
 * autocomplete against community-hosted Nominatim / Photon endpoints.
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  const text = address.trim();
  if (text.length < 6) {
    throw new Error("Vui lòng nhập địa chỉ lấy/giao hàng chi tiết hơn trước khi định vị.");
  }

  const result = await request<GeocodingResult>(
    `/geocoding/search?q=${encodeURIComponent(text)}`,
  );

  const { latitude, longitude } = result;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 ||
    longitude < -180 || longitude > 180
  ) {
    throw new Error("Dịch vụ tìm địa chỉ trả về tọa độ không hợp lệ.");
  }

  return result;
}
