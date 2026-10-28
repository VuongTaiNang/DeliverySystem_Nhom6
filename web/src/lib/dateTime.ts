export function normalizeUtcDateTime(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/Z$/i.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}Z`;
}

export function formatVietnamDateTime(value?: string | null): string {
  const normalized = normalizeUtcDateTime(value);
  if (!normalized) return "—";

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  });
}

export function formatVietnamDate(value?: string | null): string {
  const normalized = normalizeUtcDateTime(value);
  if (!normalized) return "—";

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}
